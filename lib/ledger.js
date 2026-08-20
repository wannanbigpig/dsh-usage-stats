/**
 * dsh-usage-stats — call-level ledger.
 *
 * Records one entry per llm/stream model call attributed by COMPLETION time
 * (the moment the usage chunk is reported; `completedAt`, falling back to
 * `occurredAt` for legacy entries), so hourly buckets and peak/off-peak cost
 * attribution match the provider's billing basis (usage report time) instead
 * of the request start time. A request that starts at 17:59 and reports usage
 * at 18:01 is billed in the 18:00 idle hour, exactly like the official usage
 * page.
 *
 * The ledger folds through the SAME usage engine as session events by
 * projecting each entry to a synthetic `assistant/message` event whose
 * `time` is the attribution time — reusing replace-last-sample semantics,
 * provider/model attribution, hourly buckets, and renderUsage unchanged.
 *
 * Pure module (no cordis imports) so it can be unit-tested offline.
 *
 * @module dsh-usage-stats/ledger
 */

import { costOf, dayKey, defaultPricing, foldUsage, hourKey, renderUsage, roundCost } from "./usage.js";

/** Normalize one provider usage into bucket fields (missing → 0). */
function normalizeUsage(usage) {
	return {
		inputTokens: usage?.inputTokens ?? 0,
		outputTokens: usage?.outputTokens ?? 0,
		cacheReadTokens: usage?.cacheReadTokens ?? 0,
		cacheWriteTokens: usage?.cacheWriteTokens ?? 0
	};
}

/** Structural equality of two normalized usage records. */
function usageEquals(a, b) {
	return a.inputTokens === b.inputTokens
		&& a.outputTokens === b.outputTokens
		&& a.cacheReadTokens === b.cacheReadTokens
		&& a.cacheWriteTokens === b.cacheWriteTokens;
}

/**
 * Append one call-level ledger entry (mutating). Entries with the same stable
 * call ID are deduplicated in O(1) via a per-ledger id index (a WeakMap keyed
 * by the array itself); legacy entries without IDs retain the adjacent
 * content-based fallback for compatibility. Returns the ledger.
 * @param ledger - the ledger array (mutated in place).
 * @param entry - { occurredAt, provider, model, usage }.
 * @returns the ledger.
 */
export function appendLedger(ledger, entry) {
	const normalized = {
		...(typeof entry?.id === "string" && entry.id !== "" ? { id: entry.id } : {}),
		occurredAt: Number(entry?.occurredAt) || 0,
		...(Number(entry?.completedAt) > 0 ? { completedAt: Number(entry.completedAt) } : {}),
		provider: typeof entry?.provider === "string" && entry.provider !== "" ? entry.provider : "unknown",
		model: typeof entry?.model === "string" && entry.model !== "" ? entry.model : "unknown",
		...(Number.isInteger(entry?.turn) && entry.turn >= 0 ? { turn: entry.turn } : {}),
		...(Number.isInteger(entry?.step) && entry.step >= 0 ? { step: entry.step } : {}),
		...(typeof entry?.sampleKey === "string" && entry.sampleKey !== "" ? { sampleKey: entry.sampleKey } : {}),
		usage: normalizeUsage(entry?.usage),
		...(Object.hasOwn(entry ?? {}, "costCny") ? { costCny: entry.costCny === null ? null : Number(entry.costCny) } : {}),
		...(typeof entry?.pricingVersion === "string" && entry.pricingVersion !== "" ? { pricingVersion: entry.pricingVersion } : {})
	};
	const last = ledger[ledger.length - 1];
	const ids = idIndexOf(ledger);
	if (normalized.sampleKey !== void 0) {
		const index = ledger.findIndex((item) => item?.sampleKey === normalized.sampleKey);
		if (index >= 0) {
			// Same official turn/step: final assistant/message replaces the
			// provisional stream sample, including its frozen price.
			const previous = ledger[index];
			ledger[index] = { ...normalized, id: previous.id ?? normalized.id };
			ids.delete(normalized.id);
			if (typeof ledger[index].id === "string") ids.add(ledger[index].id);
			return ledger;
		}
	}
	if (normalized.id !== void 0 && ids.has(normalized.id)) return ledger;
	if (normalized.id === void 0 && last !== void 0 && last.id === void 0
		&& last.occurredAt === normalized.occurredAt
		&& last.provider === normalized.provider
		&& last.model === normalized.model
		&& usageEquals(last.usage, normalized.usage)) {
		return ledger;
	}
	ledger.push(normalized);
	if (normalized.id !== void 0) ids.add(normalized.id);
	return ledger;
}

/**
 * Per-ledger Set of known stable call IDs, memoized in a WeakMap keyed by the
 * ledger array itself (no leak: the entry dies with the array). A miss — e.g.
 * after loadCache filters `parseLedger(...)` into a brand-new array — scans
 * the array once to rebuild the index.
 */
const ledgerIdIndexes = new WeakMap();
function idIndexOf(ledger) {
	let ids = ledgerIdIndexes.get(ledger);
	if (ids === void 0) {
		ids = new Set();
		for (const item of ledger) {
			if (typeof item?.id === "string" && item.id !== "") ids.add(item.id);
		}
		ledgerIdIndexes.set(ledger, ids);
	}
	return ids;
}

/**
 * Trim the ledger to its newest `keepCount` entries (oldest dropped) and
 * return the removed entries, oldest first, so the caller can fold them into
 * the legacy snapshot. Rebuilds the id-dedup index afterwards: without that,
 * ids of removed entries would linger in the Set and wrongly dedup a later
 * re-record of the same id. Keeps the WeakMap key (the array) stable.
 * @param ledger - the ledger array (mutated in place).
 * @param keepCount - how many newest entries to keep.
 * @returns the removed entries ([] when nothing was trimmed).
 */
export function compactLedger(ledger, keepCount) {
	const keep = Math.max(0, Math.floor(Number(keepCount) || 0));
	const overflow = ledger.length - keep;
	if (overflow <= 0) return [];
	const removed = ledger.splice(0, overflow);
	const ids = new Set();
	for (const item of ledger) {
		if (typeof item?.id === "string" && item.id !== "") ids.add(item.id);
	}
	ledgerIdIndexes.set(ledger, ids);
	return removed;
}

/** Stable fingerprint for the exact price configuration used by a call. */
export function pricingVersionOf(pricing = defaultPricing()) {
	const models = Object.entries(pricing?.pricing ?? {})
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([model, row]) => [model, Number(row?.inputMiss) || 0, Number(row?.inputHit) || 0, Number(row?.output) || 0]);
	const canonical = JSON.stringify({
		currency: pricing?.currency ?? "CNY",
		peakHours: pricing?.peakHours ?? [],
		peakMultiplier: Number(pricing?.peakMultiplier) || 1,
		models
	});
	let hash = 2166136261;
	for (let index = 0; index < canonical.length; index += 1) {
		hash ^= canonical.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `${typeof pricing?.id === "string" && pricing.id !== "" ? pricing.id : "pricing"}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/** Freeze one call's price result at occurrence time. */
export function freezeLedgerEntry(entry, pricing = defaultPricing()) {
	const occurredAt = Number(entry?.occurredAt) || 0;
	const provider = typeof entry?.provider === "string" && entry.provider !== "" ? entry.provider : "unknown";
	const model = typeof entry?.model === "string" && entry.model !== "" ? entry.model : "unknown";
	const usage = normalizeUsage(entry?.usage);
	const attributionAt = Number(entry?.completedAt) > 0 ? Number(entry.completedAt) : occurredAt;
	const cost = costOf(`${provider}/${model}`, usage, hourKey(attributionAt), pricing);
	return {
		...(typeof entry?.id === "string" && entry.id !== "" ? { id: entry.id } : {}),
		occurredAt,
		...(Number(entry?.completedAt) > 0 ? { completedAt: Number(entry.completedAt) } : {}),
		provider,
		model,
		...(Number.isInteger(entry?.turn) && entry.turn >= 0 ? { turn: entry.turn } : {}),
		...(Number.isInteger(entry?.step) && entry.step >= 0 ? { step: entry.step } : {}),
		...(typeof entry?.sampleKey === "string" && entry.sampleKey !== "" ? { sampleKey: entry.sampleKey } : {}),
		usage,
		pricingVersion: pricingVersionOf(pricing),
		costCny: cost === null ? null : roundCost(cost)
	};
}

function addCost(index, key, value) {
	let state = index.get(key);
	if (state === void 0) {
		state = { sum: 0, unpriced: false };
		index.set(key, state);
	}
	if (value === null || !Number.isFinite(Number(value))) state.unpriced = true;
	else state.sum += Number(value);
}

function costValue(index, key) {
	const state = index.get(key);
	if (state === void 0 || state.unpriced) return null;
	return roundCost(state.sum);
}

/** Replace render-time estimates with the prices frozen on ledger entries. */
function applyFrozenCosts(rendered, ledger, pricing) {
	const costs = new Map();
	for (const entry of ledger) {
		const attributionAt = Number(entry.completedAt) > 0 ? entry.completedAt : entry.occurredAt;
		const date = dayKey(attributionAt);
		const hour = hourKey(attributionAt);
		const model = `${entry.provider}/${entry.model}`;
		const frozen = Object.hasOwn(entry, "costCny")
			? entry.costCny
			: costOf(model, normalizeUsage(entry.usage), hour, pricing);
		addCost(costs, `d:${date}`, frozen);
		addCost(costs, `m:${date}:${model}`, frozen);
		addCost(costs, `h:${date}:${hour}`, frozen);
		addCost(costs, `hm:${date}:${hour}:${model}`, frozen);
	}
	for (const day of rendered.days) {
		day.cost = costValue(costs, `d:${day.date}`);
		for (const model of day.models) model.cost = costValue(costs, `m:${day.date}:${model.model}`);
		for (const hour of day.hours) {
			hour.cost = costValue(costs, `h:${day.date}:${hour.hour}`);
			for (const model of hour.models) model.cost = costValue(costs, `hm:${day.date}:${hour.hour}:${model.model}`);
		}
	}
	rendered.total.cost = rendered.days.some((day) => day.cost === null)
		? null
		: roundCost(rendered.days.reduce((sum, day) => sum + day.cost, 0));
	return rendered;
}

/**
 * Project the ledger into synthetic `assistant/message` events whose
 * `time` is the attribution time (completion time per the provider billing
 * basis; `completedAt` when recorded, else `occurredAt`). Steps are unique
 * so the replace-last-sample semantics never collide entries.
 * @param ledger - the call-level ledger.
 * @returns synthetic session events in ledger order.
 */
export function ledgerToEvents(ledger) {
	return ledger.map((entry, index) => ({
		type: "assistant/message",
		// 官方账单按请求完成时间（usage 上报时间）归小时并判峰谷；
		// completedAt 即 usage 捕获时刻，旧条目回退到 occurredAt。
		time: entry.completedAt ?? entry.occurredAt,
		data: {
			// Keep the durable turn/step when the interceptor received it. This
			// lets the official projection replace an early usage chunk with the
			// finalized assistant/message sample. Legacy entries retain unique
			// synthetic steps so unrelated calls never collide.
			turn: Number.isInteger(entry.turn) && entry.turn >= 0 ? entry.turn : 0,
			step: Number.isInteger(entry.step) && entry.step >= 0 ? entry.step : index + 1,
			message: {
				role: "assistant",
				content: [],
				source: { kind: "model", provider: entry.provider, model: entry.model }
			},
			usage: entry.usage
		}
	}));
}

/**
 * Fold the ledger into the per-day/hour/model map, attributed by completion
 * time (`completedAt`, else `occurredAt`) on the Beijing calendar.
 * @param ledger - the call-level ledger.
 * @returns Map<YYYY-MM-DD, { totals, models, hours }>.
 */
export function foldLedger(ledger) {
	return foldUsage(ledgerToEvents(ledger));
}

/**
 * Render the ledger with the same wire shape as `renderUsage` (days/total/
 * hours/models + estimated cost), so the existing client consumes it without
 * changes. Peak/off-peak cost follows the COMPLETION hour of each call
 * (completedAt, else occurredAt).
 * @param ledger - the call-level ledger.
 * @param updatedAt - computation timestamp.
 * @param pricing - merged pricing configuration (see defaultPricing).
 * @returns the usage wire shape.
 */
export function renderLedger(ledger, updatedAt, pricing = defaultPricing()) {
	return applyFrozenCosts(renderUsage(foldLedger(ledger), updatedAt, pricing), ledger, pricing);
}
