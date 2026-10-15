import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url), React = require('react');
let entry;
globalThis.window = { __ModuleLoader__: { load: value => { entry = value; } } };
new Function(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))();
const primitives = new Proxy({
 Modal: ({ title, children, onClose }) => React.createElement('div', { role: 'dialog', 'aria-label': title }, children, React.createElement('button', { onClick: onClose }, 'close')),
 Tag: ({ children }) => React.createElement('span', {}, children), StateDot: () => null
}, { get: (target, key) => target[key] ?? (() => null) });
const api = entry.factory(spec => spec === '@deepseek-ai/dsh-client-ui-primitives' ? primitives : require(spec));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
window.matchMedia = () => ({ matches: true });
const { Simulate } = require('react-dom/test-utils'), act = React.act ?? require('react-dom/test-utils').act;
const root = require('react-dom/client').createRoot(document.querySelector('#root'));
const tick = async fn => act(async () => { fn?.(); await new Promise(resolve => setTimeout(resolve, 0)); });
const t = key => key;
let upgradeState = { currentVersion: '0.5.4', supported: true, sourceType: 'registry', available: false, state: 'idle' };
let upgradeReads = 0;
let installCalls = 0, managerOpened = 0, failRead = false, failCheck = false, updateAvailable = false, keepRunning = false, loseStartReply = false;
const models = [
 { model: 'deepseek-official/deepseek-v4-flash', inputTokens: 60, outputTokens: 120, cacheReadTokens: 420, tokens: 600, requestCount: 3, cost: .5 },
 { model: 'zai/glm-5.3', inputTokens: 40, outputTokens: 80, cacheReadTokens: 280, tokens: 400, requestCount: 2, cost: null }
];
const days = [
 { date: '2026-10-14', inputTokens: 100, outputTokens: 200, cacheReadTokens: 700, tokens: 1000, requestCount: 5, cost: null, models },
 { date: '2026-10-13', inputTokens: 50, outputTokens: 100, cacheReadTokens: 350, tokens: 500, requestCount: 3, cost: .25, models: [{ ...models[0], inputTokens: 50, outputTokens: 100, cacheReadTokens: 350, tokens: 500, requestCount: 3, cost: .25 }] }
];
const call = async (_channel, endpoint, payload) => {
 let value;
 if (endpoint.startsWith('upgrade/')) {
  upgradeReads++;
  if (endpoint === 'upgrade/get' && failRead) { failRead = false; throw new Error('temporary disconnect'); }
  if (endpoint === 'upgrade/check') {
   if (failCheck) throw new Error('registry unavailable');
   upgradeState = { ...upgradeState, latestVersion: updateAvailable ? '0.5.5' : '0.5.4', available: updateAvailable && upgradeState.supported && upgradeState.state === 'idle', checkedAt: Date.now() };
  }
  if (endpoint === 'upgrade/start') { installCalls++; assert.equal(payload.body.confirm, true); assert.equal(payload.body.version, '0.5.5'); upgradeState = { ...upgradeState, available: false, requestId: 'test-install', state: keepRunning ? 'running' : 'restart-required' }; }
  value = upgradeState;
 } else if (endpoint === 'usage/get') value = { today: '2026-10-14', days, pricing: { currency: 'CNY', peakHours: [] } };
 else if (endpoint === 'providers/list') value = { defaultProviderId: 'deepseek-official', providers: [{ id: 'deepseek-official', label: 'DeepSeek', capabilities: ['balance'] }, { id: 'zai', label: 'Z.ai', capabilities: ['plan_quota'] }] };
 else if (endpoint === 'keys/list') value = { keys: [] };
 else if (endpoint === 'limits/get') value = { status: {} };
 else if (endpoint === 'balance/get') value = { account: { status: 'ok', capabilities: ['balance'], balance: { total: 128.6, currency: 'CNY' } } };
 else if (endpoint === 'usage/workspaces') value = { workspaces: [], tokens: 0 };
 else throw new Error(`unexpected endpoint ${endpoint}`);
 return { ok: true, value: { ok: true, ...value } };
};
let holdReply = null, releaseReply = null;
const delayedCall = async (...args) => {
 const result = await call(...args);
 if (args[1] === 'upgrade/start' && loseStartReply) { loseStartReply = false; throw new Error('reply lost after installation started'); }
 if (args[1] !== holdReply) return result;
 holdReply = null;
 return new Promise(resolve => { releaseReply = () => resolve(result); });
};
const hostEvents = new Map(), connectionEvents = new Map();
api.apply({ on: (name, listener) => { connectionEvents.set(name, listener); return () => connectionEvents.delete(name); }, inject: (deps, callback) => { if (deps.join(',') === 'remote') callback({ effect: fn => fn(), remote: { $on: (name, listener) => { hostEvents.set(name, listener); return () => hostEvents.delete(name); } } }); }, connection: { rpc: { call: delayedCall } }, get: key => key === 'pluginNavigation' ? { openBundle: name => { assert.equal(name, '@wannanbigpig/dsh-usage-stats'); managerOpened++; } } : null, effect() {}, locale: { bind: () => t }, slots: { inject() {} } });
function UpgradeDialogHarness(props) {
 const upgrade = api.useUpgradeController('get');
 return React.createElement(api.UpgradeDialog, { ...props, upgrade });
}
const metric = key => document.querySelector(`[data-usage-metric="${key}"] .usg_reportMetricValue`)?.textContent;
await tick(() => root.render(React.createElement(api.UsageStatsSection, { t })));
await tick(); await tick();
assert.equal(Boolean(document.querySelector('[data-usage-upgrade]')), false, 'no update means no upgrade button');
updateAvailable = true;
await tick(() => document.querySelector('[data-usage-refresh]').click());
assert.ok(document.querySelector('[data-usage-upgrade]'), 'show the button only after a newer version is detected');
failCheck = true;
await tick(() => document.querySelector('[data-usage-refresh]').click());
assert.equal(Boolean(document.querySelector('[data-usage-upgrade]')), false, 'a failed check must not leave a stale upgrade button');
failCheck = false;
upgradeState = { ...upgradeState, supported: false, sourceType: 'git' };
await tick(() => document.querySelector('[data-usage-refresh]').click());
assert.equal(Boolean(document.querySelector('[data-usage-upgrade]')), false, 'source-managed installations have no automatic upgrade button');
upgradeState = { ...upgradeState, supported: true, sourceType: 'registry' };
await tick(() => document.querySelector('[data-usage-refresh]').click());
await tick(() => [...document.querySelectorAll('[role="tab"]')].find(node => node.textContent === 'panel.tabSummary').click());
await tick();
await tick(() => Simulate.change(document.querySelector('select[aria-label="usage.timeRange"]'), { target: { value: '7d' } }));
assert.equal(metric('tokens'), '1.5K');
assert.equal(metric('requests'), '8');
assert.equal(metric('cache'), '87.5%');
assert.equal(metric('cost'), '¥0.75');
assert.ok(document.querySelector('[data-usage-metric="cost"]').textContent.includes('usage.knownCostScope'));
assert.ok(document.querySelector('[data-usage-model-trend]'));
await tick(() => document.querySelector('[data-usage-chart-mode="bars"]').click());
assert.equal(document.querySelector('[data-usage-model-trend]'), null, 'the main graph mode must not render duplicate trend plots');
assert.ok(document.querySelector('.usg_dayBar .usg_hourOutput'));
assert.ok(document.querySelector('[data-usage-bar-legend]').textContent.includes('usage.output'));
await tick(() => [...document.querySelectorAll('[role="tab"]')].find(node => node.textContent === 'panel.tabOverview').click());
await tick();
await tick(() => Simulate.change(document.querySelector('select[aria-label="usage.timeRange"]'), { target: { value: '7d' } }));
await tick(() => document.querySelector('[data-usage-chart-mode="cost"]').click());
assert.ok(document.querySelector('.usg_dayBar'));
assert.equal(Boolean(document.querySelector('.usg_dayBar .usg_hourOutput')), false, 'cost bars must not imply a cost split from token proportions');
assert.equal(document.querySelector('[data-usage-bar-legend]').textContent, 'usage.cost');
await tick(() => Simulate.change(document.querySelector('[data-usage-provider-picker]'), { target: { value: 'zai' } }));
await tick();
assert.equal(metric('tokens'), '400');
assert.equal(metric('cost'), '—', 'an unpriced provider must not display a fabricated zero cost');
await tick(() => [...document.querySelectorAll('[role="tab"]')].find(node => node.textContent === 'panel.tabDetails').click());
await tick();
assert.equal(metric('tokens'), '1.5K', 'details must retain global scope');
assert.ok(document.querySelector('[data-usage-day-detail] .usg_day_input'));
assert.ok(document.querySelector('[data-usage-day-detail] .usg_day_requestCount'));
assert.ok(document.querySelector('[data-usage-daily-trend]'));
await tick(() => document.querySelector('[data-usage-upgrade]').click());
await tick(() => document.querySelector('[data-usage-upgrade-start]').click());
assert.equal(Boolean(document.querySelector('[data-usage-upgrade]')), false, 'hide the upgrade button as soon as installation starts');
assert.ok(document.querySelector('[data-usage-upgrade-hint="restart-required"]'));
await tick(() => root.render(null));

for (const action of ['upgrade/start', 'upgrade/check']) {
 upgradeState = { currentVersion: '0.5.4', supported: true, sourceType: 'registry', available: false, state: 'idle' };
 await tick(() => root.render(React.createElement(api.UsageStatsSection, { t })));
 await tick(); await tick();
 holdReply = action;
 if (action === 'upgrade/check') await tick(() => document.querySelector('[data-usage-refresh]').click());
 await tick(() => document.querySelector('[data-usage-upgrade]').click());
 await tick(() => document.querySelector('[data-usage-upgrade-start]').click());
 if (action === 'upgrade/start') await tick(() => [...document.querySelectorAll('[data-usage-upgrade-dialog] button')].find(node => node.textContent === 'action.close').click());
 await tick(() => releaseReply());
 assert.equal(Boolean(document.querySelector('[data-usage-upgrade]')), false, `${action}: closing the dialog or a stale read cannot restore the upgrade button`);
 assert.ok(document.querySelector('[data-usage-upgrade-hint="restart-required"]'), `${action}: installation status belongs to the page`);
 await tick(() => root.render(null));
}

const originalInterval = window.setInterval.bind(window);
let pollUpgrade;
window.setInterval = (callback, ms) => { if (ms === 2000 || ms === 10000) pollUpgrade = callback; return originalInterval(callback, ms); };
Object.defineProperty(document, 'hidden', { configurable: true, value: false });
keepRunning = true;
upgradeState = { currentVersion: '0.5.4', supported: true, sourceType: 'registry', available: false, state: 'idle' };
await tick(() => root.render(React.createElement(api.UsageStatsSection, { t })));
await tick(); await tick();
await tick(() => document.querySelector('[data-usage-upgrade]').click());
await tick(() => document.querySelector('[data-usage-upgrade-start]').click());
await tick(() => [...document.querySelectorAll('[data-usage-upgrade-dialog] button')].find(node => node.textContent === 'action.close').click());
const startsBeforePoll = installCalls;
assert.ok(document.querySelector('[data-usage-upgrade-hint="running"]'));
upgradeState = { ...upgradeState, state: 'restart-required' };
await tick(() => pollUpgrade());
assert.ok(document.querySelector('[data-usage-upgrade-hint="restart-required"]'), 'closing the dialog cannot stop page-owned status polling');
assert.equal(installCalls, startsBeforePoll, 'polling is read-only');
await tick(() => root.render(null));
window.setInterval = originalInterval;
keepRunning = false;

upgradeState = { currentVersion: '0.5.4', supported: true, sourceType: 'registry', available: false, state: 'idle' };
await tick(() => root.render(React.createElement(api.UsageStatsSection, { t })));
await tick(); await tick();
await tick(() => document.querySelector('[data-usage-upgrade]').click());
loseStartReply = true;
await tick(() => document.querySelector('[data-usage-upgrade-start]').click());
assert.ok(document.querySelector('[data-usage-upgrade-hint="restart-required"]'), 'a lost mutation reply must reconcile with the server without another install');
assert.equal(Boolean(document.querySelector('[data-usage-upgrade]')), false);
assert.equal(Boolean(document.querySelector('[role="alert"]')), false, 'a confirmed installation result clears the recovered transport error');
await tick(() => root.render(null));

installCalls = 0;
upgradeState = { ...upgradeState, state: 'idle', available: false };
failRead = true;
await tick(() => root.render(React.createElement(UpgradeDialogHarness, { translate: t, onClose() {} })));
assert.ok(document.querySelector('[role="alert"]'));
assert.equal(document.querySelector('[data-usage-upgrade-check]').disabled, false, 'initial connection failures must be retryable');
await tick(() => document.querySelector('[data-usage-upgrade-check]').click());
await tick(() => document.querySelector('[data-usage-upgrade-check]').click());
assert.equal(installCalls, 0, 'checking a version cannot start an installation');
await tick(() => { document.querySelector('[data-usage-upgrade-start]').click(); document.querySelector('[data-usage-upgrade-start]').click(); });
assert.equal(installCalls, 1);
assert.ok(document.querySelector('[data-usage-upgrade-state="restart-required"]'));
await tick(() => [...document.querySelectorAll('button')].find(node => node.textContent === 'upgrade.openManager').click());
assert.equal(managerOpened, 1);
await tick(() => root.render(null));
upgradeState = { ...upgradeState, state: 'idle', supported: false, sourceType: 'git', available: false };
await tick(() => root.render(React.createElement(UpgradeDialogHarness, { translate: t, onClose() {} })));
assert.ok(document.body.textContent.includes('upgrade.gitSource'));
assert.equal(document.querySelector('[data-usage-upgrade-check]').disabled, true);
await tick(() => root.render(null));
upgradeState = { currentVersion: '0.5.4', supported: true, sourceType: 'registry', latestVersion: '0.5.5', available: true, state: 'idle', canInstall: false, installReason: 'hmr-managed' };
await tick(() => root.render(React.createElement(UpgradeDialogHarness, { translate: t, onClose() {} })));
assert.ok(document.querySelector('[data-usage-upgrade-manual]'));
assert.equal(Boolean(document.querySelector('[data-usage-upgrade-start]')), false, 'HMR self-upgrade must route to safe Host instructions');
await tick(() => root.render(null));
upgradeState = { ...upgradeState, canInstall: true, installReason: null, available: false, state: 'failed', errorCode: 'operation-error', failureKind: 'build-blocked', pendingBuilds: ['native-addon'] };
await tick(() => root.render(React.createElement(UpgradeDialogHarness, { translate: t, onClose() {} })));
assert.ok(document.querySelector('[data-usage-upgrade-error]').textContent.includes('upgrade.error.build-blocked'));
assert.ok(document.querySelector('[data-usage-upgrade-builds]').textContent.includes('native-addon'));
await tick(() => root.render(null));
upgradeState = { ...upgradeState, errorCode: 'incompatible-version', failureKind: 'unknown', pendingBuilds: [] };
await tick(() => root.render(React.createElement(UpgradeDialogHarness, { translate: t, onClose() {} })));
assert.ok(document.querySelector('[data-usage-upgrade-error]').textContent.includes('upgrade.error.incompatible-version'), 'a specific management refusal takes priority over an unknown package failure');
await tick(() => root.render(null));
keepRunning = true;
upgradeState = { currentVersion: '0.5.4', supported: true, sourceType: 'registry', available: false, state: 'idle' };
await tick(() => root.render(React.createElement(api.UsageStatsSection, { t })));
await tick(); await tick();
await tick(() => document.querySelector('[data-usage-upgrade]').click());
await tick(() => document.querySelector('[data-usage-upgrade-start]').click());
const beforeUnrelated = upgradeReads;
await tick(() => hostEvents.get('plugin-manager/install-state')({ requestId: 'other-install' }));
assert.equal(upgradeReads, beforeUnrelated, 'unrelated installs must not trigger polling');
upgradeState = { ...upgradeState, phase: 'applying' };
await tick(() => hostEvents.get('plugin-manager/install-state')({ requestId: 'test-install' }));
assert.equal(upgradeReads, beforeUnrelated + 1);
assert.ok(document.querySelector('[data-usage-upgrade-state]').textContent.includes('upgrade.phase.applying'));
upgradeState = { ...upgradeState, state: 'restart-required', restartReason: 'no-hmr' };
await tick(() => connectionEvents.get('connection/reset')());
assert.ok(document.querySelector('[data-usage-upgrade-restart-reason]').textContent.includes('upgrade.restart.no-hmr'));
const installsBeforeReset = installCalls;
await tick(() => connectionEvents.get('connection/reset')());
assert.equal(installCalls, installsBeforeReset, 'reconnect recovery only reads status');
await tick(() => root.render(null));
const readsAfterUnmount = upgradeReads;
await tick(() => connectionEvents.get('connection/reset')());
assert.equal(upgradeReads, readsAfterUnmount, 'unmounted reports release their event listeners');
await tick(() => root.unmount());
dom.window.close();
console.log('query metric scopes, unpriced costs, chart modes, daily fields and upgrade interactions ok');
