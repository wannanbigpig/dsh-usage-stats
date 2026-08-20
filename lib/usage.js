/**
 * dsh-usage-stats — pure per-day / per-hour / per-model token-usage
 * aggregation over session event logs, plus model-priced cost estimation.
 *
 * Kept free of cordis imports so it can be unit-tested and validated against
 * real logs outside the running harness.
 *
 * Aggregation semantics mirror `dsh-token-meter`'s `tokenUsage` projection:
 * a usage sample rides an `assistant/chunk` (`data.chunk.type === "usage"`)
 * or an `assistant/message` (`data.usage`); a repeated sample for the same
 * (turn, step) REPLACES the earlier value instead of double counting it, and
 * the replacement is re-attributed to the day/hour/model of the later event.
 *
 * Each sample is attributed to the model that produced it:
 * `assistant/message` carries `data.message.source.model`; usage chunks fall
 * back to the last `request/header` `data.header.config.model`; samples with
 * no model information land in the `unknown/unknown` bucket.
 *
 * Hourly buckets record totals AND the per-model split, so both the hourly
 * token chart and the hourly cost (peak/off-peak pricing) can be rendered
 * exactly.
 *
 * @module dsh-usage-stats/usage
 */

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
import { defaultPricing } from "./pricing.js";
export { defaultPricing };

/** Beijing-calendar `YYYY-MM-DD` key for a millisecond epoch. */
export function dayKey(timeMs) {
	const date = new Date(timeMs + BEIJING_OFFSET_MS);
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Beijing hour (0–23) for a millisecond epoch. */
export function hourKey(timeMs) {
	return new Date(timeMs + BEIJING_OFFSET_MS).getUTCHours();
}

/** Empty token bucket. */
export function zeroBuckets() {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0
	};
}

/** Provider usage → buckets (missing cache fields are absent in some reports). */
export function bucketsOf(usage) {
	return {
		inputTokens: usage.inputTokens ?? 0,
		outputTokens: usage.outputTokens ?? 0,
		cacheReadTokens: usage.cacheReadTokens ?? 0,
		cacheWriteTokens: usage.cacheWriteTokens ?? 0
	};
}

/** Total tokens across all buckets. */
export function totalTokens(buckets) {
	return buckets.inputTokens + buckets.outputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens;
}

/**
 * Prompt-side cache hit rate in percent (0–100, one decimal), or null when
 * no prompt tokens were reported at all. Hits over the whole prompt side:
 * cacheRead / (input + cacheRead + cacheWrite).
 */
export function cacheHitRate(buckets) {
	const input = buckets.inputTokens ?? 0;
	const cacheRead = buckets.cacheReadTokens ?? 0;
	const cacheWrite = buckets.cacheWriteTokens ?? 0;
	const promptTokens = input + cacheRead + cacheWrite;
	if (promptTokens <= 0) return null;
	return Math.round((cacheRead / promptTokens) * 1000) / 10;
}

function addInto(target, source) {
	target.inputTokens += source.inputTokens;
	target.outputTokens += source.outputTokens;
	target.cacheReadTokens += source.cacheReadTokens;
	target.cacheWriteTokens += source.cacheWriteTokens;
	return target;
}

function subtractFrom(target, source) {
	target.inputTokens -= source.inputTokens;
	target.outputTokens -= source.outputTokens;
	target.cacheReadTokens -= source.cacheReadTokens;
	target.cacheWriteTokens -= source.cacheWriteTokens;
	return target;
}

/** True when a bucket has no tokens left (used to prune replaced samples). */
export function isZeroBucket(buckets) {
	return (buckets.inputTokens ?? 0) === 0
		&& (buckets.outputTokens ?? 0) === 0
		&& (buckets.cacheReadTokens ?? 0) === 0
		&& (buckets.cacheWriteTokens ?? 0) === 0;
}

/** Extract the usage sample an event carries, if any. */
function sampleOf(event) {
	if (event.type === "assistant/chunk" && event.data?.chunk?.type === "usage") {
		return {
			key: `${event.data.turn}:${event.data.step}`,
			usage: event.data.chunk.usage
		};
	}
	if (event.type === "assistant/message" && event.data?.usage !== void 0) {
		return {
			key: `${event.data.turn}:${event.data.step}`,
			usage: event.data.usage
		};
	}
	return void 0;
}

/**
 * The `provider/model` attribution key of a usage sample: the exact provider
 * route (dsh adapter id or pi-ai route) plus the model id, so the SAME model
 * served by different providers stays distinct. `assistant/message` names
 * its provider via `data.message.source`; usage chunks fall back to the last
 * `request/header` `data.header.config`; samples with no model information
 * land in the `unknown/unknown` bucket.
 */
function modelOf(event) {
	const source = event.data?.message?.source;
	if (source !== void 0 && typeof source.model === "string") {
		return `${typeof source.provider === "string" && source.provider.length > 0 ? source.provider : "unknown"}/${source.model}`;
	}
	const config = event.data?.header?.config;
	if (config !== void 0 && typeof config.model === "string") {
		return `${typeof config.provider === "string" && config.provider.length > 0 ? config.provider : "unknown"}/${config.model}`;
	}
	return void 0;
}

/** Day entry: totals plus a per-model bucket map and per-hour per-model buckets. */
function entryOf(byDay, day) {
	let entry = byDay.get(day);
	if (entry === void 0) {
		entry = {
			totals: zeroBuckets(),
			models: new Map(),
			hours: new Map()
		};
		byDay.set(day, entry);
	}
	return entry;
}

/** Hour entry inside a day: hour → Map<model, buckets>. */
function hourEntryOf(entry, hour) {
	let hours = entry.hours.get(hour);
	if (hours === void 0) {
		hours = new Map();
		entry.hours.set(hour, hours);
	}
	return hours;
}

/**
 * One session's incremental fold state. `days` holds the already-folded
 * per-day entries; `lastSample`/`currentModel` let a later event slice keep
 * the replace-last-sample semantics and model attribution across fold
 * boundaries without replaying the whole log.
 */
export function createUsageState() {
	return {
		days: new Map(),
		lastSample: null,
		currentModel: null,
		consumed: 0
	};
}

/**
 * Fold a slice of NEW events onto an existing session state (mutating).
 * Replacements for the same (turn, step) subtract the previous sample's
 * buckets from the day/hour/model buckets they were attributed to, so a slice
 * starting mid-step (e.g. a usage chunk at the tail of the previous fold)
 * stays exact.
 * @param state - session fold state (mutated in place).
 * @param events - the new events, in seq order, starting after the last fold.
 */
export function applyUsageDelta(state, events) {
	let last = state.lastSample;
	let currentModel = state.currentModel;
	for (const event of events) {
		if (event.type === "request/header") {
			const model = modelOf(event);
			if (model !== void 0) currentModel = model;
		}
		const sample = sampleOf(event);
		if (sample === void 0) continue;
		const buckets = bucketsOf(sample.usage);
		const model = modelOf(event) ?? currentModel ?? "unknown/unknown";
		const day = dayKey(event.time);
		const hour = hourKey(event.time);
		const entry = entryOf(state.days, day);
		if (last !== null && last.key === sample.key) {
			// Same turn/step re-reported: replace instead of double counting.
			const previous = state.days.get(last.day);
			if (previous !== void 0) {
				subtractFrom(previous.totals, last.buckets);
				const previousModel = previous.models.get(last.model);
				if (previousModel !== void 0) {
					subtractFrom(previousModel, last.buckets);
					if (isZeroBucket(previousModel)) previous.models.delete(last.model);
				}
				const previousHour = previous.hours.get(last.hour);
				const previousHourModel = previousHour === void 0 ? void 0 : previousHour.get(last.model);
				if (previousHourModel !== void 0) {
					subtractFrom(previousHourModel, last.buckets);
					if (isZeroBucket(previousHourModel)) previousHour.delete(last.model);
					if (previousHour.size === 0) previous.hours.delete(last.hour);
				}
				// A fully replaced sample leaves the OLD day empty: drop it so
				// zero-token days never surface in renders or the cache. Only
				// when the replacement moved to a different day — on the same
				// day the add below repopulates the very same entry.
				if (last.day !== day && isZeroBucket(previous.totals) && previous.models.size === 0 && previous.hours.size === 0) {
					state.days.delete(last.day);
				}
			}
		}
		addInto(entry.totals, buckets);
		let modelBucket = entry.models.get(model);
		if (modelBucket === void 0) {
			modelBucket = zeroBuckets();
			entry.models.set(model, modelBucket);
		}
		addInto(modelBucket, buckets);
		const hourModels = hourEntryOf(entry, hour);
		let hourModelBucket = hourModels.get(model);
		if (hourModelBucket === void 0) {
			hourModelBucket = zeroBuckets();
			hourModels.set(model, hourModelBucket);
		}
		addInto(hourModelBucket, buckets);
		last = { key: sample.key, day, hour, model, buckets };
	}
	state.lastSample = last;
	state.currentModel = currentModel;
}

/**
 * Fold one session's events into per-day, per-hour, per-model token buckets.
 * @param events - session event log in seq order.
 * @returns Map<`YYYY-MM-DD`, { totals, models, hours }> with only days that
 *   saw usage.
 */
export function foldUsage(events) {
	const state = createUsageState();
	applyUsageDelta(state, events);
	return state.days;
}

/**
 * Merge one session's folded days into a global per-day map.
 * @param byDay - global map to mutate.
 * @param sessionDays - session day map (from foldUsage or a state).
 */
export function mergeInto(byDay, sessionDays) {
	for (const [day, entry] of sessionDays) {
		const target = entryOf(byDay, day);
		addInto(target.totals, entry.totals);
		for (const [model, buckets] of entry.models) {
			let modelBucket = target.models.get(model);
			if (modelBucket === void 0) {
				modelBucket = zeroBuckets();
				target.models.set(model, modelBucket);
			}
			addInto(modelBucket, buckets);
		}
		for (const [hour, hourModels] of entry.hours) {
			const targetHour = hourEntryOf(target, hour);
			for (const [model, buckets] of hourModels) {
				let hourModelBucket = targetHour.get(model);
				if (hourModelBucket === void 0) {
					hourModelBucket = zeroBuckets();
					targetHour.set(model, hourModelBucket);
				}
				addInto(hourModelBucket, buckets);
			}
		}
	}
}

/**
 * Default pricing (CNY per 1M tokens, official Beijing peak/idle window).
 * Re-exported from `./pricing.js` — that module is the SINGLE price source so
 * config overrides and the default never drift apart. See `pricing.js`.
 */

/** The bare model id part of a `provider/model` attribution key. */
export function modelIdOf(modelKey) {
	if (typeof modelKey !== "string") return "";
	const slash = modelKey.indexOf("/");
	return slash === -1 ? modelKey : modelKey.slice(slash + 1);
}

/** The provider part of a `provider/model` attribution key ("" when absent). */
export function providerOf(modelKey) {
	if (typeof modelKey !== "string") return "";
	const slash = modelKey.indexOf("/");
	return slash === -1 ? "" : modelKey.slice(0, slash);
}

/** True when a local hour lands in any peak window (windows are UTC). */
export function isPeakHour(hour, peakHours = [[9, 12], [14, 18]]) {
	for (const [start, end] of peakHours) {
		if (hour >= start && hour < end) return true;
	}
	return false;
}

/**
 * Look up the per-1M-token price for a `provider/model` key. Unknown models
 * stay unpriced so a configuration mistake cannot become a false bill.
 */
export function priceOf(modelKey, pricingConfig = {}) {
	const pricing = pricingConfig.pricing ?? {};
	const model = modelIdOf(modelKey);
	const row = pricing[model] ?? pricingConfig.models?.[model]?.offPeak;
	if (row === void 0 || row === null || typeof row !== "object") return null;
	return {
		inputMiss: Number(row.inputMiss) || 0,
		inputHit: Number(row.inputHit) || 0,
		output: Number(row.output) || 0
	};
}

/**
 * Estimated CNY cost of one model's buckets in a given Beijing-time hour.
 *
 * DeepSeek context caching bills cache-hit prompt tokens at the cache-hit
 * rate and everything else on the prompt side (fresh input + cache writes)
 * at the cache-miss rate. Peak-hour windows are billed at `peakMultiplier`×.
 *
 * @param modelKey - `provider/model` attribution key.
 * @param buckets - token buckets for that model.
 * @param hour - local hour 0–23.
 * @param pricingConfig - merged pricing configuration.
 * @returns estimated cost in CNY (float).
 */
export function costOf(modelKey, buckets, hour, pricingConfig = {}) {
	const price = priceOf(modelKey, pricingConfig);
	if (price === null) return null;
	const explicit = pricingConfig.models?.[modelIdOf(modelKey)];
	const tierPrice = isPeakHour(hour, pricingConfig.peakHours ?? [[9, 12], [14, 18]]) ? explicit?.peak : explicit?.offPeak;
	const effectivePrice = tierPrice && Number.isFinite(Number(tierPrice.inputMiss)) ? tierPrice : price;
	const peakMultiplier = Number(pricingConfig.peakMultiplier) || 1;
	const missTokens = (buckets.inputTokens ?? 0) + (buckets.cacheWriteTokens ?? 0);
	const base = (missTokens * effectivePrice.inputMiss + (buckets.cacheReadTokens ?? 0) * effectivePrice.inputHit + (buckets.outputTokens ?? 0) * effectivePrice.output) / 1e6;
	return explicit ? base : (isPeakHour(hour, pricingConfig.peakHours ?? [[9, 12], [14, 18]]) ? base * peakMultiplier : base);
}

/** Round a cost to a fixed number of decimals. */
export function roundCost(value, digits = 6) {
	if (!Number.isFinite(value)) return 0;
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

/**
 * Render a global per-day map into the wire shape for the usage endpoint.
 * @param byDay - day → entry map.
 * @param updatedAt - computation timestamp.
 * @param pricingConfig - merged pricing configuration (see defaultPricing).
 * @returns `{ days, total, updatedAt }` with `days` sorted ascending; each
 *   day carries `models` (descending by tokens), a `cacheHitRate` percent, an
 *   estimated `cost`, and a 24-entry `hours` array (descending by tokens is
 *   not applied — hours are index-ordered 0–23).
 */
export function renderUsage(byDay, updatedAt, pricingConfig = defaultPricing()) {
	const days = [...byDay.entries()]
		.map(([date, entry]) => {
			const models = [...entry.models.entries()]
				.map(([model, buckets]) => {
					// A model's daily cost is the sum of its per-hour costs
					// (peak/off-peak aware).
					let cost = 0;
					let priced = true;
					for (const [hour, hourModels] of entry.hours) {
						const hourBuckets = hourModels.get(model);
						if (hourBuckets !== void 0) {
							const hourCost = costOf(model, hourBuckets, hour, pricingConfig);
							if (hourCost === null) priced = false;
							else cost += hourCost;
						}
					}
					return {
						model,
						...buckets,
						tokens: totalTokens(buckets),
						cacheHitRate: cacheHitRate(buckets),
						cost: priced ? roundCost(cost) : null
					};
				})
				// All-zero buckets come from warmup requests that report
				// {input:0, output:0}; rendering them produces empty "0 tokens"
				// model rows.
				.filter((entry) => entry.tokens > 0)
				.sort((a, b) => b.tokens - a.tokens);
			const hours = [];
			for (let hour = 0; hour < 24; hour += 1) {
				const hourModels = entry.hours.get(hour);
					const totals = zeroBuckets();
					let cost = 0;
					let priced = true;
				const hourModelRows = [];
				if (hourModels !== void 0) {
					for (const [model, buckets] of hourModels) {
							addInto(totals, buckets);
							const modelCost = costOf(model, buckets, hour, pricingConfig);
							if (modelCost === null) priced = false;
							else cost += modelCost;
						hourModelRows.push({
							model,
							...buckets,
							tokens: totalTokens(buckets),
								cost: modelCost === null ? null : roundCost(modelCost)
						});
					}
					hourModelRows.sort((a, b) => b.tokens - a.tokens);
				}
				hours.push({
					hour,
					...totals,
					tokens: totalTokens(totals),
					cost: priced ? roundCost(cost) : null,
					models: hourModelRows
				});
			}
			return {
				date,
				...entry.totals,
				tokens: totalTokens(entry.totals),
				cacheHitRate: cacheHitRate(entry.totals),
				cost: models.some((model) => model.cost === null)
					? null
					: roundCost(models.reduce((sum, model) => sum + model.cost, 0)),
				models,
				hours
			};
		})
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	const total = zeroBuckets();
	for (const [, entry] of byDay) addInto(total, entry.totals);
	return {
		days,
		total: {
			...total,
			tokens: totalTokens(total),
			cacheHitRate: cacheHitRate(total),
			cost: days.some((day) => day.cost === null)
				? null
				: roundCost(days.reduce((sum, day) => sum + day.cost, 0))
		},
		updatedAt
	};
}
