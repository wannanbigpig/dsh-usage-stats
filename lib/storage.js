/** Official storage-domain declaration and repository for usage-stats v3. */

import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";

export const USAGE_STATS_DOMAIN_NAME = "usage_stats";
export const USAGE_STATS_DOMAIN_VERSION = 1;
export const USAGE_STATS_STATE_KEY = "main";
export const USAGE_STATS_STATE_VERSION = 3;

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
const FrozenDaySchema = z.object({
	totals: UsageBucketsSchema,
	models: z.record(z.string(), FrozenBucketSchema),
	hours: z.record(z.string().regex(/^(?:[0-9]|1\d|2[0-3])$/), FrozenHourSchema),
	entryCount: z.number().int().nonnegative(),
	pricingVersionCounts: CountIndexSchema
}).strict();

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

export const usageStatsDomainSpec = defineDomain({
	name: USAGE_STATS_DOMAIN_NAME,
	version: USAGE_STATS_DOMAIN_VERSION,
	tables: { state: domainTable(StateSchema) }
});

/** Return one validated empty v3 state. */
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

function detached(value) {
	return structuredClone(value);
}

/**
 * Open the official domain and expose a detached, schema-checked repository.
 * The initial-state factory is evaluated only when the durable `main` row is
 * absent. All later mutations use the official table's serialized update
 * slot; validation happens inside that slot and before the backend write.
 */
export async function openUsageStatsStorage(ctx, options = {}) {
	if (ctx?.storageDomain?.open === void 0) throw new TypeError("ctx.storageDomain.open is required");
	const domain = await ctx.storageDomain.open(usageStatsDomainSpec);
	let table;
	try {
		table = domain.table("state");
		if (table.get(USAGE_STATS_STATE_KEY) === void 0) {
			const candidate = typeof options.initialState === "function"
				? await options.initialState()
				: await (options.initialState ?? createEmptyUsageState());
			await table.put(USAGE_STATS_STATE_KEY, StateSchema.parse(candidate));
		}
	} catch (error) {
		await domain.close();
		throw error;
	}

	let closed = false;
	let revision = 0;
	return {
		domain,
		table,
		get() {
			const current = table.get(USAGE_STATS_STATE_KEY);
			if (current === void 0) throw new Error("usage_stats state/main is missing");
			return detached(current);
		},
		// Render consumers can use this stable local revision to reuse an
		// expensive derived view until a storage-domain write succeeds.
		snapshot() {
			const current = table.get(USAGE_STATS_STATE_KEY);
			if (current === void 0) throw new Error("usage_stats state/main is missing");
			return { state: detached(current), revision };
		},
		update(transform) {
			if (typeof transform !== "function") throw new TypeError("storage transform must be a function");
			return table.update(USAGE_STATS_STATE_KEY, (current) => {
				const next = transform(detached(current));
				return StateSchema.parse(next);
			}).then((next) => {
				revision += 1;
				return detached(next);
			});
		},
		replace(next) {
			return table.update(USAGE_STATS_STATE_KEY, () => StateSchema.parse(detached(next))).then((current) => {
				revision += 1;
				return detached(current);
			});
		},
		async close() {
			if (closed) return;
			closed = true;
			await domain.close();
		}
	};
}
