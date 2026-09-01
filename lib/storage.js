/** Official storage-domain declaration and row-split repository for usage-stats v4. */

import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";
import { dayKey } from "./usage.js";

export const USAGE_STATS_DOMAIN_NAME = "usage_stats";
/** Durable format generation: v1 was one single-layout `state/main` document. */
export const USAGE_STATS_DOMAIN_VERSION = 2;
/** In-memory composed-view version consumed by the ledger transforms (never persisted as a whole). */
export const USAGE_STATS_STATE_VERSION = 3;
export const USAGE_STATS_STATE_KEY = "main";

const UsageBucketsSchema = z.object({
	inputTokens: z.number().int().nonnegative(),
	outputTokens: z.number().int().nonnegative(),
	cacheReadTokens: z.number().int().nonnegative(),
	cacheWriteTokens: z.number().int().nonnegative()
}).strict();

const LedgerEntryBaseSchema = z.object({
	id: z.string().min(1).optional(),
	occurredAt: z.number().finite().nonnegative(),
	completedAt: z.number().finite().positive().optional(),
	provider: z.string().min(1),
	model: z.string().min(1),
	turn: z.number().int().nonnegative().optional(),
	step: z.number().int().nonnegative().optional(),
	sampleKey: z.string().min(1).optional(),
	usage: UsageBucketsSchema,
	pricingVersion: z.string().min(1).optional()
});

const NanosSchema = z.string().regex(/^(0|[1-9]\d*)$/);

export const LedgerEntrySchema = z.discriminatedUnion("costState", [
	LedgerEntryBaseSchema.extend({ costState: z.literal("priced"), costNanosCny: NanosSchema }).strict(),
	LedgerEntryBaseSchema.extend({ costState: z.literal("unpriced") }).strict(),
	LedgerEntryBaseSchema.extend({ costState: z.literal("not-billable") }).strict()
]);

const JsonObjectSchema = z.record(z.string(), z.json());
// Estimated sources intentionally retain their original representation:
// imported v1/v2 day maps are objects while unfrozen legacy ledger data may
// be an array. The ledger domain module owns their semantic validation.
const EstimatedSourceSchema = z.union([JsonObjectSchema, z.array(z.json()), z.null()]);
const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const RecentSampleKeySchema = z.object({ key: z.string().min(1), day: DateKeySchema }).strict();
const CountIndexSchema = z.record(z.string(), z.number().int().nonnegative());
const FrozenBucketSchema = UsageBucketsSchema.extend({
	entryCount: z.number().int().nonnegative(),
	costNanosCny: NanosSchema,
	unpricedCount: z.number().int().nonnegative()
}).strict();
const FrozenHourSchema = z.object({
	totals: UsageBucketsSchema,
	models: z.record(z.string(), FrozenBucketSchema),
	entryCount: z.number().int().nonnegative()
}).strict();
export const FrozenDaySchema = z.object({
	totals: UsageBucketsSchema,
	models: z.record(z.string(), FrozenBucketSchema),
	hours: z.record(z.string().regex(/^(?:[0-9]|1\d|2[0-3])$/), FrozenHourSchema),
	entryCount: z.number().int().nonnegative(),
	pricingVersionCounts: CountIndexSchema
}).strict();

/**
 * Composed view consumed by the ledger transforms. Rows live in dedicated
 * tables; this shape only exists in memory and matches the v3 transforms.
 */
export const StateSchema = z.object({
	version: z.literal(USAGE_STATS_STATE_VERSION),
	ledger: z.array(LedgerEntrySchema),
	archive: z.object({
		frozen: z.object({
			days: z.record(DateKeySchema, FrozenDaySchema),
			entryCount: z.number().int().nonnegative(),
			pricingVersionCounts: CountIndexSchema
		}).strict(),
		estimated: z.object({
			importedLegacy: EstimatedSourceSchema,
			unfrozenLedger: EstimatedSourceSchema,
			sessionRebuild: EstimatedSourceSchema
		}).strict()
	}).strict(),
	coverageCutoffsByDay: z.record(DateKeySchema, z.number().finite().nonnegative()),
	recentSampleKeys: z.array(RecentSampleKeySchema),
	migration: JsonObjectSchema
}).strict();

const UsageGlobalSchema = z.object({
	/** Zero means "never installed": the distribution/seed write sets it last as the commit marker. */
	installedAt: z.number().int().nonnegative(),
	coverageCutoffsByDay: z.record(DateKeySchema, z.number().finite().nonnegative()),
	recentSampleKeys: z.array(RecentSampleKeySchema),
	frozenEntryCount: z.number().int().nonnegative(),
	frozenPricingVersionCounts: CountIndexSchema,
	estimated: z.object({
		importedLegacy: EstimatedSourceSchema,
		unfrozenLedger: EstimatedSourceSchema,
		sessionRebuild: EstimatedSourceSchema
	}).strict(),
	migration: JsonObjectSchema
}).strict();

const LedgerDayRowSchema = z.object({
	day: DateKeySchema,
	entries: z.array(LedgerEntrySchema)
}).strict();

/**
 * v2 layout: per-record documents so one sample rewrites only its own day
 * row plus the small global slot, and one corrupt file reads as absent
 * instead of failing the whole unit. Old hosts without layout support
 * silently degrade to a single-file unit with the same rows.
 */
export const usageStatsDomainSpec = defineDomain({
	name: USAGE_STATS_DOMAIN_NAME,
	version: USAGE_STATS_DOMAIN_VERSION,
	layout: "per-record",
	global: {
		schema: UsageGlobalSchema,
		initial: {
			installedAt: 0,
			coverageCutoffsByDay: {},
			recentSampleKeys: [],
			frozenEntryCount: 0,
			frozenPricingVersionCounts: {},
			estimated: { importedLegacy: null, unfrozenLedger: null, sessionRebuild: null },
			migration: {}
		}
	},
	tables: {
		ledger: domainTable(LedgerDayRowSchema),
		frozen: domainTable(FrozenDaySchema)
	}
});

/** The pre-v4 medium: one single-layout document holding the whole v3 state. */
const legacyDomainSpec = defineDomain({
	name: USAGE_STATS_DOMAIN_NAME,
	version: 1,
	tables: { state: domainTable(StateSchema) }
});

/** Return one validated empty v3 state (composed view seed). */
export function createEmptyUsageState(migration = {}) {
	return StateSchema.parse({
		version: USAGE_STATS_STATE_VERSION,
		ledger: [],
		archive: {
			frozen: { days: {}, entryCount: 0, pricingVersionCounts: {} },
			estimated: {
				importedLegacy: null,
				unfrozenLedger: null,
				sessionRebuild: null
			}
		},
		coverageCutoffsByDay: {},
		recentSampleKeys: [],
		migration
	});
}

function noop() {}

/** Deterministic JSON equality: object key order must not forge a difference. */
function stableStringify(value) {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (value !== null && typeof value === "object") {
		const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
		return `{${entries.join(",")}}`;
	}
	return JSON.stringify(value);
}

function sameJson(left, right) {
	return stableStringify(left ?? null) === stableStringify(right ?? null);
}

function sortKeyedObject(source) {
	const sorted = {};
	for (const key of Object.keys(source ?? {}).sort()) sorted[key] = source[key];
	return sorted;
}

function entryDayKey(entry) {
	const at = Number(entry?.completedAt) > 0 ? Number(entry.completedAt) : Number(entry?.occurredAt) || 0;
	return dayKey(at);
}

function groupByDay(ledger) {
	const days = new Map();
	for (const entry of ledger ?? []) {
		const day = entryDayKey(entry);
		const bucket = days.get(day);
		if (bucket === void 0) days.set(day, [entry]);
		else bucket.push(entry);
	}
	return days;
}

function composeState(domain) {
	const current = domain.global.get();
	const ledger = [];
	const ledgerRows = [...domain.table("ledger").entries()]
		.sort((left, right) => String(left[1]?.day ?? left[0]).localeCompare(String(right[1]?.day ?? right[0])));
	for (const [, row] of ledgerRows) {
		if (Array.isArray(row?.entries)) ledger.push(...row.entries);
	}
	const frozenSource = {};
	for (const [key, row] of domain.table("frozen").entries()) frozenSource[key] = row;
	const frozenDays = {};
	let frozenEntryCount = 0;
	const pricingVersionCounts = {};
	for (const day of Object.keys(frozenSource).sort()) {
		const value = frozenSource[day];
		frozenDays[day] = value;
		frozenEntryCount += Number(value?.entryCount) || 0;
		for (const [version, count] of Object.entries(value?.pricingVersionCounts ?? {})) {
			pricingVersionCounts[version] = (Number(pricingVersionCounts[version]) || 0) + (Number(count) || 0);
		}
	}
	return {
		version: USAGE_STATS_STATE_VERSION,
		ledger,
		archive: {
			frozen: { days: frozenDays, entryCount: frozenEntryCount, pricingVersionCounts },
			estimated: structuredClone(current.estimated)
		},
		coverageCutoffsByDay: sortKeyedObject(current.coverageCutoffsByDay),
		recentSampleKeys: (current.recentSampleKeys ?? []).map((entry) => ({ key: entry.key, day: entry.day })),
		migration: structuredClone(current.migration)
	};
}

function diffStates(domain, before, next) {
	const ops = [];
	const beforeDays = groupByDay(before.ledger);
	const nextDays = groupByDay(next.ledger);
	for (const [day, entries] of nextDays) {
		const previous = beforeDays.get(day);
		if (previous === void 0 || !sameJson(previous, entries)) {
			ops.push({ kind: "ledger", key: day, row: { day, entries: structuredClone(entries) } });
		}
	}
	for (const day of beforeDays.keys()) {
		if (!nextDays.has(day)) ops.push({ kind: "ledger-del", key: day });
	}
	const beforeFrozen = before.archive.frozen.days ?? {};
	const nextFrozen = next.archive.frozen.days ?? {};
	for (const [day, value] of Object.entries(nextFrozen)) {
		if (!sameJson(beforeFrozen[day], value)) ops.push({ kind: "frozen", key: day, row: structuredClone(value) });
	}
	for (const day of Object.keys(beforeFrozen)) {
		if (!Object.hasOwn(nextFrozen, day)) ops.push({ kind: "frozen-del", key: day });
	}
	const currentGlobal = domain.global.get();
	const nextGlobal = {
		installedAt: currentGlobal.installedAt,
		coverageCutoffsByDay: sortKeyedObject(next.coverageCutoffsByDay),
		recentSampleKeys: next.recentSampleKeys.map((entry) => ({ key: entry.key, day: entry.day })),
		frozenEntryCount: next.archive.frozen.entryCount,
		frozenPricingVersionCounts: structuredClone(next.archive.frozen.pricingVersionCounts),
		estimated: structuredClone(next.archive.estimated),
		migration: structuredClone(next.migration)
	};
	if (!sameJson(currentGlobal, nextGlobal)) ops.push({ kind: "global", value: nextGlobal });
	return ops;
}

async function applyOp(domain, op) {
	if (op.kind === "ledger") await domain.table("ledger").put(op.key, op.row);
	else if (op.kind === "ledger-del") await domain.table("ledger").delete(op.key);
	else if (op.kind === "frozen") await domain.table("frozen").put(op.key, op.row);
	else if (op.kind === "frozen-del") await domain.table("frozen").delete(op.key);
	else await domain.global.set(op.value);
}

/** Split one validated v3 state into v2 rows; the global set lands last as the commit marker. */
async function distributeState(domain, state) {
	const ledgerTable = domain.table("ledger");
	for (const [day, entries] of groupByDay(state.ledger ?? [])) {
		await ledgerTable.put(day, { day, entries: structuredClone(entries) });
	}
	const frozenTable = domain.table("frozen");
	for (const [day, value] of Object.entries(state.archive?.frozen?.days ?? {})) {
		await frozenTable.put(day, structuredClone(value));
	}
	await domain.global.set({
		installedAt: Date.now(),
		coverageCutoffsByDay: sortKeyedObject(state.coverageCutoffsByDay ?? {}),
		recentSampleKeys: (state.recentSampleKeys ?? []).map((entry) => ({ key: entry.key, day: entry.day })),
		frozenEntryCount: Number(state.archive?.frozen?.entryCount) || 0,
		frozenPricingVersionCounts: structuredClone(state.archive?.frozen?.pricingVersionCounts ?? {}),
		estimated: structuredClone(state.archive?.estimated ?? {
			importedLegacy: null,
			unfrozenLedger: null,
			sessionRebuild: null
		}),
		migration: structuredClone(state.migration ?? {})
	});
}

function isVersionMismatch(error) {
	return error?.code === "version-mismatch";
}

function isFreshDomain(domain) {
	return domain.global.get().installedAt === 0
		&& domain.table("ledger").size === 0
		&& domain.table("frozen").size === 0;
}

/**
 * Read the pre-v4 single-document medium, or return null when it is absent
 * or stamped with a foreign version. Opening a missing unit materializes
 * nothing (the first write publishes), so probing is side-effect free.
 */
async function readLegacySingleState(ctx) {
	let domain;
	try {
		domain = await ctx.storageDomain.open(legacyDomainSpec);
	} catch (error) {
		if (isVersionMismatch(error)) return null;
		throw error;
	}
	try {
		const current = domain.table("state").get(USAGE_STATS_STATE_KEY);
		return current === void 0 ? null : StateSchema.parse(current);
	} finally {
		await domain.close();
	}
}

async function seedInitialState(domain, options) {
	const candidate = typeof options.initialState === "function"
		? await options.initialState()
		: await (options.initialState ?? createEmptyUsageState());
	await distributeState(domain, StateSchema.parse(candidate));
}

/**
 * Open the official domain and expose a detached, schema-checked repository.
 * Reads compose the v3 view from the global slot and the ledger/frozen day
 * rows; every mutation re-derives the row set and durably writes only the
 * changed rows, so a routine sample touches its own day file plus the small
 * global document. The global slot is the domain's single source for dedup
 * keys, coverage cutoffs, estimated sources and migration markers.
 */
export async function openUsageStatsStorage(ctx, options = {}) {
	if (ctx?.storageDomain?.open === void 0) throw new TypeError("ctx.storageDomain.open is required");
	let domain;
	try {
		domain = await ctx.storageDomain.open(usageStatsDomainSpec);
	} catch (error) {
		if (!isVersionMismatch(error)) throw error;
		// Old hosts ignore the layout hint, so the v3 medium is still the
		// single file this process just failed to open as v2: migrate it.
		const legacy = await readLegacySingleState(ctx);
		domain = await ctx.storageDomain.open(usageStatsDomainSpec);
		try {
			if (legacy !== null) await distributeState(domain, legacy);
			else await seedInitialState(domain, options);
		} catch (error) {
			await domain.close();
			throw error;
		}
		return buildRepository(domain);
	}
	if (!isFreshDomain(domain)) return buildRepository(domain);
	// A brand-new v2 medium can still sit beside an unmigrated v3 single
	// document (hosts that honor per-record layout store the two apart).
	await domain.close();
	const legacy = await readLegacySingleState(ctx);
	domain = await ctx.storageDomain.open(usageStatsDomainSpec);
	try {
		if (legacy !== null) await distributeState(domain, legacy);
		else await seedInitialState(domain, options);
	} catch (error) {
		await domain.close();
		throw error;
	}
	return buildRepository(domain);
}

function buildRepository(domain) {
	let revision = 0;
	let chain = Promise.resolve();
	const enqueue = (job) => {
		const run = chain.then(job);
		chain = run.then(noop, noop);
		return run;
	};
	return {
		domain,
		get() {
			return structuredClone(composeState(domain));
		},
		// Render consumers can use this stable local revision to reuse an
		// expensive derived view until a storage-domain write succeeds.
		snapshot() {
			return { state: structuredClone(composeState(domain)), revision };
		},
		update(transform) {
			if (typeof transform !== "function") throw new TypeError("storage transform must be a function");
			return enqueue(async () => {
				const before = composeState(domain);
				const produced = transform(structuredClone(before));
				const next = StateSchema.parse(produced === null || typeof produced !== "object" ? produced : structuredClone(produced));
				const ops = diffStates(domain, before, next);
				if (ops.length === 0) return structuredClone(before);
				for (const op of ops) await applyOp(domain, op);
				revision += 1;
				return structuredClone(next);
			});
		},
		replace(next) {
			return this.update(() => next);
		},
		async close() {
			await domain.close();
		}
	};
}
