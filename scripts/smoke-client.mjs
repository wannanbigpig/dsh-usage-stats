// Smoke-test the hand-written client bundle outside the browser:
// 1. feed it to a fake __ModuleLoader__ (captures the factory)
// 2. run the factory with a fake require (real react, stubbed primitives)
// 3. render the sidebar action + panel shell with react-dom/server
// 4. run apply(ctx) against a stub client context and verify the native sidebar slot
// 5. exercise usage and contribution-heatmap helpers
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const react = require("react");
const jsxRuntime = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");

// Fake primitives: every named export is a no-op component.
const Stub = () => null;
const primitives = new Proxy({}, { get: () => Stub });

let captured = null;
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry; } } };
globalThis.document = { querySelector: () => null, createElement: () => ({ dataset: {}, appendChild: () => {} }), head: { appendChild: () => {} } };

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "client.js"), "utf8");
// Endpoint contract: the client must only talk to the loopback endpoints the
// server half registers, and must never embed credentials.
if (!source.includes('fetchJson("/api/usage-stats/usage")')) throw new Error("client must fetch the usage endpoint");
if (!source.includes('fetchJson("/api/usage-stats/keys")')) throw new Error("client must fetch the keys endpoint");
if (!source.includes('fetchJson(`/api/usage-stats/balance${query}`)')) throw new Error("client must fetch the balance endpoint");
if (!source.includes('fetchJson("/api/usage-stats/limits")')) throw new Error("client must fetch the limits endpoint");
if (!source.includes('name: "settings.section"')) throw new Error("client must register the settings.section slot");
if (!source.includes('width:760px')) throw new Error("query panel must use the 760px responsive layout");
if (!source.includes("panel.tabOverview") || !source.includes("panel.tabDetails")) throw new Error("query panel must split into overview/details tabs");
if (!source.includes('"data-usage-stats-settings-link"')) throw new Error("query panel must expose the go-to-settings affordance");
if (/api[_-]?key\s*[:=]\s*["']sk-/i.test(source)) throw new Error("client must not embed credentials");
new Function(source)(); // executes the window.__ModuleLoader__.load call

if (captured === null) throw new Error("loader did not capture the bundle");
if (captured.id !== "dsh-usage-stats") throw new Error(`unexpected id ${captured.id}`);

const exports_ = captured.factory((spec) => {
	if (spec === "react") return react;
	if (spec === "react/jsx-runtime") return jsxRuntime;
	if (spec === "react-dom") return { createPortal: (node) => node };
	if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
	throw new Error(`unexpected require: ${spec}`);
});

if (typeof exports_.apply !== "function") throw new Error("missing apply export");
if (typeof exports_.LimitsCard !== "function") throw new Error("missing LimitsCard export");
if (typeof exports_.UsageStatsPanel !== "function") throw new Error("missing UsageStatsPanel export");
if (typeof exports_.UsageBillingSettingsSection !== "function") throw new Error("missing UsageBillingSettingsSection export");
if (typeof exports_.openHarnessSettings !== "function") throw new Error("missing openHarnessSettings export");
if (!source.includes('new Set(["用量与计费", "Usage & Billing"])')) throw new Error("settings shortcut must select Usage & Billing");
if (typeof exports_.ContributionHeatmap !== "function") throw new Error("missing ContributionHeatmap export");
if (typeof exports_.buildYearContributionHeatmap !== "function") throw new Error("missing buildYearContributionHeatmap export");

// Regression: never locate Settings with a broad substring selector. In the
// plugin settings page, the Shell card has aria-label="展开设置: 终端" and was
// therefore mistaken for the external Settings trigger.
if (source.includes('button[aria-label*="设置"') || source.includes('button[title*="设置"')) {
	throw new Error("client must not use broad Settings substring selectors");
}
if (!source.includes('"data-loading": accountLoading')) throw new Error("balance refresh button must expose its loading state");
if (!source.includes("@keyframes usg_spin")) throw new Error("balance refresh button must define a spin animation");
if (!source.includes('"aria-label": translate("usage.year")')) throw new Error("heatmap must expose a year selector");
if (!source.includes("width:10px;height:10px")) throw new Error("heatmap must use compact square day cells");
if (!source.includes(".usg_hourTooltip{")) throw new Error("hourly chart must define an interactive tooltip");
if (!source.includes("onMouseEnter: () => setHoveredHour(hour.hour)")) throw new Error("hourly bars must react to pointer hover");
if (!source.includes('"data-hour": hour.hour')) throw new Error("hourly bars must expose their hour for interaction tests");
if (source.includes(".usg_hourSlot.usg_peak{background:")) throw new Error("peak hours must not look like token bars");
if (!source.includes(".usg_peakRegion{")) throw new Error("peak hours must be rendered as a background region");
if (!source.includes('"data-peak-region"')) throw new Error("peak regions must be identifiable in the DOM");
if (source.includes("min-height:3px")) throw new Error("zero-token hours must not fake a bar with min-height");
if (!source.includes('onClick: () => setHoveredHour(hoveredHour === hour.hour ? null : hour.hour)')) throw new Error("hourly bars must support tap-to-toggle on touch");
if (!source.includes("const visualInput = input + cacheRead + cacheWrite")) throw new Error("cached prompt tokens must remain visible in the input bar");
if (source.includes("className: S.hourCache")) throw new Error("cache tokens must not use an invisible standalone segment");
if (!source.includes("function sidebarSummaryOf")) throw new Error("sidebar entry must derive balance and today usage summary");
if (!source.includes("className: S.sidebarSummary")) throw new Error("wide sidebar entry must render its summary");
if (!source.includes("SIDEBAR_POLL_MS_OPEN = 60000") || !source.includes("SIDEBAR_POLL_MS_CLOSED = 300000")) throw new Error("sidebar summary must poll at 60s open / 300s closed");
if (!source.includes("window.setInterval(loadSummary, pollMs)")) throw new Error("sidebar summary must refresh in the background on an open/closed-aware interval");
if (!source.includes('usage-stats:limits-updated')) throw new Error("sidebar summary must refresh after limits changes");
if (!source.includes("const [stopOnExceed, setStopOnExceed] = react.useState(false)")) throw new Error("hard stop must default to off in the settings UI");
if (source.includes("window.confirm(translate(\"limits.stopConfirm\"))")) throw new Error("hard stop must not open a confirmation dialog");
if (!source.includes('status === "blocked" || status === "exceeded"')) throw new Error("client must map blocked and exceeded through one shared tone helper");
if (!source.includes('"stale", "unavailable"')) throw new Error("client must render stale and unavailable limit states");
// Settings controls must remain usable inside the host application's global
// form styles. Amount fields save immediately from the current input value. The
// switch owns its full hit area and paints a visible track without
// relying on a potentially transparent host theme token.
if (!source.includes("handleSave({ lowBalanceWarning:")) throw new Error("low-balance input must autosave its current value");
if (!source.includes(".usg_switch input{position:absolute;inset:0;width:100%;height:100%")) throw new Error("switch input must own the full control hit area");
if (!source.includes("background-color:rgba(128,128,128,.28)")) throw new Error("switch track must have a visible theme-independent off state");
if (!source.includes(".usg_section{--usg-blue:#1f6feb;")) throw new Error("settings section must define the switch selected-state color");
if (source.includes("saveMsg") || source.includes("usg_saveSuccess") || source.includes('"limits.saved"')) throw new Error("settings must not render a saved-success message");
if (!source.includes("className: S.toggleGrid")) throw new Error("limit toggles must use the compact responsive grid");
if (!source.includes("className: S.alertRange")) throw new Error("alert percentage must use the segmented range control");
if (!source.includes('"--alert-percent": `${alertPercent}%`') || !source.includes('"--critical-percent": `${criticalPercent}%`')) throw new Error("dual range must track both configured percentages");
if (!source.includes("className: `${S.alertRange} is-overlay`")) throw new Error("alert control must render a second draggable handle");
if (!source.includes('alertTrack: "usg_alertTrack"')) throw new Error("dual range track must be bound to its positioned wrapper");
if (!source.includes("--usg-success:#22a06b;--usg-warning:#d99b00;--usg-danger:#e5484d;")) throw new Error("semantic range colors must not depend on optional host theme tokens");
if (!source.includes(".usg_alertCard input.usg_alertRange{appearance:none!important;")) throw new Error("range control must override host input styles");
if (!source.includes(".usg_alertCard input.usg_alertRange::-webkit-slider-runnable-track")) throw new Error("range control must paint an explicit WebKit track");
if (!source.includes(".usg_saveBtn{cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;")) throw new Error("save button must use the settings-page primary button palette");
if (!source.includes(".usg_switch input:checked + .usg_switchSlider{background-color:var(--usg-action);border-color:var(--usg-action)}")) throw new Error("enabled switches must use the monochrome action palette");
if (!source.includes(".usg_input{box-sizing:border-box;width:100%;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;")) throw new Error("amount inputs must use the native settings field palette");
if (!source.includes(".usg_input::placeholder{color:var(--dsw-alias-label-tertiary);opacity:1}")) throw new Error("amount inputs must use the native placeholder palette");
if (!source.includes("const [limitStatusMap, setLimitStatusMap] = react.useState({})")) throw new Error("query panel must load quota indicator statuses");
if (!source.includes("balanceTone: limitToneOf(activeLimitStatus?.balanceAlertStatus)")) throw new Error("balance card must receive the configured balance indicator tone");
if (!source.includes('"data-usage-cost-indicator": true')) throw new Error("today spend card must render a configured status indicator");
if (!source.includes('summary.balanceStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot')) throw new Error("sidebar must show balance status dots");
if (source.includes('!wide && summary.todayStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot')) throw new Error("collapsed sidebar must hide today status dot");
if (source.includes('!wide && summary.balanceStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot')) throw new Error("collapsed sidebar must hide balance status dot");
if (!source.includes('style: { left: `${panelLeft}px` }')) throw new Error("usage panel must anchor to the sidebar edge");
if (!source.includes('"limits.lowBalance": "余额提醒"')) throw new Error("balance alert field must use the concise label");
if (!source.includes("const limitsRef = react.useRef(null)")) throw new Error("limits form must retain the latest saved configuration without resyncing edits");
const limitsSaveBlock = source.slice(source.indexOf("const handleSave = async"), source.indexOf("const currentStatus ="));
if (limitsSaveBlock.includes("setLimits(")) throw new Error("save responses must not overwrite the active form fields");
if (!limitsSaveBlock.includes("limitsRef.current = payload.limits")) throw new Error("save responses must update the latest limits cache");

// Render the section in its default (loading) state.
const { UsageStatsSection, UsageStatsPanel, LimitsCard, UsageBillingSettingsSection } = exports_;
const markup = renderToStaticMarkup(react.createElement(UsageStatsSection, { t: (key) => key }));
if (markup.length < 200) throw new Error(`section markup too small: ${markup.length}`);
if (!markup.includes("panel.title") && !markup.includes("用量统计")) throw new Error("section title missing");
if (!markup.includes("panel.tabOverview") || !markup.includes("panel.tabDetails")) throw new Error("overview/details tabs missing in markup");
if (markup.includes("limits.title")) throw new Error("quota configuration must be gone from the query panel");
console.log("render ok, markup length:", markup.length);

// The settings section hosts the migrated LimitsCard (loading state in SSR).
const settingsMarkup = renderToStaticMarkup(react.createElement(UsageBillingSettingsSection, { t: (key) => key }));
if (!settingsMarkup.includes("settings.title") || !settingsMarkup.includes("settings.desc")) throw new Error("settings section header/description missing");
if (settingsMarkup.length < 120) throw new Error(`settings section markup too small: ${settingsMarkup.length}`);
console.log("settings section render ok, length:", settingsMarkup.length);

const panelMarkup = renderToStaticMarkup(react.createElement(UsageStatsPanel, { wide: true, t: (key) => key }));
if (!panelMarkup.includes("data-usage-stats-trigger")) throw new Error("sidebar trigger missing");
if (!panelMarkup.includes("panel.badge")) throw new Error("sidebar trigger label missing");
console.log("sidebar panel shell render ok, length:", panelMarkup.length);

const limitsMarkup = renderToStaticMarkup(react.createElement(LimitsCard, {
	keys: [{ id: "DEEPSEEK_API_KEY", label: "DEEPSEEK_API_KEY", configured: true }],
	selectedKey: "DEEPSEEK_API_KEY",
	pricing: { currency: "CNY" },
	todayCost: 1.5,
	translate: (key) => key
}));
if (!limitsMarkup.includes("limits.title")) throw new Error("limits markup missing title");
if (!limitsMarkup.includes("disabled")) throw new Error("limits form must render controls disabled until the limits payload loads");
if (limitsMarkup.includes("limits.apiKey")) throw new Error("single-key limits card must not render the key picker");
console.log("limits card render ok, length:", limitsMarkup.length);

const multiKeyLimitsMarkup = renderToStaticMarkup(react.createElement(LimitsCard, {
	keys: [
		{ id: "DEEPSEEK_API_KEY", label: "DEEPSEEK_API_KEY", configured: true },
		{ id: "DEEPSEEK_API_KEY_2", label: "DEEPSEEK_API_KEY_2", configured: false }
	],
	selectedKey: "DEEPSEEK_API_KEY",
	pricing: { currency: "CNY" },
	todayCost: 1.5,
	translate: (key) => key
}));
if (!multiKeyLimitsMarkup.includes("limits.apiKey")) throw new Error("multi-key limits card must render the key picker");
console.log("multi-key limits card picker ok, length:", multiKeyLimitsMarkup.length);

// Apply against a stub client context: one native sidebar footer action and
// one settings.section entry.
const registrations = [];
const registeredOptions = [];
const ctx = {
	effect: () => {},
	locale: {
		register: (ns, dict) => {
			if (ns !== "usageStats") throw new Error(`unexpected ns ${ns}`);
			if (!dict.zh || !dict.en) throw new Error("missing dictionaries");
		},
		bind: () => (key) => key
	},
	slots: {
		inject: (slot, fn) => { registrations.push([slot, fn]); return () => {}; },
		register: (options, component) => { registeredOptions.push({ options, component }); return () => {}; }
	}
};
exports_.apply(ctx);
if (registrations.length !== 2) throw new Error(`expected two slot injections, got ${registrations.length}`);
const slotNames = registrations.map(([slot]) => slot).sort();
if (slotNames[0] !== "settings.section" || slotNames[1] !== "sidebar.footer.action") throw new Error(`unexpected slots ${JSON.stringify(slotNames)}`);
const footerEntry = registrations.find(([slot]) => slot === "sidebar.footer.action");
const footerDisposer = footerEntry[1]();
if (typeof footerDisposer !== "function") throw new Error("footer slot registration must return a disposer");
const sectionEntry = registrations.find(([slot]) => slot === "settings.section");
const sectionDisposer = sectionEntry[1]();
if (typeof sectionDisposer !== "function") throw new Error("settings.section registration must return a disposer");
const sectionReg = registeredOptions.find((entry) => entry.options?.name === "settings.section");
if (sectionReg === void 0) throw new Error("settings.section registration missing options");
if (sectionReg.options.id !== "usage-stats") throw new Error(`settings.section id ${sectionReg.options.id}`);
if (typeof sectionReg.options.label !== "function" || typeof sectionReg.options.label() !== "string") throw new Error("settings.section must carry a resolving label thunk");
if (typeof sectionReg.component !== "function") throw new Error("settings.section must mount a component");
if (typeof registeredOptions.find((entry) => entry.options?.name === "sidebar.footer.action")?.component !== "function") throw new Error("sidebar.footer.action must mount a component");
console.log("apply ok, slots:", slotNames.join(", "));

// Data helpers against a synthetic wire payload.
const { filterDay, summarize, modelChoicesOf, recentDays, isPeak, fmtMoney, fmt, sidebarSummaryOf } = exports_;

// Build dates relative to today so the 14-day window assertions hold on any day.
const d0 = new Date();
const d1 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 1);
const keyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const TODAY_KEY = keyOf(d0);
const YESTERDAY_KEY = keyOf(d1);

const wireDay = {
	date: TODAY_KEY,
	inputTokens: 300,
	outputTokens: 100,
	cacheReadTokens: 50,
	cacheWriteTokens: 0,
	tokens: 450,
	cost: 0.12,
	cacheHitRate: 14.3,
	models: [
		{ model: "deepseek-official/deepseek-v4-flash", inputTokens: 200, outputTokens: 50, tokens: 250, cost: 0.07, cacheHitRate: 20 },
		{ model: "deepseek-official/deepseek-v4-pro", inputTokens: 100, outputTokens: 50, tokens: 150, cost: 0.05, cacheHitRate: 5 }
	],
	hours: [
		{ hour: 0, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0, models: [] },
		{ hour: 1, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0, models: [] },
		{ hour: 2, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0, models: [] },
		{ hour: 3, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0, models: [] },
		{ hour: 4, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0, models: [] },
		{ hour: 5, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0, models: [] },
		{ hour: 6, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0, models: [] },
		{ hour: 7, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0, models: [] },
		{ hour: 8, inputTokens: 200, outputTokens: 50, cacheReadTokens: 50, tokens: 300, cost: 0.08, models: [{ model: "deepseek-official/deepseek-v4-flash", inputTokens: 200, outputTokens: 50, tokens: 250, cost: 0.07 }, { model: "deepseek-official/deepseek-v4-pro", inputTokens: 0, outputTokens: 0, tokens: 50, cost: 0.01 }] },
		{ hour: 9, inputTokens: 100, outputTokens: 50, tokens: 150, cost: 0.04, models: [{ model: "deepseek-official/deepseek-v4-pro", inputTokens: 100, outputTokens: 50, tokens: 150, cost: 0.04 }] }
	]
};

const sidebarSummary = sidebarSummaryOf(
	{ ok: true, days: [wireDay], pricing: { currency: "CNY" } },
	{ ok: true, account: { balance: { total: 65.12, currency: "CNY" } } }
);
if (!sidebarSummary.balance.includes("65.12")) throw new Error(`sidebar balance ${sidebarSummary.balance}`);
if (sidebarSummary.today !== "¥0.12" || sidebarSummary.todayTokens !== 450) throw new Error(`sidebar usage ${JSON.stringify(sidebarSummary)}`);
if (sidebarSummary.balanceStatus !== "muted" || sidebarSummary.todayStatus !== "muted") throw new Error("sidebar indicators must stay hidden without configured limits");
const coloredSidebarSummary = sidebarSummaryOf(
	{ ok: true, days: [wireDay], pricing: { currency: "CNY" } },
	{ ok: true, account: { balance: { total: 65.12, currency: "CNY" } } },
	{ ok: true, defaultKeyRef: "DEEPSEEK_API_KEY", status: { DEEPSEEK_API_KEY: { balanceAlertStatus: "ok", spendStatus: "warning" } } }
);
if (coloredSidebarSummary.balanceStatus !== "ok" || coloredSidebarSummary.todayStatus !== "warn") throw new Error(`sidebar indicator tones ${JSON.stringify(coloredSidebarSummary)}`);

const filtered = filterDay(wireDay, "deepseek-v4-flash");
if (filtered.tokens !== 250) throw new Error(`filter tokens ${filtered.tokens}`);
if (filtered.hours[8].tokens !== 250) throw new Error(`filter hour 8 tokens ${filtered.hours[8].tokens}`);
if (filtered.hours[9].tokens !== 0) throw new Error(`filter hour 9 tokens ${filtered.hours[9].tokens}`);
if (filtered.models.length !== 1) throw new Error(`filter models ${filtered.models.length}`);
if (filterDay(wireDay, "").tokens !== 450) throw new Error("empty filter must pass through");

const choices = modelChoicesOf([wireDay]);
if (choices.length !== 2 || choices[0] !== "deepseek-v4-flash" || choices[1] !== "deepseek-v4-pro") {
	throw new Error(`model choices ${JSON.stringify(choices)}`);
}

const days = [wireDay, { ...wireDay, date: YESTERDAY_KEY, tokens: 100, cost: 0.02, models: wireDay.models }];
const stats = summarize(days, "");
if (stats.totalTokens !== 550) throw new Error(`summarize total ${stats.totalTokens}`);
const flashStats = summarize(days, "deepseek-v4-flash");
if (flashStats.totalTokens !== 500) throw new Error(`flash total ${flashStats.totalTokens}`);

if (!isPeak(2, [[1, 4], [6, 10]])) throw new Error("hour 2 must be peak");
if (isPeak(5, [[1, 4], [6, 10]])) throw new Error("hour 5 must not be peak");
if (!isPeak(9, [[1, 4], [6, 10]])) throw new Error("hour 9 must be peak");
if (isPeak(23, [[1, 4], [6, 10]])) throw new Error("hour 23 must not be peak");

if (fmtMoney(0) !== "0.00") throw new Error(`fmtMoney 0 ${fmtMoney(0)}`);
if (fmtMoney(null) !== "—") throw new Error(`fmtMoney null ${fmtMoney(null)}`);
if (fmtMoney(3.14159) !== "3.14") throw new Error(`fmtMoney 3.14 ${fmtMoney(3.14159)}`);
if (fmtMoney(0.001) !== "<0.01") throw new Error(`fmtMoney tiny ${fmtMoney(0.001)}`);
if (fmt(1234567) !== "1,234,567") throw new Error(`fmt ${fmt(1234567)}`);

const recent = recentDays([wireDay, { ...wireDay, date: "1999-01-01", tokens: 5 }]);
if (recent.length !== 1) throw new Error(`recentDays ${recent.length}`);
if (recent[0].date !== TODAY_KEY) throw new Error(`recentDays order ${recent[0].date}`);

// The server-provided Beijing "today" must win whenever present; callers that
// omit it keep the previous local-date behavior.
const beijingToday = "2020-01-15";
const todayOverrideDays = [wireDay, { ...wireDay, date: beijingToday, tokens: 777, cost: 1.23 }];
if (summarize(todayOverrideDays, "", beijingToday).todayTokens !== 777) throw new Error("summarize must honor the today override");
if (summarize(todayOverrideDays, "").todayTokens !== 450) throw new Error("summarize must fall back to the local today");
// recentDays keeps its local 14-day cutoff; the today override only tightens
// the upper bound, so a day newer than the override must be excluded.
const d3 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 3);
const THREE_DAYS_AGO_KEY = keyOf(d3);
const overriddenRecent = recentDays([wireDay, { ...wireDay, date: THREE_DAYS_AGO_KEY, tokens: 5 }], THREE_DAYS_AGO_KEY);
if (overriddenRecent.length !== 1 || overriddenRecent[0].date !== THREE_DAYS_AGO_KEY) throw new Error(`recentDays today override ${JSON.stringify(overriddenRecent)}`);
const overriddenSidebar = sidebarSummaryOf(
	{ ok: true, days: [wireDay, { ...wireDay, date: beijingToday, cost: 2.5, tokens: 900 }], pricing: { currency: "CNY" }, today: beijingToday },
	{ ok: true, account: { balance: { total: 10, currency: "CNY" } } }
);
if (overriddenSidebar.today !== "¥2.50" || overriddenSidebar.todayTokens !== 900) throw new Error(`sidebarSummaryOf server today ${JSON.stringify(overriddenSidebar)}`);

console.log("data helpers ok");

//#region contribution heatmap
{
	const { buildYearContributionHeatmap, cellColor, ContributionHeatmap } = exports_;
	const dayMap = new Map([
		["2026-08-13", { tokens: 1234, cacheHitRate: 88.8 }],
		["2026-08-14", { tokens: 4321, cacheHitRate: 90 }]
	]);
	const heat = buildYearContributionHeatmap(dayMap, 2026);
	if (heat.year !== 2026) throw new Error(`heatmap year ${heat.year}`);
	if (heat.weeks.length !== 53) throw new Error(`2026 contribution heatmap must span 53 weeks, got ${heat.weeks.length}`);
	if (heat.weeks.some((week) => week.length !== 7)) throw new Error("every contribution week must contain 7 day rows");
	if (heat.weeks.flat().some((cell) => cell !== null && !cell.key.startsWith("2026-"))) throw new Error("year heatmap leaked an adjacent year");
	if (!heat.weeks.flat().some((cell) => cell?.key === "2026-01-01")) throw new Error("January 1 missing");
	if (!heat.weeks.flat().some((cell) => cell?.key === "2026-12-31")) throw new Error("December 31 missing");
	if (heat.max !== 4321) throw new Error(`heat max ${heat.max}`);
	const day13 = heat.weeks.flat().find((cell) => cell?.key === "2026-08-13");
	if (day13?.tokens !== 1234 || day13?.hitRate !== 88.8) throw new Error(`heat day 13 ${JSON.stringify(day13)}`);
	if (heat.months.length !== 12 || !heat.months.some((month) => month.month === 7)) throw new Error(`year month labels invalid: ${JSON.stringify(heat.months)}`);
	if (cellColor(4321, heat.max).background === cellColor(0, heat.max).background) throw new Error("used and empty days must have different colors");
	// The server-provided "today" must drive the today-cell highlight.
	const todayHeatMarkup = renderToStaticMarkup(react.createElement(ContributionHeatmap, {
		heat: buildYearContributionHeatmap(new Map([["2026-08-14", { tokens: 1, cacheHitRate: null }]]), 2026),
		translate: (key) => key,
		selectedKey: null,
		onSelect: () => {},
		today: "2026-08-14"
	}));
	if (!todayHeatMarkup.includes("usg_heatCellToday")) throw new Error("heatmap must highlight the server-provided today cell");
	if (todayHeatMarkup.includes("usg_heatCellSelected")) throw new Error("heatmap today highlight must not imply a selected day");
	console.log("contribution heatmap helpers ok");
}
//#endregion

console.log("\nclient smoke: all passed");
