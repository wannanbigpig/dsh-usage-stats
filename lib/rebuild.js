/** Rebuild estimated usage through the official sessionPersistence seam. */

import { SessionFormatUnsupportedError } from "@deepseek-ai/dsh-session-persistence";
import { dayKey, foldUsage, zeroBuckets } from "./usage.js";

/** Hosts fail closed on logs with unknown event types; those sessions only skip their own rebuild. */
function isFormatUnsupported(error) {
	return error instanceof SessionFormatUnsupportedError || error?.name === "SessionFormatUnsupportedError";
}

function addBuckets(target, source) {
	for (const key of ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"]) {
		target[key] += Number(source?.[key]) || 0;
	}
}

function mergeDays(target, source) {
	for (const [date, entry] of source) {
		let day = target.get(date);
		if (day === void 0) {
			day = { totals: zeroBuckets(), models: new Map(), hours: new Map() };
			target.set(date, day);
		}
		addBuckets(day.totals, entry.totals);
		for (const [model, buckets] of entry.models) {
			const current = day.models.get(model) ?? zeroBuckets();
			addBuckets(current, buckets);
			day.models.set(model, current);
		}
		for (const [hour, models] of entry.hours) {
			const currentHour = day.hours.get(hour) ?? new Map();
			for (const [model, buckets] of models) {
				const current = currentHour.get(model) ?? zeroBuckets();
				addBuckets(current, buckets);
				currentHour.set(model, current);
			}
			day.hours.set(hour, currentHour);
		}
	}
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
 * (`list`/`open`) whose whole log still reads from offset 0 — and every
 * opened handle is closed, including when its read refuses.
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
	const fresh = cache ? new Map() : null;
	let eventCount = 0;
	let unreadableSessions = 0;
	for (const snapshot of snapshots) {
		signal?.throwIfAborted?.();
		const id = snapshot?.header?.id;
		if (typeof id !== "string" || id === "") continue;
		const cached = cache?.get(id);
		if (cached !== void 0 && cached.revision === snapshot.revision && cached.cutoffs === fingerprint) {
			fresh?.set(id, cached);
			if (cached.fold === null) {
				unreadableSessions += 1;
			} else {
				eventCount += cached.fold.eventCount;
				mergeDays(byDay, cached.fold.days);
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
		const fold = { eventCount: covered.length, days: foldUsage(covered) };
		if (cache && snapshot.revision !== void 0) fresh.set(id, { revision: snapshot.revision, cutoffs: fingerprint, fold });
		eventCount += fold.eventCount;
		mergeDays(byDay, fold.days);
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
		days: serializeDays(byDay)
	};
}

/** Read one session's whole log through a read handle, closing it even when the read refuses. */
async function readThroughHandle(sessionPersistence, id, signal) {
	const handle = await sessionPersistence.open(id, "read", { signal });
	try {
		return await handle.read(0, void 0, { signal });
	} finally {
		await handle.close();
	}
}
