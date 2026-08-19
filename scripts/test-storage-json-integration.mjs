import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
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

	const medium = JSON.parse(await readFile(join(root, "usage_stats.json"), "utf8"));
	assert.equal(medium.unit.version, 1);
	assert.equal(medium.tables.state.main.version, 3);
	console.log("official JSON backend migration/restart/concurrency integration passed");
} finally {
	await backend.close();
	await rm(root, { recursive: true, force: true });
}
