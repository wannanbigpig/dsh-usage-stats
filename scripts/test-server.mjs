import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	apply,
	collectUsage,
	configuredKeys,
	createBackgroundRefreshController,
	createBalanceService,
	createLimitsService,
	createProviderService,
	dataInfoOf,
	defaultLimitRule,
	defaultLimits,
	evaluateKeyQuota,
	filterRenderedUsageByProvider,
	inject,
	isDataClearConfirmation,
	keyForProvider,
	maxLedgerEntriesOf,
	providerTodaySummaries,
	refreshCadenceOf,
	resolveLimitRule,
	runtimePricingOf,
	todayCostFor,
	todayCostPerKey,
	validateConfig,
	validateLimitRule,
	validateLimits,
	visibleProviderIdsOf
} from "../lib/index.js";

// Disposing while a settings restart is waiting for the old refresh to stop
// must not start a new orphaned refresh instance.
{
	let watcher = null;
	let starts = 0;
	let releaseStop;
	const firstStop = new Promise((resolve) => { releaseStop = resolve; });
	const dispose = createBackgroundRefreshController({
		watch: (callback) => { watcher = callback; return () => { watcher = null; }; },
		start: () => { starts += 1; return starts === 1 ? () => firstStop : async () => {}; }
	});
	const restart = watcher({ refreshMs: 1000 }, { refreshMs: 500 });
	const disposing = dispose();
	releaseStop();
	await Promise.all([restart, disposing]);
	assert.equal(starts, 1, "disposed settings watcher must not restart background refresh");
}
import { USAGE_RPC_CHANNEL } from "../lib/rpc.js";
import { createEmptyUsageState, StateSchema } from "../lib/storage.js";

function clone(value) {
	return structuredClone(value);
}

function setAtPath(target, path, value) {
	let cursor = target;
	for (const part of path.slice(0, -1)) cursor = cursor[part] ??= {};
	cursor[path.at(-1)] = clone(value);
}

function unsetAtPath(target, path) {
	let cursor = target;
	for (const part of path.slice(0, -1)) cursor = cursor?.[part];
	if (cursor !== null && typeof cursor === "object") delete cursor[path.at(-1)];
}

/** Total live ledger entries across the per-day rows of the fake domain. */
function ledgerEntriesOf(harness) {
	return [...harness.domain.ledger.records.values()].reduce((sum, row) => sum + row.entries.length, 0);
}

function createHarness(options = {}) {
	let settingsValue;
	let userSection = {};
	const watchers = new Set();
	const settings = {
		register(_namespace, _schema, options = {}) {
			settingsValue = {
				version: 3,
				defaultProviderId: "deepseek-official",
				visibleProviderIds: [],
				refreshMs: options.base?.refreshMs ?? null,
				display: { balance: true, todayCost: true, statusDot: true },
				pricing: options.base?.pricing ?? null,
				maxLedgerEntries: options.base?.maxLedgerEntries ?? null,
				limits: defaultLimits(),
				notifications: {
					channels: { sidebar: true, toast: false },
					events: { warning: true, exceeded: true, lowBalance: true, recovery: true },
					planQuota: {
						warningRemainingPercent: 30,
						criticalRemainingPercent: 10,
						windows: {
							five_hour: { warningRemainingPercent: 30, criticalRemainingPercent: 10 },
							weekly: { warningRemainingPercent: 30, criticalRemainingPercent: 10 }
						}
					},
					cooldownMs: 1800000
				},
				migration: { legacySettingsImported: false, legacySettingsSha256: "", legacyLimitsSha256: "" }
			};
			return {
				get: () => settingsValue,
				watch(callback) { watchers.add(callback); return () => watchers.delete(callback); },
				async update(patch) {
					const previous = clone(settingsValue);
					userSection = { ...userSection, ...clone(patch) };
					settingsValue = { ...settingsValue, ...clone(patch) };
					for (const watcher of watchers) await watcher(settingsValue, previous);
				},
				async replace(section) {
					const previous = clone(settingsValue);
					userSection = clone(section);
					settingsValue = { ...settingsValue, ...clone(section) };
					for (const watcher of watchers) await watcher(settingsValue, previous);
				}
			};
		},
		async mutate(_namespace, operations) {
			const previous = clone(settingsValue);
			for (const operation of operations) {
				if (operation.op === "set") {
					setAtPath(settingsValue, operation.path, operation.value);
					setAtPath(userSection, operation.path, operation.value);
				} else {
					unsetAtPath(userSection, operation.path);
					if (operation.path.join(".") === "pricing") settingsValue.pricing = validateConfig({}).pricing;
				}
			}
			for (const watcher of watchers) await watcher(settingsValue, previous);
		},
		describe: () => [{ ns: "usage-stats", user: clone(userSection) }]
	};

	let closed = false;
	const makeTable = () => {
		const records = new Map();
		return {
			get: (key) => records.get(key),
			async put(key, value) { records.set(key, clone(value)); },
			async delete(key) { return records.delete(key); },
			entries: () => [...records.entries()][Symbol.iterator](),
			keys: () => [...records.keys()][Symbol.iterator](),
			get records() { return records; },
			get size() { return records.size; }
		};
	};
	const domain = {
		ledger: makeTable(),
		frozen: makeTable(),
		global: {
			stored: null,
			get() { return this.stored === null ? { installedAt: 0, coverageCutoffsByDay: {}, recentSampleKeys: [], frozenEntryCount: 0, frozenPricingVersionCounts: {}, estimated: { importedLegacy: null, unfrozenLedger: null, sessionRebuild: null }, migration: {} } : clone(this.stored); },
			async set(value) { this.stored = clone(value); }
		},
		table(name) { return this[name]; },
		async close() { closed = true; }
	};
	const storageDomain = {
		async open(spec) {
			// A v1 probe sees the pre-v4 single document, which this harness never writes.
			if (spec.version === 1) return { table: () => ({ get: () => void 0 }), async close() {} };
			return domain;
		}
	};
	const listeners = new Map();
	const effects = [];
	let rpcRegistration;
	const credentials = {
		resolve: async (ref) => ref === "DEEPSEEK_API_KEY" ? { value: "secret" } : null,
		set: async () => {}
	};
	const sessionPersistence = options.sessionPersistence ?? {
		listSnapshots: async () => [],
		readFrom: async () => ({ events: [] })
	};
	const ctx = {
		settings,
		storageDomain,
		credentials,
		sessionPersistence,
		connection: { rpc: { handle(channel, handler, options) { rpcRegistration = { channel, handler, options }; return () => {}; } } },
		logger: { warn: () => {}, info: () => {} },
		get(name) { return this[name]; },
		on(name, listener) { listeners.set(name, listener); return () => listeners.delete(name); },
		effect(factory) { const disposer = factory(); effects.push(disposer); return disposer; }
	};
	return {
		ctx,
		listeners,
		domain,
		get rpc() { return rpcRegistration; },
		get closed() { return closed; },
		async dispose() {
			for (const disposer of effects.reverse()) if (typeof disposer === "function") await disposer();
		}
	};
}

// Pure configuration and quota compatibility contracts.
{
	const config = validateConfig({ keys: ["A", "A", "B"], defaultKeyRef: "A", refreshMs: 60000, keyProviders: { B: ["deepseek-secondary"] } });
	assert.deepEqual(config.keys, ["A", "B"]);
	assert.equal(config.refreshMs, 60000);
	assert.equal(keyForProvider("deepseek-secondary", config), "B");
	assert.equal(refreshCadenceOf({ refreshMs: null }, config), 0);
	assert.equal(maxLedgerEntriesOf({ maxLedgerEntries: 123 }, config), 123);
	assert.equal(runtimePricingOf({ pricing: null }, config), config.pricing);
	assert.throws(() => validateConfig({ baseURL: "http://example.com" }), /HTTPS/);
	assert.throws(() => validateConfig({ maxLedgerEntries: 99 }), /at least 100/);
	assert.throws(() => validateConfig({ maxLedgerEntries: 5001 }), /at most 5000/);
	assert.throws(() => validateConfig({ maxLedgerEntries: 100.5 }), /integer/);

	const limits = validateLimits({ version: 2, global: { ...defaultLimitRule(), enabled: true, dailyCostLimit: 10 }, keys: {} });
	assert.equal(resolveLimitRule(limits, "missing").dailyCostLimit, 10);
	assert.equal(validateLimitRule({ enabled: true, stopOnExceed: true }, { legacy: true }).stopOnExceed, false);
	assert.equal(evaluateKeyQuota({ keyRef: "A", limits, todayCost: 10 }).status, "exceeded");
	const mappedButUnconfigured = validateConfig({ keys: ["known"], defaultKeyRef: "known", keyProviders: { detached: ["deepseek-official"] } });
	const unreliableLimits = validateLimits({ version: 2, global: { ...defaultLimitRule(), enabled: true, dailyCostLimit: 10, stopOnExceed: true }, keys: {} });
	const limitsService = createLimitsService({
		ctx: {},
		config: mappedButUnconfigured,
		balanceService: null,
		deps: {
			settings: { load: async () => ({ limits: unreliableLimits, pricing: null }) },
			collectUsage: async () => ({ days: [{ date: "2026-08-25", cost: null, models: [] }] }),
			todayKey: () => "2026-08-25"
		}
	});
	const unreliableFallback = await limitsService.check({ provider: "deepseek-official" });
	assert.equal(unreliableFallback.status, "unpriced", "an unmapped status fallback must preserve an unpriced daily cost");
	const monthlyLimits = validateLimits({ version: 2, global: { ...defaultLimitRule(), enabled: true, period: "monthly", monthlyCostLimit: 100 }, keys: {} });
	const monthlyStatus = evaluateKeyQuota({ keyRef: "A", limits: monthlyLimits, todayCost: 1, monthlyCost: 100 });
	assert.equal(monthlyStatus.status, "exceeded");
	assert.equal(monthlyStatus.reason, "monthly_cost");
	const partialKeyMonthlyLimits = validateLimits({
		version: 2,
		global: { ...defaultLimitRule(), enabled: true, period: "monthly", monthlyCostLimit: 100, stopOnExceed: true },
		keys: { K: { lowBalanceWarning: 1 } }
	});
	const partialKeyMonthlyStatus = evaluateKeyQuota({ keyRef: "K", limits: partialKeyMonthlyLimits, todayCost: 0, monthlyCost: 100 });
	assert.equal(partialKeyMonthlyStatus.status, "blocked", "a partial key rule must inherit the global monthly period and hard cap");
	assert.equal(partialKeyMonthlyStatus.reason, "monthly_cost", "inherited monthly limits must report the monthly reason");
	assert.equal(validateLimitRule({ period: "custom" }).period, "daily");
	assert.equal(isDataClearConfirmation("清除"), true);
	assert.equal(isDataClearConfirmation("yes"), false);
	const estimated = createEmptyUsageState();
	estimated.archive.estimated.unfrozenLedger = [{ occurredAt: Date.parse("2026-08-20T12:00:00+08:00") }];
	const info = dataInfoOf(estimated, config, { maxLedgerEntries: 123 });
	assert.equal(info.estimatedLegacyCount, 1);
	assert.deepEqual(info.estimatedRange, { earliest: "2026-08-20", latest: "2026-08-20" });
}

// Provider/key helpers remain credential-seam based and token-only providers stay isolated.
{
	const config = validateConfig({});
	const ctx = { credentials: { resolve: async () => ({ value: "secret" }) }, get(name) { return this[name]; } };
	assert.equal((await configuredKeys(ctx, config))[0].configured, true);
	const summaries = providerTodaySummaries({ days: [{ date: "2026-08-25", models: [
		{ model: "deepseek-official/deepseek-v4-flash", inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0.1 },
		{ model: "openrouter/model", inputTokens: 3, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 0, cost: null }
	] }] }, "2026-08-25");
	assert.equal(summaries["deepseek-official"].cost, 0.1);
	assert.equal(summaries.openrouter.cost, null);
	const filtered = filterRenderedUsageByProvider({ days: [{ date: "2026-08-25", models: [{ model: "openrouter/model", inputTokens: 3, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 0, cost: null }], hours: [] }] }, "openrouter");
	assert.equal(filtered.total.tokens, 7);
	const filteredCounts = filterRenderedUsageByProvider({ days: [{ date: "2026-08-25", requestCount: 3, models: [{ model: "openrouter/model", tokens: 7, requestCount: 3 }], hours: [{ hour: 1, requestCount: 3, models: [{ model: "openrouter/model", tokens: 7, requestCount: 3 }] }] }], total: { requestCount: 3 } }, "openrouter");
	assert.equal(filteredCounts.total.requestCount, 3, "provider filtering must preserve total request counts");
	assert.equal(filteredCounts.days[0].requestCount, 3, "provider filtering must recompute day request counts");
	assert.equal(filteredCounts.days[0].hours[0].requestCount, 3, "provider filtering must recompute hour request counts");
	const malformedCounts = filterRenderedUsageByProvider({ days: [{ models: [{ model: "openrouter/model", tokens: 1, requestCount: 1.5 }], hours: [] }] }, "openrouter");
	assert.equal(malformedCounts.total.requestCount, null, "provider filtering must reject malformed request counts");
	assert.deepEqual(visibleProviderIdsOf({ visibleProviderIds: ["openrouter"] }, [{ id: "deepseek-official" }, { id: "openrouter" }], "deepseek-official"), ["deepseek-official", "openrouter"]);
	const costs = todayCostPerKey([{ models: [{ model: "deepseek-secondary/x", cost: 2 }] }], "2026-08-25", { ...config, keyProviders: { B: ["deepseek-secondary"] } });
	assert.equal(todayCostFor("B", costs, 2, config), 2);
}

// Balance/provider service core remains independently testable.
{
	const config = validateConfig({});
	const service = createBalanceService({
		credentials: { resolve: async () => ({ value: "secret" }) },
		config,
		deps: { queryBalance: async () => ({ isAvailable: true, currency: "CNY", total: 12 }), now: () => 100 }
	});
	assert.equal((await service.get(config.defaultKeyRef)).balance.total, 12);
	const provider = createProviderService({
		ctx: { get: () => void 0, logger: { warn: () => {} } },
		config,
		credentials: { resolve: async () => null },
		settingsService: { snapshot: () => ({ defaultProviderId: "deepseek-official" }) },
		deps: {}
	});
	assert.ok((await provider.providers()).some((entry) => entry.id === "deepseek-official"));
}

// Full Host lifecycle over official seams: no REST service, loopback RPC, atomic v3 ledger and dedup.
{
	const home = await mkdtemp(join(tmpdir(), "usage-stats-host-"));
	const harness = createHarness();
	try {
		const balance = { id: "DEEPSEEK_API_KEY", status: "ok", fetchedAt: Date.now(), balance: { total: 12, currency: "CNY" }, capabilities: ["balance"] };
		const providers = [{ id: "deepseek-official", label: "DeepSeek", keyRef: "DEEPSEEK_API_KEY", default: true, queryable: true, capabilities: ["balance"] }];
		await apply(harness.ctx, {}, {
			dshHome: home,
			disableBackgroundRefresh: true,
			balanceService: { cached: () => balance, get: async () => balance },
			providerService: { providers: async () => providers, cached: () => balance, get: async () => balance },
			fetchOfficialPricing: async () => ({ currency: "CNY", sourceUrl: "https://example.invalid/pricing", checkedAt: "2026-08-25T00:00:00.000Z", models: { "deepseek-v4-flash": { offPeak: { inputMiss: 1, inputHit: 1, output: 1 }, peak: { inputMiss: 2, inputHit: 2, output: 2 } } } })
		});
		assert.deepEqual(inject, ["credentials", "settings", "storageDomain", "connection", "sessionPersistence"]);
		assert.equal(harness.rpc.channel, USAGE_RPC_CHANNEL);
		assert.deepEqual(harness.rpc.options, { authority: "loopback" });
		assert.equal(harness.ctx.webServer, void 0);
		assert.ok(harness.domain.global.stored !== null && harness.domain.global.stored.installedAt > 0, "the host lifecycle must install the v4 global commit marker");

		const usageBefore = await harness.rpc.handler("usage/get", { query: {} });
		assert.equal(usageBefore.ok, true);
		assert.equal(usageBefore.value.ok, true);
		assert.equal(usageBefore.value.total.tokens, 0);
		const cachedUsage = await collectUsage(harness.ctx);
		cachedUsage.total.tokens = 999;
		assert.equal((await collectUsage(harness.ctx)).total.tokens, 0,
			"cached usage responses must remain detached from caller mutations");
		assert.equal((await harness.rpc.handler("keys/list", { query: {} })).value.keys.length, 1);
		assert.equal((await harness.rpc.handler("providers/list", { query: {} })).value.providers[0].id, "deepseek-official");
		assert.equal((await harness.rpc.handler("balance/get", { query: {} })).value.account.balance.total, 12);
		const limitsBefore = await harness.rpc.handler("limits/get", { query: {} });
		assert.equal(limitsBefore.value.ok, true);
		assert.equal((await harness.rpc.handler("limits/update", { body: limitsBefore.value.limits })).value.ok, true);
		const accountsBefore = await harness.rpc.handler("accounts/get", { query: {} });
		assert.equal(accountsBefore.value.accounts["deepseek-official"].balance.total, 12);
		assert.equal((await harness.rpc.handler("accounts/update", { body: { display: { balance: false, todayCost: true, statusDot: true } } })).value.settings.display.balance, false);
		const pricingBefore = await harness.rpc.handler("pricing/get", { query: {} });
		assert.equal(pricingBefore.value.usingCustom, false);
		assert.equal((await harness.rpc.handler("pricing/update", { body: { action: "fetch-official" } })).value.candidate.models["deepseek-v4-flash"].peak.output, 2);
		assert.equal((await harness.rpc.handler("pricing/update", { body: { mode: "custom", pricing: pricingBefore.value.current } })).value.usingCustom, true);
		assert.equal((await harness.rpc.handler("pricing/update", { body: { action: "restore" } })).value.usingCustom, false);
		const alertsBefore = await harness.rpc.handler("alerts/get", { query: {} });
		assert.equal((await harness.rpc.handler("alerts/update", { body: { notifications: alertsBefore.value.notifications } })).value.ok, true);
		assert.equal((await harness.rpc.handler("data/trim", { body: { retentionDays: 1 } })).value.trimmed, true);
		const unknown = await harness.rpc.handler("missing", {});
		assert.equal(unknown.error.code, "bad-request");
		const missingBody = await harness.rpc.handler("data/rebuild-estimated", {});
		assert.equal(missingBody.error.code, "bad-request", "a missing update body must fail before any session scan");
		const invalidDryRun = await harness.rpc.handler("data/rebuild-estimated", { body: { dryRun: "false" } });
		assert.equal(invalidDryRun.error.code, "bad-request", "dryRun must not coerce non-boolean values into an applying rebuild");
		for (const maxLedgerEntries of [99, 5001, 100.5]) {
			const invalidCapacity = await harness.rpc.handler("accounts/update", { body: { maxLedgerEntries } });
			assert.equal(invalidCapacity.error?.code, "bad-request", `capacity ${maxLedgerEntries} must be rejected`);
		}
		const capacity = await harness.rpc.handler("accounts/update", { body: { maxLedgerEntries: 100 } });
		assert.equal(capacity.ok, true);
		assert.equal(capacity.value.settings.maxLedgerEntries, 100);

		await harness.listeners.get("session/event")({ id: "s1" }, { type: "step/start", time: Date.now(), data: { turn: 1, step: 2 } });
		const stream = harness.listeners.get("llm/stream")({ sessionId: "s1", provider: "deepseek-official", model: "deepseek-v4-flash" }, async function* () {
			yield { type: "text", text: "ok" };
			yield { type: "usage", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
		});
		for await (const _chunk of stream) { /* drain */ }
		assert.equal(ledgerEntriesOf(harness), 1);
		assert.equal((await collectUsage(harness.ctx)).total.tokens, 2,
			"a successful ledger write must invalidate the cached rendered usage");
		const retriedStream = harness.listeners.get("llm/stream")({ sessionId: "s1", provider: "deepseek-official", model: "deepseek-v4-flash" }, async function* () {
			yield { type: "usage", usage: { inputTokens: 8, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
		});
		for await (const _chunk of retriedStream) { /* drain */ }
		assert.equal(ledgerEntriesOf(harness), 1, "a stream retry must replace the provisional sample");
		assert.equal([...harness.domain.ledger.records.values()][0].entries[0].usage.inputTokens, 8, "a stream retry must retain its latest usage");
		await harness.listeners.get("session/event")({ id: "s1" }, {
			type: "assistant/message",
			time: Date.now(),
			data: { turn: 1, step: 2, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { provider: "deepseek-official", model: "deepseek-v4-flash" } } }
		});
		assert.equal(ledgerEntriesOf(harness), 1, "late assistant/message must not duplicate authoritative stream usage");
		const compaction = harness.listeners.get("llm/stream")({ sessionId: "s1", purpose: "compaction", provider: "deepseek-official", model: "deepseek-v4-flash" }, async function* () {
			yield { type: "usage", usage: { inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 } };
		});
		for await (const _chunk of compaction) { /* drain */ }
		assert.equal(ledgerEntriesOf(harness), 2, "purpose-scoped calls must not reuse the preceding agent step key");
		await harness.listeners.get("session/event")({ id: "s1" }, {
			type: "assistant/message",
			time: Date.now(),
			data: { usage: { inputTokens: 3, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { provider: "deepseek-official", model: "deepseek-v4-flash" } } }
		});
		assert.equal(ledgerEntriesOf(harness), 2, "an unscoped assistant fallback must not duplicate a stream usage sample");
		await harness.listeners.get("session/event")({ id: "s1" }, { type: "step/start", time: Date.now(), data: { turn: 1, step: 3 } });
		const noUsageStream = harness.listeners.get("llm/stream")({ sessionId: "s1", provider: "deepseek-official", model: "deepseek-v4-flash" }, async function* () {
			yield { type: "text", text: "no usage chunk" };
		});
		for await (const _chunk of noUsageStream) { /* drain */ }
		await harness.listeners.get("session/event")({ id: "s1" }, {
			type: "assistant/message",
			time: Date.now(),
			data: { turn: 1, step: 3, usage: { inputTokens: 2, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { provider: "deepseek-official", model: "deepseek-v4-flash" } } }
		});
		assert.equal(ledgerEntriesOf(harness), 3, "a later call with no stream usage must still use assistant/message fallback");

		const info = await harness.rpc.handler("data/get", { query: {} });
		assert.equal(info.value.info.ledgerEntries, 3);
		assert.equal(info.value.info.ledgerCapacity, 100);
		const rebuilt = await harness.rpc.handler("data/rebuild-estimated", { body: { dryRun: true } });
		assert.equal(rebuilt.value.dryRun, true);
		assert.equal(harness.domain.global.stored.estimated.sessionRebuild, null);
		const cleared = await harness.rpc.handler("data/clear", { body: { confirmation: "DELETE" } });
		assert.equal(cleared.value.cleared, true);
		assert.equal(ledgerEntriesOf(harness), 0);
		assert.equal(harness.domain.global.stored.migration.legacyCacheImported, true);
	} finally {
		await harness.dispose();
		await rm(home, { recursive: true, force: true });
	}
	assert.equal(harness.closed, true);
}

// A rebuild may commit only if the single state/main record is unchanged
// throughout the session scan. Concurrent record and clear both invalidate it.
for (const concurrentAction of ["record", "clear", "abort"]) {
	const home = await mkdtemp(join(tmpdir(), `usage-stats-rebuild-${concurrentAction}-`));
	let releaseRead;
	let markReadStarted;
	const readStarted = new Promise((resolve) => { markReadStarted = resolve; });
	const readGate = new Promise((resolve) => { releaseRead = resolve; });
	const harness = createHarness({
		sessionPersistence: {
			listSnapshots: async () => [{ header: { id: "scan-session" } }],
			readFrom: async () => {
				markReadStarted();
				await readGate;
				return { events: [] };
			}
		}
	});
	try {
		await apply(harness.ctx, {}, { dshHome: home, disableBackgroundRefresh: true });
		if (concurrentAction === "clear") {
			await harness.listeners.get("session/event")({ id: "seed" }, {
				type: "assistant/message",
				time: Date.now(),
				data: { turn: 1, step: 1, usage: { inputTokens: 1 }, message: { source: { provider: "deepseek-official", model: "deepseek-v4-flash" } } }
			});
		}
		const abort = new AbortController();
		const rebuilding = harness.rpc.handler("data/rebuild-estimated", { body: { dryRun: false } }, abort.signal);
		await readStarted;
		if (concurrentAction === "record") {
			await harness.listeners.get("session/event")({ id: "new" }, {
				type: "assistant/message",
				time: Date.now(),
				data: { turn: 2, step: 1, usage: { inputTokens: 2 }, message: { source: { provider: "deepseek-official", model: "deepseek-v4-flash" } } }
			});
		} else if (concurrentAction === "clear") {
			const cleared = await harness.rpc.handler("data/clear", { body: { confirmation: "DELETE" } });
			assert.equal(cleared.ok, true);
		} else {
			abort.abort();
		}
		releaseRead();
		const result = await rebuilding;
		assert.equal(result.error?.code, concurrentAction === "abort" ? "cancelled" : "internal", `${concurrentAction} must prevent a stale rebuild commit`);
		assert.equal(harness.domain.global.stored.estimated.sessionRebuild, null);
		assert.equal(ledgerEntriesOf(harness), concurrentAction === "record" ? 1 : 0);
	} finally {
		releaseRead();
		await harness.dispose();
		await rm(home, { recursive: true, force: true });
	}
}

assert.deepEqual(StateSchema.parse(createEmptyUsageState()), createEmptyUsageState());

console.log("server official-seam integration tests passed");
