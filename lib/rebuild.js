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
 */
export async function rebuildEstimatedFromPersistence(sessionPersistence, state, options = {}) {
	if (typeof sessionPersistence?.listSnapshots !== "function" || typeof sessionPersistence?.readFrom !== "function") {
		throw new TypeError("sessionPersistence must provide listSnapshots() and readFrom()");
	}
	const signal = options.signal;
	signal?.throwIfAborted?.();
	const snapshots = await sessionPersistence.listSnapshots(signal);
	const byDay = new Map();
	let eventCount = 0;
	let unreadableSessions = 0;
	for (const snapshot of snapshots) {
		signal?.throwIfAborted?.();
		const id = snapshot?.header?.id;
		if (typeof id !== "string" || id === "") continue;
		let loaded;
		try {
			loaded = await sessionPersistence.readFrom(id, 0, signal);
		} catch (error) {
			if (isFormatUnsupported(error)) {
				unreadableSessions += 1;
				continue;
			}
			throw error;
		}
		signal?.throwIfAborted?.();
		const events = filterEventsBeforeCoverage(loaded?.events, state?.coverageCutoffsByDay ?? {});
		eventCount += events.length;
		mergeDays(byDay, foldUsage(events));
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
