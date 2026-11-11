import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defaultLimits } from '../lib/index.js';
import { normalizePricing } from '../lib/pricing.js';
const require = createRequire(import.meta.url), React = require('react');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
window.matchMedia = () => ({ matches: true });
Object.defineProperty(document, 'hidden', { configurable: true, value: false });
const timers = new Map();
let timerId = 0;
window.setInterval = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; };
window.clearInterval = id => timers.delete(id);
let entry;
window.__ModuleLoader__ = { load: value => { entry = value; } };
new Function(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))();
const primitives = new Proxy({
 Switch: ({ checked, disabled, label, onChange }) => React.createElement('button', { role: 'switch', 'aria-label': label, 'aria-checked': checked, disabled, onClick: () => onChange(!checked) }),
 Tag: ({ children }) => React.createElement('span', {}, children), StateDot: () => null
}, { get: (target, key) => target[key] ?? (() => null) });
const api = entry.factory(spec => spec === '@deepseek-ai/dsh-client-ui-primitives' ? primitives : require(spec));
const providers = [{ id: 'deepseek-official', label: 'DeepSeek', configured: true, queryable: true, capabilities: ['balance'] }, { id: 'zai', label: 'Z.ai', configured: true, queryable: true, capabilities: ['plan_quota'] }];
const ds = { model: 'deepseek-official/flash', inputTokens: 60, cacheReadTokens: 420, cacheWriteTokens: 0, outputTokens: 120, tokens: 600, requestCount: 3, cost: .5 };
const zai = { model: 'zai/glm', inputTokens: 40, cacheReadTokens: 280, cacheWriteTokens: 0, outputTokens: 80, tokens: 400, requestCount: 2, cost: null };
const yesterday = { ...ds, inputTokens: 50, cacheReadTokens: 350, outputTokens: 100, tokens: 500, requestCount: 3, cost: .25 };
const days = [
 { date: '2026-11-10', inputTokens: 100, cacheReadTokens: 700, outputTokens: 200, tokens: 1000, requestCount: 5, cost: null, models: [ds, zai], hours: [{ hour: 9, inputTokens: 100, cacheReadTokens: 700, outputTokens: 200, tokens: 1000, models: [ds, zai] }] },
 { date: '2026-11-09', ...yesterday, models: [yesterday] }
];
let settings = { defaultProviderId: 'deepseek-official', visibleProviderIds: ['deepseek-official', 'zai'], display: { balance: true, todayCost: true }, refreshMs: 300000 };
const accountReplies = new Map();
let limitStatus = {};
const reads = [], writes = [];
let holdProviderUsage = false;
const ok = value => ({ ok: true, value: { ok: true, ...value } });
const call = async (_channel, endpoint, payload = {}, signal) => {
 reads.push({ endpoint, payload });
 if (endpoint === 'usage/get' && payload.query?.provider && holdProviderUsage) return new Promise((_resolve, reject) => {
  signal.addEventListener('abort', () => reject(new DOMException('Cancelled by test', 'AbortError')), { once: true });
 });
 if (endpoint === 'usage/get') return ok({ today: '2026-11-10', days, pricing: { currency: 'CNY', peakHours: [] } });
 if (endpoint === 'providers/list') return ok({ providers, defaultProviderId: settings.defaultProviderId });
 if (endpoint === 'keys/list') return ok({ keys: [{ id: 'main', label: 'Main', default: true, configured: true }] });
 if (endpoint === 'balance/get') return ok({ account: accountReplies.get(payload.query?.provider) ?? (payload.query?.provider === 'zai' ? { providerId: 'zai', status: 'ok', capabilities: ['plan_quota'], planName: 'Pro', windows: [{ kind: 'five_hour', remainingPercent: 42 }, { kind: 'weekly', remainingPercent: 68 }] } : { providerId: 'deepseek-official', status: 'ok', capabilities: ['balance'], balance: { total: 128.6, toppedUp: 100, granted: 28.6, currency: 'CNY' } }) });
 if (endpoint === 'accounts/update') { writes.push({ endpoint, body: payload.body }); settings = { ...settings, ...payload.body, display: { ...settings.display, ...payload.body.display } }; }
 if (endpoint.startsWith('accounts/')) return ok({ providers, settings, defaultProviderId: settings.defaultProviderId, accounts: {} });
 if (endpoint === 'limits/get') return ok({ limits: defaultLimits(), status: limitStatus });
 if (endpoint === 'alerts/get') return ok({ notifications: { channels: { sidebar: true, toast: false }, events: {}, cooldownMs: 300000 }, alerts: [] });
 if (endpoint === 'data/get') return ok({ info: { ledgerEntries: 32, ledgerCapacity: 5000, foldedCount: 3, dateRange: { earliest: '2026-11-01', latest: '2026-11-10' } } });
 if (endpoint === 'pricing/models') return ok({ providers });
 if (endpoint === 'pricing/get') return ok({ current: normalizePricing({}), official: normalizePricing({}) });
 if (endpoint.startsWith('upgrade/')) return ok({ currentVersion: '0.6.5', available: false, supported: true, state: 'idle' });
 if (endpoint === 'usage/workspaces') return ok({ tokens: 1500, workspaces: [{ workspace: '/example/project', tokens: 1500, sessions: [{ sessionId: 's1', title: 'Usage parity', tokens: 1500, inputTokens: 150, outputTokens: 300, cacheReadTokens: 1050 }] }] });
 throw new Error('Unexpected endpoint: ' + endpoint);
};
api.apply({ connection: { rpc: { call } }, effect() {}, locale: { bind: () => key => key }, slots: { inject() {} } });
const root = require('react-dom/client').createRoot(document.querySelector('#root'));
const act = React.act ?? require('react-dom/test-utils').act;
const tick = async fn => act(async () => { fn?.(); await new Promise(resolve => setTimeout(resolve, 0)); });
const change = (node, value) => require('react-dom/test-utils').Simulate.change(node, { target: { value } });
const metric = key => document.querySelector(`[data-usage-metric="${key}"] .usg_reportMetricValue`)?.textContent;
const query = () => document.querySelector('[data-usage-query]');
const tab = key => [...query().querySelectorAll('[role="tab"]')].find(n => n.textContent === key);
try {
 let menuDismissed = 0;
 await tick(() => root.render(React.createElement(React.Fragment, null,
  React.createElement(api.UsageStatsSection, { t: key => key, hostTabInfo: () => ({ tab: { id: 'test-tab', visible: true } }) }),
  React.createElement(api.UsageStatsTabMenuItems, { t: key => key, tab: { id: 'test-tab', kind: 'usage-stats' }, dismiss: () => menuDismissed++ })
 )));
 await tick(); await tick();
 assert.equal(query().querySelectorAll('[role="tab"]').length, 2, 'merge the report navigation into overview and details');
 const accountStrip = document.querySelector('[data-usage-account-strip]');
 assert.ok(accountStrip, 'account snapshots share a compact strip above the full-width charts');
 const detailToggle = accountStrip.querySelector('[data-usage-account-details-toggle]');
 assert.equal(detailToggle.getAttribute('aria-expanded'), 'false');
 assert.ok([...accountStrip.querySelectorAll('[data-usage-account-details]')].every(node => node.hidden), 'provider details start collapsed while live balances stay visible');
 const accountReadsBeforeExpand = reads.filter(r => r.endpoint === 'balance/get').length;
 await tick(() => detailToggle.click());
 assert.equal(detailToggle.getAttribute('aria-expanded'), 'true');
 assert.ok([...accountStrip.querySelectorAll('[data-usage-account-details]')].every(node => !node.hidden));
 assert.ok(accountStrip.textContent.includes('128.60') && accountStrip.textContent.includes('28.60'), 'retain balance totals and granted credit');
 assert.equal(reads.filter(r => r.endpoint === 'balance/get').length, accountReadsBeforeExpand, 'expanding account details must reuse snapshots without extra provider requests');
 await tick(() => detailToggle.click());
 assert.equal(document.querySelector('[data-usage-heat-strip]').open, true, 'annual usage is visible on first render');
 await tick(() => change(document.querySelector('select[aria-label="usage.timeRange"]'), '7d'));
 assert.equal(document.querySelector('[data-usage-hour-detail]').open, true, 'daily model details start expanded');
 assert.deepEqual(['tokens', 'requests', 'cache', 'cost'].map(metric), ['1.5K', '8', '87.5%', '¥0.75'], 'global totals must preserve the original aggregation');
 assert.equal(document.querySelector('[data-usage-chart-mode="tokens"]').getAttribute('aria-pressed'), 'true');
 assert.equal(document.querySelectorAll('[data-usage-chart-panel]').length, 3);
 await tick(() => document.querySelector('[data-usage-chart-mode="models"]').click());
 assert.ok(document.querySelector('[data-usage-model-trend]'));
 await tick(() => document.querySelector('[data-usage-chart-mode="tokens"]').click());
 assert.ok(document.querySelector('[data-usage-provider-summary]').textContent.includes('glm'));
 assert.ok(document.querySelector('[data-usage-workspace]'), 'workspace report stays available in global scope');
 assert.ok(document.querySelector('[data-usage-history-metrics]'));
 const beforeMenuRefresh = reads.length;
 await tick(() => document.querySelector('[data-usage-tab-refresh]').click()); await tick();
 const forcedAccounts = reads.slice(beforeMenuRefresh).filter(r => r.endpoint === 'balance/get' && r.payload.query?.refresh === '1');
 assert.deepEqual(forcedAccounts.map(r => r.payload.query.provider).sort(), ['deepseek-official', 'zai'], 'native tab refresh must refresh every visible account in global scope');
 const scope = () => document.querySelector('[data-usage-provider-picker]');
 await tick(() => change(scope(), 'zai')); await tick();
 assert.equal(metric('tokens'), '400'); assert.equal(metric('cost'), '—');
 assert.ok(document.body.textContent.includes('42%') && document.body.textContent.includes('68%'), 'preserve all quota windows');
 const beforeSinglePoll = reads.length;
 await tick(() => { for (const timer of [...timers.values()]) if (timer.ms === 60000) timer.fn(); });
 const singlePoll = reads.slice(beforeSinglePoll);
 assert.equal(singlePoll.filter(r => r.endpoint === 'balance/get' && r.payload.query?.provider === 'zai').length, 1, 'single-provider accounts must refresh while the report stays open');
 assert.equal(singlePoll.filter(r => r.endpoint === 'limits/get').length, 1, 'spend limits must refresh alongside usage');
 await tick(() => tab('panel.tabDetails').click()); await tick();
 assert.equal(metric('tokens'), '1.5K', 'details always read all providers');
 assert.ok([...document.querySelector('select[aria-label="usage.model"]').options].some(n => n.value === 'flash'));
 assert.ok(document.querySelector('[data-usage-day-detail] .usg_day_input'));
 const first = document.querySelector('[data-usage-day-detail="2026-11-09"]');
 await tick(() => first.click());
 assert.ok(document.querySelector('[data-usage-selected-day]').textContent.includes('500'), 'date selection retains its model detail');
 await tick(() => document.querySelector('[data-usage-stats-settings-link]').click()); await tick();
 const settingsPage = document.querySelector('[data-usage-billing-settings]');
 assert.ok(settingsPage && settingsPage.closest('[hidden]') === null, 'settings open inside the plugin');
 assert.equal(document.activeElement, document.querySelector('[data-usage-settings-back]'), 'settings receive keyboard focus');
 const balancesBeforeSettingsPoll = reads.filter(r => r.endpoint === 'balance/get').length;
 const usageBeforeSettingsPoll = reads.filter(r => r.endpoint === 'usage/get').length;
 await tick(() => { for (const timer of [...timers.values()]) if (timer.ms === 60000) timer.fn(); });
 assert.equal(reads.filter(r => r.endpoint === 'balance/get').length, balancesBeforeSettingsPoll, 'hidden query account cards must stop polling');
 assert.equal(reads.filter(r => r.endpoint === 'usage/get').length, usageBeforeSettingsPoll + 1, 'only the visible settings page polls usage');
 assert.equal(settingsPage.querySelectorAll('[data-usage-billing-tab]').length, 4, 'all four settings groups remain');
 const defaultProvider = settingsPage.querySelector('select[aria-label="accounts.defaultProvider"]');
 assert.ok(defaultProvider);
 await tick(() => change(defaultProvider, 'zai')); await tick();
 assert.equal(writes.at(-1)?.body.defaultProviderId, 'zai', 'existing settings update API remains in use');
 for (const group of ['limits', 'notifications', 'data']) {
  await tick(() => settingsPage.querySelector(`[data-usage-billing-tab="${group}"]`).click()); await tick();
  assert.ok(settingsPage.querySelector(`[data-usage-billing-panel="${group}"]`), group + ' settings remain reachable');
 }
 await tick(() => settingsPage.querySelector('[data-usage-billing-tab="limits"]').click()); await tick();
 await tick(() => change(settingsPage.querySelector('[data-usage-billing-provider]'), 'deepseek-official')); await tick();
 await tick(() => [...settingsPage.querySelectorAll('button')].find(n => n.textContent === 'pricing.fork').click());
 await tick(() => change(settingsPage.querySelector('.usg_priceInput'), '12.34'));
 await tick(() => document.querySelector('[data-usage-settings-back]').click()); await tick();
 assert.equal(tab('panel.tabDetails').getAttribute('aria-selected'), 'true', 'return preserves the active report');
 assert.ok(document.querySelector('[data-usage-selected-day]').textContent.includes('500'), 'return preserves the selected day');
 assert.equal(document.activeElement, document.querySelector('[data-usage-stats-settings-link]'), 'return restores focus to the settings trigger');
 const usageBeforeQueryPoll = reads.filter(r => r.endpoint === 'usage/get').length;
 await tick(() => { for (const timer of [...timers.values()]) if (timer.ms === 60000) timer.fn(); });
 assert.equal(reads.filter(r => r.endpoint === 'usage/get').length, usageBeforeQueryPoll + 1, 'hidden settings must stop polling');
 await tick(() => document.querySelector('[data-usage-tab-settings]').click()); await tick();
 assert.equal(menuDismissed, 2, 'the native tab menu closes before opening plugin settings');
 assert.equal(settingsPage.closest('[hidden]'), null, 'native tab settings open this plugin instance');
 assert.equal(settingsPage.querySelector('.usg_priceInput').value, '12.34', 'return and reopening preserve unsaved price drafts');
 await tick(() => root.render(null));
 let visible = true;
 const hostTabInfo = () => ({ tab: { id: 'visibility-test', visible } });
 const renderTab = () => root.render(React.createElement(api.UsageStatsSection, { t: key => key, hostTabInfo }));
 await tick(renderTab); await tick();
 await tick(() => change(document.querySelector('[data-usage-provider-picker]'), 'zai')); await tick();
 holdProviderUsage = true;
 const beforeCancellation = reads.length;
 await tick(() => { for (const timer of [...timers.values()]) if (timer.ms === 60000) timer.fn(); });
 visible = false;
 await tick(renderTab);
 holdProviderUsage = false;
 assert.equal(reads.slice(beforeCancellation).filter(r => r.endpoint === 'usage/get' && !r.payload.query?.provider).length, 0, 'aborting a provider request must not issue a global fallback');
 const beforeHidden = reads.length;
 await tick(() => { for (const timer of [...timers.values()]) if (timer.ms === 60000) timer.fn(); });
 assert.equal(reads.length, beforeHidden, 'retained hidden host tabs must pause usage, balance and limit polling');
 visible = true;
 await tick(renderTab); await tick();
 assert.ok(reads.slice(beforeHidden).some(r => r.endpoint === 'balance/get' && r.payload.query.provider === 'zai'), 'showing the host tab refreshes the selected account immediately');
 assert.equal(document.querySelector('[data-usage-provider-picker]').value, 'zai', 'visibility changes preserve report scope');
 await tick(() => root.render(null));

 // Exercise the adapter when native menus are available; the preceding report
 // and settings interactions cover the older-host native-select fallback.
 const hostPrimitives = {
  Menu: ({ anchor, open, items, selectedId, onSelect, onClose }) => React.createElement(React.Fragment, null, anchor,
   open && React.createElement('div', { role: 'menu', onKeyDown: event => { if (event.key === 'Escape') onClose(); } },
    items.map(item => React.createElement('button', { key: item.id, role: 'menuitem', disabled: item.disabled, 'aria-current': item.id === selectedId, onClick: () => { onSelect(item.id); onClose(); } }, item.label))))
 };
 const nativeApi = entry.factory(spec => spec === '@deepseek-ai/dsh-client-ui-primitives' ? hostPrimitives : require(spec));
 let selected = 'a', disabled = false;
 const renderSelect = () => root.render(React.createElement(nativeApi.UsageSelect, {
  value: selected, disabled, 'aria-label': 'Provider', onChange: event => { selected = event.target.value; renderSelect(); }
 }, ['a', 'b', 'c'].map(value => React.createElement('option', { key: value, value, disabled: value === 'c' }, value.toUpperCase()))));
 await tick(renderSelect);
 assert.equal(document.querySelector('[aria-haspopup="menu"]').getAttribute('aria-label'), 'Provider: A', 'the accessible name includes the current selection');
 await tick(() => require('react-dom/test-utils').Simulate.keyDown(document.querySelector('[aria-haspopup="menu"]'), { key: 'ArrowDown' }));
 assert.ok(document.querySelector('[role="menu"]'), 'ArrowDown opens the host menu');
 assert.equal([...document.querySelectorAll('[role="menuitem"]')].find(n => n.textContent === 'C').disabled, true);
 await tick(() => [...document.querySelectorAll('[role="menuitem"]')].find(n => n.textContent === 'B').click());
 assert.equal(selected, 'b');
 assert.equal(document.querySelector('[role="menu"]'), null, 'selection closes the menu');
 assert.equal(document.querySelector('[aria-haspopup="menu"]').getAttribute('aria-label'), 'Provider: B');
 await tick(() => document.querySelector('[aria-haspopup="menu"]').click());
 await tick(() => { disabled = true; renderSelect(); });
 assert.equal(document.querySelector('[role="menu"]'), null, 'disabling a selector closes its menu');
 await tick(() => { disabled = false; renderSelect(); });
 assert.equal(document.querySelector('[role="menu"]'), null, 're-enabling does not reopen the menu');
 console.log('merged report data and plugin settings navigation passed');
 await tick(() => root.render(null));
 const failures = [];
 const regression = async (name, run) => {
  try { await run(); console.log(name + ' passed'); }
  catch (error) { failures.push(error); console.error(name + ': ' + error.message); }
  finally { await tick(() => root.render(null)); accountReplies.clear(); limitStatus = {}; }
 };
 const translate = (key, params) => params ? `${key} ${JSON.stringify(params)}` : key;
 const renderReport = async scope => {
  await tick(() => root.render(React.createElement(api.UsageStatsSection, { t: translate })));
  await tick(); await tick();
  if (scope !== 'all') { await tick(() => change(document.querySelector('[data-usage-provider-picker]'), scope)); await tick(); }
 };
 const accountCard = (scope, provider) => scope === 'all' ? document.querySelector(`[data-usage-query-account="${provider}"]`) : document.querySelector('.usg_balance');
 const refresh = async () => { await tick(() => document.querySelector('[data-usage-refresh]').click()); await tick(); };
 const poll = async () => { await tick(() => { for (const timer of [...timers.values()]) if (timer.ms === 60000) timer.fn(); }); await tick(); };
 const spendText = scope => document.querySelector(scope === 'all' ? '.usg_accountSpend' : '.usg_usageLimitBanner')?.textContent ?? '';

 await regression('transient provider business failures retain snapshots and allow forced retry', async () => {
  for (const provider of ['deepseek-official', 'zai']) for (const scope of ['all', provider]) for (const status of ['unavailable', 'rate-limited', 'invalid-response', 'timeout']) {
   await renderReport(scope);
   const plan = provider === 'zai';
   assert.ok(accountCard(scope, provider).textContent.includes(plan ? '42%' : '128.60'));
   accountReplies.set(provider, { providerId: provider, status, capabilities: [plan ? 'plan_quota' : 'balance'], message: `upstream ${status}` });
   await refresh();
   const card = accountCard(scope, provider);
   assert.ok(plan ? card.textContent.includes('Pro') && card.textContent.includes('42%') && card.textContent.includes('68%') : card.textContent.includes('128.60') && card.textContent.includes('100.00') && card.textContent.includes('28.60'), `${scope}/${provider}/${status}: retain the complete successful snapshot`);
   assert.ok(card.querySelector('[role="alert"]')?.textContent.includes(`upstream ${status}`), `${scope}/${status}: explain the stale snapshot`);
   const retry = card.querySelector('.usg_retry');
   assert.ok(retry && !retry.disabled, `${scope}/${status}: offer a retry`);
   accountReplies.set(provider, plan ? { providerId: provider, status: 'ok', capabilities: ['plan_quota'], planName: 'Pro', windows: [{ kind: 'five_hour', remainingPercent: 37 }] } : { providerId: provider, status: 'ok', capabilities: ['balance'], balance: { total: 88.5, currency: 'CNY' } });
   const beforeRetry = reads.length;
   await tick(() => retry.click()); await tick();
   assert.ok(reads.slice(beforeRetry).some(r => r.endpoint === 'balance/get' && r.payload.query?.provider === provider && r.payload.query?.refresh === '1'), 'retry bypasses cached failure');
   assert.ok(accountCard(scope, provider).textContent.includes(plan ? '37%' : '88.50'));
   assert.equal(accountCard(scope, provider).querySelector('[role="alert"]'), null, 'successful retry clears the error');
   await tick(() => root.render(null)); accountReplies.clear();
  }
 });
 await regression('initial business failures expose retry without inventing a snapshot', async () => {
  for (const scope of ['all', 'zai']) {
   accountReplies.set('zai', { providerId: 'zai', status: 'unavailable', capabilities: ['plan_quota'] });
   await renderReport(scope);
   const card = accountCard(scope, 'zai');
   assert.ok(card.querySelector('[role="alert"]') && card.querySelector('.usg_retry'));
   assert.equal(card.querySelector('[data-usage-plan-windows]'), null);
   assert.ok(!card.textContent.includes('balance.refreshError'), 'there is no previous snapshot to claim');
   await tick(() => root.render(null)); accountReplies.clear();
  }
 });
 await regression('authentication and subscription changes clear obsolete account values', async () => {
  for (const provider of ['deepseek-official', 'zai']) for (const scope of ['all', provider]) for (const status of ['unauthorized', 'not-configured', 'not-subscribed']) {
   await renderReport(scope);
   accountReplies.set(provider, { providerId: provider, status, capabilities: [provider === 'zai' ? 'plan_quota' : 'balance'] });
   await refresh();
   const text = accountCard(scope, provider).textContent;
   assert.ok(!text.includes('128.60') && !text.includes('42%') && !text.includes('68%') && !text.includes('Pro'), `${scope}/${provider}/${status}: never retain invalidated values`);
   await tick(() => root.render(null)); accountReplies.clear();
  }
 });
 await regression('monthly and daily budgets follow the evaluated period in both report scopes', async () => {
  for (const scope of ['all', 'deepseek-official']) {
   limitStatus = { main: { enabled: true, period: 'monthly', todayCost: 3.1, dailyCostLimit: null, monthlyCost: 90, monthlyCostLimit: 100 } };
   await renderReport(scope);
   assert.ok(spendText(scope).includes('limits.monthlyProgress'), `${scope}: monthly budget must be visible`);
   assert.match(spendText(scope), /90\.00.*100\.00.*90/);
   limitStatus.main = { ...limitStatus.main, dailyCostLimit: 10 };
   await refresh();
   assert.ok(spendText(scope).includes('limits.monthlyProgress'), 'the server-selected monthly cap wins when both periods exist');
   limitStatus.main = { ...limitStatus.main, period: 'daily' };
   await refresh();
   assert.ok(spendText(scope).includes('limits.progress') && !spendText(scope).includes('limits.monthlyProgress'));
   assert.match(spendText(scope), /3\.10.*10\.00.*31/);
   await tick(() => root.render(null));
  }
 });
 await regression('budget amounts refresh on polling and visibility while hidden reports stay idle', async () => {
  for (const scope of ['all', 'deepseek-official']) {
   limitStatus = { main: { enabled: true, period: 'daily', todayCost: 3.1, dailyCostLimit: 10 } };
   await renderReport(scope);
   limitStatus.main = { ...limitStatus.main, todayCost: 9 };
   await poll();
   assert.match(spendText(scope), /9\.00.*10\.00.*90/);
   Object.defineProperty(document, 'hidden', { configurable: true, value: true });
   const beforeHidden = reads.length;
   limitStatus.main = { ...limitStatus.main, todayCost: 9.5 };
   await poll();
   assert.equal(reads.slice(beforeHidden).filter(r => ['usage/get', 'limits/get', 'balance/get'].includes(r.endpoint)).length, 0, 'hidden document must not poll');
   Object.defineProperty(document, 'hidden', { configurable: true, value: false });
   await tick(() => document.dispatchEvent(new Event('visibilitychange'))); await tick();
   assert.match(spendText(scope), /9\.50.*10\.00.*95/);
   await tick(() => document.querySelector('[data-usage-stats-settings-link]').click()); await tick();
   const beforeSettings = reads.filter(r => r.endpoint === 'limits/get').length;
   limitStatus.main = { ...limitStatus.main, todayCost: 9.6 };
   await poll();
   assert.equal(reads.filter(r => r.endpoint === 'limits/get').length, beforeSettings, 'hidden query does not poll limits while settings are open');
   await tick(() => document.querySelector('[data-usage-settings-back]').click()); await tick();
   assert.match(spendText(scope), /9\.60.*10\.00.*96/);
   await tick(() => root.render(null));
  }
 });
 assert.equal(failures.length, 0, failures.map(error => error.message).join('\n'));
} finally { await tick(() => root.unmount()); dom.window.close(); }
