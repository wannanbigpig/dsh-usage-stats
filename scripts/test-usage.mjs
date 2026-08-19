// Offline unit tests for the pure usage-folding engine (lib/usage.js).
// Folds a REAL captured session log when one is available and verifies the
// day/hour/model buckets, replace-last-sample semantics, hourly totals, and
// model-priced cost math. Fully offline.
import { readFileSync } from "node:fs";
import {
	applyUsageDelta,
	costOf,
	createUsageState,
	dayKey,
	defaultPricing,
	foldUsage,
	hourKey,
	mergeInto,
	priceOf,
	renderUsage,
	totalTokens,
	zeroBuckets
} from "../lib/usage.js";
import {
	appendLedger,
	freezeLedgerEntry,
	ledgerToEvents,
	foldLedger,
	renderLedger
} from "../lib/ledger.js";

let failures = 0;
function assert(condition, message) {
	if (!condition) {
		failures += 1;
		console.error(`FAIL: ${message}`);
	}
}

// Official peak windows and day boundaries are fixed to Beijing time (UTC+8),
// independent of the machine's local timezone.
assert(dayKey(Date.UTC(2026, 0, 1, 16, 0, 0)) === "2026-01-02", "Beijing day boundary");
assert(hourKey(Date.UTC(2026, 0, 1, 1, 0, 0)) === 9, "Beijing peak-hour boundary");

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
	assert(priceOf("deepseek-official/deepseek-v4-flash", pricing).inputMiss === 1.5, "flash price");
	assert(priceOf("deepseek-official/deepseek-v4-pro", pricing).inputMiss === 4.5, "pro price");
	assert(priceOf("deepseek-official/unknown-model", pricing) === null, "unknown model must remain unpriced");
	assert(priceOf("x/y", {}) === null, "empty config must not guess a model price");
	assert(costOf("deepseek-official/unknown-model", { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, 12, pricing) === null, "unknown model cost must be null");
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
	assert(frozen.costCny === 1.5 && typeof frozen.pricingVersion === "string" && frozen.pricingVersion !== "", "落账必须冻结费用与价格版本");
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
