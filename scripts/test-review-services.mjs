import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateConfig, defaultLimits, defaultLimitRule, evaluateKeyQuota, createLimitsService, createBalanceService, createProviderService, configuredKeys, createUsageOperations, startBackgroundRefresh } from '../lib/index.js';
import { USAGE_STATS_SETTINGS_SCHEMA, validateUsageStatsSettings } from '../lib/settings.js';

test('disabled rules cannot contribute limits or hard stops', () => {
 const limits = { ...defaultLimits(), global: { ...defaultLimitRule(), enabled: false, dailyCostLimit: 1, stopOnExceed: true }, keys: { A: { ...defaultLimitRule(), enabled: true, dailyCostLimit: 100 } } };
 assert.equal(evaluateKeyQuota({ keyRef: 'A', limits, todayCost: 2 }).status, 'normal');
 limits.keys.A.alertPercent = 95;
 limits.keys.A.criticalPercent = 99;
 assert.equal(evaluateKeyQuota({ keyRef: 'A', limits, todayCost: 85 }).status, 'normal', 'disabled global defaults must not tighten a key warning threshold');
 limits.global.enabled = true;
 limits.global.dailyCostLimit = 100;
 limits.keys.A = { ...defaultLimitRule(), enabled: false, dailyCostLimit: 1 };
 assert.equal(evaluateKeyQuota({ keyRef: 'A', limits, todayCost: 2 }).status, 'normal');
});

test('official and provider balance caches follow runtime refresh cadence', async () => {
 const config = validateConfig({ refreshMs: 60000 });
 let now = 1000;
 let settings = { refreshMs: 120000 };
 const settingsService = { snapshot: () => settings };
 const credentials = { resolve: async () => ({ value: 'synthetic-secret' }) };
 let officialCalls = 0;
 const official = createBalanceService({ config, credentials, settingsService, deps: { now: () => now, queryBalance: async () => { officialCalls++; return { total: 20 }; } } });
 let providerCalls = 0;
 const ctx = { credentials, llm: { listConfigurableProviders: () => [{ provider: 'openrouter' }] }, get(name) { return this[name]; } };
 const provider = createProviderService({ ctx, config, credentials, settingsService, deps: { now: () => now, fetch: async () => { providerCalls++; return new Response(JSON.stringify({ data: { limit: 100, usage: 1, total_credits: 100, total_usage: 1 } })); } } });
 for (const [service, get, count] of [[official, () => official.get(config.defaultKeyRef), () => officialCalls], [provider, () => provider.get('openrouter'), () => providerCalls]]) {
  await get();
  const first = count();
  now += 65000;
  await get();
  assert.equal(count(), first, 'runtime TTL longer than startup config must reuse the cache');
  settings = { refreshMs: 5000 };
  await get();
  assert.ok(count() > first, 'shortening runtime TTL must expire the old cache');
  settings = { refreshMs: 120000 };
 }
});

test('automatic balance RPC honors disabled refresh while manual reads still work', async () => {
 const config = validateConfig({});
 let settings = { refreshMs: null };
 let officialCached = null;
 let providerCached = null;
 const reads = [];
 const operations = createUsageOperations({ config, settingsService: { load: async () => settings }, balanceService: { cached: () => officialCached, get: async (ref, force) => { reads.push(['official', force]); return { id: ref, status: 'ok' }; } }, providerService: { providers: async () => [{ id: 'openrouter', keyRef: 'OPENROUTER_API_KEY', queryable: true }], cached: (_provider, ref) => { assert.equal(ref, 'OPENROUTER_API_KEY'); return providerCached; }, get: async (_provider, _ref, force) => { reads.push(['provider', force]); return { status: 'ok' }; } } });
 for (const query of [{ auto: '1' }, { auto: '1', provider: 'openrouter' }]) {
  assert.equal((await operations['balance/get']({ query })).account.status, 'refresh-disabled');
 }
 assert.deepEqual(reads, [], 'disabled automatic reads must not contact either remote service');
 officialCached = { status: 'ok', balance: { total: 1 } };
 providerCached = { status: 'ok', balance: { total: 2 } };
 assert.equal((await operations['balance/get']({ query: { auto: '1' } })).account.balance.total, 1);
 assert.equal((await operations['balance/get']({ query: { auto: '1', provider: 'openrouter' } })).account.balance.total, 2);
 await operations['balance/get']({ query: { auto: '1', refresh: '1' } });
 await operations['balance/get']({ query: { provider: 'openrouter' } });
 assert.deepEqual(reads, [['official', true], ['provider', false]]);
 settings = { refreshMs: 5000 };
 await operations['balance/get']({ query: { auto: '1' } });
 assert.equal(reads.length, 3);
});

test('display quota reads respect automatic refresh without weakening live request checks', async () => {
 const config = validateConfig({ keys: ['A'], defaultKeyRef: 'A' });
 let refreshMs = null;
 const limits = { ...defaultLimits(), global: { ...defaultLimitRule(), enabled: true, minBalance: 1 } };
 const calls = [];
 const service = createLimitsService({ ctx: {}, config, balanceService: { cached: () => null, get: async ref => { calls.push(ref); return null; } }, deps: { settings: { load: async () => ({ limits, refreshMs }) }, collectUsage: async () => ({ days: [] }) } });
 await service.evaluateAll();
 assert.deepEqual(calls, []);
 await service.check({ provider: 'deepseek-official' });
 assert.deepEqual(calls, ['A'], 'a real model request must still check its balance rule');
 refreshMs = 5000;
 await service.evaluateAll();
 assert.deepEqual(calls, ['A', 'A']);
});

test('display and live limit evaluations share the runtime cache age', async () => {
 const config = validateConfig({ keys: ['A'], defaultKeyRef: 'A', refreshMs: 60000 });
 let refreshMs = 120000;
 const limits = { ...defaultLimits(), global: { ...defaultLimitRule(), enabled: true, minBalance: 1 } };
 let calls = 0;
 const account = { id: 'A', status: 'ok', fetchedAt: 1000, balance: { total: 10 } };
 const service = createLimitsService({ ctx: {}, config, balanceService: { cached: () => account, get: async () => { calls++; return { ...account, fetchedAt: 70000 }; } }, deps: { now: () => 70000, settings: { load: async () => ({ limits, refreshMs }) }, collectUsage: async () => ({ days: [] }) } });
 assert.equal((await service.evaluateAll()).statuses.A.balanceFresh, true);
 await service.check({ provider: 'deepseek-official' });
 assert.equal(calls, 0, 'runtime TTL applies consistently to render and safety checks');
 refreshMs = 5000;
 await service.evaluateAll();
 assert.equal(calls, 1);
});

test('disabled background refresh never contacts providers on startup', async () => {
 let calls = 0;
 let timers = 0;
 const stop = startBackgroundRefresh({ logger: { warn() {} } }, { refreshAll: async () => { calls++; } }, validateConfig({}), { getRefreshMs: () => 0, refreshProvider: async () => { calls++; }, setInterval: () => { timers++; return 1; }, clearInterval() {} });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(calls, 0);
 assert.equal(timers, 0);
 await stop.refreshNow();
 assert.equal(calls, 2, 'explicit refreshNow remains available');
 await stop();
});

test('periodic background reads reuse a fresh balance and explicit refresh bypasses it', async () => {
 let calls = 0;
 const config = validateConfig({ refreshMs: 60000 });
 const balance = createBalanceService({ config, credentials: { resolve: async () => ({ value: 'synthetic-secret' }) }, deps: { now: () => 1000, queryBalance: async () => { calls++; return { total: 10 }; } } });
 await balance.get(config.defaultKeyRef);
 let tick;
 const stop = startBackgroundRefresh({ logger: { warn() {} } }, balance, config, { setInterval: callback => { tick = callback; return 1; }, clearInterval() {} });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(calls, 1, 'startup must reuse an already warmed balance');
 tick();
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(calls, 1, 'timer must reuse fresh data from other readers');
 await stop.refreshNow();
 assert.equal(calls, 2);
 await stop();
});

test('monthly plan thresholds persist and old top-level custom values remain the fallback', () => {
 const legacy = USAGE_STATS_SETTINGS_SCHEMA({ notifications: { planQuota: { warningRemainingPercent: 45, criticalRemainingPercent: 25 } } });
 const monthly = legacy.notifications.planQuota.windows.monthly;
 assert.equal(monthly?.warningRemainingPercent ?? legacy.notifications.planQuota.warningRemainingPercent, 45);
 const value = USAGE_STATS_SETTINGS_SCHEMA({ notifications: { planQuota: { windows: { monthly: { warningRemainingPercent: 40, criticalRemainingPercent: 20 } } } } });
 assert.deepEqual(value.notifications.planQuota.windows.monthly, { warningRemainingPercent: 40, criticalRemainingPercent: 20 });
 assert.throws(() => USAGE_STATS_SETTINGS_SCHEMA({ notifications: { planQuota: { windows: { monthly: { warningRemainingPercent: 101, criticalRemainingPercent: 20 } } } } }), /100|maximum|max/i);
 assert.throws(() => validateUsageStatsSettings({ ...value, pricing: undefined, notifications: { ...value.notifications, planQuota: { ...value.notifications.planQuota, windows: { ...value.notifications.planQuota.windows, monthly: { warningRemainingPercent: 10, criticalRemainingPercent: 20 } } } } }), /monthly/);
});

test('sidebar notification switch presents and updates the effective legacy display state', async () => {
 let settings = { display: { statusDot: false, balance: true }, notifications: { channels: { sidebar: true, toast: false } } };
 const operations = createUsageOperations({ settingsService: { load: async () => settings, update: async patch => { settings = { ...settings, ...patch, display: { ...settings.display, ...patch.display }, notifications: { ...settings.notifications, ...patch.notifications, channels: { ...settings.notifications.channels, ...patch.notifications?.channels } } }; return settings; } }, limitsService: { evaluateAll: async () => ({ alerts: [] }) } });
 assert.equal((await operations['alerts/get']()).notifications.channels.sidebar, false);
 const enabled = await operations['alerts/update']({ body: { notifications: { channels: { sidebar: true } } } });
 assert.equal(enabled.notifications.channels.sidebar, true);
 assert.equal(settings.display.statusDot, true);
 assert.equal(settings.display.balance, true);
 await operations['alerts/update']({ body: { notifications: { channels: { toast: true } } } });
 assert.equal(settings.display.statusDot, true);
});

test('global monthly and key daily caps are both enforced', () => {
 const limits = { ...defaultLimits(), global: { ...defaultLimitRule(), enabled: true, period: 'monthly', monthlyCostLimit: 100, stopOnExceed: true }, keys: { A: { ...defaultLimitRule(), enabled: true, dailyCostLimit: 10 } } };
 const monthly = evaluateKeyQuota({ keyRef: 'A', limits, todayCost: 1, monthlyCost: 150 });
 assert.equal(monthly.blocked, true);
 assert.equal(monthly.reason, 'monthly_cost');
 const daily = evaluateKeyQuota({ keyRef: 'A', limits, todayCost: 11, monthlyCost: 11 });
 assert.equal(daily.blocked, true);
 assert.equal(daily.reason, 'daily_cost');
 assert.equal(evaluateKeyQuota({ keyRef: 'A', limits, todayCost: 11, todayCostReliable: false, monthlyCost: 150 }).reason, 'monthly_cost');
});

test('disabled and spend-only request checks do not query balances', async () => {
 const config = validateConfig({ keys: ['A', 'B'], defaultKeyRef: 'A' });
 const limits = defaultLimits();
 const requested = [];
 const service = createLimitsService({ ctx: {}, config, balanceService: { cached: () => null, get: async ref => { requested.push(ref); return null; } }, deps: { settings: { load: async () => ({ limits }) }, collectUsage: async () => ({ days: [] }) } });
 await service.check({ provider: 'deepseek-official' });
 assert.deepEqual(requested, []);
 limits.global = { ...defaultLimitRule(), enabled: true, dailyCostLimit: 10 };
 await service.check({ provider: 'deepseek-official' });
 assert.deepEqual(requested, []);
 limits.global.minBalance = 1;
 await service.check({ provider: 'deepseek-official' });
 assert.deepEqual(requested, ['A']);
});

test('balance-only warnings cannot turn unreliable spend into a hard stop', () => {
 const limits = { ...defaultLimits(), global: { ...defaultLimitRule(), enabled: true, dailyCostLimit: 10, lowBalanceWarning: 5, stopOnExceed: true } };
 const status = evaluateKeyQuota({ keyRef: 'A', limits, todayCost: 20, todayCostReliable: false, balance: { total: 0 } });
 assert.equal(status.reason, 'low_balance');
 assert.equal(status.blocked, false);
 assert.equal(status.spendStatus, 'muted');
});

test('invalid RPC limits update cannot reset configured rules', async () => {
 let writes = 0;
 const limitsService = createLimitsService({ config: validateConfig({}), deps: { settings: { replaceLimits: async () => { writes++; } } } });
 const operations = createUsageOperations({ limitsService });
 for (const body of [{}, { global: null }, { keys: [] }, { global: [] }, { version: 2 }]) {
  await assert.rejects(operations['limits/update']({ body }));
 }
 assert.equal(writes, 0);
});

test('official balance follows live host key and baseURL and retains extra keys', async () => {
 const config = validateConfig({ keys: ['EXTRA'], defaultKeyRef: 'EXTRA' });
 let profile = { apiKeyEnv: 'HOST_KEY', baseURL: 'https://host.example/v1' };
 const ctx = { settings: { get: ns => ns === 'llm-deepseek' ? profile : null }, credentials: { resolve: async ref => ({ value: ref + '-secret' }) }, get(name) { return this[name]; } };
 const keys = await configuredKeys(ctx, config);
 assert.ok(keys.some(key => key.id === 'HOST_KEY' && key.default));
 assert.ok(keys.some(key => key.id === 'EXTRA'));
 const calls = [];
 const service = createBalanceService({ ctx, config, credentials: ctx.credentials, deps: { queryBalance: async (url, key) => { calls.push([url, key]); return { total: 10 }; } } });
 await service.get('HOST_KEY');
 assert.deepEqual(calls.at(-1), ['https://host.example/v1', 'HOST_KEY-secret']);
 profile = { ...profile, baseURL: 'https://changed.example/v1' };
 await service.get('HOST_KEY');
 assert.deepEqual(calls.at(-1), ['https://changed.example/v1', 'HOST_KEY-secret']);
 await service.get('EXTRA');
 assert.deepEqual(calls.at(-1), [config.baseURL, 'EXTRA-secret']);
 const operations = createUsageOperations({ ctx, config, balanceService: service, limitsService: { evaluateAll: async () => ({ limits: defaultLimits(), statuses: {} }) } });
 assert.equal((await operations['limits/get']()).defaultKeyRef, 'HOST_KEY');
 const beforeRefresh = calls.length;
 await operations['balance/get']({ query: {} });
 assert.equal(calls.length, beforeRefresh, 'ordinary loads reuse the matching account cache');
 await operations['balance/get']({ query: { refresh: '1' } });
 assert.equal(calls.length, beforeRefresh + 1, 'manual refresh bypasses the TTL');
 profile = { ...profile, apiKeyEnv: 'NEW_HOST_KEY' };
 await operations['balance/get']({ query: {} });
 assert.deepEqual(calls.at(-1), [profile.baseURL, 'NEW_HOST_KEY-secret']);
 assert.equal((await operations['limits/get']()).defaultKeyRef, 'NEW_HOST_KEY');
});
