import assert from "node:assert/strict";
import { dayKey } from "../lib/usage.js";
import { filterEventsBeforeCoverage, rebuildEstimatedFromPersistence } from "../lib/rebuild.js";
import { callRebuildRpc, parseArguments } from "./rebuild-today-legacy.mjs";

assert.deepEqual(parseArguments(["--base-url", "http://127.0.0.1:2026", "--apply", "--timeout-ms", "2000"]), { baseUrl: "http://127.0.0.1:2026", apply: true, timeoutMs: 2000 });
assert.throws(() => parseArguments(["--base-url"]), /requires a value/);
assert.throws(() => parseArguments(["--base-url", "http://127.0.0.1:2026", "--unknown"]), /unknown argument/);
assert.throws(() => parseArguments(["--base-url", "file:///tmp/rebuild"]), /HTTP\(S\)/);

await assert.rejects(
	() => callRebuildRpc({
		baseUrl: "http://127.0.0.1:2026",
		timeoutMs: 10,
		fetchImpl: async () => ({ ok: false, status: 502, text: () => new Promise(() => {}) })
	}),
	(error) => error?.name === "TimeoutError",
	"a non-OK response body must remain bounded by the RPC timeout"
);
await assert.rejects(
	() => callRebuildRpc({
		baseUrl: "http://127.0.0.1:2026",
		fetchImpl: async () => ({ ok: false, status: 403, text: async () => "channel denied" })
	}),
	/HTTP 403: channel denied/,
	"a completed non-OK response body must remain actionable"
);

const before = Date.parse("2026-08-24T01:00:00.000Z");
const cutoff = Date.parse("2026-08-24T02:00:00.000Z");
const inFlight = Date.parse("2026-08-24T02:30:00.000Z");
const after = Date.parse("2026-08-24T03:00:00.000Z");
const cutoffs = { [dayKey(cutoff)]: cutoff };

const events = [
	{ time: before, type: "assistant/message", data: { usage: { inputTokens: 10 } } },
	{ time: inFlight, type: "assistant/chunk", data: { chunk: { type: "usage", usage: { inputTokens: 15 } } } },
	{ time: cutoff, type: "assistant/message", data: { usage: { inputTokens: 20 } } },
	{ time: after, type: "assistant/message", data: { usage: { inputTokens: 30 } } }
];
assert.deepEqual(filterEventsBeforeCoverage(events, cutoffs).map((event) => event.time), [before], "recovery must not replay events already covered by the ledger");

const crossDayStart = Date.parse("2026-08-24T15:59:00.000Z");
const crossDayCutoffs = {
	"2026-08-24": crossDayStart,
	"2026-08-25": Date.parse("2026-08-24T16:00:00.000Z")
};
assert.deepEqual(filterEventsBeforeCoverage([
	{ time: Date.parse("2026-08-24T15:58:00.000Z") },
	{ time: Date.parse("2026-08-24T16:00:30.000Z") }
], crossDayCutoffs).map((event) => event.time), [Date.parse("2026-08-24T15:58:00.000Z")], "a cross-midnight ledger call must keep both calendar partitions disjoint");

console.log("legacy recovery boundaries ok");

const persistenceCalls = [];
const sessionPersistence = {
	listSnapshots: async (signal) => {
		persistenceCalls.push(["listSnapshots", signal]);
		return [
			{ header: { id: "session-a" }, revision: "r1" },
			{ header: { id: "session-b" }, revision: "r2" }
		];
	},
	readFrom: async (id, fromSeq, signal) => {
		persistenceCalls.push(["readFrom", id, fromSeq, signal]);
		const inputTokens = id === "session-a" ? 10 : 20;
		return {
			meta: { id },
			events: [{
				seq: 0,
				time: before,
				type: "assistant/message",
				data: {
					turn: 1,
					step: 1,
					message: { role: "assistant", content: [], source: { kind: "model", provider: "deepseek-official", model: "deepseek-v4-flash" } },
					usage: { inputTokens, outputTokens: 1 }
				}
			}]
		};
	}
};
const signal = new AbortController().signal;
const rebuilt = await rebuildEstimatedFromPersistence(sessionPersistence, {
	coverageCutoffsByDay: cutoffs
}, { signal, now: () => 1234 });
assert.equal(rebuilt.updatedAt, 1234);
assert.equal(rebuilt.sessionCount, 2);
assert.equal(rebuilt.days[dayKey(before)].totals.inputTokens, 30);
assert.equal(persistenceCalls[0][0], "listSnapshots");
assert.equal(persistenceCalls.filter((call) => call[0] === "readFrom").length, 2);
assert.ok(persistenceCalls.filter((call) => call[0] === "readFrom").every((call) => call[2] === 0 && call[3] === signal));

const failedPersistence = {
	listSnapshots: async () => [{ header: { id: "broken" }, revision: "r" }],
	readFrom: async () => { throw new Error("corrupt session"); }
};
await assert.rejects(
	() => rebuildEstimatedFromPersistence(failedPersistence, { coverageCutoffsByDay: {} }),
	/corrupt session/,
	"a failed session read must reject the whole rebuild before storage replacement"
);

const abortedDuringRead = new AbortController();
await assert.rejects(
	() => rebuildEstimatedFromPersistence({
		listSnapshots: async () => [{ header: { id: "cancelled" } }],
		readFrom: async () => {
			abortedDuringRead.abort();
			return { events: [] };
		}
	}, { coverageCutoffsByDay: {} }, { signal: abortedDuringRead.signal }),
	(error) => error?.name === "AbortError",
	"an abort observed during the final read must reject before producing a committable rebuild"
);

console.log("official sessionPersistence rebuild contract ok");
