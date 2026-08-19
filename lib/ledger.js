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

import { costNanosOf, dayKey, defaultPricing, foldUsage, hourKey, isBilledModelKey, mergeInto, renderUsage, roundCost, tokenCountOf, zeroBuckets } from "./usage.js";

/** Normalize one provider usage into bucket fields (missing → 0). */
function normalizeUsage(usage) {
	return {
		inputTokens: tokenCountOf(usage?.inputTokens),
		outputTokens: tokenCountOf(usage?.outputTokens),
		cacheReadTokens: tokenCountOf(usage?.cacheReadTokens),
		cacheWriteTokens: tokenCountOf(usage?.cacheWriteTokens)
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
 * Normalize cost fields onto the strict v3 ledger-entry shape. A legacy
 * `costCny` input is CONVERTED here (`priced` + `costNanosCny`, `unpriced`,
 * or `not-billable`) instead of being carried through: the persisted
 * StateSchema rejects unknown keys, so a passthrough would make the whole
 * atomic storage update fail and the call would never be recorded.
 */
function normalizedCostFields(entry, modelKey) {
	const costState = ["priced", "unpriced", "not-billable"].includes(entry?.costState) ? entry.costState : void 0;
	if (costState === "unpriced" || costState === "not-billable") return { costState };
	const costNanosCny = typeof entry?.costNanosCny === "string" && /^\d+$/.test(entry.costNanosCny)
		? entry.costNanosCny
		: void 0;
	if (costState === "priced" && costNanosCny !== void 0) return { costState, costNanosCny };
	if (!Object.hasOwn(entry ?? {}, "costCny")) return costState === "priced" ? { costState: "unpriced" } : {};
	const billed = isBilledModelKey(modelKey);
	if (!billed) return { costState: "not-billable" };
	if (entry.costCny === null || entry.costCny === void 0) return { costState: "unpriced" };
	const legacyNanos = legacyCnyToNanos(entry.costCny);
	return legacyNanos === null ? { costState: "unpriced" } : { costState: "priced", costNanosCny: legacyNanos };
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
export function appendLedger(ledger, entry, options = {}) {
	const provider = typeof entry?.provider === "string" && entry.provider !== "" ? entry.provider : "unknown";
	const model = typeof entry?.model === "string" && entry.model !== "" ? entry.model : "unknown";
	const normalized = {
		...(typeof entry?.id === "string" && entry.id !== "" ? { id: entry.id } : {}),
		occurredAt: Number(entry?.occurredAt) || 0,
		...(Number(entry?.completedAt) > 0 ? { completedAt: Number(entry.completedAt) } : {}),
		provider,
		model,
		...(Number.isInteger(entry?.turn) && entry.turn >= 0 ? { turn: entry.turn } : {}),
		...(Number.isInteger(entry?.step) && entry.step >= 0 ? { step: entry.step } : {}),
		...(typeof entry?.sampleKey === "string" && entry.sampleKey !== "" ? { sampleKey: entry.sampleKey } : {}),
		usage: normalizeUsage(entry?.usage),
		...normalizedCostFields(entry, `${provider}/${model}`),
		...(typeof entry?.pricingVersion === "string" && entry.pricingVersion !== "" ? { pricingVersion: entry.pricingVersion } : {})
	};
	const last = ledger[ledger.length - 1];
	const ids = normalized.id !== void 0 && options.idKnownAbsent !== true ? idIndexOf(ledger) : null;
	if (normalized.sampleKey !== void 0 && options.sampleKnownAbsent !== true) {
		const index = ledger.findIndex((item) => item?.sampleKey === normalized.sampleKey);
		if (index >= 0) {
			// Same official turn/step: final assistant/message replaces the
			// provisional stream sample, including its frozen price.
			const previous = ledger[index];
			ledger[index] = { ...normalized, id: previous.id ?? normalized.id };
			if (ids !== null) {
				ids.delete(normalized.id);
				if (typeof ledger[index].id === "string") ids.add(ledger[index].id);
			}
			return ledger;
		}
	}
	if (normalized.id !== void 0 && ids?.has(normalized.id)) return ledger;
	if (normalized.id === void 0 && last !== void 0 && last.id === void 0
		&& last.occurredAt === normalized.occurredAt
		&& last.provider === normalized.provider
		&& last.model === normalized.model
		&& usageEquals(last.usage, normalized.usage)) {
		return ledger;
	}
	ledger.push(normalized);
	if (normalized.id !== void 0 && ids !== null) ids.add(normalized.id);
	return ledger;
}

/**
 * Per-ledger Set of known stable call IDs, memoized in a WeakMap keyed by the
 * ledger array itself (no leak: the entry dies with the array). A miss after
 * an immutable repository transform scans the new array once to rebuild it.
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
 * an archive. Rebuilds the id-dedup index afterwards: without that,
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
	const modelIds = [...new Set([
		...Object.keys(pricing?.pricing ?? {}),
		...Object.keys(pricing?.models ?? {})
	])].sort((left, right) => left.localeCompare(right));
	const models = modelIds
		.map((model) => {
			const versioned = pricing?.models?.[model];
			const row = versioned?.offPeak ?? pricing?.pricing?.[model];
			const peak = versioned?.peak ?? pricing?.pricing?.[model]?.peak;
			return [
				model,
				Number(row?.inputMiss) || 0,
				Number(row?.inputHit) || 0,
				Number(row?.output) || 0,
				peak === undefined ? null : Number(peak?.inputMiss) || 0,
				peak === undefined ? null : Number(peak?.inputHit) || 0,
				peak === undefined ? null : Number(peak?.output) || 0
			];
		});
	const canonical = JSON.stringify({
		currency: pricing?.currency ?? "CNY",
		peakHours: pricing?.peakHours ?? [],
		peakMultiplier: Number(pricing?.peakMultiplier) || 1,
		weekendOffPeakFrom: pricing?.weekendOffPeakFrom ?? null,
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
	const modelKey = `${provider}/${model}`;
	const billed = isBilledModelKey(modelKey);
	const costNanosCny = billed ? costNanosOf(modelKey, usage, hourKey(attributionAt), pricing, dayKey(attributionAt)) : null;
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
		costState: billed ? (costNanosCny === null ? "unpriced" : "priced") : "not-billable",
		...(costNanosCny === null ? {} : { costNanosCny })
	};
}

function legacyCnyToNanos(value) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric < 0) return null;
	return BigInt(Math.round(numeric * 1e9)).toString();
}

function frozenCostOf(entry, pricing) {
	const model = `${entry.provider}/${entry.model}`;
	if (!isBilledModelKey(model) || entry.costState === "not-billable") return { kind: "not-billable" };
	if (entry.costState === "unpriced") return { kind: "unpriced" };
	if (typeof entry.costNanosCny === "string" && /^\d+$/.test(entry.costNanosCny)) return { kind: "priced", nanos: entry.costNanosCny };
	if (Object.hasOwn(entry, "costCny")) {
		if (entry.costCny === null) return { kind: "unpriced" };
		const nanos = legacyCnyToNanos(entry.costCny);
		return nanos === null ? { kind: "unpriced" } : { kind: "priced", nanos };
	}
	// An explicitly frozen priced record without an amount is corrupt. Never
	// turn that corruption into a render-time estimate of supposedly exact
	// history.
	if (entry.costState === "priced") return { kind: "unpriced" };
	const attributionAt = Number(entry.completedAt) > 0 ? entry.completedAt : entry.occurredAt;
	const nanos = costNanosOf(model, normalizeUsage(entry.usage), hourKey(attributionAt), pricing, dayKey(attributionAt));
	return nanos === null ? { kind: "unpriced" } : { kind: "priced", nanos };
}

function addCost(index, key, stateValue) {
	let state = index.get(key);
	if (state === void 0) {
		state = { sum: 0n, unpriced: false };
		index.set(key, state);
	}
	if (stateValue.kind === "unpriced") state.unpriced = true;
	else if (stateValue.kind === "priced") state.sum += BigInt(stateValue.nanos);
}

function costValue(index, key) {
	const state = index.get(key);
	if (state === void 0) return void 0;
	if (state.unpriced) return null;
	return roundCost(Number(state.sum) / 1e9);
}

/** Replace render-time estimates with the prices frozen on ledger entries. */
function applyFrozenCosts(rendered, ledger, pricing) {
	const costs = new Map();
	for (const entry of ledger) {
		const attributionAt = Number(entry.completedAt) > 0 ? entry.completedAt : entry.occurredAt;
		const date = dayKey(attributionAt);
		const hour = hourKey(attributionAt);
		const model = `${entry.provider}/${entry.model}`;
		// 计费只认官方 DeepSeek；其他供应商（GLM/MiMo 等）只记 token，不参与
		// 费用聚合，避免把已定价费用拉成 null。
		if (!isBilledModelKey(model)) continue;
		const frozen = frozenCostOf(entry, pricing);
		addCost(costs, `d:${date}`, frozen);
		addCost(costs, `m:${date}:${model}`, frozen);
		addCost(costs, `h:${date}:${hour}`, frozen);
		addCost(costs, `hm:${date}:${hour}:${model}`, frozen);
	}
	for (const day of rendered.days) {
		// 无冻结数据（仅非计费供应商）时回退 render 的估算值，而不是覆盖成 null。
		const dayCost = costValue(costs, `d:${day.date}`);
		if (dayCost !== void 0) day.cost = dayCost;
		for (const model of day.models) {
			const modelCost = costValue(costs, `m:${day.date}:${model.model}`);
			if (modelCost !== void 0) model.cost = modelCost;
		}
		for (const hour of day.hours) {
			const hourCost = costValue(costs, `h:${day.date}:${hour.hour}`);
			if (hourCost !== void 0) hour.cost = hourCost;
			for (const model of hour.models) {
				const modelCost = costValue(costs, `hm:${day.date}:${hour.hour}:${model.model}`);
				if (modelCost !== void 0) model.cost = modelCost;
			}
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
				// `foldUsage` treats turn/step as a session-scoped replacement key,
				// while this ledger spans every session. Stream/final replacement has
				// already happened in appendLedger via the stable sampleKey, so always
				// use a projection-local unique key here.
				turn: 0,
				step: index + 1,
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

function addBuckets(target, source) {
	target.inputTokens += Number(source?.inputTokens) || 0;
	target.outputTokens += Number(source?.outputTokens) || 0;
	target.cacheReadTokens += Number(source?.cacheReadTokens) || 0;
	target.cacheWriteTokens += Number(source?.cacheWriteTokens) || 0;
	return target;
}

function archivedBucket() {
	return {
		...zeroBuckets(),
		entryCount: 0,
		costNanosCny: "0",
		unpricedCount: 0
	};
}

/** Create the serializable aggregate used for exact compacted calls. */
export function createFrozenArchive() {
	return { days: {}, entryCount: 0, pricingVersionCounts: {} };
}

function cloneFrozenArchive(archive) {
	if (archive === null || typeof archive !== "object") return createFrozenArchive();
	return structuredClone({
		days: archive.days ?? {},
		entryCount: Number(archive.entryCount) || 0,
		pricingVersionCounts: archive.pricingVersionCounts ?? {}
	});
}

function archivedDayOf(archive, date) {
	let day = archive.days[date];
	if (day === void 0) {
		day = { totals: zeroBuckets(), models: {}, hours: {}, entryCount: 0, pricingVersionCounts: {} };
		archive.days[date] = day;
	}
	return day;
}

function archivedModelOf(index, model) {
	let bucket = index[model];
	if (bucket === void 0) {
		bucket = archivedBucket();
		index[model] = bucket;
	}
	return bucket;
}

function addArchivedCost(bucket, cost) {
	bucket.entryCount += 1;
	if (cost.kind === "unpriced") bucket.unpricedCount += 1;
	else if (cost.kind === "priced") bucket.costNanosCny = (BigInt(bucket.costNanosCny ?? "0") + BigInt(cost.nanos)).toString();
}

/**
 * Fold exact ledger entries into a serializable archive without mutating the
 * input archive. The archive stores token dimensions and nano-CNY separately,
 * so render-time pricing is never consulted for compacted calls.
 */
export function foldFrozenLedgerEntries(entries, archive = createFrozenArchive()) {
	const next = cloneFrozenArchive(archive);
	for (const raw of entries ?? []) {
		const entry = { ...raw, usage: normalizeUsage(raw?.usage) };
		const at = Number(entry.completedAt) > 0 ? Number(entry.completedAt) : Number(entry.occurredAt) || 0;
		const date = dayKey(at);
		const hour = hourKey(at);
		const model = `${entry.provider || "unknown"}/${entry.model || "unknown"}`;
		const cost = frozenCostOf(entry, {});
		const day = archivedDayOf(next, date);
		addBuckets(day.totals, entry.usage);
		day.entryCount += 1;
		const dayModel = archivedModelOf(day.models, model);
		addBuckets(dayModel, entry.usage);
		addArchivedCost(dayModel, cost);
		let archivedHour = day.hours[String(hour)];
		if (archivedHour === void 0) {
			archivedHour = { totals: zeroBuckets(), models: {}, entryCount: 0 };
			day.hours[String(hour)] = archivedHour;
		}
		addBuckets(archivedHour.totals, entry.usage);
		archivedHour.entryCount += 1;
		const hourModel = archivedModelOf(archivedHour.models, model);
		addBuckets(hourModel, entry.usage);
		addArchivedCost(hourModel, cost);
		next.entryCount += 1;
		if (typeof entry.pricingVersion === "string" && entry.pricingVersion !== "") {
			next.pricingVersionCounts[entry.pricingVersion] = (Number(next.pricingVersionCounts[entry.pricingVersion]) || 0) + 1;
			day.pricingVersionCounts[entry.pricingVersion] = (Number(day.pricingVersionCounts[entry.pricingVersion]) || 0) + 1;
		}
	}
	return next;
}

function mergeArchivedBucket(target, source) {
	addBuckets(target, source);
	target.entryCount += Number(source?.entryCount) || 0;
	target.unpricedCount += Number(source?.unpricedCount) || 0;
	target.costNanosCny = (BigInt(target.costNanosCny ?? "0") + BigInt(source?.costNanosCny ?? "0")).toString();
}

/** Merge two exact archives immutably. */
export function mergeFrozenArchive(left, right) {
	const next = cloneFrozenArchive(left);
	const source = cloneFrozenArchive(right);
	for (const [date, sourceDay] of Object.entries(source.days)) {
		const day = archivedDayOf(next, date);
		addBuckets(day.totals, sourceDay.totals);
		day.entryCount += Number(sourceDay.entryCount) || 0;
		for (const [model, sourceModel] of Object.entries(sourceDay.models ?? {})) mergeArchivedBucket(archivedModelOf(day.models, model), sourceModel);
		for (const [hour, sourceHour] of Object.entries(sourceDay.hours ?? {})) {
			let targetHour = day.hours[hour];
			if (targetHour === void 0) {
				targetHour = { totals: zeroBuckets(), models: {}, entryCount: 0 };
				day.hours[hour] = targetHour;
			}
			addBuckets(targetHour.totals, sourceHour.totals);
			targetHour.entryCount += Number(sourceHour.entryCount) || 0;
			for (const [model, sourceModel] of Object.entries(sourceHour.models ?? {})) mergeArchivedBucket(archivedModelOf(targetHour.models, model), sourceModel);
		}
		for (const [version, count] of Object.entries(sourceDay.pricingVersionCounts ?? {})) {
			day.pricingVersionCounts[version] = (Number(day.pricingVersionCounts[version]) || 0) + (Number(count) || 0);
		}
	}
	next.entryCount += source.entryCount;
	for (const [version, count] of Object.entries(source.pricingVersionCounts)) {
		next.pricingVersionCounts[version] = (Number(next.pricingVersionCounts[version]) || 0) + (Number(count) || 0);
	}
	return next;
}

function frozenArchiveDayMap(archive) {
	const days = new Map();
	for (const [date, day] of Object.entries(archive?.days ?? {})) {
		const entry = { totals: { ...zeroBuckets(), ...day.totals }, models: new Map(), hours: new Map() };
		for (const [model, bucket] of Object.entries(day.models ?? {})) entry.models.set(model, { ...zeroBuckets(), ...bucket, requestCount: Number(bucket?.entryCount) || 0 });
		for (const [hour, archivedHour] of Object.entries(day.hours ?? {})) {
			const models = new Map();
			for (const [model, bucket] of Object.entries(archivedHour.models ?? {})) models.set(model, { ...zeroBuckets(), ...bucket, requestCount: Number(bucket?.entryCount) || 0 });
			entry.hours.set(Number(hour), models);
		}
		days.set(date, entry);
	}
	return days;
}

function archiveBucketCost(bucket) {
	if ((Number(bucket?.unpricedCount) || 0) > 0) return null;
	return roundCost(Number(BigInt(bucket?.costNanosCny ?? "0")) / 1e9);
}

/** Render exact compacted aggregates without consulting current pricing. */
export function renderFrozenArchive(archive, updatedAt) {
	const rendered = renderUsage(frozenArchiveDayMap(archive), updatedAt, {});
	for (const day of rendered.days) {
		const archivedDay = archive?.days?.[day.date];
		for (const model of day.models) {
			if (isBilledModelKey(model.model)) model.cost = archiveBucketCost(archivedDay?.models?.[model.model]);
		}
		for (const hour of day.hours) {
			for (const model of hour.models) {
				if (isBilledModelKey(model.model)) model.cost = archiveBucketCost(archivedDay?.hours?.[String(hour.hour)]?.models?.[model.model]);
			}
			const billed = hour.models.filter((model) => isBilledModelKey(model.model));
			hour.cost = billed.some((model) => model.cost === null) ? null : roundCost(billed.reduce((sum, model) => sum + (model.cost ?? 0), 0));
		}
		const billed = day.models.filter((model) => isBilledModelKey(model.model));
		day.cost = billed.some((model) => model.cost === null) ? null : roundCost(billed.reduce((sum, model) => sum + (model.cost ?? 0), 0));
	}
	rendered.total.cost = rendered.days.some((day) => day.cost === null)
		? null
		: roundCost(rendered.days.reduce((sum, day) => sum + (day.cost ?? 0), 0));
	return rendered;
}

function defaultEstimatedArchive() {
	return { importedLegacy: null, unfrozenLedger: null, sessionRebuild: null };
}

/** Create a normalized immutable v3 ledger state. */
export function createLedgerState(seed = {}) {
	const ledger = Array.isArray(seed.ledger) ? structuredClone(seed.ledger) : [];
	const recentSampleKeys = Array.isArray(seed.recentSampleKeys)
		? seed.recentSampleKeys
			.filter((entry) => entry !== null && typeof entry === "object" && typeof entry.key === "string" && entry.key !== "" && /^\d{4}-\d{2}-\d{2}$/.test(entry.day))
			.map((entry) => ({ key: entry.key, day: entry.day }))
		: [];
	if (recentSampleKeys.length === 0) {
		for (const entry of ledger) recentSampleKeys.push(...dedupRecordsOf(entry));
	}
	const uniqueRecent = [];
	const seenRecent = new Set();
	for (const entry of recentSampleKeys) {
		if (seenRecent.has(entry.key)) continue;
		seenRecent.add(entry.key);
		uniqueRecent.push(entry);
	}
	return {
		version: 3,
		ledger,
		archive: {
			frozen: cloneFrozenArchive(seed.archive?.frozen),
			estimated: { ...defaultEstimatedArchive(), ...(seed.archive?.estimated === null ? {} : structuredClone(seed.archive?.estimated ?? {})) }
		},
		coverageCutoffsByDay: { ...(seed.coverageCutoffsByDay ?? {}) },
		recentSampleKeys: uniqueRecent,
		migration: structuredClone(seed.migration ?? {})
	};
}

/**
 * Storage validates every persisted state before this transform receives it.
 * In that hot path we only read the current state and construct replacement
 * branches below, so a second whole-state clone is unnecessary. Public calls
 * with incomplete seed data retain the defensive normalization path.
 */
function recordableLedgerState(state) {
	if (state?.version === 3
		&& Array.isArray(state.ledger)
		&& state.archive !== null && typeof state.archive === "object"
		&& state.archive.frozen !== null && typeof state.archive.frozen === "object"
		&& state.archive.estimated !== null && typeof state.archive.estimated === "object"
		&& state.coverageCutoffsByDay !== null && typeof state.coverageCutoffsByDay === "object"
		&& Array.isArray(state.recentSampleKeys)
		&& state.migration !== null && typeof state.migration === "object") return state;
	return createLedgerState(state);
}

function dedupKeysOf(entry) {
	const keys = [];
	if (typeof entry?.sampleKey === "string" && entry.sampleKey !== "") keys.push(`sample:${entry.sampleKey}`);
	if (typeof entry?.id === "string" && entry.id !== "") keys.push(`id:${entry.id}`);
	return keys;
}

function dedupRecordsOf(entry) {
	const at = Number(entry?.completedAt) > 0 ? Number(entry.completedAt) : Number(entry?.occurredAt) || 0;
	return dedupKeysOf(entry).map((key) => ({ key, day: dayKey(at) }));
}

/** Test whether one stable id/sample key remains inside the bounded window. */
export function hasRecentSampleKey(state, key) {
	return Array.isArray(state?.recentSampleKeys) && state.recentSampleKeys.some((entry) => entry?.key === key);
}

function normalizeFrozenInput(entry, pricing) {
	if (entry?.costState === "priced" || entry?.costState === "unpriced" || entry?.costState === "not-billable" || Object.hasOwn(entry ?? {}, "costCny")) {
		// appendLedger already normalizes cost fields (including legacy costCny)
		// onto the strict v3 shape, so the result can persist directly.
		const ledger = [];
		appendLedger(ledger, entry);
		return ledger[0];
	}
	return freezeLedgerEntry(entry, pricing);
}

function addCoverage(cutoffs, entry) {
	const start = Number(entry.occurredAt) || 0;
	const completedAt = Number(entry.completedAt) > 0 ? Number(entry.completedAt) : start;
	const end = Math.max(start, completedAt);
	let cursor = start;
	let first = true;
	while (dayKey(cursor) <= dayKey(end)) {
		const date = dayKey(cursor);
		const cutoff = first ? start : cursor;
		if (!Number.isFinite(Number(cutoffs[date])) || cutoff < Number(cutoffs[date])) cutoffs[date] = cutoff;
		if (date === dayKey(end)) break;
		const [year, month, day] = date.split("-").map(Number);
		cursor = Date.UTC(year, month - 1, day + 1) - 8 * 60 * 60 * 1000;
		first = false;
	}
}

/**
 * Atomically express one append/dedup/compact operation as a pure transform.
 * The caller can pass this directly to an official storage table `update`.
 */
export function recordLedgerState(state, entry, options = {}) {
	const current = recordableLedgerState(state);
	const frozen = normalizeFrozenInput(entry, options.pricing ?? defaultPricing());
	const maxLedgerEntries = Math.max(0, Math.floor(Number(options.maxLedgerEntries ?? 5000) || 0));
	// A call usually contributes one id plus one sample key. With a window at
	// least twice as large as the live ledger, a recent-key miss proves the
	// item is absent from that ledger and avoids a linear scan on normal writes.
	const capacity = Math.max(1, Math.floor(Number(options.recentSampleKeyCapacity ?? Math.max(100, maxLedgerEntries * 4)) || 0));
	const recentCoversLedger = capacity >= current.ledger.length * 2;
	const keys = dedupKeysOf(frozen);
	const recent = new Set(current.recentSampleKeys.map((entry) => entry.key));
	const hasIdDuplicate = keys.some((key) => key.startsWith("id:") && recent.has(key));
	const sampleKey = keys.find((key) => key.startsWith("sample:"));
	const hasSampleDuplicate = sampleKey !== void 0 && recent.has(sampleKey);
	const hasSampleInLedger = hasSampleDuplicate && options.replaceSampleKey === true
		? current.ledger.some((item) => item?.sampleKey === sampleKey.slice("sample:".length))
		: false;
	if (hasIdDuplicate || (hasSampleDuplicate && !(options.replaceSampleKey === true && hasSampleInLedger))) return state;
	if (!recentCoversLedger && current.ledger.some((item) => typeof item?.id === "string" && keys.includes(`id:${item.id}`))) return state;
	const ledger = [...current.ledger];
	appendLedger(ledger, frozen, {
		idKnownAbsent: recentCoversLedger,
		sampleKnownAbsent: recentCoversLedger && !hasSampleDuplicate
	});
	const overflow = compactLedger(ledger, maxLedgerEntries);
	const unfrozenOverflow = overflow.filter(isUnfrozenLegacyEntry);
	const exactOverflow = overflow.filter((item) => !isUnfrozenLegacyEntry(item));
	// One call normally contributes both id and sampleKey. Keep two complete
	// ledger windows so the first archived window remains protected too.
	const recentSampleKeys = [...current.recentSampleKeys];
	const dedupDay = dayKey(Number(frozen.completedAt) > 0 ? Number(frozen.completedAt) : Number(frozen.occurredAt) || 0);
	for (const key of keys) {
		if (!recent.has(key)) {
			recent.add(key);
			recentSampleKeys.push({ key, day: dedupDay });
		}
	}
	if (recentSampleKeys.length > capacity) recentSampleKeys.splice(0, recentSampleKeys.length - capacity);
	const coverageCutoffsByDay = { ...current.coverageCutoffsByDay };
	addCoverage(coverageCutoffsByDay, frozen);
	return {
		...current,
		ledger,
		archive: {
			frozen: foldFrozenLedgerEntries(exactOverflow, current.archive.frozen),
			estimated: {
				...current.archive.estimated,
				unfrozenLedger: mergeUnfrozenEstimated(current.archive.estimated.unfrozenLedger, unfrozenOverflow)
			}
		},
		coverageCutoffsByDay,
		recentSampleKeys
	};
}

function plainDayMap(source) {
	if (source === null || source === void 0) return new Map();
	if (Array.isArray(source)) return foldLedger(source);
	if (source instanceof Map) return source;
	const rawDays = source.days ?? source;
	const days = new Map();
	for (const [date, raw] of Object.entries(rawDays ?? {})) {
		const entry = { totals: { ...zeroBuckets(), ...(raw?.totals ?? {}) }, models: new Map(), hours: new Map() };
		for (const [model, bucket] of Object.entries(raw?.models ?? {})) entry.models.set(model, { ...zeroBuckets(), ...bucket });
		for (const [hour, rawModels] of Object.entries(raw?.hours ?? {})) {
			const modelSource = rawModels?.models ?? rawModels;
			const models = new Map();
			for (const [model, bucket] of Object.entries(modelSource ?? {})) models.set(model, { ...zeroBuckets(), ...bucket });
			entry.hours.set(Number(hour), models);
		}
		days.set(date, entry);
	}
	return days;
}

function serializeDayMap(days) {
	return {
		days: Object.fromEntries([...days.entries()].map(([date, entry]) => [date, {
			totals: { ...zeroBuckets(), ...entry.totals },
			models: Object.fromEntries([...entry.models.entries()].map(([model, buckets]) => [model, { ...zeroBuckets(), ...buckets }])),
			hours: Object.fromEntries([...entry.hours.entries()].map(([hour, models]) => [String(hour),
				Object.fromEntries([...models.entries()].map(([model, buckets]) => [model, { ...zeroBuckets(), ...buckets }]))
			]))
		}]))
	};
}

function isUnfrozenLegacyEntry(entry) {
	return isBilledModelKey(`${entry?.provider}/${entry?.model}`)
		&& !["priced", "unpriced"].includes(entry?.costState)
		&& !(typeof entry?.costNanosCny === "string" && /^\d+$/.test(entry.costNanosCny))
		&& !Object.hasOwn(entry ?? {}, "costCny");
}

function mergeUnfrozenEstimated(source, entries) {
	if (entries.length === 0) return source;
	const days = new Map();
	mergeInto(days, plainDayMap(source));
	mergeInto(days, foldLedger(entries));
	return serializeDayMap(days);
}

function hasEstimatedSource(source) {
	if (Array.isArray(source)) return source.length > 0;
	if (source instanceof Map) return source.size > 0;
	const days = source?.days ?? source;
	return days !== null && typeof days === "object" && Object.keys(days).length > 0;
}

function mergedCost(values) {
	const present = values.filter((value) => value !== void 0);
	if (present.length === 0) return void 0;
	if (present.some((value) => value === null)) return null;
	return roundCost(present.reduce((sum, value) => sum + Number(value), 0));
}

function overlayLayerCosts(rendered, layers) {
	for (const day of rendered.days) {
		const layerDays = layers.map((layer) => layer.days.find((item) => item.date === day.date));
		for (const model of day.models) {
			if (!isBilledModelKey(model.model)) continue;
			model.cost = mergedCost(layerDays.map((item) => item?.models?.find((row) => row.model === model.model)?.cost));
		}
		for (const hour of day.hours) {
			for (const model of hour.models) {
				if (!isBilledModelKey(model.model)) continue;
				model.cost = mergedCost(layerDays.map((item) => item?.hours?.[hour.hour]?.models?.find((row) => row.model === model.model)?.cost));
			}
			const billed = hour.models.filter((model) => isBilledModelKey(model.model));
			hour.cost = billed.some((model) => model.cost === null) ? null : roundCost(billed.reduce((sum, model) => sum + (model.cost ?? 0), 0));
		}
		const billed = day.models.filter((model) => isBilledModelKey(model.model));
		day.cost = billed.some((model) => model.cost === null) ? null : roundCost(billed.reduce((sum, model) => sum + (model.cost ?? 0), 0));
	}
	rendered.total.cost = rendered.days.some((day) => day.cost === null) ? null : roundCost(rendered.days.reduce((sum, day) => sum + (day.cost ?? 0), 0));
	return rendered;
}

/** Render ledger, exact archive, and every estimated source as one wire view. */
export function renderLedgerState(state, updatedAt, pricing = defaultPricing()) {
	const current = createLedgerState(state);
	const combinedDays = new Map();
	const estimatedDays = new Map();
	for (const source of Object.values(current.archive.estimated)) mergeInto(estimatedDays, plainDayMap(source));
	mergeInto(combinedDays, estimatedDays);
	mergeInto(combinedDays, frozenArchiveDayMap(current.archive.frozen));
	mergeInto(combinedDays, foldLedger(current.ledger));
	const estimated = renderUsage(estimatedDays, updatedAt, pricing);
	// Ledger and archive are one exact layer. Fold them together before the
	// wire conversion so sub-micro amounts on either side of the compaction
	// boundary are rounded only once.
	const exact = renderFrozenArchive(foldFrozenLedgerEntries(current.ledger, current.archive.frozen), updatedAt);
	const rendered = overlayLayerCosts(renderUsage(combinedDays, updatedAt, pricing), [estimated, exact]);
	const hasEstimatedHistory = Object.values(current.archive.estimated).some(hasEstimatedSource);
	rendered.costBasis = {
		ledger: current.ledger.length > 0 ? "frozen" : null,
		archive: current.archive.frozen.entryCount > 0 ? "frozen" : null,
		legacy: hasEstimatedHistory ? "legacy-estimated" : null
	};
	rendered.hasEstimatedHistory = hasEstimatedHistory;
	return rendered;
}

function trimEstimatedSource(source, cutoffDay) {
	if (Array.isArray(source)) return source.filter((entry) => dayKey(Number(entry.completedAt) > 0 ? entry.completedAt : entry.occurredAt) >= cutoffDay);
	if (source === null || source === void 0) return null;
	const container = source.days === void 0 ? source : source.days;
	const days = Object.fromEntries(Object.entries(container ?? {}).filter(([date]) => date >= cutoffDay));
	return source.days === void 0 ? days : { ...source, days };
}

/** Remove all history before a Beijing-calendar cutoff, immutably. */
export function trimLedgerState(state, cutoffDay) {
	if (typeof cutoffDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(cutoffDay)) throw new TypeError("cutoffDay must be YYYY-MM-DD");
	const current = createLedgerState(state);
	const frozen = cloneFrozenArchive(current.archive.frozen);
	for (const date of Object.keys(frozen.days)) if (date < cutoffDay) delete frozen.days[date];
	frozen.entryCount = Object.values(frozen.days).reduce((sum, day) => sum + (Number(day.entryCount) || 0), 0);
	frozen.pricingVersionCounts = {};
	for (const day of Object.values(frozen.days)) {
		for (const [version, count] of Object.entries(day.pricingVersionCounts ?? {})) frozen.pricingVersionCounts[version] = (Number(frozen.pricingVersionCounts[version]) || 0) + (Number(count) || 0);
	}
	const estimated = {};
	for (const [name, source] of Object.entries(current.archive.estimated)) estimated[name] = trimEstimatedSource(source, cutoffDay);
	const ledger = current.ledger.filter((entry) => dayKey(Number(entry.completedAt) > 0 ? entry.completedAt : entry.occurredAt) >= cutoffDay);
	return {
		...current,
		ledger,
		archive: { frozen, estimated },
		coverageCutoffsByDay: Object.fromEntries(Object.entries(current.coverageCutoffsByDay).filter(([date]) => date >= cutoffDay)),
		// Explicit retention trimming bounds dedup by the same Beijing date while
		// retaining keys for exact archive rows that remain inside the cutoff.
		recentSampleKeys: current.recentSampleKeys.filter((entry) => entry.day >= cutoffDay)
	};
}

/** Clear usage data while retaining the migration marker. */
export function clearLedgerState(state) {
	const current = createLedgerState(state);
	return {
		...current,
		ledger: [],
		archive: { frozen: createFrozenArchive(), estimated: defaultEstimatedArchive() },
		coverageCutoffsByDay: {},
		recentSampleKeys: []
	};
}
