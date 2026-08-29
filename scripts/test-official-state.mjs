import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	StateSchema,
	createEmptyUsageState,
	openUsageStatsStorage,
	usageStatsDomainSpec
} from "../lib/storage.js";
import {
	USAGE_STATS_SETTINGS_NAMESPACE,
	USAGE_STATS_SETTINGS_SCHEMA,
	createUsageStatsSettings,
	retiredSettingsFieldsOf,
	validateUsageStatsSettings
} from "../lib/settings.js";
import {
	backupLegacyFile,
	initializeLegacyMigrations,
	legacyUsageStatsPaths,
	migrateLegacyCacheToV3,
	migrateLegacySettingsToV3,
	prepareLegacyJson
} from "../lib/migration.js";

function clone(value) {
	return structuredClone(value);
}

class FakeTable {
	constructor(value) {
		this.value = value;
		this.putCalls = [];
		this.updateCalls = 0;
	}

	get(key) {
		assert.equal(key, "main");
		return this.value;
	}

	async put(key, value) {
		assert.equal(key, "main");
		this.putCalls.push(clone(value));
		this.value = value;
	}

	async update(key, transform) {
		assert.equal(key, "main");
		this.updateCalls += 1;
		const next = transform(this.value);
		this.value = next;
		return next;
	}
}

async function testStorageRepository() {
	assert.equal(usageStatsDomainSpec.name, "usage_stats");
	assert.equal(usageStatsDomainSpec.version, 1);
	assert.deepEqual(Object.keys(usageStatsDomainSpec.tables), ["state"]);
	const representative = createEmptyUsageState();
	representative.archive.estimated.importedLegacy = { "2026-08-01": { totals: {} } };
	representative.ledger.push({
		occurredAt: 1,
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
		costState: "priced",
		costNanosCny: "50"
	});
	assert.deepEqual(StateSchema.parse(representative), representative, "state schema must preserve ledger/archive domain fields");
	assert.throws(() => StateSchema.parse({
		...createEmptyUsageState(),
		ledger: [{
			occurredAt: 1,
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: { inputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
			costState: "priced"
		}]
	}), /Invalid input|costNanosCny/);
	assert.throws(() => StateSchema.parse({
		...createEmptyUsageState(),
		archive: { ...createEmptyUsageState().archive, frozen: { days: {}, entryCount: -1, pricingVersionCounts: {} } }
	}), /Invalid input|entryCount/);

	const table = new FakeTable();
	let initialCalls = 0;
	let closeCalls = 0;
	const ctx = {
		storageDomain: {
			async open(spec) {
				assert.equal(spec, usageStatsDomainSpec);
				return {
					table(name) {
						assert.equal(name, "state");
						return table;
					},
					async close() { closeCalls += 1; }
				};
			}
		}
	};
	const storage = await openUsageStatsStorage(ctx, {
		initialState: async () => {
			initialCalls += 1;
			return createEmptyUsageState({ migratedAt: 123 });
		}
	});
	assert.equal(initialCalls, 1);
	assert.equal(table.putCalls.length, 1);
	assert.equal(storage.get().migration.migratedAt, 123);
	assert.equal(storage.snapshot().revision, 0, "a fresh storage snapshot must start at revision zero");

	const durableBefore = clone(table.value);
	await storage.update((draft) => {
		draft.recentSampleKeys.push({ key: "sample:sample-1", day: "2026-08-25" });
		return draft;
	});
	assert.deepEqual(durableBefore.recentSampleKeys, [], "transform must not receive the durable object by reference");
	assert.deepEqual(storage.get().recentSampleKeys, [{ key: "sample:sample-1", day: "2026-08-25" }]);
	assert.equal(storage.snapshot().revision, 1, "a successful storage update must advance the render-cache revision");

	const detached = storage.get();
	detached.recentSampleKeys.push("outside");
	assert.deepEqual(storage.get().recentSampleKeys, [{ key: "sample:sample-1", day: "2026-08-25" }], "reads must be detached");

	await assert.rejects(
		storage.update((draft) => ({ ...draft, version: 2 })),
		/version|Invalid input/
	);
	assert.equal(table.value.version, 3, "invalid transforms must fail before persistence");

	await storage.close();
	assert.equal(closeCalls, 1);

	const existingTable = new FakeTable(createEmptyUsageState());
	await openUsageStatsStorage({
		storageDomain: { async open() { return { table: () => existingTable, close() {} }; } }
	}, {
		initialState: () => {
			throw new Error("initial state factory must not run for an existing record");
		}
	});
	let failedOpenClosed = 0;
	await assert.rejects(openUsageStatsStorage({
		storageDomain: { async open() { return { table: () => new FakeTable(), async close() { failedOpenClosed += 1; } }; } }
	}, { initialState: async () => { throw new Error("migration failed"); } }), /migration failed/);
	assert.equal(failedOpenClosed, 1, "an initialization failure must release the official domain handle");
}

function legacyDay(tokens) {
	return {
		totals: { inputTokens: tokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
		models: { "deepseek-official/deepseek-v4-flash": { inputTokens: tokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } },
		hours: { 1: { "deepseek-official/deepseek-v4-flash": { inputTokens: tokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } } }
	};
}

async function testLegacyConverters() {
	const at = Date.parse("2026-08-02T01:00:00+08:00");
	const usage = { inputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
	const v2 = migrateLegacyCacheToV3({
		version: 2,
		legacy: { days: { "2026-08-01": legacyDay(2) }, updatedAt: at },
		ledger: [
			{ id: "priced", occurredAt: at, completedAt: at, provider: "deepseek-official", model: "deepseek-v4-flash", usage, costCny: 0.000001, pricingVersion: "old-a" },
			{ id: "unpriced", occurredAt: at + 1, completedAt: at + 1, provider: "deepseek-official", model: "unknown", usage, costCny: null, pricingVersion: "old-b" },
			{ id: "estimated", occurredAt: at + 2, completedAt: at + 2, provider: "deepseek-official", model: "deepseek-v4-flash", usage },
			{ id: "external", occurredAt: at + 3, completedAt: at + 3, provider: "glm", model: "glm-4", usage, costCny: null }
		]
	}, { maxLedgerEntries: 1, migratedAt: 42, sourceSha256: "abc" });
	assert.equal(StateSchema.parse(v2).version, 3);
	assert.equal(v2.archive.frozen.entryCount, 2, "priced and explicit-unpriced overflow must archive exactly");
	assert.equal(v2.ledger.length, 1);
	assert.equal(v2.ledger[0].costState, "not-billable");
	assert.equal(v2.archive.estimated.unfrozenLedger.length, 1, "official rows without historical price must remain estimated");
	assert.equal(v2.archive.estimated.importedLegacy.days["2026-08-01"].totals.inputTokens, 2);
	assert.deepEqual(v2.migration, { legacyCacheImported: true, legacyCacheSha256: "abc", migratedAt: 42 });

	const v1 = migrateLegacyCacheToV3({
		version: 1,
		sessions: {
			a: { days: { "2026-08-01": legacyDay(2) } },
			b: { days: { "2026-08-01": legacyDay(3) } }
		}
	});
	assert.equal(v1.archive.estimated.importedLegacy.days["2026-08-01"].totals.inputTokens, 5);
	assert.throws(() => migrateLegacyCacheToV3({ version: 99 }), /unsupported legacy cache version/i);
	assert.throws(() => migrateLegacyCacheToV3({ version: 2, legacy: null, ledger: [{ occurredAt: 1, provider: "deepseek-official", model: "x", usage: { inputTokens: -1 } }] }), /non-negative safe integer/i);
	assert.throws(() => migrateLegacyCacheToV3({ version: 1, sessions: { bad: { days: { "not-a-date": legacyDay(1) } } } }), /day key is invalid/i);
	assert.throws(() => migrateLegacyCacheToV3({ version: 2, legacy: null, ledger: [{ occurredAt: "bad", provider: "deepseek-official", model: "x", usage: {} }] }), /occurredAt/i);

	const migratedSettings = migrateLegacySettingsToV3({
		version: 2,
		refreshMs: 7000,
		display: { balance: false },
		pricing: null
	}, {
		version: 1,
		global: { enabled: true, dailyCostLimit: 5, minBalance: 9, stopOnExceed: true },
		keys: {}
	}, { settingsSha256: "s", limitsSha256: "l" });
	assert.equal(migratedSettings.settingsPatch.refreshMs, 7000);
	assert.equal(Object.hasOwn(migratedSettings.settingsPatch, "pricing"), false, "legacy null pricing must re-inherit composition base");
	const migratedRetiredConversation = migrateLegacySettingsToV3({
		version: 2,
		conversation: { enabled: true, showTokenUsage: true, showSessionTokenUsage: false }
	}, { version: 2 });
	assert.equal(Object.hasOwn(migratedRetiredConversation.settingsPatch, "conversation"), false,
		"retired plugin conversation settings must not enter the current namespace");
	assert.equal(migratedSettings.limits.global.dailyCostLimit, 5);
	assert.equal(migratedSettings.limits.global.enabled, true, "v1 advisory enablement must be preserved");
	assert.equal(migratedSettings.limits.global.minBalance, null, "v1 hard-stop fields must migrate fail-open");
	assert.equal(migratedSettings.limits.global.stopOnExceed, false);
	assert.deepEqual(migratedSettings.migration, {
		legacySettingsImported: true,
		legacySettingsSha256: "s",
		legacyLimitsSha256: "l"
	});
	const disabledRefresh = migrateLegacySettingsToV3({ version: 2, refreshMs: null }, { version: 2 });
	assert.equal(Object.hasOwn(disabledRefresh.settingsPatch, "refreshMs"), true);
	assert.equal(disabledRefresh.settingsPatch.refreshMs, null, "explicit legacy null refresh must override composition base");
	assert.equal(Object.hasOwn(migrateLegacySettingsToV3({ version: 2, maxLedgerEntries: null }, { version: 2 }).settingsPatch, "maxLedgerEntries"), false,
		"legacy null capacity must continue inheriting the composition base");
	assert.throws(() => migrateLegacySettingsToV3({ version: 2, maxLedgerEntries: 5001 }, { version: 2 }), /100 to 5000/i);
	assert.throws(() => migrateLegacySettingsToV3({ version: 2, refreshMs: "7000" }, { version: 2 }), /refreshMs/i);
	assert.throws(() => migrateLegacySettingsToV3({ version: 2, display: { balance: "yes" } }, { version: 2 }), /display\.balance/i);
	assert.throws(() => migrateLegacySettingsToV3({ version: 2, display: { balance: true, bogus: true } }, { version: 2 }), /unknown field/i);
	assert.throws(() => migrateLegacySettingsToV3({ version: 2, notifications: { planQuota: { windows: { weekly: { bogus: 1 } } } } }, { version: 2 }), /unknown field/i);
	assert.throws(() => migrateLegacySettingsToV3({ version: 2 }, { version: 2, global: { dailyCostLimit: "5" } }), /dailyCostLimit/i);
	assert.throws(() => migrateLegacySettingsToV3({ version: 2 }, { version: 2, bogus: 1 }), /unknown field/i);
	assert.throws(() => migrateLegacySettingsToV3({ version: 2 }, { version: 2, global: { bogus: 1 } }), /unknown field/i);
	assert.throws(() => migrateLegacySettingsToV3({ version: 2 }, { version: 2, keys: { " A ": {}, A: {} } }), /duplicate normalized key/i);
	const malformedPricing = { pricing: [], models: "bad", peakHours: "bad" };
	assert.throws(() => migrateLegacySettingsToV3({ version: 2, pricing: malformedPricing }, { version: 2 }), /pricing/i);
	assert.throws(() => validateUsageStatsSettings({ ...USAGE_STATS_SETTINGS_SCHEMA({}), pricing: malformedPricing }), /pricing/i);
}

async function testSettingsAdapter() {
	const defaults = USAGE_STATS_SETTINGS_SCHEMA({});
	assert.equal(defaults.version, 3);
	assert.deepEqual(defaults.display, { balance: true, todayCost: true, statusDot: true });
	assert.deepEqual(defaults.limits, { version: 2, global: {
		enabled: false,
		dailyCostLimit: null,
		monthlyCostLimit: null,
		minBalance: null,
		lowBalanceWarning: null,
		alertPercent: 80,
		criticalPercent: 90,
		period: "daily",
		stopOnExceed: false,
		notificationCooldownMs: 30 * 60 * 1000
	}, keys: {} });
	const calls = [];
	let current = { marker: "resolved" };
	const scope = {
		get: () => current,
		watch: (callback) => {
			calls.push(["watch", callback]);
			return () => calls.push(["unwatch"]);
		},
		async update(patch) {
			calls.push(["update", patch]);
			current = { ...current, ...patch };
		},
		async replace(section) { calls.push(["replace", section]); }
	};
	const ctx = {
		settings: {
			register(namespace, schema, options) {
				calls.push(["register", namespace, schema, options]);
				return scope;
			},
			async mutate(namespace, operations) {
				calls.push(["mutate", namespace, operations]);
			}
		}
	};
	const settings = createUsageStatsSettings(ctx, { refreshMs: 9000, maxLedgerEntries: 321 });
	assert.equal(calls[0][1], USAGE_STATS_SETTINGS_NAMESPACE);
	assert.deepEqual(calls[0][3].base, { refreshMs: 9000, maxLedgerEntries: 321 });
	assert.equal(calls[0][3].applies, "live");
	assert.equal(calls[0][3].validate, validateUsageStatsSettings);
	assert.throws(() => validateUsageStatsSettings({
		...defaults,
		visibleProviderIds: ["same", "same"]
	}), /duplicates/);
	assert.throws(() => validateUsageStatsSettings({
		...defaults,
		limits: { ...defaults.limits, global: { ...defaults.limits.global, alertPercent: 90, criticalPercent: 80 } }
	}), /criticalPercent/);
	assert.throws(() => USAGE_STATS_SETTINGS_SCHEMA({ maxLedgerEntries: 5001 }), /5000|maximum|max/i);
	assert.deepEqual(settings.get(), { marker: "resolved" });
	await settings.update({ display: { balance: false } });
	await settings.replaceLimits({ version: 2, global: {}, keys: {} });
	await settings.resetPricing();
	assert.deepEqual(calls.slice(1).map((entry) => entry.slice(0, 3)), [
		["update", { display: { balance: false } }],
		["mutate", USAGE_STATS_SETTINGS_NAMESPACE, [{ op: "set", path: ["limits"], value: { version: 2, global: {}, keys: {} } }]],
		["mutate", USAGE_STATS_SETTINGS_NAMESPACE, [{ op: "unset", path: ["pricing"] }]]
	]);
	assert.deepEqual(retiredSettingsFieldsOf({ conversation: { enabled: true }, display: {} }), ["conversation"]);
	assert.deepEqual(retiredSettingsFieldsOf({ display: {} }), []);
	assert.deepEqual(retiredSettingsFieldsOf(null), []);
	current = { marker: "resolved", conversation: { enabled: true } };
	await settings.retireStaleFields();
	assert.deepEqual(calls.at(-1).slice(0, 3), ["mutate", USAGE_STATS_SETTINGS_NAMESPACE, [{ op: "unset", path: ["conversation"] }]], "stale retired conversation field must be pruned from persisted settings");
	current = { marker: "resolved" };
	const callsBeforePrune = calls.length;
	await settings.retireStaleFields();
	assert.equal(calls.length, callsBeforePrune, "retireStaleFields must not write when no retired fields remain");
}

async function testMigrationBridge() {
	const root = await mkdtemp(join(tmpdir(), "dsh-usage-state-"));
	try {
		assert.deepEqual(legacyUsageStatsPaths(root), {
			settings: join(root, "storages", "usage-settings.json"),
			limits: join(root, "storages", "usage-limits.json"),
			cache: join(root, "storages", "usage-stats-cache.json")
		});
		const source = join(root, "usage-settings.json");
		await writeFile(source, JSON.stringify({ version: 2, refreshMs: 7000 }), "utf8");
		const first = await backupLegacyFile(source);
		assert.equal(first.backupPath, `${source}.pre-v3.bak`);
		assert.equal(await readFile(first.backupPath, "utf8"), await readFile(source, "utf8"));
		const prepared = await prepareLegacyJson(source);
		assert.deepEqual(prepared.value, { version: 2, refreshMs: 7000 });
		assert.equal(prepared.sha256, first.sha256);

		await writeFile(source, JSON.stringify({ version: 2, refreshMs: 8000 }), "utf8");
		await assert.rejects(backupLegacyFile(source), /backup conflict/i);
		await unlink(source);
		assert.deepEqual((await prepareLegacyJson(source)).value, { version: 2, refreshMs: 7000 }, "retry must read the fixed backup");

		const broken = join(root, "broken.json");
		await writeFile(broken, "{nope", "utf8");
		await assert.rejects(prepareLegacyJson(broken), /invalid legacy JSON/i);
		assert.equal(await prepareLegacyJson(join(root, "missing.json")), null);

		const settingsPath = join(root, "settings-ok.json");
		const limitsPath = join(root, "limits-ok.json");
		const cachePath = join(root, "cache-ok.json");
		await Promise.all([
			writeFile(settingsPath, "{}", "utf8"),
			writeFile(limitsPath, "{}", "utf8"),
			writeFile(cachePath, JSON.stringify({ version: 2, ledger: [] }), "utf8")
		]);
		let settingsDone = false;
		let storageDone = false;
		let settingsCommits = 0;
		let storageCommits = 0;
		const options = {
			paths: { settings: settingsPath, limits: limitsPath, cache: cachePath },
			settings: {
				isComplete: () => settingsDone,
				commit: async ({ settings, limits }) => {
					assert.deepEqual(settings.value, {});
					assert.deepEqual(limits.value, {});
					settingsCommits += 1;
					settingsDone = true;
				}
			},
			storage: {
				isComplete: () => storageDone,
				commit: async ({ cache }) => {
					assert.equal(cache.value.version, 2);
					storageCommits += 1;
					storageDone = true;
				}
			}
		};
		assert.deepEqual(await initializeLegacyMigrations(options), { settings: "migrated", storage: "migrated" });
		assert.deepEqual(await initializeLegacyMigrations(options), { settings: "skipped", storage: "skipped" });
		assert.equal(settingsCommits, 1);
		assert.equal(storageCommits, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

await testStorageRepository();
await testSettingsAdapter();
await testMigrationBridge();
await testLegacyConverters();
console.log("official storage/settings/migration tests passed");
