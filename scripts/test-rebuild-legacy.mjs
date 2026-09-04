import assert from "node:assert/strict";
import { dayKey } from "../lib/usage.js";
import { filterEventsBeforeCoverage, rebuildEstimatedFromPersistence } from "../lib/rebuild.js";
import { SessionFormatUnsupportedError } from "@deepseek-ai/dsh-session-persistence";
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

const mixedPersistence = {
	listSnapshots: async () => [
		{ header: { id: "future" }, revision: "r1" },
		{ header: { id: "readable" }, revision: "r2" }
	],
	readFrom: async (id) => {
		if (id === "future") {
			throw new SessionFormatUnsupportedError('session "future" contains event type "future/event" (seq 3) unknown to this harness; refusing to interpret the log — it was likely written by a newer harness');
		}
		return {
			meta: { id },
			events: [{ seq: 0, time: before, type: "assistant/message", data: { usage: { inputTokens: 7 } } }]
		};
	}
};
const mixed = await rebuildEstimatedFromPersistence(mixedPersistence, { coverageCutoffsByDay: {} }, { now: () => 4321 });
assert.equal(mixed.unreadableSessions, 1, "a session written by a newer harness must be skipped, not fail the rebuild");
assert.equal(mixed.sessionCount, 2, "sessionCount keeps reporting every snapshot the registry listed");
assert.equal(mixed.days[dayKey(before)].totals.inputTokens, 7, "readable sessions must still fold into the rebuild");

const namedUnsupported = Object.assign(new Error('session "legacy" contains event type "old/event" unknown to this harness'), { name: "SessionFormatUnsupportedError" });
const namedPersistence = {
	listSnapshots: async () => [{ header: { id: "legacy" } }],
	readFrom: async () => { throw namedUnsupported; }
};
const named = await rebuildEstimatedFromPersistence(namedPersistence, { coverageCutoffsByDay: {} }, { now: () => 4321 });
assert.equal(named.unreadableSessions, 1, "the skip must also work when the host shapes the error differently");

console.log("official sessionPersistence rebuild contract ok");

// Hosts from dsh-0.1.2-alpha.4 replace listSnapshots()/readFrom() with the
// handle-based seam: list() plus open(id, 'read') returning a SessionHandle
// whose read(offset, length) yields the flat event array. The rebuild must
// serve both generations and close every handle it opens.
const modernCalls = [];
const modernPersistence = {
	list: async (options) => {
		modernCalls.push(["list", options]);
		return [
			{ header: { id: "session-a" }, revision: "r1" },
			{ header: { id: "session-b" }, revision: "r2" }
		];
	},
	open: async (id, access, options) => {
		modernCalls.push(["open", id, access, options]);
		return {
			read: async (offset, length, readOptions) => {
				modernCalls.push(["read", id, offset, length]);
				return [{
					seq: offset,
					time: before,
					type: "assistant/message",
					data: { usage: { inputTokens: id === "session-a" ? 10 : 20 } }
				}];
			},
			close: async () => { modernCalls.push(["close", id]); }
		};
	}
};
const modernRebuilt = await rebuildEstimatedFromPersistence(modernPersistence, { coverageCutoffsByDay: {} }, { now: () => 5678 });
assert.equal(modernRebuilt.updatedAt, 5678);
assert.equal(modernRebuilt.sessionCount, 2);
assert.equal(modernRebuilt.days[dayKey(before)].totals.inputTokens, 30);
assert.equal(modernCalls[0][0], "list", "the handle seam must be discovered through list(), not listSnapshots()");
assert.ok(modernCalls.filter((call) => call[0] === "open").every((call) => call[2] === "read" && call[3]?.signal === void 0), "sessions open read-only");
assert.ok(modernCalls.filter((call) => call[0] === "read").every((call) => call[2] === 0), "every handle reads the whole log from offset 0");
assert.equal(modernCalls.filter((call) => call[0] === "close").length, 2, "every opened read handle must be closed");

const modernMixedCloses = [];
const modernMixed = {
	list: async () => [
		{ header: { id: "future-open" } },
		{ header: { id: "future-read" } },
		{ header: { id: "readable" } }
	],
	open: async (id) => {
		if (id === "future-open") {
			throw new SessionFormatUnsupportedError('session "future-open" contains event type "future/event" (seq 3) unknown to this harness and not marked ignorable');
		}
		return {
			read: async () => {
				if (id === "future-read") {
					throw new SessionFormatUnsupportedError('session "future-read" contains event type "future/event" (seq 3) unknown to this harness and not marked ignorable');
				}
				return [{ seq: 0, time: before, type: "assistant/message", data: { usage: { inputTokens: 7 } } }];
			},
			close: async () => { modernMixedCloses.push(id); }
		};
	}
};
const mixedModern = await rebuildEstimatedFromPersistence(modernMixed, { coverageCutoffsByDay: {} }, { now: () => 4321 });
assert.equal(mixedModern.unreadableSessions, 2, "refusals from open() and from handle.read() both count as unreadable sessions");
assert.equal(mixedModern.sessionCount, 3);
assert.equal(mixedModern.days[dayKey(before)].totals.inputTokens, 7);
assert.ok(modernMixedCloses.includes("future-read"), "a handle whose read refused must still be closed");
assert.ok(!modernMixedCloses.includes("future-open"), "a refused open owns no handle to close");

const modernCorruptCloses = [];
await assert.rejects(
	() => rebuildEstimatedFromPersistence({
		list: async () => [{ header: { id: "corrupt" } }],
		open: async () => ({
			read: async () => { throw new Error("corrupt session"); },
			close: async () => { modernCorruptCloses.push(true); }
		})
	}, { coverageCutoffsByDay: {} }),
	/corrupt session/,
	"a failed modern read must reject the whole rebuild after closing its handle"
);
assert.equal(modernCorruptCloses.length, 1);

const modernAbort = new AbortController();
const modernAbortCloses = [];
await assert.rejects(
	() => rebuildEstimatedFromPersistence({
		list: async () => [{ header: { id: "cancelled" } }],
		open: async () => ({
			read: async () => {
				modernAbort.abort();
				return [];
			},
			close: async () => { modernAbortCloses.push(true); }
		})
	}, { coverageCutoffsByDay: {} }, { signal: modernAbort.signal }),
	(error) => error?.name === "AbortError",
	"an abort observed after a modern read must reject before producing a committable rebuild"
);
assert.equal(modernAbortCloses.length, 1);

await assert.rejects(
	() => rebuildEstimatedFromPersistence({}, { coverageCutoffsByDay: {} }),
	TypeError,
	"a seam carrying neither generation must still fail loud"
);

console.log("handle-based sessionPersistence rebuild contract ok");

// Per-session fold cache: both seam generations stamp each snapshot with an
// opaque revision, so a caller-owned Map keyed by session id can skip
// re-reading every session whose revision and coverage cutoffs are unchanged.
const cacheReads = [];
const cache = new Map();
const cachedLegacy = {
	listSnapshots: async () => [
		{ header: { id: "session-a" }, revision: "r1" },
		{ header: { id: "session-b" }, revision: "r2" }
	],
	readFrom: async (id) => {
		cacheReads.push(id);
		return {
			meta: { id },
			events: [{ seq: 0, time: before, type: "assistant/message", data: { usage: { inputTokens: id === "session-a" ? 10 : 20 } } }]
		};
	}
};
const cachedFirst = await rebuildEstimatedFromPersistence(cachedLegacy, { coverageCutoffsByDay: {} }, { cache, now: () => 1000 });
assert.equal(cachedFirst.days[dayKey(before)].totals.inputTokens, 30);
assert.equal(cachedFirst.eventCount, 2);
assert.deepEqual(cacheReads, ["session-a", "session-b"]);
assert.equal(cache.size, 2);

const cachedSecond = await rebuildEstimatedFromPersistence(cachedLegacy, { coverageCutoffsByDay: {} }, { cache, now: () => 2000 });
assert.equal(cachedSecond.updatedAt, 2000);
assert.equal(cachedSecond.sessionCount, 2);
assert.equal(cachedSecond.days[dayKey(before)].totals.inputTokens, 30, "a cached rebuild must fold the same totals without re-reading");
assert.equal(cachedSecond.eventCount, cachedFirst.eventCount, "cached folds keep their filtered event counts");
assert.deepEqual(cacheReads, ["session-a", "session-b"], "unchanged revisions must not trigger a second read");

const bumpedLegacy = {
	listSnapshots: async () => [
		{ header: { id: "session-a" }, revision: "r1" },
		{ header: { id: "session-b" }, revision: "r3" }
	],
	readFrom: async (id) => {
		cacheReads.push(id);
		return {
			meta: { id },
			events: [{ seq: 0, time: before, type: "assistant/message", data: { usage: { inputTokens: id === "session-a" ? 10 : 99 } } }]
		};
	}
};
const cachedThird = await rebuildEstimatedFromPersistence(bumpedLegacy, { coverageCutoffsByDay: {} }, { cache, now: () => 3000 });
assert.deepEqual(cacheReads, ["session-a", "session-b", "session-b"], "only the session whose revision changed may be re-read");
assert.equal(cachedThird.days[dayKey(before)].totals.inputTokens, 109, "the re-read session must replace its stale fold, not add to it");

const cachedFourth = await rebuildEstimatedFromPersistence(bumpedLegacy, { coverageCutoffsByDay: cutoffs }, { cache, now: () => 4000 });
assert.equal(cacheReads.length, 5, "changed coverage cutoffs must invalidate every cached fold");
assert.equal(cachedFourth.days[dayKey(before)].totals.inputTokens, 109, "events still under the cutoff fold identically after the refresh");

const revisionlessCache = new Map();
const revisionless = {
	listSnapshots: async () => [{ header: { id: "x" }, revision: void 0 }],
	readFrom: async () => ({ meta: {}, events: [{ seq: 0, time: before, type: "assistant/message", data: { usage: { inputTokens: 5 } } }] })
};
await rebuildEstimatedFromPersistence(revisionless, { coverageCutoffsByDay: {} }, { cache: revisionlessCache });
await rebuildEstimatedFromPersistence(revisionless, { coverageCutoffsByDay: {} }, { cache: revisionlessCache });
assert.equal(revisionlessCache.size, 0, "snapshots without a revision must never be cached");

const refusalReads = [];
const refusalCache = new Map();
const refuser = {
	listSnapshots: async () => [{ header: { id: "future" }, revision: "f1" }],
	readFrom: async () => {
		refusalReads.push(1);
		throw new SessionFormatUnsupportedError('session "future" contains event type "future/event" (seq 3) unknown to this harness and not marked ignorable');
	}
};
const refusedFirst = await rebuildEstimatedFromPersistence(refuser, { coverageCutoffsByDay: {} }, { cache: refusalCache });
const refusedSecond = await rebuildEstimatedFromPersistence(refuser, { coverageCutoffsByDay: {} }, { cache: refusalCache });
assert.equal(refusedFirst.unreadableSessions, 1);
assert.equal(refusedSecond.unreadableSessions, 1, "a cached refusal must keep counting as unreadable");
assert.equal(refusalReads.length, 1, "an unreadable session must not be re-read while its revision is unchanged");

const modernCacheOpens = [];
const modernCache = new Map();
const cachedModern = {
	list: async () => [{ header: { id: "s1" }, revision: "m1" }],
	open: async (id) => {
		modernCacheOpens.push(id);
		return {
			read: async () => [{ seq: 0, time: before, type: "assistant/message", data: { usage: { inputTokens: 3 } } }],
			close: async () => {}
		};
	}
};
const modernCachedFirst = await rebuildEstimatedFromPersistence(cachedModern, { coverageCutoffsByDay: {} }, { cache: modernCache });
const modernCachedSecond = await rebuildEstimatedFromPersistence(cachedModern, { coverageCutoffsByDay: {} }, { cache: modernCache });
assert.equal(modernCachedSecond.days[dayKey(before)].totals.inputTokens, modernCachedFirst.days[dayKey(before)].totals.inputTokens);
assert.equal(modernCacheOpens.length, 1, "the handle seam must reuse cached folds by revision too");

const prunedCache = new Map();
prunedCache.set("session-a", { revision: "r1", cutoffs: "{}", fold: { eventCount: 0, days: new Map() } });
prunedCache.set("session-gone", { revision: "r9", cutoffs: "{}", fold: { eventCount: 0, days: new Map() } });
await rebuildEstimatedFromPersistence(cachedLegacy, { coverageCutoffsByDay: {} }, { cache: prunedCache, now: () => 5000 });
assert.equal(prunedCache.size, 2, "a rebuild must prune entries for sessions the registry no longer lists while keeping listed ones");

console.log("per-session rebuild fold cache ok");
