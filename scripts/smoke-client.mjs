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
if (!source.includes('fetchJson("/api/usage-stats/providers")')) throw new Error("client must fetch the providers endpoint");
if (!source.includes('fetchJson(`/api/usage-stats/balance${query}`)')) throw new Error("client must fetch the balance endpoint");
if (!source.includes('fetchJson("/api/usage-stats/limits")')) throw new Error("client must fetch the limits endpoint");
if (!source.includes('name: "settings.section"')) throw new Error("client must register the settings.section slot");
if (!source.includes('width:760px')) throw new Error("query panel must use the 760px responsive layout");
if (!source.includes("panel.tabOverview") || !source.includes("panel.tabDetails")) throw new Error("query panel must split into overview/details tabs");
if (!source.includes('"data-usage-stats-settings-link"')) throw new Error("query panel must expose the go-to-settings affordance");
if (source.includes('"data-usage-provider-select": true')) throw new Error("query panel must follow the settings-selected provider without a second selector");
if (!source.includes('"data-usage-default-provider-select": true')) throw new Error("settings must expose the default provider selector");
if (!source.includes('function usageKindOf')) throw new Error("client must normalize balance/plan/local provider capabilities");
if (!source.includes('"data-usage-provider-kind": providerKind')) throw new Error("provider cards must expose their normalized capability kind");
if (!source.includes('"data-usage-plan-windows": true')) throw new Error("plan providers must expose their quota window group");
if (!source.includes('"data-usage-window-progress": true')) throw new Error("plan windows must expose a remaining progress bar");
if (!source.includes('"data-usage-window-reset": true')) throw new Error("plan windows must expose reset information");
if (!source.includes('.usg_providerAccountRow{align-items:center;gap:12px}')) throw new Error("provider account rows must vertically center identity and values with symmetric inherited padding");
if (!source.includes('.usg_providerAccountIdentity{align-items:flex-start;flex:1;min-width:0}')) throw new Error("provider account identity must stay left-aligned");
if (!source.includes('.usg_providerAccountValues{align-items:flex-end;text-align:right;flex:none;gap:3px}')) throw new Error("provider account values must stay right-aligned with compact row spacing");
if (!source.includes('.usg_providerAccountBalanceValues{display:grid;grid-template-columns:max-content max-content;column-gap:8px;row-gap:3px;align-items:baseline}')) throw new Error("balance provider values must share the widest row columns");
if (!source.includes('.usg_providerAccountPlanValues{display:grid;grid-template-columns:max-content max-content max-content;column-gap:8px;row-gap:3px;align-items:baseline}')) throw new Error("plan provider values must share the widest row columns");
if (!source.includes('.usg_providerAccountBalanceValues .usg_providerBalanceRow,.usg_providerAccountPlanValues .usg_providerPlanWindow{grid-column:1 / -1;grid-template-columns:subgrid}')) throw new Error("provider value rows must inherit shared block columns");
if (!source.includes('.usg_providerBalanceRow{display:grid;grid-template-columns:max-content max-content;column-gap:8px;align-items:baseline;justify-content:end;white-space:nowrap}')) throw new Error("balance provider values must size columns to their content");
if (!source.includes('.usg_providerBalanceLabel{color:var(--dsw-alias-label-secondary);text-align:right}') || !source.includes('.usg_providerBalanceValue{font-weight:600;text-align:right}')) throw new Error("balance provider labels and values must align within reserved columns");
if (!source.includes('.usg_providerPlanWindow{display:grid;grid-template-columns:max-content max-content max-content;column-gap:8px;align-items:baseline;justify-content:end;white-space:nowrap}')) throw new Error("provider plan windows must size columns to their content");
if (!source.includes('.usg_providerPlanLabel{color:var(--dsw-alias-label-secondary);text-align:right}') || !source.includes('.usg_providerPlanPercent{font-weight:600;text-align:right}')) throw new Error("provider plan labels and percentages must align within their reserved columns");
if (!source.includes('.usg_providerReset{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;white-space:nowrap}')) throw new Error("provider reset text must use a smaller muted style");
if (!source.includes('account?.status !== "ok"')) throw new Error("provider account rows must hide the realtime status label");
const accountsCardSource = source.slice(source.indexOf("function AccountsCard"), source.indexOf("function PricingCard"));
if (!accountsCardSource.includes('S.providerAccountIdentity') || !accountsCardSource.includes('S.providerAccountValues')) throw new Error("provider accounts must use distinct identity and right-aligned value columns");
if (!accountsCardSource.includes("planWindows.map")) throw new Error("provider accounts must render every plan quota window");
if (accountsCardSource.includes('"data-usage-window-progress": true')) throw new Error("provider account plan windows must render text without progress bars");
if (!accountsCardSource.includes("windowResetCountdownForItem(window, translate)") || !accountsCardSource.includes('children: `(${reset})`')) throw new Error("provider account plan windows must show compact reset status in parentheses");
if (!accountsCardSource.includes('translate("panel.balance")') || !accountsCardSource.includes('translate("accounts.today")')) throw new Error("DeepSeek account rows must label balance and today spend");
if (!accountsCardSource.includes('translate("accounts.unsupported")')) throw new Error("unsupported provider accounts must show a concise unsupported label");
if (!source.includes('function providerLogoOf')) throw new Error("provider balance card must expose provider branding");
if (!source.includes('function windowResetCountdownOf(value, translate, now = Date.now())')) throw new Error("plan quota reset times must be formatted as relative countdowns");
if (!source.includes('function windowResetDisplayOf(value, translate, now = Date.now())')) throw new Error("plan quota reset display must combine countdown and calendar time");
if (!source.includes('function windowResetValueOf(item)')) throw new Error("plan quota reset display must accept provider reset aliases");
if (!source.includes('function windowResetDisplayForItem(item, translate, now = Date.now())')) throw new Error("plan quota reset display must keep an empty five-hour bucket visible");
if (!source.includes('function windowResetCountdownForItem(item, translate, now = Date.now())')) throw new Error("compact account reset display must keep an empty five-hour bucket visible");
if (!source.includes('translate("balance.resetNotStarted")')) throw new Error("empty five-hour quota must explain that its reset timer has not started");
if (!source.includes('.usg_planQuotaWindowReset{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;text-align:right;padding-right:8px;font-variant-numeric:tabular-nums}')) throw new Error("plan quota reset rows must use a compact right-aligned muted style");
const providerLogoSource = source.slice(source.indexOf("function providerLogoOf"), source.indexOf("function pricingOf"));
if (!providerLogoSource.includes("primitives.FishLogo")) throw new Error("DeepSeek provider branding must reuse the Harness FishLogo primitive");
if (!providerLogoSource.includes('viewBox: "0 0 1024 1024"') || !providerLogoSource.includes('M422.43584 883.5072H71.68')) throw new Error("Z.ai provider branding must use the supplied official SVG geometry");
if (!providerLogoSource.includes('fill: "currentColor"')) throw new Error("inline provider SVG logos must inherit the black logo-seat foreground");
if (!providerLogoSource.includes("XIAOMI_MIMO_LOGO_DATA_URL") || !source.includes('const XIAOMI_MIMO_LOGO_DATA_URL = "data:image/jpeg;base64,')) throw new Error("Xiaomi MiMo provider branding must use the downloaded local image data");
if (!source.includes('.usg_providerLogoImage{display:block;width:100%;height:100%;object-fit:cover}')) throw new Error("raster provider logos must fill the provider logo seat");
if (!source.includes('.usg_balanceIcon[data-provider-id=deepseek-official],.usg_balanceIcon[data-provider-id=zai-coding-cn]{color:#fff;background:#111}')) throw new Error("SVG provider logos must use a white foreground on a black seat");
if (!source.includes('tokenMode ? `${fmt(hovered.tokens)} tokens`')) throw new Error("plan hourly chart must use token counts instead of money");
if (!source.includes('!tokenMode && peakHours.map')) throw new Error("plan hourly chart must not render peak-hour regions");
if (!source.includes('selectedProviderKind === "balance" && selectedProviderId === "deepseek-official"')) throw new Error("limit UI must be scoped to the official provider");
if (!source.includes('"data-usage-limit-provider": selectedLimitProvider?.id ?? providerId')) throw new Error("limit settings must expose their provider scope");
if (source.includes('"data-usage-limit-provider-selector": true')) throw new Error("limit settings must not duplicate the accounts provider selector");
if (source.includes('const [billingProviderId, setBillingProviderId]')) throw new Error("billing settings must follow the accounts default provider state");
if (!source.includes('providers.some((provider) => provider.id === defaultProviderId)')) throw new Error("billing settings must derive the provider from the accounts default provider");
if (!source.includes('summary.kind === "plan_quota"')) throw new Error("sidebar must switch its compact value for plan providers");
if (!source.includes('summary.planWindows ?? []')) throw new Error("sidebar must summarize all plan windows");
if (!source.includes('function planQuotaToneOf')) throw new Error("plan quota dots must derive color from configured remaining thresholds");
if (!source.includes('planQuotaWindows')) throw new Error("plan quota settings must expose separate five-hour and weekly thresholds");
if (!source.includes('data-usage-plan-quota-window')) throw new Error("each plan quota window threshold must be identifiable");
if (!source.includes('function PlanQuotaCard')) throw new Error("plan quota settings must be reusable in the billing tab");
if (!source.includes('function supportsPlanQuota')) throw new Error("plan quota settings must follow provider metadata instead of a hardcoded provider list");
if (!source.includes('isZaiProvider')) throw new Error("plan quota settings must be scoped to Z.ai");
if (!source.includes('planQuotaRef')) throw new Error("plan quota slider saves must use the latest dragged thresholds");
if (!source.includes('usage-stats:plan-quota-updated')) throw new Error("plan quota dragging must broadcast live threshold updates");
if (!source.includes('addEventListener("usage-stats:plan-quota-updated"')) throw new Error("sidebar must listen for live plan quota threshold updates");
if (!source.includes('"data-usage-plan-status-dot": true')) throw new Error("each sidebar plan window must expose a status dot");
if (!source.includes('className: S.statusDot, "data-tone": item.tone, "data-usage-plan-status-dot": true')) throw new Error("plan quota dots must reuse the balance status-dot style");
if (!source.includes('.usg_planWindowItem{display:inline-flex;align-items:center;white-space:nowrap}')) throw new Error("plan windows must use fixed inline item layout");
if (!source.includes('.usg_planWindowDotSlot{width:12px;display:inline-flex;align-items:center;justify-content:flex-start;flex:none}')) throw new Error("plan window dots must reserve the same slot when hidden");
if (!source.includes('.usg_planWindowSeparator{display:inline-block;margin-inline:6px}')) throw new Error("plan window separators must have stable spacing");
if (!source.includes('"data-usage-plan-quota-settings": true')) throw new Error("billing settings must expose plan quota thresholds");
if (source.includes('? `${summary.providerLabel} ${planWindowText')) throw new Error("plan sidebar summary must not repeat the provider label");
if (!source.includes("const providerQuery = providerId ? `?provider=${encodeURIComponent(providerId)}` : \"\";")) throw new Error("sidebar must derive provider queries from the settings default");
if (!source.includes("fetchJson(`/api/usage-stats/balance${providerQuery}`)")) throw new Error("sidebar must query the selected provider balance");
if (!source.includes("const usagePayload = usageResult.status === \"fulfilled\" ? filterUsageByProvider(usageResult.value, providerId) : null;")) throw new Error("sidebar must filter usage to the settings-selected provider");
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
if (typeof exports_.AccountsCard !== "function") throw new Error("missing AccountsCard export");
if (typeof exports_.PricingCard !== "function") throw new Error("missing PricingCard export");
if (typeof exports_.NotificationsCard !== "function") throw new Error("missing NotificationsCard export");
if (typeof exports_.DataCard !== "function") throw new Error("missing DataCard export");
if (!Array.isArray(exports_.SETTINGS_TABS) || exports_.SETTINGS_TABS.length !== 5) throw new Error("SETTINGS_TABS must declare five settings tabs");
if (exports_.SETTINGS_TABS.some((tab) => tab.id === "pricing")) throw new Error("provider pricing must live under billing and limits, not a separate tab");
if (!source.includes('"data-usage-provider-billing-settings": true')) throw new Error("budget and limits must group provider-scoped limits and pricing");
if (typeof exports_.ConversationCard !== "function") throw new Error("missing ConversationCard export");
if (typeof exports_.CompactConversationController !== "function") throw new Error("missing CompactConversationController export");
if (typeof exports_.windowResetCountdownOf !== "function") throw new Error("missing reset countdown formatter export");
if (typeof exports_.windowResetDisplayOf !== "function") throw new Error("missing reset display formatter export");
if (typeof exports_.windowResetDisplayForItem !== "function") throw new Error("missing reset display item formatter export");
if (typeof exports_.windowResetCountdownForItem !== "function") throw new Error("missing compact reset item formatter export");

// Regression: never locate Settings with a broad substring selector. In the
// plugin settings page, the Shell card has aria-label="展开设置: 终端" and was
// therefore mistaken for the external Settings trigger.
if (source.includes('button[aria-label*="设置"') || source.includes('button[title*="设置"')) {
	throw new Error("client must not use broad Settings substring selectors");
}
if (!source.includes("@keyframes usg_spin")) throw new Error("refresh button must define a spin animation");
if (!source.includes(".usg_refreshButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border:0;background:transparent")) throw new Error("global refresh button must be a compact borderless glyph");
if (!source.includes(".usg_refreshGlyph")) throw new Error("refresh glyph must receive the spin animation");
if (source.includes(".usc-fold-summary:hover{background:")) throw new Error("conversation fold summary must not change background on hover");
if (!source.includes('react_jsx_runtime.jsxs("svg"')) throw new Error("refresh button must use SVG icon for reliable rotation");
if (!source.includes(".usg_hourTooltipHead{justify-content:space-between")) throw new Error("tooltip head must lay time and amount on one row");
if (!source.includes(".usg_hourTooltipAmount")) throw new Error("tooltip head must wrap the amount in a dedicated span");
if (!source.includes(".usg_hourRangeSelect{") || !source.includes("appearance:none")) throw new Error("hour range selector must be transparent and borderless");
if (!source.includes(".usg_hourRangeSelect:focus,.usg_hourRangeSelect:focus-visible{outline:none")) throw new Error("hour range selector must not show a blue focus border");
if (!source.includes(".usg_select:focus,.usg_select:focus-visible") || !source.includes(".usg_input:focus,.usg_input:focus-visible")) throw new Error("all plugin fields must suppress blue focus borders");
if (!source.includes('"data-loading": usageLoading || balanceLoading')) throw new Error("global refresh must reflect both usage and balance loading");
if (source.includes('function BalanceCard({ keys, selectedKey, onSelectKey, account, accountLoading, accountError, balanceTone = "muted", translate, onRefresh })')) throw new Error("balance card must not render a duplicate refresh action");
if (!source.includes("className: S.hourControls")) throw new Error("hourly range selector must share the header controls with date navigation");
if (!source.includes(".usg_hourRangeSelect{height:28px;color:var(--dsw-alias-label-secondary);background:transparent;border:0")) throw new Error("hourly range selector must not render a white bordered field");
if (!source.includes('"aria-label": translate("usage.year")')) throw new Error("heatmap must expose a year selector");
if (!source.includes("width:10px;height:10px")) throw new Error("heatmap must use compact square day cells");
if (!source.includes("onMouseEnter: (event) => setHoveredCell") || !source.includes("day.inputTokens") || !source.includes("day: entry?.day ?? entry ?? null")) throw new Error("heatmap cells must show full-day hover details");
if (!source.includes('"aria-label": title')) throw new Error("heatmap cells must retain an accessible label");
if (!source.includes(".usg_hourTooltip{")) throw new Error("hourly chart must define an interactive tooltip");
if (!source.includes("onMouseEnter: () => setHoveredHour(hour.hour)")) throw new Error("hourly bars must react to pointer hover");
if (!source.includes('"data-hour": hour.hour')) throw new Error("hourly bars must expose their hour for interaction tests");
if (source.includes(".usg_hourSlot.usg_peak{background:")) throw new Error("peak hours must not look like token bars");
if (!source.includes(".usg_peakRegion{")) throw new Error("peak hours must be rendered as a background region");
if (!source.includes('"data-peak-region"')) throw new Error("peak regions must be identifiable in the DOM");
if (source.includes("min-height:3px")) throw new Error("zero-token hours must not fake a bar with min-height");
if (!source.includes('onMouseLeave: () => setHoveredHour(null)')) throw new Error("hourly chart tooltip must clear when the pointer leaves");
if (source.includes('onClick: () => setHoveredHour(hoveredHour === hour.hour ? null : hour.hour)')) throw new Error("hourly tooltip must not persist after a click");
if (!source.includes('filteredActiveDay !== null && react_jsx_runtime.jsx(DayDetail')) throw new Error("single-day view must retain the model detail summary");
if (!source.includes('translate("usage.input"), fmt(hovered.inputTokens ?? 0)') || !source.includes('hovered.models.map((model)')) throw new Error("multi-day tooltip must show input/output and model details");
if (!source.includes("Number(tokenMode ? hour.tokens : hour.cost)")) throw new Error("hourly bars must scale by cost or token count according to provider kind");
if (!source.includes("Math.max(input + output, 1)")) throw new Error("hourly input/output split must not count cache read against the visible bars");
if (source.includes("className: S.hourCache")) throw new Error("cache tokens must not use an invisible standalone segment");
if (!source.includes("function sidebarSummaryOf")) throw new Error("sidebar entry must derive balance and today usage summary");
if (!source.includes("className: S.sidebarSummary")) throw new Error("wide sidebar entry must render its summary");
if (!source.includes("SIDEBAR_POLL_MS_OPEN = 60000") || !source.includes("SIDEBAR_POLL_MS_CLOSED = 300000")) throw new Error("sidebar summary must poll at 60s open / 300s closed");
if (!source.includes("window.setInterval(loadSummary, pollMs)")) throw new Error("sidebar summary must refresh in the background on an open/closed-aware interval");
if (!source.includes('usage-stats:limits-updated')) throw new Error("sidebar summary must refresh after limits changes");
if (!source.includes('usage-stats:accounts-updated')) throw new Error("sidebar summary must refresh after account display toggles change");
if (!source.includes('display.balance !== false')) throw new Error("sidebar summary must respect the balance display toggle");
if (!source.includes('display.todayCost !== false')) throw new Error("sidebar summary must respect the today-spend display toggle");
if (!source.includes('display.statusDot !== false')) throw new Error("sidebar summary must respect the status-dot display toggle");
if (!source.includes('t("panel.badge")') || !source.includes('t("panel.today")')) throw new Error("sidebar summary labels must use the active locale");
if (source.includes('`余额 ${summary.balance}`') || source.includes('`今日 ${summary.today}`')) throw new Error("sidebar summary must not hard-code Chinese labels");
if (!source.includes("const stopOnExceed = rule?.stopOnExceed === true")) throw new Error("hard stop must reflect the saved limit rule");
if (!source.includes("window.confirm(translate(\"limits.stopConfirm\"))")) throw new Error("enabling hard stop must require confirmation");
if (!source.includes('key: `${targetKey}:daily:${limits === null ? "loading" : "ready"}`')) throw new Error("daily limit input must remount when the selected key changes");
if (!source.includes('key: `${targetKey}:balance:${limits === null ? "loading" : "ready"}`')) throw new Error("balance limit input must remount when the selected key changes");
if (!source.includes('status === "blocked" || status === "exceeded"')) throw new Error("client must map blocked and exceeded through one shared tone helper");
if (!source.includes('"stale", "unavailable"')) throw new Error("client must render stale and unavailable limit states");
// Settings controls must remain usable inside the host application's global
// form styles. Amount fields save immediately from the current input value. The
// switch owns its full hit area and paints a visible track without
// relying on a potentially transparent host theme token.
if (!source.includes("handleSave({ lowBalanceWarning:")) throw new Error("low-balance input must autosave its current value");
if (!source.includes(".usg_switch input{position:absolute;inset:0;width:100%;height:100%")) throw new Error("switch input must own the full control hit area");
if (!source.includes("background-color:rgba(128,128,128,.28)")) throw new Error("switch track must have a visible theme-independent off state");
if (!source.includes(".usg_section{--usg-blue:var(--dsw-alias-brand-primary,#1f6feb);")) throw new Error("settings section must define the switch selected-state color");
if (source.includes("saveMsg") || source.includes("usg_saveSuccess") || source.includes('"limits.saved"')) throw new Error("settings must not render a saved-success message");
if (!source.includes("className: S.toggleGrid")) throw new Error("limit toggles must use the compact responsive grid");
if (!source.includes("className: S.alertRange")) throw new Error("alert percentage must use the segmented range control");
if (!source.includes('"--alert-percent": `${alertPercent}%`') || !source.includes('"--critical-percent": `${criticalPercent}%`')) throw new Error("dual range must track both configured percentages");
if (!source.includes("className: `${S.alertRange} is-overlay`")) throw new Error("alert control must render a second draggable handle");
if (!source.includes('alertTrack: "usg_alertTrack"')) throw new Error("dual range track must be bound to its positioned wrapper");
if (!source.includes("--usg-success:var(--dsw-alias-state-success-primary,#22a06b);--usg-warning:var(--dsw-alias-state-warn-primary,#d99b00);--usg-danger:var(--dsw-alias-state-error-primary,#e5484d);")) throw new Error("semantic range colors must follow the host theme with fallbacks");
if (!source.includes(".usg_alertCard input.usg_alertRange{appearance:none!important;")) throw new Error("range control must override host input styles");
if (!source.includes(".usg_alertCard input.usg_alertRange::-webkit-slider-runnable-track")) throw new Error("range control must paint an explicit WebKit track");
if (!source.includes(".usg_saveBtn{cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;")) throw new Error("save button must use the settings-page primary button palette");
if (!source.includes(".usg_switch input:checked + .usg_switchSlider{background-color:var(--usg-action);border-color:var(--usg-action)}")) throw new Error("enabled switches must use the monochrome action palette");
if (!source.includes(".usg_input{box-sizing:border-box;width:100%;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;")) throw new Error("amount inputs must use the native settings field palette");
if (!source.includes(".usg_input::placeholder{color:var(--dsw-alias-label-tertiary);opacity:1}")) throw new Error("amount inputs must use the native placeholder palette");
if (!source.includes("const [limitStatusMap, setLimitStatusMap] = react.useState({})")) throw new Error("query panel must load quota indicator statuses");
if (!source.includes('providerKind === "balance" && status === "ok" && balanceTone !== "muted" ? balanceTone')) throw new Error("DeepSeek balance badge must follow the configured balance alert tone");
if (!source.includes('"data-status": currentStatus.spendStatus ?? "muted"')) throw new Error("today-spend progress must use its own status, not the combined balance status");
if (!source.includes('.usg_usageLimitBanner{border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;line-height:20px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-bg-base));border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}')) throw new Error("usage banner must use the neutral monochrome surface");
if (!source.includes('.usg_usageLimitBanner strong{font-size:16px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary)}')) throw new Error("usage banner title must keep the primary text color");
if (!source.includes('.usg_usageLimitBanner:before{content:\\\"\\\";position:absolute;inset:0 auto 0 0;width:var(--usage-progress,0%);background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);z-index:0}')) throw new Error("usage banner must render monochrome full-height background progress");
if (source.includes('.usg_usageLimitBanner:after{')) throw new Error("usage banner must not render a separate bottom progress rule");
const usageLimitBannerCss = source.slice(source.indexOf('.usg_usageLimitBanner{'), source.indexOf('.usg_bannerHead{'));
if (usageLimitBannerCss.includes('[data-status=')) throw new Error("usage progress must not depend on warning or error status colors");
if (!source.includes('translate("limits.dailySpendProgress")')) throw new Error("usage progress must use a neutral daily-spend title");
if (!source.includes('const spendBannerStatus = ["warning", "exceeded", "blocked"].includes(spendStatus) ? spendStatus : "normal"')) throw new Error("limit banner must be scoped to today-spend status");
if (!source.includes('currentStatus?.reason === "daily_cost" || currentStatus?.reason === "unpriced"')) throw new Error("limit banner must hide balance-only messages");
if (!source.includes('currentStatus !== null && currentLimit > 0 && react_jsx_runtime.jsxs("div"')) throw new Error("today-spend banner must only render when a daily limit is configured");
if (!source.includes('translate("limits.dailyLimitStatus")')) throw new Error("today-spend banner must use a daily-limit label instead of the generic usage-warning title");
if (!source.includes("const loadLimitStatus = react.useCallback")) throw new Error("query panel must have a reusable limit-status refresh");
if (!source.includes('window.addEventListener("usage-stats:limits-updated", onLimitsUpdated)')) throw new Error("query panel must refresh balance alert linkage after limit changes");
if (source.includes('"data-balance-indicator": true')) throw new Error("balance card must not render a status dot");
if (source.includes('"data-usage-cost-indicator": true')) throw new Error("today spend card must not render a status dot");
if (!source.includes('summary.balanceStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot')) throw new Error("sidebar must show balance status dots");
if (source.includes('`${balanceLabel} ${summary.balance}`')) throw new Error("sidebar balance summary must not include provider names");
if (source.includes('`${summary.providerLabel} ${t("balance.local")}')) throw new Error("sidebar local summary must not include provider names");
if (!source.includes('todayInputTokens') || !source.includes('todayOutputTokens')) throw new Error("sidebar local summary must expose today's input/output totals");
if (!source.includes('fmtSidebarTokens')) throw new Error("sidebar local summary must use compact token formatting");
if (source.includes('!wide && summary.todayStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot')) throw new Error("collapsed sidebar must hide today status dot");
if (source.includes('!wide && summary.balanceStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot')) throw new Error("collapsed sidebar must hide balance status dot");
if (!source.includes('style: { left: `${panelLeft}px` }')) throw new Error("usage panel must anchor to the sidebar edge");
if (!source.includes('"limits.lowBalance": "余额提醒"')) throw new Error("balance alert field must use the concise label");
if (!source.includes("const limitsRef = react.useRef(null)")) throw new Error("limits form must retain the latest saved configuration without resyncing edits");
if (!source.includes("limitsRef.current = next")) throw new Error("limits slider edits must update the synchronous save cache");
if (!source.includes("onPointerUp: () => handleSave({})") || !source.includes("onKeyUp: () => handleSave({})")) throw new Error("limits slider saves must read the latest edited thresholds");
const limitsSaveBlock = source.slice(source.indexOf("const handleSave = async"), source.indexOf("const currentStatus ="));
if (limitsSaveBlock.includes("setLimits(")) throw new Error("save responses must not overwrite the active form fields");
if (!limitsSaveBlock.includes("limitsRef.current = payload.limits")) throw new Error("save responses must update the latest limits cache");
if (!source.includes('fetchJson("/api/usage-stats/accounts")')) throw new Error("client must fetch the accounts endpoint");
if (!source.includes('fetchJson("/api/usage-stats/pricing")')) throw new Error("client must fetch the pricing endpoint");
if (!source.includes('fetchJson("/api/usage-stats/alerts")')) throw new Error("client must fetch the alerts endpoint");
if (!source.includes('fetchJson("/api/usage-stats/data")')) throw new Error("client must fetch the data endpoint");
if (!source.includes("SETTINGS_TABS")) throw new Error("settings page must declare its tab list");
if (!source.includes('"data-usage-billing-tab": tab.id')) throw new Error("settings tabs must be identifiable per tab");
if (!source.includes('"data-usage-accounts-card"')) throw new Error("accounts card must be identifiable");
for (const key of ["accounts.desc", "accounts.defaultProviderDesc", "accounts.refreshDesc", "accounts.showBalanceDesc", "accounts.showTodayDesc", "accounts.showStatusDesc"]) {
	if (!source.includes(`\"${key}\"`)) throw new Error(`accounts settings must explain ${key}`);
}
if (!source.includes('accounts.defaultAccount')) throw new Error("single-key account row must use a friendly label, not the raw credential ref");
if (!source.includes('singleKey ? translate("accounts.defaultAccount") : key.label')) throw new Error("account row label must switch to a friendly name when only one key is configured");
if (!source.includes('"data-usage-pricing-card"')) throw new Error("pricing card must be identifiable");
if (!source.includes('"pricing.providerScope"')) throw new Error("pricing settings must explain their provider scope");
if (!source.includes('"data-usage-notifications-card"')) throw new Error("notifications card must be identifiable");
for (const key of ["notifications.channelSidebarDesc", "notifications.channelToastDesc", "notifications.eventsDesc", "notifications.cooldownDesc", "notifications.historyDesc"]) {
	if (!source.includes(`\"${key}\"`)) throw new Error(`notification settings must explain ${key}`);
}
if (!source.includes('"data-usage-data-card"')) throw new Error("data card must be identifiable");
if (!source.includes('"data.retentionNote"')) throw new Error("data retention must explain its inclusive-day behavior");
if (!source.includes('"data.clearConfirmWord"') || !source.includes('"data.clearConfirmBtn"')) throw new Error("data clear must require typed confirmation");
if (!source.includes('primitives.Modal')) throw new Error("data clear must use a confirmation dialog");
if (!source.includes('confirmText.trim() === confirmWord')) throw new Error("data clear must gate the confirm button on the typed word");
if (!source.includes("onClick: handleFork") || !source.includes("onClick: handleRestore")) throw new Error("pricing card must expose fork and restore actions");
if (!source.includes('colSpan: 3')) throw new Error("pricing table must group peak/off-peak columns under a grouped header");
if (!source.includes('pricing.colMiss') || !source.includes('pricing.colHit')) throw new Error("pricing table must use concise column labels");
if (!source.includes('usingCustom ? translate("pricing.edit")')) throw new Error("pricing card must relabel the fork action to Edit when a custom scheme is active");
if (!source.includes('background:var(--usg-action)')) throw new Error("primary buttons must use the solid action palette");
if (!source.includes('.usg_btnDanger{background:')) throw new Error("danger buttons must use a solid error fill");
if (!source.includes("className: S.alertList")) throw new Error("notifications card must render the alert history list");
if (source.includes('run("rebuild")')) throw new Error("data card must not expose the server-side no-op rebuild action");
if (!source.includes('run("clear", { confirmation: confirmText.trim() })') || !source.includes('run("trim"')) throw new Error("data card must expose clear/trim actions with server-side clear confirmation");
// Notification linkage: the sidebar delivers in-page toasts with a fixed
// five-second lifecycle, ignores pre-session history on first hydration,
// honors the sidebar channel on the status dot, and polls alerts.
if (!source.includes('const USAGE_TOAST_TOTAL_MS = 5000')) throw new Error("usage toast must have a five-second total lifecycle");
if (!source.includes('function UsageAlertToast')) throw new Error("notifications must render the plugin-owned usage toast");
if (!source.includes('notificationSessionStartedAtRef')) throw new Error("notifications must track the current page session start");
if (!source.includes('const sessionStartedAt = notificationSessionStartedAtRef.current') || !source.includes('itemAt < sessionStartedAt')) throw new Error("notifications must ignore alert history from before the page session");
if (!source.includes('deliverAlerts')) throw new Error("sidebar must deliver new alerts from the alerts poll");
if (!source.includes('notifications.channels?.sidebar !== false')) throw new Error("sidebar status dot must honor the notification sidebar channel");
if (!source.includes('fetchJson("/api/usage-stats/alerts")')) throw new Error("sidebar must poll the alerts endpoint for toast delivery");
// Limits card grouping: daily limit and alert thresholds stay together; balance
// is its own group with sub-headings.
if (!source.includes('translate("limits.groupSpend")') || !source.includes('translate("limits.groupBalance")')) throw new Error("limits card must group spend/alert and balance settings");
if (!source.includes('S.limitSub')) throw new Error("limits card must render group sub-headings");
// Pricing custom input keeps raw draft strings so decimals are not swallowed.
if (!source.includes('toNumericModels')) throw new Error("pricing card must convert draft strings to numbers on save");
if (!source.includes('value: row?.[period]?.[field] ?? ""')) throw new Error("pricing edit inputs must render the raw draft string");
if (!source.includes('pricing.invalidValue') || !source.includes('value < 0')) throw new Error("pricing card must reject blank, invalid, and negative values");
if (!source.includes('const editableModels =') || !source.includes('draft !== null ? draft : editableModels')) throw new Error("pricing editor must keep official/current model rows when opening custom pricing");
if (!source.includes('M433.493333 548.693333') || !source.includes('M831.573333 511.146667') || !source.includes('atomDot.setAttribute("fill", "currentColor")')) throw new Error("thought metric must use the supplied atom icon");
if (!source.includes('.usg_hourInput{background:#3b82f6') || !source.includes('.usg_hourOutput{background:#22c55e')) throw new Error("hourly input/output bars must use blue/green colors");
if (!source.includes('.usg_dayBar{width:72%;margin:0 auto;border-radius:3px 3px 0 0;background:#f59e0b')) throw new Error("daily range bars must use orange");
if (!source.includes('M944.140673 718.412117') || !source.includes('tool.setAttribute("fill", "currentColor")')) throw new Error("tool metric must use the replacement tool icon");
// Data card must be organized into plain-language groups.
if (!source.includes('translate("data.overview")') || !source.includes('translate("data.retentionGroup")') || !source.includes('translate("data.dangerGroup")')) throw new Error("data card must use plain-language group headings");

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

const warningBalanceMarkup = renderToStaticMarkup(react.createElement(exports_.BalanceCard, {
	keys: [],
	providers: [{ id: "deepseek-official", label: "DeepSeek", capabilities: ["balance"] }],
	selectedProviderId: "deepseek-official",
	selectedKey: null,
	account: { status: "ok", balance: { total: 18.41, currency: "CNY" } },
	accountLoading: false,
	accountError: null,
	balanceTone: "warn",
	translate: (key) => key
}));
if (!warningBalanceMarkup.includes('data-tone="warn"')) throw new Error("DeepSeek balance card must render the configured warning tone");
console.log("DeepSeek balance alert tone linkage render ok");

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

// Settings page hosts five tabs: account, provider billing, notifications, conversation, data.
const tabsMarkup = renderToStaticMarkup(react.createElement(UsageBillingSettingsSection, { t: (key) => key }));
for (const tab of ["accounts", "limits", "notifications", "conversation", "data"]) {
	if (!tabsMarkup.includes(`data-usage-billing-tab="${tab}"`)) throw new Error(`settings tab ${tab} missing`);
}
if (!tabsMarkup.includes("data-usage-accounts-card")) throw new Error("settings section must mount the accounts card by default");
console.log("settings five-tab navigation render ok");

const accountsMarkup = renderToStaticMarkup(react.createElement(exports_.AccountsCard, { keys: [{ id: "DEEPSEEK_API_KEY", label: "DEEPSEEK_API_KEY", configured: true }], translate: (key) => key }));
if (!accountsMarkup.includes("data-usage-accounts-card") || !accountsMarkup.includes("accounts.title")) throw new Error("accounts card render missing title/identity");
if (accountsMarkup.includes("sk-")) throw new Error("accounts card must not embed credentials");
console.log("accounts card render ok, length:", accountsMarkup.length);

const pricingMarkup = renderToStaticMarkup(react.createElement(exports_.PricingCard, { translate: (key) => key }));
if (!pricingMarkup.includes("data-usage-pricing-card") || !pricingMarkup.includes("pricing.title")) throw new Error("pricing card render missing title/identity");

console.log("pricing card render ok, length:", pricingMarkup.length);

const notificationsMarkup = renderToStaticMarkup(react.createElement(exports_.NotificationsCard, { translate: (key) => key }));
if (!notificationsMarkup.includes("data-usage-notifications-card") || !notificationsMarkup.includes("notifications.title")) throw new Error("notifications card render missing title/identity");
if (!notificationsMarkup.includes("notifications.desc")) throw new Error("notifications card render missing description");
if (notificationsMarkup.includes("data-usage-plan-quota-window")) throw new Error("plan quota sliders must not live in notifications settings");
console.log("notifications card render ok, length:", notificationsMarkup.length);

const zaiLimitsMarkup = renderToStaticMarkup(react.createElement(LimitsCard, {
	keys: [{ id: "ZAI_CODING_CN_API_KEY", label: "ZAI_CODING_CN_API_KEY", configured: true }],
	providers: [{ id: "zai-coding-cn", label: "zai-coding-cn", capabilities: ["plan_quota"] }],
	providerId: "zai-coding-cn",
	providerKind: "plan",
	translate: (key) => key
}));
if (!zaiLimitsMarkup.includes("data-usage-plan-quota-window") || !zaiLimitsMarkup.includes("usg_alertRange")) throw new Error("Z.ai billing limits must render both plan quota sliders");
console.log("Z.ai plan quota billing card render ok, length:", zaiLimitsMarkup.length);

const dataMarkup = renderToStaticMarkup(react.createElement(exports_.DataCard, { translate: (key) => key }));
if (!dataMarkup.includes("data-usage-data-card") || !dataMarkup.includes("data.title")) throw new Error("data card render missing title/identity");
if (!dataMarkup.includes("data.desc")) throw new Error("data card render missing description");
console.log("data card render ok, length:", dataMarkup.length);

const conversationMarkup = renderToStaticMarkup(react.createElement(exports_.ConversationCard, { translate: (key) => key, conversation: { enabled: true, showTokenUsage: true }, onConversationUpdated: () => {} }));
if (!conversationMarkup.includes("data-usage-conversation-card") || !conversationMarkup.includes("conversation.title")) throw new Error("conversation card render missing title/identity");
if (!conversationMarkup.includes("conversation.enable")) throw new Error("conversation card render missing enable toggle");
if (!conversationMarkup.includes("conversation.showTokenUsage")) throw new Error("conversation card render missing token usage toggle");
console.log("conversation card render ok, length:", conversationMarkup.length);

const countdownNow = Date.UTC(2026, 7, 21, 0, 0, 0);
const durationTranslate = (key, params = {}) => ({
	"balance.resetSoon": "即将重置",
	"duration.day": `${params.value}天`,
	"duration.hour": `${params.value}小时`,
	"duration.minute": `${params.value}分钟`
}[key] ?? key);
if (exports_.windowResetCountdownOf(countdownNow + 143 * 60000, durationTranslate, countdownNow) !== "2小时 23分钟") throw new Error("five-hour reset countdown formatting mismatch");
if (exports_.windowResetCountdownOf(countdownNow + (6 * 1440 + 143) * 60000, durationTranslate, countdownNow) !== "6天 2小时 23分钟") throw new Error("weekly reset countdown formatting mismatch");
if (exports_.windowResetDisplayOf("2026-08-21T02:23:00Z", durationTranslate, countdownNow) !== "2小时 23分钟 (08/21 10:23)") throw new Error("plan quota reset display must include countdown and local calendar time");
if (exports_.windowResetDisplayForItem({ kind: "five_hour", remainingPercent: 100 }, (key) => key === "balance.resetNotStarted" ? "尚未开始" : key, countdownNow) !== "尚未开始") throw new Error("empty five-hour quota must show an explicit not-started state");
if (exports_.windowResetCountdownForItem({ kind: "five_hour", remainingPercent: 100 }, (key) => key === "balance.resetNotStarted" ? "尚未开始" : key, countdownNow) !== "尚未开始") throw new Error("compact empty five-hour quota must show an explicit not-started state");
console.log("plan quota reset countdown formatting ok");

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
if (registrations.length !== 3) throw new Error(`expected three slot injections, got ${registrations.length}`);
const slotNames = registrations.map(([slot]) => slot).sort();
if (slotNames[0] !== "conversation.session.header.actions" || slotNames[1] !== "settings.section" || slotNames[2] !== "sidebar.footer.action") throw new Error(`unexpected slots ${JSON.stringify(slotNames)}`);
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
const compactEntry = registrations.find(([slot]) => slot === "conversation.session.header.actions");
const compactDisposer = compactEntry[1]();
if (typeof compactDisposer !== "function") throw new Error("compact conversation slot registration must return a disposer");
const compactReg = registeredOptions.find((entry) => entry.options?.name === "conversation.session.header.actions");
if (compactReg === void 0) throw new Error("conversation.session.header.actions registration missing");
if (compactReg.options.id !== "usage-stats-compact-conversation") throw new Error(`compact conversation id ${compactReg.options.id}`);
if (typeof compactReg.component !== "function") throw new Error("compact conversation must mount a component");
console.log("apply ok, slots:", slotNames.join(", "));

// Data helpers against a synthetic wire payload.
const { activeDayKeyOf, filterDay, summarize, modelChoicesOf, recentDays, isPeak, fmtMoney, fmt, sidebarSummaryOf } = exports_;

// Build dates relative to today so the 14-day window assertions hold on any day.
const d0 = new Date();
const d1 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 1);
const keyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const TODAY_KEY = keyOf(d0);
const YESTERDAY_KEY = keyOf(d1);

if (activeDayKeyOf("yesterday", null, TODAY_KEY) !== YESTERDAY_KEY) throw new Error("yesterday range must resolve to yesterday's active chart day");
if (activeDayKeyOf("today", null, TODAY_KEY) !== TODAY_KEY) throw new Error("today range must resolve to today's active chart day");
if (activeDayKeyOf("custom", "2026-08-19", TODAY_KEY) !== "2026-08-19") throw new Error("custom range must retain its selected day");

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
const externalSidebarSummary = sidebarSummaryOf(
	{ ok: true, days: [wireDay], pricing: { currency: "CNY" } },
	{ ok: true, account: { windows: [{ kind: "weekly", remainingPercent: 78 }] } },
	{ ok: true, defaultKeyRef: "DEEPSEEK_API_KEY", status: { DEEPSEEK_API_KEY: { balanceAlertStatus: "ok", spendStatus: "warning" } } },
	undefined,
	"zai",
	"Z.ai"
);
if (externalSidebarSummary.providerLabel !== "Z.ai" || externalSidebarSummary.balanceStatus !== "muted" || externalSidebarSummary.todayStatus !== "muted") throw new Error(`sidebar provider selection ${JSON.stringify(externalSidebarSummary)}`);
const localSidebarSummary = sidebarSummaryOf(
	{ ok: true, days: [wireDay], pricing: { currency: "CNY" } },
	{ ok: true, account: { status: "unsupported", capabilities: ["plan_quota"] } },
	undefined,
	undefined,
	"xiaomi-token-plan-cn",
	"xiaomi-token-plan-cn",
	{ capabilities: ["plan_quota"] }
);
if (localSidebarSummary.kind !== "local_usage" || localSidebarSummary.todayInputTokens !== 300 || localSidebarSummary.todayOutputTokens !== 100) throw new Error(`local token sidebar summary ${JSON.stringify(localSidebarSummary)}`);
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
	for (const year of [2028, 2056]) {
		const edgeHeat = buildYearContributionHeatmap(new Map(), year);
		if (edgeHeat.weeks.length !== 53) throw new Error(`${year} contribution heatmap must not render a 54th column`);
		const cells = edgeHeat.weeks.flat();
		if (!cells.some((cell) => cell?.key === `${year}-01-01`) || !cells.some((cell) => cell?.key === `${year}-12-31`)) {
			throw new Error(`${year} contribution heatmap lost a year edge cell`);
		}
	}
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

//#region provider-grouped model breakdown
{
	const { providerOf, groupModelsByProvider } = exports_;
	if (!source.includes('S.providerGroup')) throw new Error("DayDetail must group models by provider");
	if (!source.includes('usage.providerDeepseek')) throw new Error("DayDetail must label the official DeepSeek provider");
	if (!source.includes('usage.notBilled')) throw new Error("DayDetail must mark non-billed providers");
	const grouped = groupModelsByProvider([
		{ model: "deepseek-official/deepseek-v4-flash", tokens: 100, cost: 4.0 },
		{ model: "zai-coding-cn/glm-5.2", tokens: 900, cost: null }
	]);
	if (grouped.length !== 2) throw new Error("groupModelsByProvider must split by provider");
	const deepseek = grouped.find((group) => group.provider === "deepseek-official");
	const glm = grouped.find((group) => group.provider === "zai-coding-cn");
	if (deepseek === void 0 || deepseek.tokens !== 100) throw new Error("deepseek group must sum its tokens");
	if (glm === void 0 || glm.tokens !== 900) throw new Error("glm group must sum its tokens");
	if (providerOf("deepseek-official/deepseek-v4-flash") !== "deepseek-official") throw new Error("providerOf must split the provider part");
	console.log("provider-grouped model breakdown ok");
}
//#endregion

console.log("\nclient smoke: all passed");
