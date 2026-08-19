// Offline unit tests for the pure usage-folding engine (lib/usage.js).
// Folds a REAL captured session log when one is available and verifies the
// day/hour/model buckets, replace-last-sample semantics, hourly totals, and
// model-priced cost math. Fully offline.
import { readFileSync } from "node:fs";
import {
	applyUsageDelta,
	costOf,
	costNanosOf,
	createUsageState,
	dayKey,
	defaultPricing,
	foldUsage,
	hourKey,
	isPeakBillingPeriod,
	mergeInto,
	priceOf,
	renderUsage,
	totalTokens,
	zeroBuckets
} from "../lib/usage.js";

import {
	appendLedger,
	clearLedgerState,
	createLedgerState,
	foldFrozenLedgerEntries,
	freezeLedgerEntry,
	ledgerToEvents,
	foldLedger,
	renderLedger,
	pricingVersionOf,
	recordLedgerState,
	renderFrozenArchive,
	renderLedgerState,
	mergeFrozenArchive,
	trimLedgerState
} from "../lib/ledger.js";
import { filterRenderedUsageByProvider } from "../lib/index.js";
import { normalizePricing, validatePricingInput } from "../lib/pricing.js";
import { StateSchema, createEmptyUsageState } from "../lib/storage.js";

let failures = 0;
function assert(condition, message) {
	if (!condition) {
		failures += 1;
		// Fail fast like every other script's node:assert/strict: continuing on a
		// broken invariant only produces cascading TypeErrors that hide the root
		// cause. The exit-code contract below stays as a belt-and-braces guard.
		throw new Error(`FAIL: ${message}`);
	}
}

// Null usage payloads are explicitly absent samples and must not crash the fold.
{
	const state = foldUsage([{ type: "assistant/message", data: { turn: 1, step: 1, usage: null } }]);
	assert(state.size === 0, "null usage must be ignored");
}

// Providers occasionally serialize usage numbers as strings. They must be
// normalized at the boundary so arithmetic never turns into concatenation.
{
	const [, entry] = [...foldUsage([
		{ type: "assistant/message", time: 1, data: { turn: 1, step: 1, usage: { inputTokens: "10", outputTokens: "2", cacheReadTokens: "0", cacheWriteTokens: "0" } } }
	])][0];
	assert(entry.totals.inputTokens === 10 && entry.totals.outputTokens === 2,
		"numeric-string usage must fold as numeric token counts");
}

// Replacements are keyed by (turn, step), not by event adjacency: a late
// final message can follow another step and must still replace its own sample.
{
	const rendered = renderUsage(foldUsage([
		{ type: "assistant/message", time: 1, data: { turn: 1, step: 1, usage: { inputTokens: 10 } } },
		{ type: "assistant/message", time: 2, data: { turn: 1, step: 2, usage: { inputTokens: 20 } } },
		{ type: "assistant/message", time: 3, data: { turn: 1, step: 1, usage: { inputTokens: 30 } } }
	]), 0, defaultPricing());
	assert(rendered.total.inputTokens === 50 && rendered.total.requestCount === 2,
		"non-adjacent samples with the same turn/step must replace their earlier value");
}

// Request counts follow distinct usage samples, preserve provider/model identity,
// and do not double-count a final replacement for the same turn/step.
{
	const folded = renderUsage(foldUsage([
		{ type: "assistant/message", time: 1, data: { turn: 1, step: 1, usage: { inputTokens: 2 }, message: { source: { provider: "alpha", model: "same-model" } } } },
		{ type: "assistant/message", time: 2, data: { turn: 1, step: 1, usage: { inputTokens: 3 }, message: { source: { provider: "alpha", model: "same-model" } } } },
		{ type: "assistant/message", time: 3, data: { usage: { inputTokens: 4 }, message: { source: { provider: "alpha", model: "same-model" } } } },
		{ type: "assistant/message", time: 4, data: { usage: { inputTokens: 5 }, message: { source: { provider: "beta", model: "same-model" } } } }
	]), 0, defaultPricing());
	assert(folded.total.requestCount === 3, "replacement samples must count as one request while identity-less samples accumulate");
	assert(folded.days[0].models.find((row) => row.model === "alpha/same-model")?.requestCount === 2, "request count must be kept per provider/model");
	assert(folded.days[0].models.find((row) => row.model === "beta/same-model")?.requestCount === 1, "same model on another provider must remain distinct");
}

// Zero-token calls are still real calls. Daily and hourly request counts must
// use the same source rows even when the zero-token model row is hidden.
{
	const rendered = renderUsage(foldUsage([
		{ type: "assistant/message", time: 1, data: { turn: 1, step: 1, usage: { inputTokens: 0, outputTokens: 0 }, message: { source: { provider: "deepseek-official", model: "warmup" } } } },
		{ type: "assistant/message", time: 2, data: { turn: 1, step: 2, usage: { inputTokens: 1, outputTokens: 0 }, message: { source: { provider: "deepseek-official", model: "live" } } } }
	]), 0, defaultPricing());
	assert(rendered.days[0].requestCount === 2, "daily request count must retain zero-token calls");
	assert(rendered.days[0].hours[8].requestCount === 2, "daily and hourly request counts must agree");
}

// Persisted/rendered request counts must be non-negative safe integers; malformed
// values and safe-integer overflow make the aggregate explicitly unknown.
{
	const malformed = renderUsage(new Map([["2026-01-01", {
		totals: zeroBuckets(),
		models: new Map([
			["alpha/fractional", { ...zeroBuckets(), inputTokens: 1, requestCount: 1.5 }],
			["alpha/negative", { ...zeroBuckets(), inputTokens: 1, requestCount: -1 }],
			["alpha/huge", { ...zeroBuckets(), inputTokens: 1, requestCount: Number.MAX_SAFE_INTEGER + 1 }]
		]),
		hours: new Map()
	}]]), 0, defaultPricing());
	assert(malformed.days[0].models.every((row) => row.requestCount === null), "malformed request counts must be rejected");
	const overflow = renderUsage(new Map([["2026-01-01", {
		totals: zeroBuckets(),
		models: new Map([
			["alpha/one", { ...zeroBuckets(), inputTokens: 1, requestCount: Number.MAX_SAFE_INTEGER }],
			["alpha/two", { ...zeroBuckets(), inputTokens: 1, requestCount: Number.MAX_SAFE_INTEGER }]
		]),
		hours: new Map()
	}]]), 0, defaultPricing());
	assert(overflow.total.requestCount === null, "request count sums beyond safe integer must be unknown");
}

// Official peak windows and day boundaries are fixed to Beijing time (UTC+8),
// independent of the machine's local timezone.
assert(dayKey(Date.UTC(2026, 0, 1, 16, 0, 0)) === "2026-01-02", "Beijing day boundary");
assert(hourKey(Date.UTC(2026, 0, 1, 1, 0, 0)) === 9, "Beijing peak-hour boundary");

//#region v3 frozen ledger state contracts
{
	const pricing = defaultPricing();
	const tinyUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1, cacheWriteTokens: 0 };
	assert(costNanosOf("deepseek-official/deepseek-v4-flash", tinyUsage, 12, pricing, "2026-01-02") === "50",
		"one cache-hit token must retain 50 nano-CNY before wire rounding");
	const tiny = freezeLedgerEntry({
		id: "tiny",
		occurredAt: beijingTime(2026, 0, 2, 12),
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: tinyUsage
	}, pricing);
	assert(tiny.costState === "priced" && tiny.costNanosCny === "50", "freeze must persist priced nano-CNY state");

	const unpriced = freezeLedgerEntry({
		id: "unknown",
		occurredAt: beijingTime(2026, 0, 2, 12),
		provider: "deepseek-official",
		model: "unknown-model",
		usage: { inputTokens: 10 }
	}, pricing);
	assert(unpriced.costState === "unpriced" && !Object.hasOwn(unpriced, "costNanosCny"), "official unknown model must freeze as unpriced");
	const external = freezeLedgerEntry({
		id: "external",
		occurredAt: beijingTime(2026, 0, 2, 12),
		provider: "zai-coding-cn",
		model: "glm-5.2",
		usage: { inputTokens: 10 }
	}, pricing);
	assert(external.costState === "not-billable", "external provider must freeze as token-only");

	const initial = createLedgerState();
	const first = recordLedgerState(initial, tiny, { maxLedgerEntries: 1, recentSampleKeyCapacity: 4 });
	const priced = freezeLedgerEntry({
		id: "priced",
		sampleKey: "turn:2:step:1",
		occurredAt: beijingTime(2026, 0, 2, 17, 59),
		completedAt: beijingTime(2026, 0, 3, 0, 1),
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 1e6 }
	}, pricing);
	const compacted = recordLedgerState(first, priced, { maxLedgerEntries: 1, recentSampleKeyCapacity: 4 });
	assert(initial.ledger.length === 0 && first.ledger.length === 1, "record transform must not mutate its input state");
	assert(compacted.ledger.length === 1 && compacted.archive.frozen.entryCount === 1, "overflow must move into exact frozen archive");
	assert(compacted.recentSampleKeys.some((entry) => entry.key === "id:tiny")
		&& compacted.recentSampleKeys.some((entry) => entry.key === "sample:turn:2:step:1"), "dedup keys must survive ledger compaction");
	assert(Object.hasOwn(compacted.coverageCutoffsByDay, "2026-01-02") && Object.hasOwn(compacted.coverageCutoffsByDay, "2026-01-03"),
		"cross-midnight call must cover every Beijing day it spans");
	const duplicate = recordLedgerState(compacted, { ...priced, usage: { inputTokens: 2e6 } }, { maxLedgerEntries: 1, recentSampleKeyCapacity: 4 });
	assert(duplicate === compacted, "same-sample final message must not replace the authoritative first stream write");
	const replaced = recordLedgerState(compacted, { ...priced, id: "final-replacement", usage: { inputTokens: 2e6 } }, { maxLedgerEntries: 1, recentSampleKeyCapacity: 4, replaceSampleKey: true });
	assert(replaced !== compacted && replaced.ledger[0].usage.inputTokens === 2e6, "explicit final sample replacement must update the current ledger entry");
	const afterSampleCompaction = recordLedgerState(compacted, freezeLedgerEntry({
		id: "newest",
		occurredAt: beijingTime(2026, 0, 3, 1),
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 10 }
	}, pricing), { maxLedgerEntries: 1, recentSampleKeyCapacity: 4 });
	const archivedDuplicate = recordLedgerState(afterSampleCompaction, { ...priced, usage: { inputTokens: 2e6 } }, { maxLedgerEntries: 1, recentSampleKeyCapacity: 4 });
	assert(archivedDuplicate === afterSampleCompaction, "late duplicate sample must remain rejected after its full entry was archived");
	let defaultBoundary = createLedgerState();
	for (let index = 0; index <= 100; index += 1) {
		defaultBoundary = recordLedgerState(defaultBoundary, freezeLedgerEntry({
			id: `boundary-${index}`,
			sampleKey: `boundary-sample-${index}`,
			occurredAt: beijingTime(2026, 0, 3, 2) + index,
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: { inputTokens: 1 }
		}, pricing), { maxLedgerEntries: 100 });
	}
	assert(defaultBoundary.archive.frozen.entryCount === 1
		&& defaultBoundary.recentSampleKeys.some((entry) => entry.key === "id:boundary-0")
		&& defaultBoundary.recentSampleKeys.some((entry) => entry.key === "sample:boundary-sample-0"),
		"default dedup capacity must protect the first call after it crosses into archive");
	assert(recordLedgerState(defaultBoundary, freezeLedgerEntry({
		id: "boundary-0",
		sampleKey: "boundary-sample-0",
		occurredAt: beijingTime(2026, 0, 3, 2),
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 99 }
	}, pricing), { maxLedgerEntries: 100 }) === defaultBoundary, "archived boundary duplicate must be rejected by default settings");
	const trimmedBoundary = trimLedgerState(defaultBoundary, "2026-01-03");
	assert(trimmedBoundary.archive.frozen.entryCount === 1
		&& trimmedBoundary.recentSampleKeys.some((entry) => entry.key === "id:boundary-0"),
		"trim must retain dedup keys for archived calls inside the retained date range");

	const changedPricing = structuredClone(pricing);
	changedPricing.models["deepseek-v4-flash"].offPeak.inputMiss = 999;
	changedPricing.pricing["deepseek-v4-flash"].inputMiss = 999;
	const rendered = renderLedgerState(compacted, 123, changedPricing);
	assert(rendered.days.find((day) => day.date === "2026-01-02")?.cost === 0,
		"nano amount below six decimals rounds only at the wire boundary");
	assert(rendered.days.find((day) => day.date === "2026-01-03")?.cost === 1.5,
		"ledger frozen cost must not drift after pricing changes");
	assert(rendered.costBasis.archive === "frozen" && rendered.hasEstimatedHistory === false, "state render must describe exact archive basis");

	const unknownState = recordLedgerState(createLedgerState(), unpriced, { maxLedgerEntries: 1 });
	assert(renderLedgerState(unknownState, 123, pricing).total.cost === null, "explicit unpriced state must not fall back to current pricing");

	const frozenArchive = foldFrozenLedgerEntries([tiny, external]);
	const archivedRender = renderFrozenArchive(frozenArchive, 123);
	assert(archivedRender.total.tokens === 11 && archivedRender.total.cost === 0, "frozen archive must retain tiny exact cost and external tokens");
	const unpricedArchive = foldFrozenLedgerEntries([unpriced]);
	const mixedArchive = mergeFrozenArchive(frozenArchive, unpricedArchive);
	assert(renderFrozenArchive(mixedArchive, 123).total.cost === null, "one exact-unpriced official call must propagate through a merged archive");

	const subMicroEntry = (id, nanos) => ({
		id,
		occurredAt: beijingTime(2026, 0, 4, 12),
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 1 },
		costState: "priced",
		costNanosCny: nanos,
		pricingVersion: "test"
	});
	const splitExact = createLedgerState({
		ledger: [subMicroEntry("recent-sub-micro", "400")],
		archive: { frozen: foldFrozenLedgerEntries([subMicroEntry("archived-sub-micro", "400")]) }
	});
	assert(renderLedgerState(splitExact, 123, pricing).total.cost === 0.000001,
		"exact ledger and archive must combine nano-CNY before one wire rounding");
	let manyTiny = createLedgerState();
	for (let index = 0; index < 150; index += 1) {
		manyTiny = recordLedgerState(manyTiny, {
			id: `many-tiny-${index}`,
			occurredAt: beijingTime(2026, 0, 4, 12),
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: tinyUsage
		}, { maxLedgerEntries: 3, recentSampleKeyCapacity: 300, pricing });
	}
	assert(manyTiny.ledger.length === 3 && manyTiny.archive.frozen.entryCount === 147,
		"large append sequence must preserve the configured recent ledger cap");
	const manyTinyRender = renderLedgerState(manyTiny, 123, pricing);
	assert(manyTinyRender.total.cost === 0.000008,
		"many sub-micro calls must accumulate exactly across compaction");
	assert(manyTinyRender.total.requestCount === 150
		&& manyTinyRender.days[0].models.find((row) => row.model === "deepseek-official/deepseek-v4-flash")?.requestCount === 150,
		"request counts must combine recent ledger and frozen archive entries");

	const estimatedBuckets = { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
	const estimatedState = createLedgerState({
		archive: {
			estimated: {
				importedLegacy: {
					days: {
						"2026-01-05": {
							totals: estimatedBuckets,
							models: { "deepseek-official/deepseek-v4-flash": estimatedBuckets },
							hours: { "12": { "deepseek-official/deepseek-v4-flash": estimatedBuckets } }
						}
					}
				}
			}
		}
	});
	const estimatedRender = renderLedgerState(estimatedState, 123, pricing);
	assert(estimatedRender.total.cost === 1.5 && estimatedRender.hasEstimatedHistory === true
		&& estimatedRender.costBasis.legacy === "legacy-estimated", "estimated sources must render with current pricing and expose their basis");

	const legacyMissingCost = {
		id: "legacy-without-cost",
		occurredAt: beijingTime(2026, 0, 1, 12),
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
	};
	const legacySeed = createLedgerState({ ledger: [legacyMissingCost] });
	const legacyOverflow = recordLedgerState(legacySeed, tiny, { maxLedgerEntries: 1, recentSampleKeyCapacity: 8, pricing });
	assert(legacyOverflow.archive.frozen.entryCount === 0
		&& legacyOverflow.archive.estimated.unfrozenLedger?.days?.["2026-01-01"]?.totals?.inputTokens === 1e6,
		"official legacy entry without any frozen cost field must overflow into estimated.unfrozenLedger");
	assert(renderLedgerState(legacyOverflow, 123, pricing).hasEstimatedHistory === true,
		"unfrozen overflow must be visibly marked as estimated history");

	const trimmed = trimLedgerState(compacted, "2026-01-03");
	assert(trimmed.archive.frozen.entryCount === 0 && trimmed.ledger.length === 1, "trim must remove all layers before cutoff without mutating newer ledger");
	assert(trimmed.recentSampleKeys.some((entry) => entry.key === "id:priced")
		&& trimmed.recentSampleKeys.some((entry) => entry.key === "sample:turn:2:step:1")
		&& !trimmed.recentSampleKeys.some((entry) => entry.key === "id:tiny"),
		"trim must retain dedup keys for detailed entries and remove discarded history keys");
	const cleared = clearLedgerState(compacted);
	assert(cleared.ledger.length === 0 && cleared.archive.frozen.entryCount === 0 && cleared.recentSampleKeys.length === 0,
		"clear must remove ledger, archive, coverage, and dedup state");
	console.log("v3 frozen ledger state contracts ok");
}

//#region pricing input validation preserves lenient persisted normalization
{
	const legacy = normalizePricing({ peakHours: [[25, 30], [9, 12], [1, null]] });
	assert(JSON.stringify(legacy.peakHours) === "[[9,12]]", "normalizePricing must discard out-of-range persisted peak hours");
	const invalidWindows = normalizePricing({ windows: [{ start: "garbage", end: "x" }, { start: "09:00", end: "12:00", tier: "peak" }] });
	assert(invalidWindows.windows.length === 1 && invalidWindows.windows[0].start === "09:00", "normalizePricing must discard malformed persisted schedule windows");
	assert(JSON.stringify(normalizePricing({ peakHours: [[25, 30]] }).peakHours) === "[[9,12],[14,18]]", "normalizePricing must restore default peak hours when all persisted ranges are invalid");
	let threw = null;
	try { validatePricingInput({ peakHours: [[25, 30]] }); } catch (error) { threw = error; }
	assert(threw instanceof TypeError && /peakHours/.test(threw.message), "pricing input rejects out-of-range peak hours");
	threw = null;
	try { validatePricingInput({ peakHours: [[9, "bad"]] }); } catch (error) { threw = error; }
	assert(threw instanceof TypeError && /peakHours/.test(threw.message), "pricing input rejects non-numeric peak hours");
	const valid = validatePricingInput({ peakHours: [[0, 8], [14, 18]] });
	assert(valid.peakHours[0][1] === 8, "pricing input accepts valid peak hours");
	threw = null;
	try { validatePricingInput({ peakMultiplier: -1 }); } catch (error) { threw = error; }
	assert(threw instanceof TypeError && /peakMultiplier/.test(threw.message), "pricing input rejects negative peak multiplier");
	let malformedError = null;
	try { normalizePricing({ peakHours: [null] }); } catch (error) { malformedError = error; }
	assert(malformedError === null, "persisted malformed peak windows must not crash normalization");
	assert(normalizePricing({ peakMultiplier: -1 }).peakMultiplier === 2, "persisted negative peak multiplier falls back to the default");
	console.log("pricing input validation ok");
}

{
	const base = defaultPricing();
	const changedPeak = structuredClone(base);
	changedPeak.models["deepseek-v4-flash"] = { ...changedPeak.models["deepseek-v4-flash"], peak: { inputMiss: 99, inputHit: 88, output: 77 } };
	assert(pricingVersionOf(base) !== pricingVersionOf(changedPeak), "pricing version includes explicit peak prices");
	const changedWeekendRule = { ...base, weekendOffPeakFrom: "2026-09-01" };
	assert(pricingVersionOf(base) !== pricingVersionOf(changedWeekendRule), "pricing version includes the weekend effective date");
}

function sampleEvent(seq, time, type, data) {
	return { type, seq, time, data };
}

function usageChunk(seq, time, turn, step, usage) {
	return sampleEvent(seq, time, "assistant/chunk", { turn, step, chunk: { type: "usage", usage } });
}

function assistantMessage(seq, time, turn, step, model, usage) {
	return sampleEvent(seq, time, "assistant/message", {
		turn,
		step,
		message: { role: "assistant", content: [], source: { kind: "model", provider: "deepseek-official", model } },
		usage
	});
}

function requestHeader(seq, time, model) {
	return sampleEvent(seq, time, "request/header", { header: { config: { provider: "deepseek-official", model } } });
}

function beijingTime(year, month, day, hour, minute = 0) {
	return Date.UTC(year, month, day, hour - 8, minute, 0);
}

//#region basic folding + hourly buckets
{
	const events = [
		requestHeader(1, beijingTime(2026, 0, 2, 4), "deepseek-v4-flash"),
		usageChunk(2, beijingTime(2026, 0, 2, 4, 30), 1, 1, { inputTokens: 100, outputTokens: 20 }),
		usageChunk(3, beijingTime(2026, 0, 2, 9), 1, 2, { inputTokens: 50, outputTokens: 10, cacheReadTokens: 40 })
	];
	const days = foldUsage(events);
	assert(days.size === 1, `expected 1 day, got ${days.size}`);
	const entry = days.get("2026-01-02");
	assert(entry !== void 0, "missing day 2026-01-02");
	assert(entry.totals.inputTokens === 150, `input total ${entry.totals.inputTokens}`);
	assert(entry.totals.outputTokens === 30, `output total ${entry.totals.outputTokens}`);
	assert(entry.totals.cacheReadTokens === 40, `cacheRead total ${entry.totals.cacheReadTokens}`);
	const model = entry.models.get("deepseek-official/deepseek-v4-flash");
	assert(model !== void 0, "missing model bucket");
	assert(model.inputTokens === 150, `model input ${model.inputTokens}`);
	assert(entry.hours.size === 2, `expected 2 hours, got ${entry.hours.size}`);
	const hour4 = entry.hours.get(4);
	assert(hour4 !== void 0 && hour4.get("deepseek-official/deepseek-v4-flash")?.inputTokens === 100, "hour 4 bucket wrong");
	const hour9 = entry.hours.get(9);
	assert(hour9 !== void 0 && hour9.get("deepseek-official/deepseek-v4-flash")?.outputTokens === 10, "hour 9 bucket wrong");
	assert(hourKey(beijingTime(2026, 0, 2, 4, 30)) === 4, "hourKey mismatch");
	console.log("basic folding + hourly buckets ok");
}

//#region replace-last-sample across fold boundaries
{
	// Same (turn, step) re-reported with larger numbers must REPLACE, and the
	// replacement must move the attribution to the later hour/day.
	const state = createUsageState();
	const t1 = beijingTime(2026, 0, 3, 10);
	const t2 = beijingTime(2026, 0, 3, 14);
	const t3 = beijingTime(2026, 0, 4, 2);
	applyUsageDelta(state, [
		requestHeader(1, t1, "deepseek-v4-flash"),
		usageChunk(2, t1, 1, 1, { inputTokens: 100, outputTokens: 10 })
	]);
	applyUsageDelta(state, [
		usageChunk(3, t2, 1, 1, { inputTokens: 200, outputTokens: 30 })
	]);
	const day3 = state.days.get("2026-01-03");
	assert(day3.totals.inputTokens === 200, `replace must not double count, got ${day3.totals.inputTokens}`);
	assert(day3.totals.outputTokens === 30, `replace output ${day3.totals.outputTokens}`);
	assert(day3.hours.get(14).get("deepseek-official/deepseek-v4-flash").inputTokens === 200, "replacement must move to hour 14");
	assert(day3.hours.get(10) === void 0, "old hour bucket must be gone");
	// Replace across a day boundary: sample moves to the later day entirely.
	applyUsageDelta(state, [
		usageChunk(4, t3, 1, 1, { inputTokens: 500, outputTokens: 60 })
	]);
	assert(state.days.get("2026-01-03") === void 0, "day 3 must vanish after cross-day replacement");
	const day4 = state.days.get("2026-01-04");
	assert(day4 !== void 0 && day4.totals.inputTokens === 500, `day 4 input ${day4?.totals.inputTokens}`);
	console.log("replace-last-sample semantics ok");
}

//#region mergeInto
{
	const a = foldUsage([usageChunk(1, beijingTime(2026, 0, 5, 8), 1, 1, { inputTokens: 10, outputTokens: 5 })]);
	const b = foldUsage([usageChunk(1, beijingTime(2026, 0, 5, 9), 1, 1, { inputTokens: 30, outputTokens: 15 })]);
	const byDay = new Map();
	mergeInto(byDay, a);
	mergeInto(byDay, b);
	const entry = byDay.get("2026-01-05");
	assert(entry.totals.inputTokens === 40 && entry.totals.outputTokens === 20, `merge totals ${JSON.stringify(entry.totals)}`);
	assert(entry.hours.get(8).get("unknown/unknown").inputTokens === 10, "merge hour 8");
	assert(entry.hours.get(9).get("unknown/unknown").inputTokens === 30, "merge hour 9");
	console.log("mergeInto ok");
}

//#region pricing + cost
{
	const pricing = defaultPricing();
	assert(pricing.currency === "CNY", `default currency ${pricing.currency}`);
	assert(pricing.weekendOffPeakFrom === "2026-08-23", `weekend rule effective date ${pricing.weekendOffPeakFrom}`);
	assert(priceOf("deepseek-official/deepseek-v4-flash", pricing).inputMiss === 1.5, "flash price");
	assert(priceOf("deepseek-official/deepseek-v4-pro", pricing).inputMiss === 4.5, "pro price");
	assert(priceOf("deepseek-official/deepseek-v4-flash-vision-exp", pricing).inputMiss === 1.5, "vision flash price");
	assert(priceOf("deepseek-official/unknown-model", pricing) === null, "unknown model must remain unpriced");
	assert(priceOf("x/y", {}) === null, "empty config must not guess a model price");
	assert(costOf("deepseek-official/unknown-model", { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, 12, pricing) === null, "unknown model cost must be null");
	assert(costOf("external-relay/deepseek-v4-flash", { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, 12, pricing) === null,
		"a DeepSeek-named model served by a non-official provider must remain token-only");
	// 1M input (miss) + 1M output at flash idle time: ¥1.5 + ¥4.5 = ¥6
	const cost = costOf("deepseek-official/deepseek-v4-flash", { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 0, cacheWriteTokens: 0 }, 12, pricing);
	assert(Math.abs(cost - 6) < 1e-9, `flash cost ${cost}`);
	// Cache-read tokens bill at the cache-hit rate.
	const hitCost = costOf("deepseek-official/deepseek-v4-flash", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1e6, cacheWriteTokens: 0 }, 12, pricing);
	assert(Math.abs(hitCost - 0.05) < 1e-9, `hit cost ${hitCost}`);
	assert(pricing.peakMultiplier === 2 && JSON.stringify(pricing.peakHours) === "[[9,12],[14,18]]", "official Beijing peak windows");
	// Beijing 10:00 is peak: ¥1.5 × 2 = ¥3.
	const peakCost = costOf("deepseek-official/deepseek-v4-flash", { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, 10, pricing);
	assert(Math.abs(peakCost - 3) < 1e-9, `peak cost ${peakCost}`);
	const visionPeakCost = costOf("deepseek-official/deepseek-v4-flash-vision-exp", { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 0, cacheWriteTokens: 0 }, 10, pricing);
	assert(Math.abs(visionPeakCost - 12) < 1e-9, `vision peak cost ${visionPeakCost}`);
	assert(isPeakBillingPeriod("2026-08-22", 10, pricing) === true, "生效日前的周六仍执行原高峰价");
	assert(isPeakBillingPeriod("2026-08-23", 10, pricing) === false, "生效日起的周日全天低谷价");
	assert(isPeakBillingPeriod("2026-08-24", 10, pricing) === true, "生效后的工作日继续执行高峰价");
	const sundayCost = costOf("deepseek-official/deepseek-v4-flash", { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, 10, pricing, "2026-08-23");
	assert(Math.abs(sundayCost - 1.5) < 1e-9, `周日 10 点应按低谷价计费: ${sundayCost}`);
	const mondayCost = costOf("deepseek-official/deepseek-v4-flash", { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, 10, pricing, "2026-08-24");
	assert(Math.abs(mondayCost - 3) < 1e-9, `周一 10 点应按高峰价计费: ${mondayCost}`);
	// Custom pricing override works.
	const custom = { ...pricing, pricing: { ...pricing.pricing, "my-model": { inputMiss: 1, inputHit: 0.1, output: 2 } } };
	assert(priceOf("p/my-model", custom).output === 2, "custom model price");
	const unpricedDays = foldUsage([
		requestHeader(10, beijingTime(2026, 0, 8, 3), "model-not-configured"),
		usageChunk(11, beijingTime(2026, 0, 8, 3, 1), 1, 1, { inputTokens: 100, outputTokens: 20 })
	]);
	const unpriced = renderUsage(unpricedDays, 123, pricing);
	assert(unpriced.days[0].models[0].cost === null, "unpriced model row cost must be null");
	assert(unpriced.days[0].hours[3].cost === null && unpriced.days[0].cost === null, "unpriced hour/day cost must be null");
	assert(unpriced.total.cost === null, "unpriced total cost must be null");
	console.log("pricing + cost math ok");
}

//#region non-official providers are token-only (never blank the official cost)
{
	const pricing = defaultPricing();
	const events = [
		assistantMessage(1, beijingTime(2026, 7, 20, 10), 1, 1, "deepseek-v4-flash", { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0 }),
		sampleEvent(2, beijingTime(2026, 7, 20, 10, 5), "assistant/message", {
			turn: 1,
			step: 2,
			message: { role: "assistant", content: [], source: { kind: "model", provider: "zai-coding-cn", model: "glm-5.2" } },
			usage: { inputTokens: 900, outputTokens: 10, cacheReadTokens: 0 }
		})
	];
	const mixed = renderUsage(foldUsage(events), 123, pricing);
	const day = mixed.days[0];
	assert(day.cost !== null && day.cost > 0, "non-official provider must not blank the official day cost");
	assert(day.models.some((model) => model.model === "zai-coding-cn/glm-5.2" && model.cost === null), "non-official provider model stays token-only");
	assert(day.models.some((model) => model.model === "deepseek-official/deepseek-v4-flash" && model.cost !== null), "official model is priced");
	console.log("non-official provider token-only ok");
}

//#region ledger projection isolates call-level entries from session turn/step replacement
{
	const ledger = [
		// Distinct sessions can both emit turn 2 / step 3. The call ledger has
		// already deduplicated a stream/final pair by sampleKey before projection,
		// so these independent calls must add instead of replacing one another.
		{ id: "session-a-call", occurredAt: beijingTime(2026, 0, 6, 16), completedAt: beijingTime(2026, 0, 6, 16), provider: "deepseek-official", model: "deepseek-v4-flash", turn: 2, step: 3, usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 20 } },
		{ id: "session-b-call", occurredAt: beijingTime(2026, 0, 6, 16), completedAt: beijingTime(2026, 0, 6, 16), provider: "deepseek-official", model: "deepseek-v4-flash", turn: 2, step: 3, usage: { inputTokens: 120, outputTokens: 12, cacheReadTokens: 30 } }
	];
	const days = foldLedger(ledger);
	const totals = days.get("2026-01-06")?.totals;
	assert(totals?.inputTokens === 220 && totals?.outputTokens === 22 && totals?.cacheReadTokens === 50,
		"ledger projection must not let independent calls with the same turn/step replace one another");
	const events = ledgerToEvents(ledger);
	assert(events[0].data.step !== events[1].data.step, "ledger projection must emit a unique sample key for every stored call");
	console.log("ledger projection call isolation ok");
}

//#region v3 rendering keeps official cost when token-only providers coexist
{
	const pricing = defaultPricing();
	const mixed = renderLedgerState(createLedgerState({
		ledger: [
			{
				id: "official-call",
				occurredAt: beijingTime(2026, 0, 6, 11),
				completedAt: beijingTime(2026, 0, 6, 11),
				provider: "deepseek-official",
				model: "deepseek-v4-flash",
				usage: { inputTokens: 100, outputTokens: 20 },
				costCny: 0.0002
			},
			{
				id: "token-only-call",
				occurredAt: beijingTime(2026, 0, 6, 11),
				completedAt: beijingTime(2026, 0, 6, 11),
				provider: "zai-coding-cn",
				model: "glm-5.2",
				usage: { inputTokens: 900, outputTokens: 10 },
				costCny: null
			}
		]
	}), 123, pricing);
	const day = mixed.days[0];
	assert(day.cost === 0.0002, `token-only provider must not blank combined day cost: ${day.cost}`);
	assert(day.hours[11].cost === 0.0002, `token-only provider must not blank combined hour cost: ${day.hours[11].cost}`);
	assert(mixed.total.cost === 0.0002, `token-only provider must not blank combined total cost: ${mixed.total.cost}`);
	assert(day.models.some((model) => model.model === "zai-coding-cn/glm-5.2" && model.cost === null), "token-only model remains unpriced");
	const official = filterRenderedUsageByProvider(mixed, "deepseek-official");
	assert(official.days.length === 1 && official.days[0].tokens === 120 && official.total.tokens === 120, "provider filter recomputes official day and total tokens");
	assert(official.days[0].models.length === 1 && official.days[0].models[0].model === "deepseek-official/deepseek-v4-flash", "provider filter removes other provider model rows");
	assert(official.days[0].hours[11].tokens === 120 && official.days[0].hours[11].models.length === 1, "provider filter recomputes hour rows");
	assert(official.days[0].cost === 0.0002 && official.total.cost === 0.0002, "provider filter preserves official priced cost");
	const tokenOnly = filterRenderedUsageByProvider(mixed, "zai-coding-cn");
	assert(tokenOnly.days[0].tokens === 910 && tokenOnly.total.tokens === 910, "provider filter recomputes token-only totals");
	assert(tokenOnly.days[0].models.length === 1 && tokenOnly.days[0].models[0].model === "zai-coding-cn/glm-5.2", "provider filter keeps only the selected token-only model");
	assert(tokenOnly.days[0].hours[11].tokens === 910 && tokenOnly.days[0].cost === null && tokenOnly.total.cost === null, "token-only provider remains explicitly unpriced after filtering");
	const absent = filterRenderedUsageByProvider(mixed, "missing-provider");
	assert(absent.days.length === 1 && absent.days[0].tokens === 0 && absent.total.tokens === 0, "provider filter preserves calendar days while zeroing an absent provider");
	console.log("v3 mixed-provider cost isolation ok");
}

{
	const ledger = [];
	appendLedger(ledger, { id: "early", sampleKey: "route:pending:1", provider: "p", model: "m", usage: { inputTokens: 10 } });
	appendLedger(ledger, { id: "final", sampleKey: "route:pending:1", provider: "p", model: "m", usage: { inputTokens: 20 } });
	assert(ledger.length === 1 && ledger[0].usage.inputTokens === 20 && ledger[0].id === "early",
		"ledger append must upsert the finalized sample without adding a second call");
	console.log("ledger finalized sample upsert ok");
}

//#region samples without turn/step metadata must accumulate, not replace
{
	const folded = foldUsage([
		{ type: "assistant/message", time: 1750000000000, data: { usage: { inputTokens: 1000, outputTokens: 0 }, message: { source: { provider: "deepseek-official", model: "deepseek-chat" } } } },
		{ type: "assistant/message", time: 1750000300000, data: { usage: { inputTokens: 2000, outputTokens: 0 }, message: { source: { provider: "deepseek-official", model: "deepseek-chat" } } } }
	]);
	let metadataLessTotal = 0;
	for (const [, entry] of folded) metadataLessTotal += entry.totals.inputTokens;
	assert(metadataLessTotal === 3000, `metadata-less samples must add, not replace: ${metadataLessTotal}`);
	const nullMetadata = foldUsage([
		{ type: "assistant/message", time: 1750000000000, data: { turn: null, step: null, usage: { inputTokens: 1000, outputTokens: 0 } } },
		{ type: "assistant/message", time: 1750000300000, data: { turn: null, step: null, usage: { inputTokens: 2000, outputTokens: 0 } } }
	]);
	let nullMetadataTotal = 0;
	for (const [, entry] of nullMetadata) nullMetadataTotal += entry.totals.inputTokens;
	assert(nullMetadataTotal === 3000, `null turn/step samples must add, not replace: ${nullMetadataTotal}`);
	const replaced = foldUsage([
		{ type: "assistant/chunk", time: 1750000000000, data: { turn: 1, step: 0, chunk: { type: "usage", usage: { inputTokens: 500 } } } },
		{ type: "assistant/message", time: 1750000000001, data: { turn: 1, step: 0, usage: { inputTokens: 600 } } }
	]);
	let replacedTotal = 0;
	for (const [, entry] of replaced) replacedTotal += entry.totals.inputTokens;
	assert(replacedTotal === 600, `same (turn, step) replacement must survive: ${replacedTotal}`);
	console.log("metadata-less sample accumulation ok");
}

//#region legacy costCny entries must satisfy the strict v3 state schema
{
	const converted = [];
	appendLedger(converted, { occurredAt: 1, provider: "deepseek-official", model: "m", usage: { inputTokens: 1 }, costState: "priced", costCny: 0.5 });
	assert(converted[0].costNanosCny === "500000000" && converted[0].costCny === void 0,
		`priced entries with legacy costCny must convert to nanos: ${JSON.stringify(converted[0])}`);
	const unpriced = [];
	appendLedger(unpriced, { occurredAt: 1, provider: "deepseek-official", model: "m", usage: { inputTokens: 1 }, costCny: null });
	assert(unpriced[0].costState === "unpriced" && unpriced[0].costCny === void 0,
		`null costCny must normalize to unpriced: ${JSON.stringify(unpriced[0])}`);
	const malformed = [];
	appendLedger(malformed, { occurredAt: 1, provider: "deepseek-official", model: "m", usage: { inputTokens: 1 }, costState: "priced" });
	assert(malformed[0].costState === "unpriced" && malformed[0].costNanosCny === void 0,
		`priced entries without a frozen amount must normalize to unpriced: ${JSON.stringify(malformed[0])}`);
	let malformedStateValid = true;
	try { StateSchema.parse(recordLedgerState(createEmptyUsageState(), malformed[0])); } catch { malformedStateValid = false; }
	assert(malformedStateValid, "normalized malformed priced entries must satisfy the strict state schema");
	const invalidLegacyCost = [];
	appendLedger(invalidLegacyCost, { occurredAt: 1, provider: "deepseek-official", model: "m", usage: { inputTokens: 1 }, costCny: -1 });
	assert(invalidLegacyCost[0].costState === "unpriced" && invalidLegacyCost[0].costNanosCny === void 0,
		`invalid legacy cost must normalize to unpriced: ${JSON.stringify(invalidLegacyCost[0])}`);
	let persisted;
	try {
		persisted = StateSchema.parse(recordLedgerState(createEmptyUsageState(), {
			occurredAt: 1750000000000,
			completedAt: 1750000000000,
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: { inputTokens: 100, outputTokens: 20 },
			costCny: 0.0002
		}));
	} catch (error) {
		assert(false, `recordLedgerState with legacy costCny must satisfy the strict state schema: ${String(error).slice(0, 200)}`);
	}
	if (persisted !== void 0) {
		assert(persisted.ledger[0].costCny === void 0 && persisted.ledger[0].costNanosCny === "200000",
			`persisted entry must carry nanos only: ${JSON.stringify(persisted.ledger[0])}`);
		assert(renderLedgerState(persisted, 123, defaultPricing()).total.cost === 0.0002,
			"frozen legacy cost must survive the schema round-trip");
	}
	console.log("legacy costCny schema round-trip ok");
}

//#region renderUsage wire shape
{
	const pricing = defaultPricing();
	const days = foldUsage([
		requestHeader(1, beijingTime(2026, 0, 6, 3), "deepseek-v4-flash"),
		usageChunk(2, beijingTime(2026, 0, 6, 3, 30), 1, 1, { inputTokens: 2e6, outputTokens: 1e6, cacheReadTokens: 500000 }),
		usageChunk(3, beijingTime(2026, 0, 6, 11), 2, 1, { inputTokens: 1e6, outputTokens: 0 })
	]);
	const rendered = renderUsage(days, 123, pricing);
	assert(rendered.days.length === 1, `days length ${rendered.days.length}`);
	const day = rendered.days[0];
	assert(day.hours.length === 24, `hours length ${day.hours.length}`);
	assert(day.hours[3].tokens === 3.5e6, `hour 3 tokens ${day.hours[3].tokens}`);
	assert(day.hours[11].tokens === 1e6, `hour 11 tokens ${day.hours[11].tokens}`);
	assert(day.hours[0].tokens === 0, "hour 0 must be zero-filled");
	assert(day.models.length === 1, `models ${day.models.length}`);
	// Beijing 03:00 is idle: miss 2M → ¥3; hit 0.5M → ¥0.025; output 1M → ¥4.5.
	assert(Math.abs(day.hours[3].cost - 7.525) < 1e-6, `hour 3 cost ${day.hours[3].cost}`);
	// Beijing 11:00 is peak: 1M cache-miss input ¥1.5 × 2 = ¥3.
	assert(Math.abs(day.hours[11].cost - 3) < 1e-6, `hour 11 cost ${day.hours[11].cost}`);
	// Day cost = sum of hour costs.
	const expectedDayCost = day.hours.reduce((sum, hour) => sum + hour.cost, 0);
	assert(Math.abs(day.cost - expectedDayCost) < 1e-6, `day cost ${day.cost} vs ${expectedDayCost}`);
	assert(rendered.total.tokens === 4.5e6, `total tokens ${rendered.total.tokens}`);
	assert(rendered.total.cost === day.cost, `total cost ${rendered.total.cost}`);
	console.log("renderUsage wire shape ok");
}

//#region real session log fold (when available)
const realLog = process.env.DSH_SESSION_LOG;
if (realLog !== void 0 && realLog !== "") {
	let events = [];
	try {
		const raw = readFileSync(realLog, "utf8");
		events = raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
	} catch (error) {
		assert(false, `cannot read real session log: ${String(error)}`);
	}
	if (events.length > 0) {
		const days = foldUsage(events);
		assert(days.size > 0, "real log must produce at least one day");
		let total = 0;
		for (const [, entry] of days) total += totalTokens(entry.totals);
		assert(total > 0, `real log total tokens must be > 0, got ${total}`);
		const rendered = renderUsage(days, Date.now(), defaultPricing());
		assert(rendered.days.length === days.size, "rendered day count");
		for (const day of rendered.days) {
			assert(day.hours.length === 24, `day ${day.date} hours`);
			const hourTotal = day.hours.reduce((sum, hour) => sum + hour.tokens, 0);
			assert(Math.abs(hourTotal - day.tokens) < 1e-6, `day ${day.date} hour sum ${hourTotal} vs ${day.tokens}`);
			const modelTotal = day.models.reduce((sum, model) => sum + model.tokens, 0);
			assert(Math.abs(modelTotal - day.tokens) < 1e-6, `day ${day.date} model sum ${modelTotal} vs ${day.tokens}`);
		}
		console.log(`real session log fold ok: ${rendered.days.length} days, ${total} tokens total`);
	}
}

//#region serialization round-trip parity (plain-object JSON like index.js cache)
{
	const events = [
		requestHeader(1, beijingTime(2026, 0, 7, 5), "deepseek-v4-flash"),
		usageChunk(2, beijingTime(2026, 0, 7, 5, 30), 1, 1, { inputTokens: 100, outputTokens: 20 }),
		usageChunk(3, beijingTime(2026, 0, 7, 6), 1, 2, { inputTokens: 50, outputTokens: 10 })
	];
	const state = createUsageState();
	applyUsageDelta(state, events);
	const serialized = {
		kind: "persisted",
		consumed: state.consumed,
		days: Object.fromEntries([...state.days.entries()].map(([date, entry]) => [
			date,
			{
				totals: { ...entry.totals },
				models: Object.fromEntries([...entry.models.entries()].map(([m, b]) => [m, { ...b }])),
				hours: Object.fromEntries([...entry.hours.entries()].map(([h, byModel]) => [
					h,
					Object.fromEntries([...byModel.entries()].map(([m, b]) => [m, { ...b }]))
				]))
			}
		])),
		lastSample: null,
		currentModel: state.currentModel
	};
	const json = JSON.stringify(serialized);
	const round = JSON.parse(json);
	assert(round.days["2026-01-07"].hours["5"]["deepseek-official/deepseek-v4-flash"].inputTokens === 100, "serialization round-trip hour");
	assert(Object.keys(round.days).length === 1, "serialization round-trip days");
	console.log("serialization round-trip parity ok");
}



//#region call-level ledger: request-start-time attribution
{
	// 账本条目按【完成时间】(completedAt，缺失时回退 occurredAt) 归小时并判峰谷。
	// 无 completedAt 的旧条目按发起时间归小时：17:59 发起 → 计入 17 点（高峰价）。
	const ledger = [];
	appendLedger(ledger, { occurredAt: beijingTime(2026, 0, 2, 17, 59), provider: "deepseek-official", model: "deepseek-v4-flash", usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 1000 } });
	appendLedger(ledger, { occurredAt: beijingTime(2026, 0, 2, 18, 1), provider: "deepseek-official", model: "deepseek-v4-flash", usage: { inputTokens: 200, outputTokens: 20, cacheReadTokens: 0 } });
	assert(ledger.length === 2, `ledger length ${ledger.length}`);

	const byDay = foldLedger(ledger);
	assert(byDay.size === 1, `ledger days ${byDay.size}`);
	const entry = byDay.get("2026-01-02");
	const hour17 = entry.hours.get(17);
	assert(hour17 !== void 0 && hour17.get("deepseek-official/deepseek-v4-flash")?.inputTokens === 100, "17:59 条目必须归到 17 点（发起时间）");
	assert(entry.hours.get(18)?.get("deepseek-official/deepseek-v4-flash")?.inputTokens === 200, "18:01 条目归到 18 点");

	// 峰谷：17 点高峰价（×2）、18 点空闲价
	const rendered = renderLedger(ledger, 0, defaultPricing());
	const day = rendered.days[0];
	const cost17 = day.hours[17].cost;
	const cost18 = day.hours[18].cost;
	assert(Math.abs(cost17 - ((100 * 3 + 50 * 9 + 1000 * 0.1) / 1e6)) < 1e-9, `hour17 高峰价 ${cost17}`);
	assert(Math.abs(cost18 - ((200 * 1.5 + 20 * 4.5) / 1e6)) < 1e-9, `hour18 空闲价 ${cost18}`);

	// 伪事件：turn/step 唯一，source 携带 provider/model，time=发起时间
	const events = ledgerToEvents(ledger);
	assert(events.length === 2, `events ${events.length}`);
	assert(events[0].time === beijingTime(2026, 0, 2, 17, 59), "伪事件 time 必须是发起时间");
	assert(events[0].data.turn === 0 && events[0].data.step === 1 && events[1].data.step === 2, "伪事件 step 必须唯一（避免替换语义误触发）");
	assert(events[0].data.message.source.provider === "deepseek-official" && events[0].data.message.source.model === "deepseek-v4-flash", "伪事件 source 必须携带 provider/model");
	assert(events[0].data.usage.inputTokens === 100, "伪事件 usage 原样保留");

	// 归属基准是【完成时间】(completedAt)：发起 17:59(高峰)、完成 18:01 → 归 18 点空闲价
	const completedLedger = [];
	appendLedger(completedLedger, {
		occurredAt: beijingTime(2026, 0, 2, 17, 59),
		completedAt: beijingTime(2026, 0, 2, 18, 1),
		provider: "deepseek-official", model: "deepseek-v4-flash",
		usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 1000 }
	});
	const completedByDay = foldLedger(completedLedger);
	assert(completedByDay.get("2026-01-02").hours.get(18) !== void 0, "completedAt 决定小时归属（18 点）");
	assert(completedByDay.get("2026-01-02").hours.get(17) === void 0, "发起时间不再决定归属");
	const completedRender = renderLedger(completedLedger, 0, defaultPricing());
	assert(Math.abs(completedRender.days[0].hours[18].cost - ((100 * 1.5 + 50 * 4.5 + 1000 * 0.05) / 1e6)) < 1e-9, "完成小时按空闲价计费");
	// 旧条目无 completedAt → 回退 occurredAt
	const legacyEntry = [];
	appendLedger(legacyEntry, { occurredAt: beijingTime(2026, 0, 2, 17, 59), provider: "p", model: "m", usage: { inputTokens: 10, outputTokens: 0 } });
	assert(foldLedger(legacyEntry).get("2026-01-02").hours.get(17) !== void 0, "无 completedAt 回退 occurredAt");

	// 去重：相邻完全相同的条目只保留一条
	const dupLedger = [];
	appendLedger(dupLedger, { id: "call-1", occurredAt: 1000, provider: "p", model: "m", usage: { inputTokens: 5, outputTokens: 0 } });
	appendLedger(dupLedger, { id: "call-1", occurredAt: 1000, provider: "p", model: "m", usage: { inputTokens: 5, outputTokens: 0 } });
	assert(dupLedger.length === 1, `相同调用 ID 必须去重: ${dupLedger.length}`);
	// 同一毫秒、相同 usage 也可能是两次真实调用，不能按内容误去重。
	appendLedger(dupLedger, { id: "call-2", occurredAt: 1000, provider: "p", model: "m", usage: { inputTokens: 5, outputTokens: 0 } });
	assert(dupLedger.length === 2, `不同调用 ID 不应去重: ${dupLedger.length}`);

	// usage 字段规范化：缺失字段补 0
	const normLedger = [];
	appendLedger(normLedger, { occurredAt: 2000, provider: "p", model: "m", usage: { inputTokens: 3 } });
	assert(normLedger[0].usage.outputTokens === 0 && normLedger[0].usage.cacheReadTokens === 0 && normLedger[0].usage.cacheWriteTokens === 0, "usage 缺失字段必须补 0");

	// 新账本在落账时冻结费用；之后修改当前价格不得重写历史。
	const frozen = freezeLedgerEntry({
		id: "priced-call",
		occurredAt: beijingTime(2026, 0, 2, 18, 1),
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 1e6, outputTokens: 0 }
	}, defaultPricing());
	assert(frozen.costState === "priced" && frozen.costNanosCny === "1500000000" && typeof frozen.pricingVersion === "string" && frozen.pricingVersion !== "", "落账必须冻结纳元费用与价格版本");
	const weekendFrozen = freezeLedgerEntry({
		id: "weekend-priced-call",
		occurredAt: beijingTime(2026, 7, 23, 9, 59),
		completedAt: beijingTime(2026, 7, 23, 10, 0),
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 1e6, outputTokens: 0 }
	}, defaultPricing());
	assert(weekendFrozen.costNanosCny === "1500000000", `周末账本必须按完成日的低谷价冻结: ${weekendFrozen.costNanosCny}`);
	const raised = defaultPricing();
	raised.pricing["deepseek-v4-flash"] = { inputMiss: 99, inputHit: 99, output: 99 };
	const frozenRender = renderLedger([frozen], 0, raised);
	assert(frozenRender.days[0].cost === 1.5, `历史费用不得随当前价格漂移: ${frozenRender.days[0].cost}`);

	console.log("call-level ledger attribution ok");
}

if (failures > 0) {
	console.error(`\n${failures} test(s) failed`);
	process.exit(1);
}
console.log("\nusage tests: all passed");
