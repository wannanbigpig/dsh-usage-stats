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
		inputTokens: tokenCountOf(usage?.inputTokens),
		outputTokens: tokenCountOf(usage?.outputTokens),
		cacheReadTokens: tokenCountOf(usage?.cacheReadTokens),
		cacheWriteTokens: tokenCountOf(usage?.cacheWriteTokens)
	};
}

/** Only non-negative safe integer token counts can participate in arithmetic. */
export function tokenCountOf(value) {
	const parsed = typeof value === "number"
		? value
		: typeof value === "string" && value.trim() !== ""
			? Number(value)
			: NaN;
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
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

/** Exact call count when the source preserves call-level identity; otherwise null. */
function requestCountOf(source) {
	if (!Object.hasOwn(source ?? {}, "requestCount")) return null;
	if (source?.requestCount === null || source?.requestCount === void 0) return null;
	const value = Number(source.requestCount);
	return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function addRequestCount(target, count = 1) {
	if (target.requestCount === null) return target;
	const current = target.requestCount === void 0 ? 0 : Number(target.requestCount);
	const next = current + count;
	target.requestCount = Number.isSafeInteger(current) && current >= 0 && Number.isSafeInteger(next) && next >= 0 ? next : null;
	return target;
}

function subtractRequestCount(target, count = 1) {
	if (target.requestCount === null) return target;
	target.requestCount = Math.max(0, (Number(target.requestCount) || 0) - count);
	return target;
}

function mergeRequestCount(target, source) {
	const sourceCount = requestCountOf(source);
	if (sourceCount === null) target.requestCount = null;
	else addRequestCount(target, sourceCount);
	return target;
}

function summedRequestCount(rows) {
	let count = 0;
	for (const row of rows) {
		const value = requestCountOf(row);
		if (value === null) return null;
		count += value;
		if (!Number.isSafeInteger(count)) return null;
	}
	return count;
}

/** True when a bucket has no tokens left (used to prune replaced samples). */
export function isZeroBucket(buckets) {
	return (buckets.inputTokens ?? 0) === 0
		&& (buckets.outputTokens ?? 0) === 0
		&& (buckets.cacheReadTokens ?? 0) === 0
		&& (buckets.cacheWriteTokens ?? 0) === 0;
}

/**
 * Replacement key of a usage sample: the session-scoped (turn, step) pair.
 * A sample without BOTH fields has no stable identity (foreign or malformed
 * logs), so it gets `null` and must accumulate instead of replacing the
 * previous sample — otherwise consecutive identity-less calls silently drop
 * each other's tokens.
 */
function sampleKeyOfData(data) {
	return Number.isInteger(data?.turn) && data.turn >= 0 && Number.isInteger(data?.step) && data.step >= 0
		? `${data.turn}:${data.step}`
		: null;
}

/** Extract the usage sample an event carries, if any. */
function sampleOf(event) {
	if (event.type === "assistant/chunk" && event.data?.chunk?.type === "usage" && event.data.chunk.usage !== null && typeof event.data.chunk.usage === "object") {
		return {
			key: sampleKeyOfData(event.data),
			usage: event.data.chunk.usage
		};
	}
	if (event.type === "assistant/message" && event.data?.usage !== null && event.data?.usage !== void 0 && typeof event.data.usage === "object") {
		return {
			key: sampleKeyOfData(event.data),
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
 * per-day entries; `samples`/`currentModel` let a later event slice keep
 * the replace-sample semantics and model attribution across fold
 * boundaries without replaying the whole log.
 */
export function createUsageState() {
	return {
		days: new Map(),
		lastSample: null,
		samples: new Map(),
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
	const samples = state.samples instanceof Map ? state.samples : new Map();
	if (last?.key !== null && last?.key !== void 0 && !samples.has(last.key)) samples.set(last.key, last);
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
		const previousSample = sample.key === null ? null : samples.get(sample.key) ?? null;
		if (previousSample !== null) {
			// The same turn/step may be re-reported after unrelated samples. Replace
			// its prior attribution instead of double-counting it.
			const previous = state.days.get(previousSample.day);
			if (previous !== void 0) {
				subtractFrom(previous.totals, previousSample.buckets);
				const previousModel = previous.models.get(previousSample.model);
				if (previousModel !== void 0) {
					subtractFrom(previousModel, previousSample.buckets);
					subtractRequestCount(previousModel);
					if (isZeroBucket(previousModel)) previous.models.delete(previousSample.model);
				}
				const previousHour = previous.hours.get(previousSample.hour);
				const previousHourModel = previousHour === void 0 ? void 0 : previousHour.get(previousSample.model);
				if (previousHourModel !== void 0) {
					subtractFrom(previousHourModel, previousSample.buckets);
					subtractRequestCount(previousHourModel);
					if (isZeroBucket(previousHourModel)) previousHour.delete(previousSample.model);
					if (previousHour.size === 0) previous.hours.delete(previousSample.hour);
				}
				// A fully replaced sample leaves the OLD day empty: drop it so
				// zero-token days never surface in renders or the cache. Only
				// when the replacement moved to a different day — on the same
				// day the add below repopulates the very same entry.
				if (previousSample.day !== day && isZeroBucket(previous.totals) && previous.models.size === 0 && previous.hours.size === 0) {
					state.days.delete(previousSample.day);
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
		addRequestCount(modelBucket);
		const hourModels = hourEntryOf(entry, hour);
		let hourModelBucket = hourModels.get(model);
		if (hourModelBucket === void 0) {
			hourModelBucket = zeroBuckets();
			hourModels.set(model, hourModelBucket);
		}
		addInto(hourModelBucket, buckets);
		addRequestCount(hourModelBucket);
		last = { key: sample.key, day, hour, model, buckets };
		if (sample.key !== null) samples.set(sample.key, last);
	}
	state.lastSample = last;
	state.samples = samples;
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
			mergeRequestCount(modelBucket, buckets);
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
				mergeRequestCount(hourModelBucket, buckets);
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

/** True when a Beijing local hour lands in any peak window. */
export function isPeakHour(hour, peakHours = [[9, 12], [14, 18]]) {
	for (const [start, end] of peakHours) {
		if (hour >= start && hour < end) return true;
	}
	return false;
}

/** True when a Beijing calendar day is Saturday or Sunday. */
function isWeekendDay(day) {
	if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
	const [year, month, date] = day.split("-").map(Number);
	const parsed = new Date(Date.UTC(year, month - 1, date));
	if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return false;
	const weekday = parsed.getUTCDay();
	return weekday === 0 || weekday === 6;
}

/**
 * True when a Beijing date/hour uses the peak tier. A missing date preserves
 * the legacy hour-only API behavior; internal billing callers always supply
 * the Beijing day so the weekend rule is applied exactly.
 */
export function isPeakBillingPeriod(day, hour, pricingConfig = {}) {
	const weekendOffPeakFrom = pricingConfig.weekendOffPeakFrom;
	if (typeof day === "string" && typeof weekendOffPeakFrom === "string"
		&& day >= weekendOffPeakFrom && isWeekendDay(day)) return false;
	return isPeakHour(hour, pricingConfig.peakHours ?? [[9, 12], [14, 18]]);
}

/** Provider ids that are billed (DeepSeek official). Other providers are
 * token-only: usage is recorded but never priced, and their absence from the
 * price table must not blank out the official cost. */
const BILLED_PROVIDERS = new Set(["deepseek-official"]);

/** True only for provider routes whose balance and pricing this plugin owns. */
export function isOfficialBillingProvider(provider) {
	return typeof provider === "string" && BILLED_PROVIDERS.has(provider);
}

/** True when a `provider/model` key belongs to a billed provider. */
export function isBilledModelKey(modelKey) {
	return isOfficialBillingProvider(providerOf(modelKey));
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
	if (!["inputMiss", "inputHit", "output"].every((field) => {
		const value = Number(row[field]);
		return row[field] !== null && row[field] !== void 0 && Number.isFinite(value) && value >= 0;
	})) return null;
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
 * @param day - Beijing calendar `YYYY-MM-DD`; omit only for legacy hour-only callers.
 * @returns estimated cost in CNY (float).
 */
export function costOf(modelKey, buckets, hour, pricingConfig = {}, day = null) {
	if (!isBilledModelKey(modelKey)) return null;
	const price = priceOf(modelKey, pricingConfig);
	if (price === null) return null;
	const explicit = pricingConfig.models?.[modelIdOf(modelKey)];
	const peak = isPeakBillingPeriod(day, hour, pricingConfig);
	const tierPrice = peak ? explicit?.peak : explicit?.offPeak;
	const effectivePrice = tierPrice && Number.isFinite(Number(tierPrice.inputMiss)) ? tierPrice : price;
	const peakMultiplier = Number(pricingConfig.peakMultiplier) || 1;
	const missTokens = (buckets.inputTokens ?? 0) + (buckets.cacheWriteTokens ?? 0);
	const base = (missTokens * effectivePrice.inputMiss + (buckets.cacheReadTokens ?? 0) * effectivePrice.inputHit + (buckets.outputTokens ?? 0) * effectivePrice.output) / 1e6;
	return explicit ? base : (peak ? base * peakMultiplier : base);
}

/** Parse a finite decimal Number into an exact base-10 fraction. */
function decimalFraction(value) {
	if (!Number.isFinite(Number(value))) return null;
	const text = String(Number(value)).toLowerCase();
	const [coefficient, exponentText] = text.split("e");
	const exponent = Number(exponentText ?? 0);
	const negative = coefficient.startsWith("-");
	const unsigned = negative ? coefficient.slice(1) : coefficient;
	const [whole, fraction = ""] = unsigned.split(".");
	const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
	const scale = fraction.length - exponent;
	let numerator = BigInt(digits);
	let denominator = 1n;
	if (scale > 0) denominator = 10n ** BigInt(scale);
	else if (scale < 0) numerator *= 10n ** BigInt(-scale);
	return { numerator: negative ? -numerator : numerator, denominator };
}

/** Round a non-negative rational number to its nearest integer. */
function roundedDivide(numerator, denominator) {
	if (numerator < 0n) return -roundedDivide(-numerator, denominator);
	return (numerator + denominator / 2n) / denominator;
}

/**
 * Exact nano-CNY cost of one model bucket, serialized as a decimal string.
 *
 * The public renderer intentionally remains Number-based, but call-level
 * freezing must not round to six decimals. Prices are parsed as base-10
 * fractions and accumulated with BigInt before the single nano-CNY rounding
 * boundary. This shares the same provider, model, peak and weekend decisions
 * as `costOf` rather than maintaining another pricing table.
 */
export function costNanosOf(modelKey, buckets, hour, pricingConfig = {}, day = null) {
	if (!isBilledModelKey(modelKey)) return null;
	const basePrice = priceOf(modelKey, pricingConfig);
	if (basePrice === null) return null;
	const explicit = pricingConfig.models?.[modelIdOf(modelKey)];
	const peak = isPeakBillingPeriod(day, hour, pricingConfig);
	const explicitTier = peak ? explicit?.peak : explicit?.offPeak;
	const effectivePrice = explicitTier && priceOf(modelKey, { pricing: { [modelIdOf(modelKey)]: explicitTier } }) !== null
		? explicitTier
		: basePrice;
	const terms = [
		[(buckets.inputTokens ?? 0) + (buckets.cacheWriteTokens ?? 0), effectivePrice.inputMiss],
		[buckets.cacheReadTokens ?? 0, effectivePrice.inputHit],
		[buckets.outputTokens ?? 0, effectivePrice.output]
	];
	let denominator = 1n;
	const fractions = [];
	for (const [tokensValue, priceValue] of terms) {
		const tokens = Number(tokensValue);
		const price = decimalFraction(priceValue);
		if (!Number.isFinite(tokens) || tokens < 0 || !Number.isInteger(tokens) || price === null || price.numerator < 0n) return null;
		fractions.push({ tokens: BigInt(tokens), ...price });
		if (price.denominator > denominator) denominator = price.denominator;
	}
	let weighted = 0n;
	for (const fraction of fractions) {
		weighted += fraction.tokens * fraction.numerator * (denominator / fraction.denominator);
	}
	// CNY/1M-token → nano-CNY/token: multiply by 1e9 / 1e6 = 1000.
	let numerator = weighted * 1000n;
	if (!explicit && peak) {
		const multiplier = decimalFraction(Number(pricingConfig.peakMultiplier) || 1);
		if (multiplier === null || multiplier.numerator < 0n) return null;
		numerator *= multiplier.numerator;
		denominator *= multiplier.denominator;
	}
	return roundedDivide(numerator, denominator).toString();
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
 *   day/model/hour and the total carry an exact `requestCount` when all
 *   contributing sources preserve call identity, otherwise `null`.
 */
export function renderUsage(byDay, updatedAt, pricingConfig = defaultPricing()) {
	const days = [...byDay.entries()]
		.map(([date, entry]) => {
			const allModels = [...entry.models.entries()]
				.map(([model, buckets]) => {
					// A model's daily cost is the sum of its per-hour costs
					// (peak/off-peak aware).
					let cost = 0;
					let priced = true;
					for (const [hour, hourModels] of entry.hours) {
						const hourBuckets = hourModels.get(model);
						if (hourBuckets !== void 0) {
							const hourCost = costOf(model, hourBuckets, hour, pricingConfig, date);
							if (hourCost === null) priced = false;
							else cost += hourCost;
						}
					}
					return {
						model,
						...buckets,
						tokens: totalTokens(buckets),
						requestCount: requestCountOf(buckets),
						cacheHitRate: cacheHitRate(buckets),
						cost: priced ? roundCost(cost) : null
					};
				})
			const models = allModels
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
							const modelCost = costOf(model, buckets, hour, pricingConfig, date);
							// 非官方供应商不计费：只记 token，不参与小时费用，也不拉低官方费用。
							if (isBilledModelKey(model)) {
								if (modelCost === null) priced = false;
								else cost += modelCost;
							}
						hourModelRows.push({
							model,
							...buckets,
							tokens: totalTokens(buckets),
							requestCount: requestCountOf(buckets),
							cost: modelCost === null ? null : roundCost(modelCost)
						});
					}
					hourModelRows.sort((a, b) => b.tokens - a.tokens);
				}
				hours.push({
					hour,
					...totals,
					tokens: totalTokens(totals),
					requestCount: summedRequestCount(hourModelRows),
					cost: priced ? roundCost(cost) : null,
					models: hourModelRows
				});
			}
			// 计费只认官方 DeepSeek（deepseek-official）；其他供应商（如 GLM/MiMo）
			// 只记 token、不计费——不参与 day.cost，也不把已定价费用拉成 null。
			const billedModels = models.filter((model) => isBilledModelKey(model.model));
			return {
				date,
				...entry.totals,
				tokens: totalTokens(entry.totals),
				requestCount: summedRequestCount(allModels),
				cacheHitRate: cacheHitRate(entry.totals),
				cost: billedModels.some((model) => model.cost === null)
					? null
					: roundCost(billedModels.reduce((sum, model) => sum + (model.cost ?? 0), 0)),
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
			requestCount: summedRequestCount(days),
			cacheHitRate: cacheHitRate(total),
			cost: days.some((day) => day.cost === null)
				? null
				: roundCost(days.reduce((sum, day) => sum + day.cost, 0))
		},
		updatedAt
	};
}
