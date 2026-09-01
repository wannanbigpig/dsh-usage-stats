import assert from "node:assert/strict";
import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { recordLedgerState, renderLedgerState } from "../lib/ledger.js";
import { migrateLegacyCacheToV3 } from "../lib/migration.js";
import { openUsageStatsStorage } from "../lib/storage.js";

const harnessRoot = process.env.DSH_HARNESS_ROOT
	?? fileURLToPath(new URL("../../deepseek-harness/", import.meta.url));
const domainEntry = join(harnessRoot, "packages/storage/storage-domain/lib/index.js");
const jsonEntry = join(harnessRoot, "packages/storage/storage-json/lib/index.js");

try {
	await Promise.all([access(domainEntry), access(jsonEntry)]);
} catch {
	const required = process.env.DSH_REQUIRE_JSON_INTEGRATION === "1" || process.env.CI === "true" || process.env.CI === "1";
	if (required) {
		console.error("official JSON backend integration is required in CI (or with DSH_REQUIRE_JSON_INTEGRATION=1), but sibling deepseek-harness source is unavailable");
		process.exit(1);
	}
	console.log("official JSON backend integration skipped locally: sibling deepseek-harness source is unavailable (set DSH_REQUIRE_JSON_INTEGRATION=1 to enforce)");
	process.exit(0);
}

const [{ DomainFacility }, { JsonStorageBackend }] = await Promise.all([
	import(pathToFileURL(domainEntry).href),
	import(pathToFileURL(jsonEntry).href)
]);

const root = await mkdtemp(join(tmpdir(), "usage-stats-json-"));
const backend = new JsonStorageBackend(root);
const host = {
	storage: { backend: { get(name) { assert.equal(name, "json"); return backend; } } },
	emit() {},
	logger: { warn() {} }
};
const facility = () => new DomainFacility(host, { backend: "json", routes: {} });
const pricing = {
	id: "tiny",
	currency: "CNY",
	peakHours: [],
	peakMultiplier: 1,
	pricing: { "deepseek-v4-flash": { inputMiss: 0, inputHit: 0.05, output: 0 } },
	models: {}
};
const at = Date.parse("2026-08-25T12:00:00+08:00");

try {
	const migratedAt = at - 1;
	const legacyState = migrateLegacyCacheToV3({
		version: 2,
		legacy: null,
		ledger: [{
			id: "legacy-priced",
			occurredAt: migratedAt,
			completedAt: migratedAt,
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: { inputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
			costCny: 0.123456789,
			pricingVersion: "legacy-price"
		}]
	}, { migratedAt: 42, sourceSha256: "legacy-cache-sha" });
	const first = await openUsageStatsStorage({ storageDomain: facility() }, { initialState: legacyState });
	await Promise.all(Array.from({ length: 120 }, (_, index) => first.update((state) => recordLedgerState(state, {
		id: `call-${index}`,
		sampleKey: `sample-${index}`,
		occurredAt: at + index,
		completedAt: at + index,
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1, cacheWriteTokens: 0 }
	}, { pricing, maxLedgerEntries: 10, recentSampleKeyCapacity: 260 }))));
	const before = first.get();
	assert.equal(before.ledger.length, 10);
	assert.equal(before.archive.frozen.entryCount, 111);
	assert.equal(before.recentSampleKeys.length, 241);
	assert.deepEqual(before.migration, { legacyCacheImported: true, legacyCacheSha256: "legacy-cache-sha", migratedAt: 42 });
	const frozenCost = renderLedgerState(before, at, pricing).total.cost;
	await first.close();

	const reopened = await openUsageStatsStorage({ storageDomain: facility() }, {
		initialState: () => { throw new Error("durable state must win on restart"); }
	});
	const after = reopened.get();
	assert.equal(after.ledger.length + after.archive.frozen.entryCount, 121);
	const changedPricing = { ...pricing, pricing: { "deepseek-v4-flash": { inputMiss: 99, inputHit: 99, output: 99 } } };
	assert.equal(renderLedgerState(after, at, changedPricing).total.cost, frozenCost, "restart and current-price changes must not move frozen history");
	await reopened.close();

	// The per-record medium keeps one file per day row plus the global slot;
	// frozen days live apart from the live ledger window.
	const unitDir = join(root, "usage_stats");
	const ledgerDir = join(unitDir, "ledger");
	const frozenDir = join(unitDir, "frozen");
	const ledgerDays = (await readdir(ledgerDir)).sort();
	assert.ok(ledgerDays.length >= 1 && ledgerDays.length <= 10, `ledger rows must stay bounded, got ${ledgerDays.length}`);
	for (const day of ledgerDays) {
		assert.match(day, /^\d{4}-\d{2}-\d{2}\.json$/, "ledger row files must be day-keyed");
		const document = JSON.parse(await readFile(join(ledgerDir, day), "utf8"));
		assert.equal(document.version, 2, "every record document carries the unit version stamp");
		assert.ok(Array.isArray(document.record.entries), "ledger rows hold their day's entries");
	}
	const frozenDays = (await readdir(frozenDir)).sort();
	assert.ok(frozenDays.length >= 1, "compaction must leave frozen day rows on disk");
	const global = JSON.parse(await readFile(join(unitDir, "global.json"), "utf8"));
	assert.equal(global.version, 2);
	assert.ok(global.record.installedAt > 0, "the global commit marker must be installed");
	assert.equal(global.record.frozenEntryCount, before.archive.frozen.entryCount);
	console.log("per-record medium layout ok");

	// A pre-v4 single-document medium must split into the row layout on open.
	const migrationRoot = await mkdtemp(join(tmpdir(), "usage-stats-migrate-"));
	try {
		const migrationBackend = new JsonStorageBackend(migrationRoot);
		const migrationHost = {
			storage: { backend: { get(name) { assert.equal(name, "json"); return migrationBackend; } } },
			emit() {},
			logger: { warn() {} }
		};
		const singleState = {
			version: 3,
			ledger: [{
				id: "v3-call",
				occurredAt: at,
				completedAt: at,
				provider: "deepseek-official",
				model: "deepseek-v4-flash",
				usage: { inputTokens: 3, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
				costState: "priced",
				costNanosCny: "700"
			}],
			archive: {
				frozen: { days: {}, entryCount: 0, pricingVersionCounts: {} },
				estimated: { importedLegacy: null, unfrozenLedger: null, sessionRebuild: null }
			},
			coverageCutoffsByDay: {},
			recentSampleKeys: [],
			migration: { migratedAt: 77 }
		};
		const legacyDocument = {
			unit: { name: "usage_stats", version: 1 },
			global: null,
			tables: { state: { main: singleState } }
		};
		await writeFile(join(migrationRoot, "usage_stats.json"), `${JSON.stringify(legacyDocument, null, 2)}\n`);
		const migrated = await openUsageStatsStorage({ storageDomain: new DomainFacility(migrationHost, { backend: "json", routes: {} }) }, {
			initialState: () => { throw new Error("durable v3 medium must win over the initial-state seed"); }
		});
		const composed = migrated.get();
		assert.equal(composed.ledger.length, 1);
		assert.equal(composed.ledger[0].id, "v3-call");
		assert.equal(composed.migration.migratedAt, 77);
		assert.ok((await readdir(join(migrationRoot, "usage_stats", "ledger"))).length === 1, "the v3 ledger must split into day rows");
		const append = await migrated.update((state) => recordLedgerState(state, {
			id: "post-migration",
			sampleKey: "post",
			occurredAt: at + 1,
			completedAt: at + 1,
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: { inputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
		}, { pricing, maxLedgerEntries: 10 }));
		assert.equal(append.ledger.length, 2, "the migrated repository must keep accepting samples");
		await migrated.close();
		await migrationBackend.close();
	} finally {
		await rm(migrationRoot, { recursive: true, force: true });
	}

	console.log("official JSON backend migration/restart/concurrency integration passed");
} finally {
	await backend.close();
	await rm(root, { recursive: true, force: true });
}
