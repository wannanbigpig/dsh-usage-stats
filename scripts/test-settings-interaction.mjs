import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { defaultLimits, defaultLimitRule } from '../lib/index.js';
import { normalizePricing } from '../lib/pricing.js';
const require = createRequire(import.meta.url);
const react = require('react');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
window.matchMedia = () => ({ matches: false });
let captured;
window.__ModuleLoader__ = { load: entry => { captured = entry; } };
new Function(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))();
const api = captured.factory(spec => spec === '@deepseek-ai/dsh-client-ui-primitives' ? new Proxy({}, { get: () => () => null }) : require(spec));
let responder;
api.apply({ connection: { rpc: { call: (...args) => responder(...args) } }, effect() {}, locale: { bind: () => key => key }, slots: { inject() {} } });
const root = require('react-dom/client').createRoot(document.getElementById('root'));
const step = async fn => react.act(async () => { fn(); await new Promise(resolve => setTimeout(resolve, 0)); });
const change = (input, value) => require('react-dom/test-utils').Simulate.change(input, { target: { value } });
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent === text);
const ok = value => ({ ok: true, value: { ok: true, ...value } });
const failures = [];
async function check(name, test) {
 try { await test(); console.log(name + ' ok'); }
 catch (error) { failures.push(name + ': ' + error.message); }
 finally { await step(() => root.render(null)); }
}
const limitProps = { keys: [], translate: key => key, providerId: 'deepseek-official', providerKind: 'balance' };
await check('monthly rule displays and saves its active period', async () => {
 let limits = { ...defaultLimits(), global: { ...defaultLimitRule(), enabled: true, period: 'monthly', monthlyCostLimit: 100 } };
 responder = async (_channel, endpoint, payload) => {
  if (endpoint === 'limits/update') limits = payload.body;
  return ok({ limits, status: {} });
 };
 await step(() => root.render(react.createElement(api.LimitsCard, limitProps)));
 const amount = document.querySelector('input[inputmode="decimal"]');
 assert.equal(amount.value, '100');
 await step(() => { amount.value = '150'; require('react-dom/test-utils').Simulate.blur(amount); });
 assert.equal(limits.global.monthlyCostLimit, 150);
 const period = document.querySelector('select[aria-label="limits.period"]');
 assert.ok(period);
 await step(() => change(period, 'daily'));
 assert.equal(limits.global.period, 'daily');
});
await check('invalid amounts report errors and failed saves restore stored values', async () => {
 const limits = { ...defaultLimits(), global: { ...defaultLimitRule(), enabled: true, dailyCostLimit: 20 } };
 let writes = 0;
 responder = async (_channel, endpoint) => {
  if (endpoint === 'limits/update') { writes++; return { ok: false, error: { code: 'internal', message: 'simulated failure' } }; }
  return ok({ limits, status: {} });
 };
 await step(() => root.render(react.createElement(api.LimitsCard, limitProps)));
 const amount = () => document.querySelector('input[inputmode="decimal"]');
 await step(() => { amount().value = 'abc'; require('react-dom/test-utils').Simulate.blur(amount()); });
 assert.equal(writes, 0);
 assert.ok(document.querySelector('.usg_error'));
 await step(() => { amount().value = '50'; require('react-dom/test-utils').Simulate.blur(amount()); });
 assert.equal(writes, 1);
 assert.equal(amount().value, '20');
});
await check('minimum balance is an editable independent safeguard', async () => {
 let limits = { ...defaultLimits(), global: { ...defaultLimitRule(), enabled: true, lowBalanceWarning: 10, minBalance: 2 } };
 responder = async (_channel, endpoint, payload) => {
  if (endpoint === 'limits/update') limits = payload.body;
  return ok({ limits, status: {} });
 };
 await step(() => root.render(react.createElement(api.LimitsCard, limitProps)));
 const amount = document.querySelector('input[aria-label="limits.minBalance"]');
 assert.ok(amount);
 assert.equal(amount.value, '2');
 await step(() => { amount.value = '5'; require('react-dom/test-utils').Simulate.blur(amount); });
 assert.equal(limits.global.minBalance, 5);
 assert.equal(limits.global.lowBalanceWarning, 10);
});
await check('notification saves immediately notify the sidebar', async () => {
 const notifications = { channels: { sidebar: true, toast: false }, events: {}, cooldownMs: 1800000 };
 let updated = 0;
 const onUpdated = () => { updated++; };
 window.addEventListener('usage-stats:notifications-updated', onUpdated);
 responder = async () => ok({ notifications, alerts: [] });
 await step(() => root.render(react.createElement(api.NotificationsCard, { translate: key => key })));
 await step(() => document.querySelector('input[type="checkbox"]').click());
 window.removeEventListener('usage-stats:notifications-updated', onUpdated);
 assert.equal(updated, 1);
 assert.equal(api.accountDisplayFields({ balance: true }).some(([key]) => key === 'statusDot'), false);
});
await check('plan quota editor follows supported monthly windows', async () => {
 responder = async () => ok({ notifications: { planQuota: { windows: { monthly: { warningRemainingPercent: 45, criticalRemainingPercent: 20 } } } }, limits: defaultLimits(), status: {} });
 await step(() => root.render(react.createElement(api.LimitsCard, { ...limitProps, providerId: 'opencode-go', providerKind: 'plan_quota', providers: [{ id: 'opencode-go', capabilities: ['plan_quota'], planQuota: { windows: ['monthly'] } }] })));
 assert.ok(document.querySelector('[data-usage-plan-quota-window="monthly"]'));
 assert.equal(document.querySelector('[data-usage-plan-quota-window="weekly"]'), null);
 assert.equal(document.querySelectorAll('[data-usage-plan-quota-window="monthly"] input')[1].value, '45');
});
await check('billing provider selection is local and tab navigation retains price drafts', async () => {
 const providers = [{ id: 'deepseek-official', label: 'DeepSeek', capabilities: ['balance'] }, { id: 'opencode-go', label: 'OpenCode', capabilities: ['plan_quota'], planQuota: { windows: ['monthly'] } }];
 const settings = { defaultProviderId: 'deepseek-official', display: {}, visibleProviderIds: [] };
 const pricing = normalizePricing({});
 let accountWrites = 0;
 responder = async (_channel, endpoint) => {
  if (endpoint === 'accounts/update') accountWrites++;
  return ok({ providers, defaultProviderId: 'deepseek-official', settings, accounts: {}, keys: [], today: '2026-09-06', days: [], limits: defaultLimits(), status: {}, notifications: {}, current: pricing, official: pricing });
 };
 await step(() => root.render(react.createElement(api.UsageBillingSettingsSection, { t: key => key })));
 const tabs = () => [...document.querySelectorAll('[data-usage-billing-tab]')];
 await step(() => { tabs()[0].focus(); tabs()[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
 assert.equal(document.activeElement.getAttribute('data-usage-billing-tab'), 'limits');
 assert.equal(tabs()[1].getAttribute('aria-selected'), 'true');
 const picker = document.querySelector('select[aria-label="settings.editProvider"]');
 assert.ok(picker);
 await step(() => change(picker, 'opencode-go'));
 assert.equal(accountWrites, 0);
 await step(() => change(picker, 'deepseek-official'));
 await step(() => button('pricing.fork').click());
 await step(() => change(document.querySelector('.usg_priceInput'), '12.34'));
 await step(() => tabs()[2].click());
 await step(() => tabs()[1].click());
 assert.equal(document.querySelector('.usg_priceInput').value, '12.34');
});
await step(() => root.unmount());
dom.window.close();
if (failures.length) throw new Error(failures.join('\n'));
console.log('settings interaction regressions passed');
