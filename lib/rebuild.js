/** Rebuild estimated usage through the official sessionPersistence seam. */

import { SessionFormatUnsupportedError } from "@deepseek-ai/dsh-session-persistence";
import { dayKey, foldUsage, mergeInto, zeroBuckets } from "./usage.js";

/** Hosts fail closed on logs with unknown event types; those sessions only skip their own rebuild. */
function isFormatUnsupported(error) {
	return error instanceof SessionFormatUnsupportedError || error?.name === "SessionFormatUnsupportedError";
}

function serializeDays(days) {
	const output = {};
	for (const [date, entry] of days) {
		const models = {};
		for (const [model, buckets] of entry.models) models[model] = { ...buckets };
		const hours = {};
		for (const [hour, byModel] of entry.hours) {
			const rows = {};
			for (const [model, buckets] of byModel) rows[model] = { ...buckets };
			hours[hour] = rows;
		}
		output[date] = { totals: { ...entry.totals }, models, hours };
	}
	return output;
}

/** Serialize the per-workspace and per-session day buckets for the estimated source. */
function serializeWorkspaces(byWorkspace) {
	const output = {};
	for (const [workspace, sessions] of byWorkspace) {
		const sessionRows = {};
		for (const [session, days] of sessions) {
			const rows = {};
			for (const [date, buckets] of days) rows[date] = { ...buckets };
			sessionRows[session] = { days: rows };
		}
		output[workspace] = { sessions: sessionRows };
	}
	return output;
}

/** Accumulate the per-day totals of one session into the workspace map. */
function accumulateWorkspace(byWorkspace, workspace, session, days) {
	let sessions = byWorkspace.get(workspace);
	if (sessions === void 0) {
		sessions = new Map();
		byWorkspace.set(workspace, sessions);
	}
	let dateBuckets = sessions.get(session);
	if (dateBuckets === void 0) {
		dateBuckets = new Map();
		sessions.set(session, dateBuckets);
	}
	for (const [date, entry] of days) {
		let bucket = dateBuckets.get(date);
		if (bucket === void 0) {
			bucket = zeroBuckets();
			dateBuckets.set(date, bucket);
		}
		const totals = entry?.totals ?? entry;
		bucket.inputTokens += totals.inputTokens ?? 0;
		bucket.outputTokens += totals.outputTokens ?? 0;
		bucket.cacheReadTokens += totals.cacheReadTokens ?? 0;
		bucket.cacheWriteTokens += totals.cacheWriteTokens ?? 0;
	}
}

/**
 * Conservative overlap boundary, not proof of uninterrupted collection.
 * Frozen archives no longer retain every call identity, so replaying events
 * after the first recorded call could double-count them. Same-day collection
 * gaps cannot be repaired safely from this cutoff-only representation.
 */
export function filterEventsBeforeCoverage(events, coverageCutoffsByDay = {}) {
	return (events ?? []).filter((event) => {
		const at = Number(event?.time);
		if (!Number.isFinite(at) || at <= 0) return false;
		const cutoff = Number(coverageCutoffsByDay[dayKey(at)]);
		return !Number.isFinite(cutoff) || at < cutoff;
	});
}

/**
 * Build a complete replacement for archive.estimated.sessionRebuild.
 * No durable write occurs here; callers commit only after this resolves.
 * Sessions whose logs this harness refuses to read (event types written by a
 * newer build) are skipped and counted in `unreadableSessions`; every other
 * read failure still rejects the whole rebuild.
 * Serves both seam generations: pre-alpha.4 hosts address sessions by id
 * (`listSnapshots`/`readFrom`), alpha.4+ hosts hand out read handles
 * (`list`/`open`) whose owned log reads after the fork-inherited prefix. Older
 * handles return an event array; current handles return `{ eventState, events }`.
 * Every opened handle is closed, including when its read refuses.
 * `options.cache` — an optional caller-owned Map (one per service instance)
 * keyed by session id that skips re-reading sessions whose snapshot revision
 * and coverage cutoffs are unchanged; format-refused sessions cache their
 * refusal the same way. Revisions are instance-scoped change tokens, so a
 * cache never outlives the service instance that handed them out, and
 * entries for sessions the registry no longer lists are pruned each run.
 */
export async function rebuildEstimatedFromPersistence(sessionPersistence, state, options = {}) {
	const legacySeam = typeof sessionPersistence?.listSnapshots === "function" && typeof sessionPersistence?.readFrom === "function";
	const handleSeam = typeof sessionPersistence?.list === "function" && typeof sessionPersistence?.open === "function";
	if (!legacySeam && !handleSeam) {
		throw new TypeError("sessionPersistence must provide listSnapshots()+readFrom(), or list()+open()");
	}
	const signal = options.signal;
	signal?.throwIfAborted?.();
	const cache = options.cache instanceof Map ? options.cache : null;
	const cutoffs = state?.coverageCutoffsByDay ?? {};
	const fingerprint = JSON.stringify(cutoffs);
	const snapshots = legacySeam ? await sessionPersistence.listSnapshots(signal) : await sessionPersistence.list({ signal });
	const byDay = new Map();
	const byWorkspace = new Map();
	const fresh = cache ? new Map() : null;
	let eventCount = 0;
	let unreadableSessions = 0;
	for (const snapshot of snapshots) {
		signal?.throwIfAborted?.();
		const id = snapshot?.header?.id;
		if (typeof id !== "string" || id === "") continue;
		const workspace = typeof snapshot?.header?.cwd === "string" && snapshot.header.cwd !== "" ? snapshot.header.cwd : "";
		const cached = cache?.get(id);
		if (cached !== void 0 && cached.revision === snapshot.revision && cached.cutoffs === fingerprint) {
			fresh?.set(id, cached);
			if (cached.fold === null) {
				unreadableSessions += 1;
			} else {
				eventCount += cached.fold.eventCount;
				mergeInto(byDay, cached.fold.days);
				accumulateWorkspace(byWorkspace, cached.fold.workspace ?? "", id, cached.fold.days);
			}
			continue;
		}
		let events;
		try {
			events = legacySeam
				? (await sessionPersistence.readFrom(id, 0, signal))?.events
				: await readThroughHandle(sessionPersistence, id, signal);
		} catch (error) {
			if (isFormatUnsupported(error)) {
				unreadableSessions += 1;
				if (cache && snapshot.revision !== void 0) fresh.set(id, { revision: snapshot.revision, cutoffs: fingerprint, fold: null });
				continue;
			}
			throw error;
		}
		signal?.throwIfAborted?.();
		const covered = filterEventsBeforeCoverage(events, cutoffs);
		const fold = { eventCount: covered.length, days: foldUsage(covered), workspace };
		if (cache && snapshot.revision !== void 0) fresh.set(id, { revision: snapshot.revision, cutoffs: fingerprint, fold });
		eventCount += fold.eventCount;
		mergeInto(byDay, fold.days);
		accumulateWorkspace(byWorkspace, workspace, id, fold.days);
	}
	if (cache) {
		cache.clear();
		for (const [id, entry] of fresh) cache.set(id, entry);
	}
	signal?.throwIfAborted?.();
	return {
		updatedAt: Number((options.now ?? Date.now)()),
		sessionCount: snapshots.length,
		unreadableSessions,
		eventCount,
		days: serializeDays(byDay),
		workspaces: serializeWorkspaces(byWorkspace)
	};
}

/** Latest durable conversation title from a complete session log. */
function sessionTitleOf(events) {
	if (!Array.isArray(events)) return null;
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type !== "session/title") continue;
		const title = event.data?.title;
		return typeof title === "string" && title.trim() !== "" ? title : null;
	}
	return null;
}

/** Read one complete modern session log, including any fork-inherited prefix. */
async function readCompleteThroughHandle(sessionPersistence, id, signal) {
	const handle = await sessionPersistence.open(id, "read", { signal });
	try {
		const result = await handle.read(0, void 0, { signal });
		if (Array.isArray(result)) return result;
		if (Array.isArray(result?.events)) return result.events;
		throw new TypeError("sessionPersistence handle.read() must return events");
	} finally {
		await handle.close();
	}
}

/**
 * Resolve durable titles for selected session ids without activating sessions.
 * The optional cache is scoped to one persistence-service instance and keyed by
 * its opaque revision, so unchanged logs are read only once.
 */
export async function readSessionTitlesFromPersistence(sessionPersistence, sessionIds, options = {}) {
	const legacySeam = typeof sessionPersistence?.listSnapshots === "function" && typeof sessionPersistence?.readFrom === "function";
	const handleSeam = typeof sessionPersistence?.list === "function" && typeof sessionPersistence?.open === "function";
	if (!legacySeam && !handleSeam) {
		throw new TypeError("sessionPersistence must provide listSnapshots()+readFrom(), or list()+open()");
	}
	const signal = options.signal;
	signal?.throwIfAborted?.();
	const wanted = new Set((sessionIds ?? []).filter((id) => typeof id === "string" && id !== ""));
	if (wanted.size === 0) return new Map();
	const cache = options.cache instanceof Map ? options.cache : null;
	const snapshots = legacySeam ? await sessionPersistence.listSnapshots(signal) : await sessionPersistence.list({ signal });
	const visibleIds = new Set();
	const titles = new Map();
	for (const snapshot of snapshots) {
		signal?.throwIfAborted?.();
		const id = snapshot?.header?.id;
		if (typeof id !== "string" || id === "") continue;
		visibleIds.add(id);
		if (!wanted.has(id)) continue;
		const cached = cache?.get(id);
		if (snapshot.revision !== void 0 && cached !== void 0 && cached.revision === snapshot.revision) {
			if (cached.title !== null) titles.set(id, cached.title);
			continue;
		}
		try {
			const events = legacySeam
				? (await sessionPersistence.readFrom(id, 0, signal))?.events
				: await readCompleteThroughHandle(sessionPersistence, id, signal);
			const title = sessionTitleOf(events);
			if (snapshot.revision !== void 0) cache?.set(id, { revision: snapshot.revision, title });
			if (title !== null) titles.set(id, title);
		} catch (error) {
			signal?.throwIfAborted?.();
			if (isFormatUnsupported(error) && snapshot.revision !== void 0) cache?.set(id, { revision: snapshot.revision, title: null });
			else options.onError?.(id, error);
		}
	}
	if (cache !== null) for (const id of cache.keys()) if (!visibleIds.has(id)) cache.delete(id);
	return titles;
}

/** Read one session's owned log through a read handle, closing it even when the read refuses. */
async function readThroughHandle(sessionPersistence, id, signal) {
	const handle = await sessionPersistence.open(id, "read", { signal });
	try {
		// Older handle hosts do not expose the inherited prefix length.
		const result = await handle.read(handle.inheritedEventCount ?? 0, void 0, { signal });
		if (Array.isArray(result)) return result;
		if (Array.isArray(result?.events)) return result.events;
		throw new TypeError("sessionPersistence handle.read() must return events");
	} finally {
		await handle.close();
	}
}
