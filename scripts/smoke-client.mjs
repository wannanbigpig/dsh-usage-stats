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
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));

// Fake primitives: every named export is a no-op component.
const Stub = () => null;
const primitives = new Proxy({
	Modal: ({ open, children }) => open ? jsxRuntime.jsx("div", { "data-test-modal": true, children }) : null
}, { get: (target, key) => target[key] ?? Stub });

let captured = null;
globalThis.window = { __ModuleLoader__: { load: (entry) => { captured = entry; } } };
globalThis.document = { querySelector: () => null, createElement: () => ({ dataset: {}, appendChild: () => {} }), head: { appendChild: () => {} } };

const source = readFileSync(join(projectRoot, "lib", "client.js"), "utf8");
// Endpoint contract: existing component call sites retain their logical paths,
// while fetchJson transports every request through the official Connection RPC.
if (!source.includes('fetchJson("/api/usage-stats/usage")')) throw new Error("client must fetch the usage endpoint");
if (!source.includes('fetchJson("/api/usage-stats/keys")')) throw new Error("client must fetch the keys endpoint");
if (!source.includes('fetchJson("/api/usage-stats/providers")')) throw new Error("client must fetch the providers endpoint");
if (!source.includes('fetchJson(`/api/usage-stats/balance${query}`)')) throw new Error("client must fetch the balance endpoint");
if (!source.includes('const balanceLoader = react.useRef(createLoader())')) throw new Error("balance requests must have a stale-response guard");
if (!source.includes('setBalance({ ok: false, message: error instanceof Error ? error.message : String(error) })')) throw new Error("balance failures must preserve an error payload");
if (source.includes("legacyParams")) throw new Error("non-official balance failures must not fall back to a DeepSeek-only balance request");
if (!source.includes('fetchJson("/api/usage-stats/limits")')) throw new Error("client must fetch the limits endpoint");
if (!source.includes('connectionRpc.call("/usage-stats", request.endpoint, request.payload, signal)')) throw new Error("client must transport usage requests through Connection RPC");
if (source.includes("await fetch(path, init)")) throw new Error("client must not keep the native fetch transport fallback");
if (!source.includes('name: "settings.section"')) throw new Error("client must register the settings.section slot");
if (!source.includes('width:920px') || !source.includes('Math.min(920, window.innerWidth - panelGutter * 2)')) throw new Error("query panel shell and viewport positioning must use the compact 920px width");
if ((source.match(/max-height:94vh/g) ?? []).length < 2) throw new Error("panel shell and scroll body must use the taller 94vh viewport budget");
if (!source.includes('max-width:calc(100vw - 48px);max-height:94vh') || !source.includes('.usg_panelBody{box-sizing:border-box;max-height:94vh') || source.includes('height:94vh;max-height:94vh') || source.includes('.usg_panelBody{box-sizing:border-box;height:100%')) throw new Error("panel height must remain content-driven under the 94vh ceiling");
if (!source.includes('const sectionRef = react.useRef(null)') || !source.includes('const [detailsMinHeight, setDetailsMinHeight] = react.useState(null)') || !source.includes('setDetailsMinHeight(Math.ceil(sectionRef.current.getBoundingClientRect().height))')) throw new Error("details tab must snapshot the overview section height before switching");
if (!source.includes('ref: sectionRef') || !source.includes('onClick: showDetails') || !source.includes('style: activeTab === "details" && detailsMinHeight !== null ? { minHeight: `${detailsMinHeight}px` } : void 0')) throw new Error("only the details tab may inherit the overview height snapshot");
if (!source.includes('border-radius:24px') || !source.includes('background:var(--dsw-alias-bg-layer-2)') || !source.includes('box-shadow:var(--dsw-shadow-lv3)')) throw new Error("query panel shell must follow the Harness elevated-surface tokens");
if (!source.includes("panel.tabSummary") || !source.includes("panel.tabOverview") || !source.includes("panel.tabDetails")) throw new Error("query panel must split into summary/overview/details tabs");
if (!source.includes('const [activeTab, setActiveTab] = react.useState("overview")')) throw new Error("query panel must open on the current-provider tab");
if (!source.includes('const usageProviderId = activeTab === "summary" ? null : selectedProviderId')) throw new Error("summary must request all providers while overview/details request the selected provider");
if (!source.includes('if (activeTab !== "summary" && !selectedProviderId) { setUsageLoading(false); return Promise.resolve(); }')) throw new Error("current-provider views must wait for the default provider and clear loading state");
if (!source.includes('setError(loadError instanceof Error ? loadError.message : String(loadError));') || !source.includes('setLoaded(true);\n\t\t\t\t});')) throw new Error("settings usage failures must release the limits loading gate");
if (!source.includes('"panel.tabSummary": "全部"') || !source.includes('"panel.tabOverview": "概览"') || !source.includes('"panel.tabSummary": "All"') || !source.includes('"panel.tabOverview": "Overview"')) throw new Error("provider scope tabs must use concise localized labels");
if ((source.match(/\.\.\.sumRows\(rows\), models: rows/g) ?? []).length < 1 || !source.includes('...summed, models: rows')) throw new Error("client-side provider/model fallback filters must preserve hourly model rows for tooltips");
if (!source.includes('"data-usage-summary": isSummaryTab')) throw new Error("summary workbench must expose its all-provider mode");
if (!source.includes('function ProviderUsageList') || !source.includes('translate("usage.modelUsage")')) throw new Error("summary rail must render a cross-provider model usage list");
if (!source.includes('"data-usage-provider-summary": true')) throw new Error("summary provider list must expose a stable DOM contract");
if (!source.includes('request request request') || !source.includes('.usg_providerUsageRequest{grid-area:request;white-space:nowrap}') || !source.includes('`${S.providerUsageMeta} ${S.providerUsageRequest}`')) throw new Error("summary request counts must use a dedicated non-wrapping row");
if (source.includes('onDayHover: setRangeHoveredDay')) throw new Error("multi-day hover must not resize the parent model list");
if (!source.includes('reservedModelCount') || !source.includes('data-usage-provider-placeholder')) throw new Error("summary model list must reserve a stable row capacity for the active range");
if (!source.includes('.usg_overviewWorkbench[data-usage-summary=true] .usg_insightRail{align-self:start;min-height:0}') || !source.includes('.usg_providerUsageList{display:flex;flex-direction:column;gap:7px}')) throw new Error("summary model usage rail must remain naturally sized without an internal scrollbar");
if (!source.includes('isSummaryTab ? react_jsx_runtime.jsx(ProviderUsageList')) throw new Error("summary rail must fill the account-card space with cross-provider model usage");
if (!source.includes('isSummaryTab ? null : react_jsx_runtime.jsx(BalanceCard')) throw new Error("summary must not render a selected-provider balance or plan card");
if (!source.includes('"data-usage-overview-workbench": true')) throw new Error("overview must expose the redesigned workbench layout");
if (!source.includes('"data-usage-activity-stage": true')) throw new Error("overview must promote hourly activity into the primary stage");
if (!source.includes('"data-usage-insight-rail": true')) throw new Error("overview must group account and summary metrics into an insight rail");
if (!source.includes('"data-usage-heat-strip": true')) throw new Error("overview must render yearly activity as a separate full-width strip");
if (!source.includes('.usg_overviewWorkbench{display:grid;grid-template-columns:minmax(0,1fr) 264px;grid-template-areas:\\\"activity rail\\\" \\\"heat heat\\\"')) throw new Error("overview must use an asymmetric two-column composition");
if (!source.includes('@media(max-width:840px){.usg_overviewWorkbench{grid-template-columns:1fr;grid-template-areas:\\\"activity\\\" \\\"rail\\\" \\\"heat\\\"}')) throw new Error("overview workbench must collapse deliberately on narrow screens without changing reading order");
if (!source.includes('.usg_activityStage{grid-area:activity') || !source.includes('background:var(--dsw-alias-bg-layer-3)')) throw new Error("primary activity stage must use a native Harness layer surface");
if (source.includes('.usg_headerMark{') || source.includes('className: S.headerMark')) throw new Error("panel header must keep the title text-only without an identity glyph");
if (!source.includes('.usg_header{position:sticky;top:-18px') || !source.includes('padding:0;background:var(--dsw-alias-bg-layer-2)')) throw new Error("panel header must use zero padding without duplicating the panel body's top spacing");
if (!source.includes('.usg_detailSummary{') || !source.includes('max-height:180px;overflow-y:auto;scrollbar-gutter:stable')) throw new Error("day model breakdown must stay height-bounded and internally scrollable");
if (!source.includes('.usg_providerGroup{grid-template-columns:repeat(2,minmax(0,1fr))') || !source.includes('@media(max-width:560px)') || !source.includes('.usg_providerGroup{grid-template-columns:1fr}')) throw new Error("model rows must use two columns on wide panels and one column on phones");
if (!source.includes('"usage.activityToday": "今日 Token"') || !source.includes('"usage.activityToday": "Tokens today"') || !source.includes('"usage.tokenUnit": "tokens"')) throw new Error("primary activity metric must be localized");
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
if (!source.includes('function providerDisplayStatus(status)')) throw new Error("provider remote failures must normalize through a display-status helper");
if (!source.includes('status === "invalid-response" || status === "timeout" ? "unavailable" : status')) throw new Error("provider invalid responses and timeouts must show as temporarily unavailable");
const accountsCardSource = source.slice(source.indexOf("function AccountsCard"), source.indexOf("function PricingCard"));
if (!accountsCardSource.includes('S.providerAccountIdentity') || !accountsCardSource.includes('S.providerAccountValues')) throw new Error("provider accounts must use distinct identity and right-aligned value columns");
if (!accountsCardSource.includes("planWindows.map")) throw new Error("provider accounts must render every plan quota window");
if (accountsCardSource.includes('"data-usage-window-progress": true')) throw new Error("provider account plan windows must render text without progress bars");
if (!accountsCardSource.includes("windowResetCountdownForItem(window, translate)") || !accountsCardSource.includes('children: `(${reset})`')) throw new Error("provider account plan windows must show compact reset status in parentheses");
if (!accountsCardSource.includes('translate("panel.balance")') || !accountsCardSource.includes('translate("accounts.today")')) throw new Error("DeepSeek account rows must label balance and today spend");
if (!accountsCardSource.includes('translate("balance.keyLimit")') || !accountsCardSource.includes('account?.keyLimit')) throw new Error("provider accounts must render OpenRouter ordinary-key limits separately from account balance");
if (!source.includes('translate("balance.managementKeyMissing")') || !source.includes('managementStatus')) throw new Error("OpenRouter must explain when Management Credits are not configured or unavailable");
if (!source.includes('status === "not-subscribed" ? translate("balance.status.subscriptionRequired")')) throw new Error("OpenCode Go entitlement failures must render as subscription-required");
if (!accountsCardSource.includes('translate("accounts.unsupported")')) throw new Error("unsupported provider accounts must show a concise unsupported label");
if (!accountsCardSource.includes('data-usage-visible-provider') || !accountsCardSource.includes('visibleProviderIds.length >= 3')) throw new Error("provider accounts must expose a selector capped at three visible providers");
if (!accountsCardSource.includes('visibleProviderIdsForView')) throw new Error("provider accounts must preserve an explicit selection below the three-provider maximum");
if (!source.includes('.usg_providerPicker>summary,.usg_providerPicker>summary *{cursor:pointer!important}')) throw new Error("provider picker summary must keep the pointer cursor across the whole clickable title");
if (!source.includes('.usg_providerPicker input[type=checkbox]{cursor:pointer!important}')) throw new Error("provider picker checkboxes must show the pointer cursor");
if (!source.includes('.usg_btnCompact{padding:3px 9px;border-radius:7px;font-size:12px;line-height:18px}')) throw new Error("account refresh action must use compact button sizing");
if (!accountsCardSource.includes('provider.accountUrl') || !accountsCardSource.includes('target: "_blank"')) throw new Error("web-only provider accounts must expose their fixed official query URL");
if (!accountsCardSource.includes('selectedProvider.extraCredentials') || !accountsCardSource.includes('type: "password"') || !accountsCardSource.includes('credential: { providerId: effectiveDefaultProviderId')) throw new Error("selected providers must render write-only extra credential fields");
if (!source.includes('function providerLogoOf')) throw new Error("provider balance card must expose provider branding");
if (!source.includes('function windowResetCountdownOf(value, translate, now = Date.now())')) throw new Error("plan quota reset times must be formatted as relative countdowns");
if (!source.includes('function windowResetDisplayOf(value, translate, now = Date.now())')) throw new Error("plan quota reset display must combine countdown and calendar time");
if (!source.includes('function windowResetValueOf(item)')) throw new Error("plan quota reset display must accept provider reset aliases");
if (!source.includes('function windowResetDisplayForItem(item, translate, now = Date.now())')) throw new Error("plan quota reset display must keep an empty five-hour bucket visible");
if (!source.includes('function windowResetCountdownForItem(item, translate, now = Date.now())')) throw new Error("compact account reset display must keep an empty five-hour bucket visible");
if (!source.includes('translate("balance.resetNotStarted")')) throw new Error("empty five-hour quota must explain that its reset timer has not started");
if (!source.includes('.usg_planQuotaWindowReset{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;text-align:right;padding-right:8px;font-variant-numeric:tabular-nums}')) throw new Error("plan quota reset rows must use a compact right-aligned muted style");
if (!source.includes('.usg_planName{') || !source.includes('background:var(--dsw-alias-bg-module-platform)') || !source.includes('font-size:14px') || !source.includes('text-transform:capitalize')) throw new Error("plan names must use a compact tier badge instead of the balance amount typography");
if (!source.includes('data-usage-plan-name') || !source.includes('providerKind === "plan_quota" ? S.planName : S.balanceAmount')) throw new Error("only plan providers may use the tier-name treatment");
if (!source.includes('.usg_balanceStatus{') || !source.includes('align-self:stretch') || !source.includes('data-usage-account-status')) throw new Error("long plan-account failures must use a full-width status row");
if (!source.includes('summary.accountStatus === "not-subscribed" ? t("balance.status.subscriptionRequired")')) throw new Error("unsubscribed plan providers must use the subscription-required label in the sidebar");
if (!source.includes('function animateNumberValue(from, to, progress)') || !source.includes('function useAnimatedNumber(value, duration = 500, animationKey = 0)') || !source.includes('function AnimatedNumber({ value, format, className')) throw new Error("changing numeric values must use the shared counting animation primitive");
if (!source.includes('function animationStartValue(current, target, replay)') || !source.includes('animationKey')) throw new Error("manual refresh must be able to replay numeric animation even when values are unchanged");
if (!source.includes('window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches')) throw new Error("numeric animation must respect reduced-motion preferences");
if (!source.includes('"data-usage-animated-number": true') || !source.includes('.usg_animatedNumber{display:inline-block;font-variant-numeric:tabular-nums}')) throw new Error("animated numeric values must expose a stable DOM marker and tabular digits");
if (!source.includes('className: S.activityValue, value: stats.todayTokens') || !source.includes('className: S.dayTokens, value: day.tokens') || !source.includes('className: S.statValue, value: stats.monthTokens') || !source.includes('className: S.balanceAmount, value: balancePrimaryValue') || !source.includes('value: summary.balanceValue') || !source.includes('value: summary.todayValue')) throw new Error("token and balance surfaces must use the shared numeric animation");
if (!source.includes('className: S.providerTokens, value: group.tokens, animationKey') || !source.includes('className: S.modelTokens, value: model.tokens, animationKey')) throw new Error("provider and model token rows must replay numeric animation after manual refresh");
if ((source.match(/animationKey: refreshTick/g) ?? []).length < 6) throw new Error("manual refresh tick must reach the overview numeric surfaces");
const providerLogoSource = source.slice(source.indexOf("function providerLogoOf"), source.indexOf("function pricingOf"));
if (!providerLogoSource.includes("primitives.FishLogo")) throw new Error("DeepSeek provider branding must reuse the Harness FishLogo primitive");
if (!providerLogoSource.includes('viewBox: "0 0 1024 1024"') || !providerLogoSource.includes('M422.43584 883.5072H71.68')) throw new Error("Z.ai provider branding must use the supplied official SVG geometry");
if (!providerLogoSource.includes('fill: "currentColor"')) throw new Error("inline provider SVG logos must inherit the black logo-seat foreground");
if (!providerLogoSource.includes("XIAOMI_MIMO_LOGO_DATA_URL") || !source.includes('const XIAOMI_MIMO_LOGO_DATA_URL = "data:image/jpeg;base64,')) throw new Error("Xiaomi MiMo provider branding must use the downloaded local image data");
if (!providerLogoSource.includes("OPENCODE_LOGO_DATA_URL") || !source.includes('const OPENCODE_LOGO_DATA_URL = "data:image/png;base64,')) throw new Error("OpenCode Go branding must use the bundled OpenCode image from token-monitor");
if (!providerLogoSource.includes('providerId === "moonshotai" || providerId === "moonshotai-cn"') || !providerLogoSource.includes('M117.9648 684.6464l342.30272 93.57312v75.34592')) throw new Error("Moonshot providers must use the supplied brand SVG");
if (!source.includes('.usg_providerLogoImage{display:block;width:100%;height:100%;object-fit:cover}')) throw new Error("raster provider logos must fill the provider logo seat");
if (!source.includes('.usg_balanceIcon[data-provider-id=moonshotai],.usg_balanceIcon[data-provider-id=moonshotai-cn]{color:#fff;background:#111}')) throw new Error("Moonshot icons must use a black brand seat");
if (!source.includes('.usg_balanceIcon[data-provider-id=deepseek-official],.usg_balanceIcon[data-provider-id=zai-coding-cn]{color:#fff;background:#111}')) throw new Error("SVG provider logos must use a white foreground on a black seat");
if (!source.includes('tokenMode ? `${fmt(hovered.tokens)} tokens`')) throw new Error("plan hourly chart must use token counts instead of money");
if (!source.includes('!tokenMode && visiblePeakHours.map')) throw new Error("plan and weekend hourly charts must hide peak-hour regions");
if (!source.includes('function isWeekendOffPeakDay')) throw new Error("client must recognize weekend off-peak days by Beijing date");
if (!source.includes('translate(weekendOffPeak ? "chart.weekendOffPeakNote" : "chart.peakNote")')) throw new Error("hourly chart must explain the weekend off-peak rule");
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
if (captured.id !== packageJson.name) throw new Error(`unexpected id ${captured.id}; expected ${packageJson.name}`);

const exports_ = captured.factory((spec) => {
	if (spec === "react") return react;
	if (spec === "react/jsx-runtime") return jsxRuntime;
	if (spec === "react-dom") return { createPortal: (node) => node };
	if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
	throw new Error(`unexpected require: ${spec}`);
});
const rpcCalls = [];
let rpcResponder = async (channel, endpoint, payload, signal) => {
	rpcCalls.push({ channel, endpoint, payload, signal });
	return { ok: true, value: { ok: true, endpoint } };
};
exports_.apply({
	connection: { rpc: { call: (...args) => rpcResponder(...args) } },
	effect: () => {},
	locale: { register: () => () => {}, bind: () => (key) => key },
	slots: { inject: () => () => {}, register: () => () => {} }
});

// A plugin hot reload can leave the previous style element in the document.
// The next factory run must refresh its text instead of leaving new classes unstyled.
{
	const previousDocument = globalThis.document;
	const staleStyle = { dataset: {}, textContent: "old client css" };
	globalThis.document = {
		...previousDocument,
		querySelector: (selector) => selector.startsWith("style[data-plugin-css=") ? staleStyle : null
	};
	captured.factory((spec) => {
		if (spec === "react") return react;
		if (spec === "react/jsx-runtime") return jsxRuntime;
		if (spec === "react-dom") return { createPortal: (node) => node };
		if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		throw new Error(`unexpected require: ${spec}`);
	});
	globalThis.document = previousDocument;
	if (!staleStyle.textContent.includes(".usg_modelNameCopyTip{position:fixed")) throw new Error("client hot reload must replace stale plugin CSS");
}

if (typeof exports_.apply !== "function") throw new Error("missing apply export");
if (typeof exports_.LimitsCard !== "function") throw new Error("missing LimitsCard export");
if (typeof exports_.UsageStatsPanel !== "function") throw new Error("missing UsageStatsPanel export");
if (typeof exports_.UsageBillingSettingsSection !== "function") throw new Error("missing UsageBillingSettingsSection export");
if (typeof exports_.openHarnessSettings !== "function") throw new Error("missing openHarnessSettings export");
if (typeof exports_.freshAlertsForProvider !== "function") throw new Error("missing provider-scoped alert selector export");
if (typeof exports_.pricingWritePayload !== "function") throw new Error("missing pricing write payload helper export");
const rpcMappings = [
	["/api/usage-stats/usage", "GET", undefined, "usage/get"],
	["/api/usage-stats/keys", "GET", undefined, "keys/list"],
	["/api/usage-stats/providers", "GET", undefined, "providers/list"],
	["/api/usage-stats/balance", "GET", undefined, "balance/get"],
	["/api/usage-stats/limits", "GET", undefined, "limits/get"],
	["/api/usage-stats/limits", "POST", {}, "limits/update"],
	["/api/usage-stats/accounts", "GET", undefined, "accounts/get"],
	["/api/usage-stats/accounts", "POST", {}, "accounts/update"],
	["/api/usage-stats/pricing", "GET", undefined, "pricing/get"],
	["/api/usage-stats/pricing", "POST", {}, "pricing/update"],
	["/api/usage-stats/alerts", "GET", undefined, "alerts/get"],
	["/api/usage-stats/alerts", "POST", {}, "alerts/update"],
	["/api/usage-stats/data", "GET", undefined, "data/get"],
	["/api/usage-stats/data", "POST", { action: "trim" }, "data/trim"],
	["/api/usage-stats/data", "POST", { action: "clear" }, "data/clear"],
	["/api/usage-stats/data", "POST", { action: "rebuild-estimated" }, "data/rebuild-estimated"]
];
for (const [path, method, body, expected] of rpcMappings) {
	const request = exports_.rpcRequestOf(path, { method, body });
	if (request.endpoint !== expected) throw new Error(`${method} ${path} must map to ${expected}, got ${request.endpoint}`);
}
if (!source.includes('new Set(["用量与计费", "Usage & Billing"])')) throw new Error("settings shortcut must select Usage & Billing");
if (!source.includes('"data.ledgerEntries": "近期精细记录"') || !source.includes('"data.ledgerEntries": "Recent detailed records"')) throw new Error("recent detailed record labels must be localized");
if (!source.includes('"data.ledgerCapacity": "近期记录上限"') || !source.includes('"data.ledgerCapacity": "Recent record limit"')) throw new Error("recent record limit labels must be localized");
if (!source.includes('"data.foldedCount": "已归档调用"') || !source.includes('"data.foldedCount": "Archived calls"')) throw new Error("exact archive labels must be localized");
if (!source.includes("冻结金额精确归档") || !source.includes("archived with their frozen exact costs")) throw new Error("exact frozen-cost archive explanation must be localized");
if (!source.includes("永久丢失逐调用") || !source.includes("permanently discards per-call")) throw new Error("capacity control must explain the irreversible per-call detail loss");
if (typeof exports_.ContributionHeatmap !== "function") throw new Error("missing ContributionHeatmap export");
if (typeof exports_.buildYearContributionHeatmap !== "function") throw new Error("missing buildYearContributionHeatmap export");
if (typeof exports_.chartTooltipAnchorStyle !== "function") throw new Error("missing chart tooltip anchor helper export");
if (typeof exports_.DayBarsChart !== "function") throw new Error("missing multi-day chart export");
if (source.includes(".usg_providerUsageList{max-height:220px;overflow-y:auto")) throw new Error("summary model list must not keep an internal vertical scrollbar");
const dayBarSource = source.slice(source.indexOf("function DayBarsChart"), source.indexOf("function DayList"));
if (dayBarSource.includes("onMouseLeave: () => setHoveredDay")) throw new Error("multi-day tooltip must not close when the pointer leaves its trigger bar");
if (!dayBarSource.includes("onDayHover") || !dayBarSource.includes("onDaySelect")) throw new Error("multi-day chart must expose date hover and selection callbacks");
if (!source.includes('const providerUsageDay = singleRange ? filteredActiveDay : focusedRangeDay') || !source.includes('reservedModelCount: providerUsageCapacity')) throw new Error("summary model list must follow the clicked multi-day date with a stable reserved height");
if (typeof exports_.chartUsesTokens !== "function") throw new Error("missing hourly chart token-mode policy export");
if (exports_.chartUsesTokens(false, "deepseek-official") !== false) throw new Error("official DeepSeek overview must retain cost-scaled charts");
if (exports_.chartUsesTokens(false, "zai-coding-cn") !== true) throw new Error("non-official provider overview must use token-scaled charts");
if (exports_.chartUsesTokens(true, "deepseek-official") !== true) throw new Error("all-provider summary must use token-scaled charts");
if (typeof exports_.isTruncatedTextNode !== "function") throw new Error("missing model-name overflow helper export");
if (typeof exports_.TruncatedModelName !== "function") throw new Error("missing overflow-aware model-name component export");
if (exports_.isTruncatedTextNode({ scrollWidth: 120, clientWidth: 120 })) throw new Error("fully visible model names must not show a tip");
if (!exports_.isTruncatedTextNode({ scrollWidth: 121, clientWidth: 120 })) throw new Error("truncated model names must show a tip");
if (typeof exports_.AccountsCard !== "function") throw new Error("missing AccountsCard export");
if (typeof exports_.PricingCard !== "function") throw new Error("missing PricingCard export");
if (typeof exports_.NotificationsCard !== "function") throw new Error("missing NotificationsCard export");
if (typeof exports_.DataCard !== "function") throw new Error("missing DataCard export");
if (typeof exports_.normalizeLedgerCapacity !== "function") throw new Error("missing ledger capacity validator export");
if (exports_.normalizeLedgerCapacity("100") !== 100 || exports_.normalizeLedgerCapacity(5000) !== 5000) throw new Error("ledger capacity boundaries must be accepted");
for (const value of [99, 5001, 100.5, "nope", ""]) if (exports_.normalizeLedgerCapacity(value) !== null) throw new Error(`invalid ledger capacity accepted: ${String(value)}`);
if (!Array.isArray(exports_.SETTINGS_TABS) || exports_.SETTINGS_TABS.length !== 4) throw new Error("SETTINGS_TABS must declare four settings tabs");
if (exports_.SETTINGS_TABS.some((tab) => tab.id === "pricing")) throw new Error("provider pricing must live under billing and limits, not a separate tab");
if (!source.includes('"data-usage-provider-billing-settings": true')) throw new Error("budget and limits must group provider-scoped limits and pricing");
if (!source.includes('"settings.tabLimits": "供应商用量与计费"') || !source.includes('"settings.tabLimits": "Provider Usage & Billing"')) throw new Error("billing tab must communicate provider scope");
if (!source.includes('"notifications.desc": "这里只配置所有供应商共用的告警输出通道')) throw new Error("notifications tab must explain its shared scope");
if (source.includes('translate("notifications.planQuota')) throw new Error("provider plan quota labels must live in the billing namespace");
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
if (source.includes("conversation.session.header.actions") || source.includes("usc-fold") || source.includes("data-usc-")) throw new Error("client must leave conversation folding to Harness");
if (!source.includes('react_jsx_runtime.jsxs("svg"')) throw new Error("refresh button must use SVG icon for reliable rotation");
if (!source.includes(".usg_hourTooltipHead{justify-content:space-between")) throw new Error("tooltip head must lay time and amount on one row");
if (!source.includes(".usg_hourTooltipAmount")) throw new Error("tooltip head must wrap the amount in a dedicated span");
if (!source.includes(".usg_hourTooltipModel span:first-child{min-width:0;flex:1;max-width:145px") || !source.includes(".usg_hourTooltipModel span:last-child{flex:none;white-space:nowrap")) throw new Error("tooltip model rows must keep the value column on one line");
if (!source.includes(".usg_hourTooltip{position:absolute") || !source.includes("pointer-events:auto")) throw new Error("hourly tooltip must accept pointer input for custom model-name tips");
if (!source.includes("function TruncatedModelName") || !source.includes("if (!isTruncatedTextNode(labelRef.current)) return")) throw new Error("model-name tips must render only when the visible label is actually truncated");
if ((source.match(/react_jsx_runtime\.jsx\(TruncatedModelName/g) ?? []).length < 4) throw new Error("all model-name surfaces must use the overflow-aware model-name label");
if (source.includes("cursor:help")) throw new Error("model-name tips must keep the normal mouse pointer");
if (source.includes("data-full-name") || source.includes(":hover::after")) throw new Error("model-name tips must not use non-selectable CSS generated content");
if (!source.includes(".usg_modelNameCopyTip{position:fixed") || !source.includes("pointer-events:auto;user-select:text;cursor:text")) throw new Error("model-name tips must be pointer-accessible and selectable for copying");
if (!source.includes('"data-usage-model-name-tip": true') || !source.includes("onMouseEnter: cancelClose") || !source.includes("onMouseLeave: scheduleClose")) throw new Error("model-name tips must stay open while the pointer moves into them");
if (!source.includes("transform:translate(-50%,-100%)")) throw new Error("model-name tips must appear above the hovered label");
if (!source.includes(".usg_hourRangeSelect{") || !source.includes("appearance:none")) throw new Error("hour range selector must be transparent and borderless");
if (!source.includes(".usg_hourRangeSelect:focus,.usg_hourRangeSelect:focus-visible{outline:none")) throw new Error("hour range selector must not show a blue focus border");
if (!source.includes(".usg_select:focus,.usg_select:focus-visible") || !source.includes(".usg_input:focus,.usg_input:focus-visible")) throw new Error("all plugin fields must suppress blue focus borders");
if (!source.includes('"data-loading": usageLoading || balanceLoading')) throw new Error("global refresh must reflect both usage and balance loading");
if (source.includes('function BalanceCard({ keys, selectedKey, onSelectKey, account, accountLoading, accountError, balanceTone = "muted", translate, onRefresh })')) throw new Error("balance card must not render a duplicate refresh action");
if (!source.includes("className: S.hourControls")) throw new Error("hourly range selector must share the header controls with date navigation");
if (!source.includes(".usg_hourRangeSelect{height:28px;color:var(--dsw-alias-label-secondary);background:transparent;border:0")) throw new Error("hourly range selector must not render a white bordered field");
if (!source.includes('"aria-label": translate("usage.year")')) throw new Error("heatmap must expose a year selector");
if (!source.includes('className: S.yearPicker') || !source.includes('.usg_yearPicker::after{') || !source.includes('.usg_yearSelect{appearance:none;-webkit-appearance:none')) throw new Error("heatmap year selection must use the compact custom picker treatment");
if (!source.includes("width:10px;height:10px")) throw new Error("heatmap must use compact square day cells");
if (!source.includes(".usg_contribGrid{grid-template-rows:16px repeat(7,10px);gap:5px;min-width:max-content;width:100%;justify-content:center;display:grid}")) throw new Error("heatmap must use the requested 5px gaps while centering the year grid");
if (!source.includes("onMouseEnter: (event) => setHoveredCell") || !source.includes("day.inputTokens") || !source.includes("day: entry?.day ?? entry ?? null")) throw new Error("heatmap cells must show full-day hover details");
if (!source.includes('"aria-label": title')) throw new Error("heatmap cells must retain an accessible label");
if (!source.includes(".usg_hourTooltip{")) throw new Error("hourly chart must define an interactive tooltip");
if (!source.includes('style: chartTooltipAnchorStyle(hovered.hour, 24)') || !source.includes('.usg_dayTooltip{position:fixed')) throw new Error("hourly tooltip must retain its chart anchor and multi-day tooltip must escape chart clipping");
if (source.includes('Math.min(72, 100 *')) throw new Error("chart tooltips must not use a fixed left clamp that can overflow their scroll viewport");
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
if ((source.match(/translate\("usage.requestCount"\), fmtRequestCount\(/g) ?? []).length < 3) throw new Error("all usage tooltips must show request counts");
if (!source.includes("Number(tokenMode ? hour.tokens : hour.cost)")) throw new Error("hourly bars must scale by cost or token count according to provider kind");
if (!source.includes("const inputWithCache = input + cache") || !source.includes("const inputShare = compositionTotal > 0")) throw new Error("hourly bars must include cache tokens in the visible input-side stack");
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
if (!source.includes(".usg_section{--usg-blue:var(--dsw-alias-state-business-primary,var(--dsw-static-deepseek-500,#4176e6));--usg-action:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#0f1115));")) throw new Error("panel must separate the Harness business accent from its monochrome action color");
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
if (!source.includes('.usg_usageLimitBanner{border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:7px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}')) throw new Error("usage banner must become a compact Harness module inside the insight rail");
if (!source.includes('.usg_usageLimitBanner strong{font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-secondary)}')) throw new Error("usage banner title must use the compact secondary label hierarchy");
if (!source.includes('.usg_usageLimitBanner:before{content:\\\"\\\";position:absolute;inset:auto 0 0;height:3px;background:var(--dsw-alias-border-l2);z-index:0}')) throw new Error("usage banner must render a neutral bottom track");
if (!source.includes('.usg_usageLimitBanner:after{content:\\\"\\\";position:absolute;inset:auto auto 0 0;width:var(--usage-progress,0%);height:3px;background:var(--dsw-alias-brand-primary);z-index:1}')) throw new Error("usage banner must render brand-token progress on the bottom track");
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
if (!source.includes("const committedLimitsRef = react.useRef(null)")) throw new Error("limits form must retain the last server-confirmed configuration for rollback");
if (!source.includes("limitsRef.current = next")) throw new Error("limits slider edits must update the synchronous save cache");
if (!source.includes("onPointerUp: () => handleSave({})") || !source.includes("onKeyUp: () => handleSave({})")) throw new Error("limits slider saves must read the latest edited thresholds");
const limitsSaveBlock = source.slice(source.indexOf("const handleSave = async"), source.indexOf("const currentStatus ="));
if (limitsSaveBlock.includes("setLimits(")) throw new Error("save responses must not overwrite the active form fields");
if (!limitsSaveBlock.includes("limitsRef.current = payload.limits")) throw new Error("save responses must update the latest limits cache");
if (!limitsSaveBlock.includes("committedLimitsRef.current = payload.limits") || !limitsSaveBlock.includes("rollbackToCommittedLimits()")) throw new Error("failed optimistic limit saves must restore the last server-confirmed configuration");
if (!source.includes("const rollbackToCommittedLimits = () =>") || !source.includes("setLimits(committed)")) throw new Error("limit rollback helper must restore the last server-confirmed configuration");
if (!source.includes("limitsRef.current ?? limits")) throw new Error("visible limit rules must derive from the saved cache so key switches show post-save values");
if (source.includes("if (!open) loadSummary();\n\t\t\t\t\t\t\t\tsetOpen")) throw new Error("opening the usage panel must not request its summary twice");
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
if (!source.includes('accountDisplayFields(display).map')) throw new Error("sidebar child display toggles must follow the provider-summary toggle");
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
if (!source.includes('body: { action: "fetch-official" }')) throw new Error("pricing card must request a server-side official pricing preview");
if (!source.includes('onClick: handleFetchOfficial') || !source.includes('pricing.fetchOfficial')) throw new Error("pricing card must expose the official pricing fetch action");
if (!source.includes('setDraft(draftOf(modelRowsOf(officialPreview)))')) throw new Error("official pricing must fill the editable draft only after confirmation");
if (!source.includes('pricing.confirmOfficial') || !source.includes('pricing.confirmOfficialDesc')) throw new Error("official pricing preview must require an explicit confirmation");
if (!source.includes('colSpan: 3')) throw new Error("pricing table must group peak/off-peak columns under a grouped header");
if (!source.includes('pricing.colMiss') || !source.includes('pricing.colHit')) throw new Error("pricing table must use concise column labels");
if (!source.includes('usingCustom ? translate("pricing.edit")')) throw new Error("pricing card must relabel the fork action to Edit when a custom scheme is active");
if (!source.includes('background:var(--usg-action)')) throw new Error("primary buttons must use the solid action palette");
if (!source.includes('.usg_btnDanger{background:')) throw new Error("danger buttons must use a solid error fill");
if (!source.includes("className: S.alertList")) throw new Error("notifications card must render the alert history list");
if (source.includes('run("rebuild")')) throw new Error("data card must not expose the server-side no-op rebuild action");
if (!source.includes('run("clear", { confirmation: confirmText.trim() })') || !source.includes('run("trim"')) throw new Error("data card must expose clear/trim actions with server-side clear confirmation");
if (source.includes('key: "path1"') || source.includes('key: "polyline1"')) throw new Error("refresh SVG keys must be passed through jsx runtime key arguments");
// Notification linkage: the sidebar delivers in-page toasts with a fixed
// five-second lifecycle, ignores pre-session history on first hydration,
// honors the sidebar channel on the status dot, and polls alerts.
if (!source.includes('const USAGE_TOAST_TOTAL_MS = 5000')) throw new Error("usage toast must have a five-second total lifecycle");
if (!source.includes('function UsageAlertToast')) throw new Error("notifications must render the plugin-owned usage toast");
if (!source.includes('notificationSessionStartedAtRef')) throw new Error("notifications must track the current page session start");
if (!source.includes('const sessionStartedAt = notificationSessionStartedAtRef.current') || !source.includes('itemAt < sessionStartedAt')) throw new Error("notifications must ignore alert history from before the page session");
if (!source.includes('deliverAlerts')) throw new Error("sidebar must deliver new alerts from the alerts poll");
if (!source.includes('Array.isArray(item.providerIds)') || !source.includes('providerIds.includes(currentProviderId)')) throw new Error("sidebar Toasts must follow the current provider");
if (!source.includes('notificationProviderRef.current !== currentProviderId')) throw new Error("provider changes must clear stale Toasts");
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
if (!source.includes('.usg_hourInput{background:var(--dsw-static-blue-500,#3b82f6)') || !source.includes('.usg_hourOutput{background:var(--dsw-static-green-500,#22c55e)')) throw new Error("hourly input/output bars must use Harness semantic palette tokens");
if (!source.includes('.usg_dayBar{width:72%;margin:0 auto;border-radius:3px 3px 0 0;background:var(--dsw-static-amber-500,#f59e0b)')) throw new Error("daily range bars must use the Harness amber token");
if (!source.includes('.usg_dayTrack{background:var(--dsw-alias-fill-l2);border-radius:3px;height:6px;flex:1;min-width:80px;overflow:hidden}') || !source.includes('.usg_dayValueBar{display:block;height:100%;border-radius:inherit;background:var(--usg-blue);opacity:.72}')) throw new Error("recent-day details must use a fixed track with a proportional fill");
if (!source.includes('className: S.dayTrack') || !source.includes('className: S.dayValueBar, style: { width: `${100 * (Number(day.tokens) || 0) / maxTokens}%` }')) throw new Error("recent-day detail values must scale inside their track");
if (!source.includes('color-mix(in srgb,var(--dsw-alias-state-business-primary) ${intensity}%,var(--usg-cellEmpty))')) throw new Error("heatmap intensity must follow the Harness business accent in both themes");
// Data card must be organized into plain-language groups.
if (!source.includes('translate("data.overview")') || !source.includes('translate("data.retentionGroup")') || !source.includes('translate("data.dangerGroup")')) throw new Error("data card must use plain-language group headings");
if (!source.includes('.usg_dataStatMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))') || !source.includes('.usg_dataStatRange{grid-template-columns:auto minmax(0,1fr)')) throw new Error("data overview must group three numeric metrics and give the date range its own row");
if (!source.includes('.usg_dataStatRangeValue{white-space:nowrap;text-align:right') || !source.includes('@media(max-width:560px)') || !source.includes('.usg_dataStatRange{grid-template-columns:1fr;gap:2px}')) throw new Error("data range must stay on one line when space allows and deliberately stack on narrow screens");
if (!source.includes('.usg_dataActionPanel{') || !source.includes('.usg_dataActionControls{') || !source.includes('.usg_dataDangerPanel{')) throw new Error("data retention and destructive actions must use structured action panels");

// Render the section in its default (loading) state.
const { UsageStatsSection, UsageStatsPanel, LimitsCard, UsageBillingSettingsSection, ProviderUsageList } = exports_;
const markup = renderToStaticMarkup(react.createElement(UsageStatsSection, { t: (key) => key }));
if (markup.length < 200) throw new Error(`section markup too small: ${markup.length}`);
if (!markup.includes("panel.title") && !markup.includes("用量统计")) throw new Error("section title missing");
if (!markup.includes("panel.tabSummary") || !markup.includes("panel.tabOverview") || !markup.includes("panel.tabDetails")) throw new Error("summary/overview/details tabs missing in markup");
if (markup.includes("limits.title")) throw new Error("quota configuration must be gone from the query panel");
console.log("render ok, markup length:", markup.length);

const summaryModelsMarkup = renderToStaticMarkup(react.createElement(ProviderUsageList, {
	day: {
		models: [
			{ model: "zai-coding-cn/glm-5.3", tokens: 900 },
			{ model: "deepseek-official/deepseek-v4-flash", tokens: 120 }
		]
	},
	providers: [{ id: "zai-coding-cn", displayName: "Z.ai Coding" }, { id: "deepseek-official", displayName: "DeepSeek" }],
	reservedModelCount: 4,
	translate: (key) => key
}));
if (!summaryModelsMarkup.includes('data-usage-provider-summary="true"') || !summaryModelsMarkup.includes("glm-5.3") || !summaryModelsMarkup.includes("deepseek-v4-flash")) throw new Error("summary model list must include models from every provider");
if (summaryModelsMarkup.indexOf("glm-5.3") > summaryModelsMarkup.indexOf("deepseek-v4-flash")) throw new Error("summary model list must rank models by token usage");
if ((summaryModelsMarkup.match(/data-usage-provider-placeholder="true"/g) ?? []).length !== 2) throw new Error("summary model list must reserve the remaining rows instead of changing its height");
console.log("all-provider summary model list ok");

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
if (!warningBalanceMarkup.includes('class="usg_balanceAmount"') || warningBalanceMarkup.includes('data-usage-plan-name')) throw new Error("DeepSeek balance typography must remain unchanged");
console.log("DeepSeek balance alert tone linkage render ok");

const openrouterKeyLimitMarkup = renderToStaticMarkup(react.createElement(exports_.BalanceCard, {
	keys: [],
	providers: [{ id: "openrouter", label: "OpenRouter", capabilities: ["key_limit", "balance"], managementConfigured: false }],
	selectedProviderId: "openrouter",
	selectedKey: null,
	account: { status: "ok", capabilities: ["key_limit", "balance"], managementStatus: "not-configured", keyLimit: { currency: "USD", limit: 100, remaining: 74.5, used: 25.5 } },
	accountLoading: false,
	accountError: null,
	translate: (key) => key
}));
if (!openrouterKeyLimitMarkup.includes('data-usage-key-limit="true"') || !openrouterKeyLimitMarkup.includes("balance.keyLimit")) throw new Error("OpenRouter balance card must render normal-key limits without Management Credits");
if (!openrouterKeyLimitMarkup.includes("balance.managementKeyMissing")) throw new Error("OpenRouter balance card must identify the missing optional Management Key");
console.log("OpenRouter split key-limit/credits render ok");

const unavailablePlanMarkup = renderToStaticMarkup(react.createElement(exports_.BalanceCard, {
	keys: [],
	providers: [{ id: "zai-coding-cn", label: "zai-coding-cn", capabilities: ["plan_quota"] }],
	selectedProviderId: "zai-coding-cn",
	selectedKey: null,
	account: { status: "invalid-response", capabilities: ["plan_quota"] },
	accountLoading: false,
	accountError: null,
	translate: (key) => key
}));
if (!unavailablePlanMarkup.includes("balance.status.unavailable") || unavailablePlanMarkup.includes("balance.status.ok")) throw new Error("invalid plan responses must render as unavailable, never realtime");
console.log("provider unavailable status render ok");

const livePlanMarkup = renderToStaticMarkup(react.createElement(exports_.BalanceCard, {
	keys: [],
	providers: [{ id: "zai-coding-cn", label: "zai-coding-cn", capabilities: ["plan_quota"] }],
	selectedProviderId: "zai-coding-cn",
	selectedKey: null,
	account: { status: "ok", capabilities: ["plan_quota"], planName: "lite", windows: [{ kind: "five_hour", remainingPercent: 100 }] },
	accountLoading: false,
	accountError: null,
	translate: (key) => key
}));
if (!livePlanMarkup.includes('class="usg_planName"') || !livePlanMarkup.includes('data-usage-plan-name="true"') || livePlanMarkup.includes('class="usg_balanceAmount"')) throw new Error("live plan cards must render the plan name with plan-only typography");

const unsubscribedOpenCodeMarkup = renderToStaticMarkup(react.createElement(exports_.BalanceCard, {
	keys: [],
	providers: [{ id: "opencode-go", label: "opencode-go", capabilities: ["plan_quota"] }],
	selectedProviderId: "opencode-go",
	selectedKey: null,
	account: { status: "not-subscribed", capabilities: ["plan_quota"] },
	accountLoading: false,
	accountError: null,
	translate: (key) => key
}));
if (!unsubscribedOpenCodeMarkup.includes("OpenCode Go balance.planSuffix")) throw new Error("OpenCode Go account cards must use the canonical brand name");
if (!unsubscribedOpenCodeMarkup.includes('class="usg_providerLogoImage"') || !unsubscribedOpenCodeMarkup.includes('alt="OpenCode"')) throw new Error("OpenCode Go account cards must render the bundled OpenCode logo");
if (!unsubscribedOpenCodeMarkup.includes('class="usg_balanceStatus"') || !unsubscribedOpenCodeMarkup.includes('data-usage-account-status="not-subscribed"')) throw new Error("OpenCode Go subscription failures must render below the identity row");
if (unsubscribedOpenCodeMarkup.includes('data-usage-plan-name') || unsubscribedOpenCodeMarkup.includes(">balance.plan<")) throw new Error("unsubscribed OpenCode Go cards must not render a fake Token Plan tier");

const moonshotMarkup = renderToStaticMarkup(react.createElement(exports_.BalanceCard, {
	keys: [],
	providers: [{ id: "moonshotai", label: "Moonshot AI", capabilities: ["balance"] }],
	selectedProviderId: "moonshotai",
	selectedKey: null,
	account: { status: "ok", capabilities: ["balance"], balance: { total: 12.34, toppedUp: 10, granted: 2.34, currency: "USD" } },
	accountLoading: false,
	accountError: null,
	translate: (key) => key
}));
if (!moonshotMarkup.includes('<svg') || !moonshotMarkup.includes('aria-label="Moonshot AI"') || !moonshotMarkup.includes('M117.9648 684.6464l342.30272 93.57312v75.34592')) throw new Error("Moonshot account cards must render the supplied SVG logo");
if ((moonshotMarkup.match(/data-usage-animated-number="true"/g) ?? []).length < 3) throw new Error("balance totals, topped-up and granted amounts must use numeric animation markers");

const localUsageMarkup = renderToStaticMarkup(react.createElement(exports_.BalanceCard, {
	keys: [],
	providers: [{ id: "xiaomi-token-plan-cn", label: "xiaomi-token-plan-cn", capabilities: ["local_usage"] }],
	selectedProviderId: "xiaomi-token-plan-cn",
	selectedKey: null,
	account: { status: "local", capabilities: ["local_usage"] },
	accountLoading: false,
	accountError: null,
	translate: (key) => key
}));
if (!localUsageMarkup.includes('class="usg_localProviderName"') || !localUsageMarkup.includes(">xiaomi-token-plan-cn<")) throw new Error("local-only cards must prioritize the provider name");
if (!localUsageMarkup.includes('class="usg_localUsageNote"') || !localUsageMarkup.includes(">balance.localOnly<")) throw new Error("local-only cards must explain their scope once");
if (localUsageMarkup.includes('class="usg_balanceMain"') || localUsageMarkup.includes('class="usg_badge"') || localUsageMarkup.includes(">balance.local<")) throw new Error("local-only cards must not repeat local stats as a large value and badge");

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

// Settings page hosts account, provider billing, notifications, and data tabs.
const tabsMarkup = renderToStaticMarkup(react.createElement(UsageBillingSettingsSection, { t: (key) => key }));
for (const tab of ["accounts", "limits", "notifications", "data"]) {
	if (!tabsMarkup.includes(`data-usage-billing-tab="${tab}"`)) throw new Error(`settings tab ${tab} missing`);
}
if (!tabsMarkup.includes("data-usage-accounts-card")) throw new Error("settings section must mount the accounts card by default");
console.log("settings four-tab navigation render ok");

const accountsMarkup = renderToStaticMarkup(react.createElement(exports_.AccountsCard, { keys: [{ id: "DEEPSEEK_API_KEY", label: "DEEPSEEK_API_KEY", configured: true }], translate: (key) => key }));
if (!accountsMarkup.includes("data-usage-accounts-card") || !accountsMarkup.includes("accounts.title")) throw new Error("accounts card render missing title/identity");
if (accountsMarkup.includes("sk-")) throw new Error("accounts card must not embed credentials");
if (JSON.stringify(exports_.accountDisplayFields({ balance: false, todayCost: true, statusDot: true }).map(([field]) => field)) !== JSON.stringify(["balance"])) throw new Error("summary-off state must hide today-spend and status-dot settings");
if (JSON.stringify(exports_.accountDisplayFields({ balance: true, todayCost: false, statusDot: false }).map(([field]) => field)) !== JSON.stringify(["balance", "todayCost", "statusDot"])) throw new Error("summary-on state must show both child settings without changing their saved values");
console.log("accounts card render ok, length:", accountsMarkup.length);

const compactProvidersMarkup = renderToStaticMarkup(react.createElement(exports_.AccountsCard, {
	providers: [
		{ id: "opencode-go", label: "OpenCode Go", queryable: true, capabilities: ["plan_quota"] },
		{ id: "deepseek-official", label: "DeepSeek", queryable: true, capabilities: ["balance"] },
		{ id: "xiaomi-token-plan-cn", label: "Xiaomi", queryable: false, capabilities: ["plan_quota"], accountUrl: "https://platform.xiaomimimo.com/console/plan-manage" },
		{ id: "opencode", label: "OpenCode Zen", queryable: false, capabilities: ["local_usage"], accountUrl: "https://opencode.ai/workspace/wrk_01KN1AVY46S9P0AQNE6GNGNQE0" }
	],
	defaultProviderId: "opencode-go",
	translate: (key) => key
}));
if ((compactProvidersMarkup.match(/data-usage-provider-account=/g) ?? []).length !== 3) throw new Error("account overview must render no more than three providers");
if (!compactProvidersMarkup.includes('href="https://platform.xiaomimimo.com/console/plan-manage"') || !compactProvidersMarkup.includes('target="_blank"')) throw new Error("web-only provider must render its official query link");
if (compactProvidersMarkup.includes('href="https://opencode.ai/auth"') || compactProvidersMarkup.includes('data-usage-web-query="opencode-go"')) throw new Error("OpenCode Go must not render a redundant web query link");
const xiaomiAccountStart = compactProvidersMarkup.indexOf('data-usage-provider-account="xiaomi-token-plan-cn"');
const xiaomiAccountEnd = compactProvidersMarkup.indexOf('data-usage-provider-account=', xiaomiAccountStart + 1);
const xiaomiAccountMarkup = compactProvidersMarkup.slice(xiaomiAccountStart, xiaomiAccountEnd < 0 ? compactProvidersMarkup.length : xiaomiAccountEnd);
if (!(xiaomiAccountMarkup.indexOf("accounts.unsupported") < xiaomiAccountMarkup.indexOf('data-usage-web-query="xiaomi-token-plan-cn"'))) throw new Error("web query links must render below the provider status");
if (!(compactProvidersMarkup.indexOf("accounts.refreshNow") < compactProvidersMarkup.indexOf('data-usage-default-provider-select="true"'))) throw new Error("manual account refresh must render above provider settings");
if (!compactProvidersMarkup.includes('data-usage-accounts-head="true"') || !compactProvidersMarkup.includes('class="usg_btn usg_btnCompact"')) throw new Error("manual account refresh must share the title row and use compact sizing");
if (compactProvidersMarkup.includes('data-usage-provider-account="opencode"')) throw new Error("the fourth provider must remain collapsed from the account overview");
console.log("compact provider selection and credential fields render ok");

const credentialProviderMarkup = renderToStaticMarkup(react.createElement(exports_.AccountsCard, {
	providers: [{ id: "openrouter", label: "OpenRouter", queryable: true, capabilities: ["balance"], extraCredentials: [{ id: "managementApiKey", ref: "OPENROUTER_MANAGEMENT_KEY", label: "Management API Key", configured: false }] }],
	defaultProviderId: "openrouter",
	translate: (key) => key
}));
if (!credentialProviderMarkup.includes('data-usage-provider-extra-credentials="openrouter"') || !credentialProviderMarkup.includes('type="password"')) throw new Error("default provider must render its additional write-only credential fields");

const visibleDirectory = ["deepseek-official", "moonshotai-cn", "opencode-go", "xiaomi-token-plan-cn", "zai-coding-cn"].map((id) => ({ id }));
if (JSON.stringify(exports_.visibleProviderIdsForView(visibleDirectory, ["deepseek-official", "moonshotai-cn"], "deepseek-official")) !== JSON.stringify(["deepseek-official", "moonshotai-cn"])) throw new Error("client must not refill a provider explicitly unchecked by the user");

const pricingMarkup = renderToStaticMarkup(react.createElement(exports_.PricingCard, { translate: (key) => key }));
if (!pricingMarkup.includes("data-usage-pricing-card") || !pricingMarkup.includes("pricing.title")) throw new Error("pricing card render missing title/identity");
if (!pricingMarkup.includes("pricing.fetchOfficial")) throw new Error("pricing card render missing official pricing fetch button");

console.log("pricing card render ok, length:", pricingMarkup.length);

// The official pricing flow must preview fetched values, then fill the editor
// only after the user confirms. It must not persist during fetch/confirmation.
{
	const { JSDOM } = require("jsdom");
	const previousGlobals = {
		window: globalThis.window,
		document: globalThis.document,
		HTMLElement: globalThis.HTMLElement,
		Event: globalThis.Event,
		MouseEvent: globalThis.MouseEvent,
		actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT
	};
	const previousRpcResponder = rpcResponder;
	const dom = new JSDOM('<!doctype html><div id="root"></div>');
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.Event = dom.window.Event;
	globalThis.MouseEvent = dom.window.MouseEvent;
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	const fetchedModels = {
		"deepseek-v4-flash": { offPeak: { inputMiss: 1.5, inputHit: 0.05, output: 4.5 }, peak: { inputMiss: 3, inputHit: 0.1, output: 9 } },
		"deepseek-v4-pro": { offPeak: { inputMiss: 4.5, inputHit: 0.15, output: 13.5 }, peak: { inputMiss: 9, inputHit: 0.3, output: 27 } },
		"deepseek-v4-flash-vision-exp": { offPeak: { inputMiss: 1.5, inputHit: 0.05, output: 4.5 }, peak: { inputMiss: 3, inputHit: 0.1, output: 9 } }
	};
	const requestBodies = [];
	rpcResponder = async (channel, endpoint, payload, signal) => {
		rpcCalls.push({ channel, endpoint, payload, signal });
		const body = payload.body ?? null;
		if (body !== null) requestBodies.push(body);
		const value = body?.action === "fetch-official"
			? { ok: true, candidate: { currency: "CNY", checkedAt: "2026-08-24T00:00:00.000Z", sourceUrl: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/", models: fetchedModels } }
			: { ok: true, current: { currency: "CNY", models: {} }, official: { currency: "CNY", models: {} }, usingCustom: false };
		return { ok: true, value };
	};
	const { createRoot } = require("react-dom/client");
	const { act } = react;
	const rootNode = dom.window.document.getElementById("root");
	const root = createRoot(rootNode);
	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
	await act(async () => { root.render(react.createElement(exports_.PricingCard, { translate: (key) => key })); await flush(); });
	const buttonByText = (text) => [...rootNode.querySelectorAll("button")].find((button) => button.textContent === text);
	await act(async () => { buttonByText("pricing.fetchOfficial").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await flush(); });
	if (rootNode.querySelector("[data-usage-official-pricing-preview]") === null || !rootNode.textContent.includes("deepseek-v4-flash-vision-exp") || !rootNode.textContent.includes("27")) throw new Error("official pricing fetch must show a complete confirmation preview");
	if (rootNode.querySelectorAll("input.usg_priceInput").length !== 0) throw new Error("official pricing fetch must not fill the editor before confirmation");
	await act(async () => { buttonByText("pricing.confirmOfficial").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await flush(); });
	const priceInputs = [...rootNode.querySelectorAll("input.usg_priceInput")];
	if (priceInputs.length !== 18 || !priceInputs.some((input) => input.value === "27")) throw new Error("confirming official pricing must fill all fetched model rates into the editor");
	if (requestBodies.length !== 1 || requestBodies[0].action !== "fetch-official") throw new Error("fetch and confirmation must not persist pricing automatically");
	await act(async () => { root.unmount(); await flush(); });
	dom.window.close();
	rpcResponder = previousRpcResponder;
	for (const [key, value] of Object.entries(previousGlobals)) {
		if (key === "actEnvironment") globalThis.IS_REACT_ACT_ENVIRONMENT = value;
		else globalThis[key] = value;
	}
	console.log("official pricing confirmation flow ok");
}

// The data card must expose the estimated-history rebuild and, when the host
// refused to read sessions written by a newer harness build, surface the
// skipped count instead of staying silent about the undercount.
{
	const { JSDOM } = require("jsdom");
	const previousGlobals = {
		window: globalThis.window,
		document: globalThis.document,
		HTMLElement: globalThis.HTMLElement,
		Event: globalThis.Event,
		MouseEvent: globalThis.MouseEvent,
		actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT
	};
	const previousRpcResponder = rpcResponder;
	const dom = new JSDOM('<!doctype html><div id="root"></div>');
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.Event = dom.window.Event;
	globalThis.MouseEvent = dom.window.MouseEvent;
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	let rebuildPreview = { unreadableSessions: 2, sessionCount: 5, eventCount: 12, days: {} };
	rpcResponder = async (channel, endpoint, payload) => {
		const body = payload.body ?? null;
		if (body?.action === "rebuild-estimated") {
			return { ok: true, value: { ok: true, rebuilt: true, dryRun: false, preview: rebuildPreview } };
		}
		return { ok: true, value: { ok: true, info: { ledgerEntries: 3, ledgerCapacity: 1000, foldedCount: 1 } } };
	};
	const { createRoot } = require("react-dom/client");
	const { act } = react;
	const dict = { "data.rebuildSkipped": "skipped {count} sessions" };
	const translate = (key) => dict[key] ?? key;
	const rootNode = dom.window.document.getElementById("root");
	const root = createRoot(rootNode);
	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
	await act(async () => { root.render(react.createElement(exports_.DataCard, { translate })); await flush(); });
	const buttonByText = (text) => [...rootNode.querySelectorAll("button")].find((button) => button.textContent === text);
	const rebuildButton = buttonByText("data.rebuild");
	if (rebuildButton === undefined) throw new Error("data card must expose an estimated-history rebuild action");
	await act(async () => { rebuildButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await flush(); });
	if (!rootNode.textContent.includes("skipped 2 sessions")) {
		throw new Error("a rebuild that skipped unreadable sessions must surface the skipped count");
	}
	if (rootNode.textContent.includes("data.trimmed")) throw new Error("a rebuild must not be reported as a retention trim");
	await act(async () => { root.unmount(); await flush(); });

	rebuildPreview = { unreadableSessions: 0, sessionCount: 5, eventCount: 12, days: {} };
	const root2 = createRoot(rootNode);
	await act(async () => { root2.render(react.createElement(exports_.DataCard, { translate })); await flush(); });
	const rebuildButton2 = buttonByText("data.rebuild");
	await act(async () => { rebuildButton2.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await flush(); });
	if (!rootNode.textContent.includes("data.rebuilt") || rootNode.textContent.includes("data.rebuildSkipped")) {
		throw new Error("a rebuild without skipped sessions must report success without the skip hint");
	}
	await act(async () => { root2.unmount(); await flush(); });
	dom.window.close();
	rpcResponder = previousRpcResponder;
	for (const [key, value] of Object.entries(previousGlobals)) {
		if (key === "actEnvironment") globalThis.IS_REACT_ACT_ENVIRONMENT = value;
		else globalThis[key] = value;
	}
	console.log("data card rebuild flow with skipped-session hint ok");
}

// Model-name tips must be absent for fully visible labels, appear only after
// real overflow, remain open while entering the tip, and expose selectable text.
{
	const { JSDOM } = require("jsdom");
	const previousGlobals = {
		window: globalThis.window,
		document: globalThis.document,
		HTMLElement: globalThis.HTMLElement,
		Event: globalThis.Event,
		MouseEvent: globalThis.MouseEvent,
		actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT
	};
	const dom = new JSDOM('<!doctype html><div id="root"></div>');
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.Event = dom.window.Event;
	globalThis.MouseEvent = dom.window.MouseEvent;
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	const domExports = captured.factory((spec) => {
		if (spec === "react") return react;
		if (spec === "react/jsx-runtime") return jsxRuntime;
		if (spec === "react-dom") return { createPortal: (node) => node };
		if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		throw new Error(`unexpected require: ${spec}`);
	});
	const { createRoot } = require("react-dom/client");
	const { act } = react;
	const rootNode = dom.window.document.getElementById("root");
	const root = createRoot(rootNode);
	const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
	await act(async () => { root.render(react.createElement(domExports.TruncatedModelName, { value: "deepseek-v4-flash-vision-exp" })); await flush(); });
	const label = rootNode.querySelector("span");
	Object.defineProperties(label, {
		clientWidth: { configurable: true, value: 120 },
		scrollWidth: { configurable: true, value: 120 }
	});
	label.getBoundingClientRect = () => ({ left: 100, right: 220, top: 80, bottom: 97, width: 120, height: 17 });
	await act(async () => { label.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true, clientX: 150 })); await flush(); });
	if (rootNode.querySelector("[data-usage-model-name-tip]") !== null) throw new Error("fully visible model names must not render a tip");
	Object.defineProperty(label, "scrollWidth", { configurable: true, value: 220 });
	await act(async () => {
		label.dispatchEvent(new dom.window.MouseEvent("mouseout", { bubbles: true, relatedTarget: dom.window.document.body }));
		await flush(190);
		label.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true, clientX: 150 }));
		await flush();
	});
	const tip = rootNode.querySelector("[data-usage-model-name-tip]");
	if (tip === null || tip.textContent !== "deepseek-v4-flash-vision-exp" || tip.style.top !== "74px") throw new Error("truncated model names must render their full name above the label");
	const tipStyle = dom.window.getComputedStyle(tip);
	if (tipStyle.position !== "fixed" || tipStyle.userSelect !== "text" || tipStyle.cursor !== "text") throw new Error("model-name tip must compute as an interactive fixed overlay");
	await act(async () => {
		label.dispatchEvent(new dom.window.MouseEvent("mouseout", { bubbles: true, relatedTarget: tip }));
		tip.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true, relatedTarget: label }));
		await flush(220);
	});
	if (rootNode.querySelector("[data-usage-model-name-tip]") === null) throw new Error("model-name tip must remain open while the pointer enters it");
	const selection = dom.window.getSelection();
	const range = dom.window.document.createRange();
	range.selectNodeContents(tip);
	selection.removeAllRanges();
	selection.addRange(range);
	if (selection.toString() !== "deepseek-v4-flash-vision-exp") throw new Error("model-name tip text must be selectable for copying");
	await act(async () => { root.unmount(); await flush(); });
	dom.window.close();
	for (const [key, value] of Object.entries(previousGlobals)) {
		if (key === "actEnvironment") globalThis.IS_REACT_ACT_ENVIRONMENT = value;
		else globalThis[key] = value;
	}
console.log("overflow-aware selectable model-name tip ok");
}

// Multi-day charts must preserve the selected metric, keep their portal tip
// open when the pointer enters it, and expose date focus to the parent.
{
	const multiRangeDays = [
		{ date: "2026-08-25", tokens: 100, cost: 1, inputTokens: 80, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, models: [] },
		{ date: "2026-08-26", tokens: 10, cost: 4, inputTokens: 8, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, models: [] }
	];
	const buttonMarkupOf = (markup, date) => {
		const start = markup.indexOf(`data-day="${date}"`);
		const end = markup.indexOf("</button>", start);
		return start < 0 || end < 0 ? "" : markup.slice(start, end + 9);
	};
	const costBars = renderToStaticMarkup(react.createElement(exports_.DayBarsChart, { rangeDays: multiRangeDays, tokenMode: false, money: String, translate: (key) => key }));
	if (!buttonMarkupOf(costBars, "2026-08-25").includes("height:25%") || !buttonMarkupOf(costBars, "2026-08-26").includes("height:100%")) throw new Error("official DeepSeek multi-day bars must scale by cost");
	const tokenBars = renderToStaticMarkup(react.createElement(exports_.DayBarsChart, { rangeDays: multiRangeDays, tokenMode: true, money: String, translate: (key) => key }));
	if (!buttonMarkupOf(tokenBars, "2026-08-25").includes("height:100%") || !buttonMarkupOf(tokenBars, "2026-08-26").includes("height:10%")) throw new Error("token-mode multi-day bars must scale by tokens");

	const { JSDOM } = require("jsdom");
	const previousGlobals = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement, Event: globalThis.Event, MouseEvent: globalThis.MouseEvent, actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT };
	const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.Event = dom.window.Event;
	globalThis.MouseEvent = dom.window.MouseEvent;
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	const originalRectOf = dom.window.HTMLElement.prototype.getBoundingClientRect;
	dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
		if (this.getAttribute("data-day") === "2026-08-26") return { left: 320, top: 300, right: 360, bottom: 420, width: 40, height: 120 };
		if (this.getAttribute("data-usage-day-tooltip") === "true") {
			const top = Number.parseInt(this.style.top, 10) || 0;
			return { left: Number.parseInt(this.style.left, 10) || 0, top, right: top + 230, bottom: top + 140, width: 230, height: 140 };
		}
		return originalRectOf.call(this);
	};
	const domExports = captured.factory((spec) => {
		if (spec === "react") return react;
		if (spec === "react/jsx-runtime") return jsxRuntime;
		if (spec === "react-dom") return require("react-dom");
		if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		throw new Error(`unexpected require: ${spec}`);
	});
	const { createRoot } = require("react-dom/client");
	const { act } = react;
	const root = createRoot(dom.window.document.getElementById("root"));
	const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
	const hovered = [];
	const selected = [];
	await act(async () => { root.render(react.createElement(domExports.DayBarsChart, { rangeDays: multiRangeDays, tokenMode: true, money: String, translate: (key) => key, onDayHover: (date) => hovered.push(date), onDaySelect: (date) => selected.push(date) })); await flush(); });
	const bar = dom.window.document.querySelector('[data-day="2026-08-26"]');
	await act(async () => { bar.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true })); await flush(); });
	const tooltip = dom.window.document.querySelector('[data-usage-day-tooltip]');
	if (tooltip === null) throw new Error("multi-day bar hover must create a tooltip");
	const tooltipTop = Number.parseInt(tooltip.style.top, 10);
	if (!(tooltipTop + 140 <= 300 || tooltipTop >= 420)) throw new Error("multi-day tooltip must avoid covering its trigger bar");
	await act(async () => { bar.dispatchEvent(new dom.window.MouseEvent("mouseout", { bubbles: true, relatedTarget: tooltip })); tooltip.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true, relatedTarget: bar })); await flush(220); });
	if (dom.window.document.querySelector('[data-usage-day-tooltip]') === null || hovered.at(-1) !== "2026-08-26") throw new Error("multi-day tooltip must stay open while the pointer enters it");
	await act(async () => { bar.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); await flush(); });
	if (selected.at(-1) !== "2026-08-26") throw new Error("multi-day bar clicks must report the selected date");
	await act(async () => { root.unmount(); await flush(); });
	dom.window.close();
	for (const [key, value] of Object.entries(previousGlobals)) {
		if (key === "actEnvironment") globalThis.IS_REACT_ACT_ENVIRONMENT = value;
		else globalThis[key] = value;
	}
	console.log("multi-day chart interaction and metric mode ok");
}

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
if (!dataMarkup.includes('data-usage-data-metrics="true"') || !dataMarkup.includes('data-usage-data-range="true"')) throw new Error("data card must separate numeric metrics from the date-range row");
if (!dataMarkup.includes('data-usage-retention-panel="true"') || !dataMarkup.includes('data-usage-danger-panel="true"')) throw new Error("data card action groups must expose the redesigned layout");
if (!dataMarkup.includes('data-usage-ledger-capacity-control="true"') || !dataMarkup.includes('min="100"') || !dataMarkup.includes('max="5000"') || !dataMarkup.includes('step="100"')) throw new Error("data card must render the editable 100-5000 ledger capacity control with a 100-record step");
console.log("data card render ok, length:", dataMarkup.length);

const countdownNow = Date.UTC(2026, 7, 21, 0, 0, 0);
const durationTranslate = (key, params = {}) => ({
	"balance.resetSoon": "即将重置",
	"duration.day": `${params.value}天`,
	"duration.hour": `${params.value}小时`,
	"duration.minute": `${params.value}分钟`
}[key] ?? key);
if (exports_.windowResetCountdownOf(countdownNow + 143 * 60000, durationTranslate, countdownNow) !== "2小时 23分钟") throw new Error("five-hour reset countdown formatting mismatch");
if (exports_.windowResetCountdownOf(countdownNow + (6 * 1440 + 143) * 60000, durationTranslate, countdownNow) !== "6天 2小时 23分钟") throw new Error("weekly reset countdown formatting mismatch");
const resetAt = new Date("2026-08-21T02:23:00Z");
const pad = (part) => String(part).padStart(2, "0");
const localResetTime = `${pad(resetAt.getMonth() + 1)}/${pad(resetAt.getDate())} ${pad(resetAt.getHours())}:${pad(resetAt.getMinutes())}`;
if (exports_.windowResetDisplayOf(resetAt.toISOString(), durationTranslate, countdownNow) !== `2小时 23分钟 (${localResetTime})`) throw new Error("plan quota reset display must include countdown and local calendar time");
if (exports_.windowResetDisplayForItem({ kind: "five_hour", remainingPercent: 100 }, (key) => key === "balance.resetNotStarted" ? "尚未开始" : key, countdownNow) !== "尚未开始") throw new Error("empty five-hour quota must show an explicit not-started state");
if (exports_.windowResetCountdownForItem({ kind: "five_hour", remainingPercent: 100 }, (key) => key === "balance.resetNotStarted" ? "尚未开始" : key, countdownNow) !== "尚未开始") throw new Error("compact empty five-hour quota must show an explicit not-started state");
console.log("plan quota reset countdown formatting ok");

// Apply against a stub client context: one native sidebar footer action and
// one settings.section entry.
const registrations = [];
const registeredOptions = [];
rpcResponder = async (channel, endpoint, payload, signal) => {
	rpcCalls.push({ channel, endpoint, payload, signal });
	return { ok: true, value: { ok: true, endpoint } };
};
const ctx = {
	effect: () => {},
	connection: {
		rpc: {
			call: (...args) => rpcResponder(...args)
		}
	},
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
if (!exports_.inject.includes("connection")) throw new Error("client must require the official connection service");

const usageResult = await exports_.fetchJson("/api/usage-stats/usage?provider=deepseek");
if (usageResult.endpoint !== "usage/get") throw new Error("usage RPC success payload must be unwrapped");
let rpcCall = rpcCalls.at(-1);
if (rpcCall.channel !== "/usage-stats" || rpcCall.endpoint !== "usage/get") throw new Error("usage path must map to usage/get");
if (rpcCall.payload.query.provider !== "deepseek" || Object.hasOwn(rpcCall.payload, "body")) throw new Error("GET query must map into the RPC payload");
if (!(rpcCall.signal instanceof AbortSignal)) throw new Error("every RPC call must receive a timeout signal");

await exports_.fetchJson("/api/usage-stats/limits", { method: "POST", body: { global: { enabled: true } } });
rpcCall = rpcCalls.at(-1);
if (rpcCall.endpoint !== "limits/update" || rpcCall.payload.body.global.enabled !== true) throw new Error("POST body must map to the update RPC endpoint");

await exports_.fetchJson("/api/usage-stats/data", { method: "POST", body: { action: "clear" } });
if (rpcCalls.at(-1).endpoint !== "data/clear") throw new Error("data clear action must map to data/clear");
await exports_.fetchJson("/api/usage-stats/data", { method: "POST", body: { action: "rebuild" } });
if (rpcCalls.at(-1).endpoint !== "data/rebuild-estimated") throw new Error("data rebuild action must map to data/rebuild-estimated");

rpcResponder = async () => ({ ok: false, error: { code: "bad-request", message: "invalid range", details: { issues: [] } } });
await exports_.fetchJson("/api/usage-stats/data").then(
	() => { throw new Error("failed RpcResult must reject"); },
	(error) => { if (error.message !== "invalid range") throw error; }
);

const abort = new AbortController();
rpcResponder = async (channel, endpoint, payload, signal) => new Promise((resolve, reject) => {
	rpcCalls.push({ channel, endpoint, payload, signal });
	signal.addEventListener("abort", () => reject(signal.reason), { once: true });
});
const pending = exports_.fetchJson("/api/usage-stats/keys", { signal: abort.signal });
abort.abort(new DOMException("cancelled", "AbortError"));
await pending.then(
	() => { throw new Error("aborted RPC call must reject"); },
	(error) => { if (error.name !== "AbortError") throw error; }
);
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
const { activeDayKeyOf, filterDay, summarize, modelChoicesOf, recentDays, isPeak, isWeekendOffPeakDay, fmtMoney, fmt, sidebarSummaryOf, animateNumberValue, animationStartValue, settingsNavMutationRelevant } = exports_;
const unrelatedMutation = [{ type: "characterData", target: { closest: () => null } }];
if (settingsNavMutationRelevant(unrelatedMutation)) throw new Error("unrelated body mutations must not trigger plugin scans");
const navNode = { nodeType: 1, matches: (selector) => selector === "button,a,[role=button], [data-usage-stats-trigger]", querySelector: () => null };
if (!settingsNavMutationRelevant([{ type: "childList", addedNodes: [navNode], removedNodes: [] }])) throw new Error("navigation mutations must trigger icon synchronization");
const nullBalanceMarkup = renderToStaticMarkup(exports_.BalanceCard({
	keys: [],
	providers: [{ id: "deepseek-official", capabilities: ["balance"], label: "DeepSeek" }],
	selectedProviderId: "deepseek-official",
	selectedKey: null,
	onSelectKey: () => {},
	account: null,
	accountLoading: false,
	accountError: null,
	translate: (key) => key,
	onRetry: () => {}
}));
if (nullBalanceMarkup.includes("¥0.00")) throw new Error("null balance must not render as ¥0.00");
if (animateNumberValue(0, 100, 0) !== 0 || animateNumberValue(0, 100, 1) !== 100 || animateNumberValue(0, 100, 0.5) !== 87.5 || animateNumberValue(100, 0, 2) !== 0) throw new Error("numeric interpolation must ease between the current and next values without overshoot");
if (animationStartValue(678350, 678350, false) !== 678350 || animationStartValue(678350, 678350, true) !== 0 || animationStartValue(25, 100, true) !== 0) throw new Error("manual numeric replay must restart from zero while ordinary updates continue from the displayed value");

const earlyTooltipAnchor = exports_.chartTooltipAnchorStyle(6, 24);
const lateTooltipAnchor = exports_.chartTooltipAnchorStyle(17, 24);
if (earlyTooltipAnchor.left !== `${100 * 6.5 / 24}%` || Object.hasOwn(earlyTooltipAnchor, "right")) throw new Error("early chart tooltips must anchor from the left");
if (Math.abs(Number.parseFloat(lateTooltipAnchor.right) - 100 * 6.5 / 24) > 1e-12 || Object.hasOwn(lateTooltipAnchor, "left")) throw new Error("late chart tooltips must anchor from the right");

const alertSeen = new Set();
const providerBAlert = { at: 200, type: "alert", event: "warning", keyRef: "K", status: "warning", providerIds: ["provider-b"], message: "B" };
const hiddenForA = exports_.freshAlertsForProvider([providerBAlert], {}, "provider-a", alertSeen, 100, (key) => key);
if (hiddenForA.length !== 0 || alertSeen.size !== 0) throw new Error("alerts for another provider must not be consumed by the dedup set");
const visibleForB = exports_.freshAlertsForProvider([providerBAlert], {}, "provider-b", alertSeen, 100, (key) => key);
if (visibleForB.length !== 1 || alertSeen.size !== 1) throw new Error("an alert must remain deliverable after switching to its provider");

const pricingPayload = exports_.pricingWritePayload({ peakHours: [[1, 2]], weekendOffPeakFrom: "2030-01-01", windows: [{ start: "01:00", end: "02:00", tier: "peak" }], pricing: { model: { inputMiss: 99 } } }, "CNY", { model: { offPeak: { inputMiss: 1 } } });
if (JSON.stringify(pricingPayload.peakHours) !== "[[1,2]]" || pricingPayload.weekendOffPeakFrom !== "2030-01-01" || pricingPayload.windows.length !== 1) throw new Error("pricing saves must preserve the active schedule metadata");
if (Object.hasOwn(pricingPayload, "pricing") || pricingPayload.models.model.offPeak.inputMiss !== 1) throw new Error("pricing saves must not let the legacy read shape overwrite edited versioned rates");

const chartHours = Array.from({ length: 24 }, (_, hour) => ({ hour, tokens: 0, cost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, models: [] }));
const weekendChartMarkup = renderToStaticMarkup(react.createElement(exports_.HourlyChart, {
	day: { date: "2026-08-23", hours: chartHours },
	peakHours: [[9, 12], [14, 18]],
	weekendOffPeakFrom: "2026-08-23",
	money: String,
	translate: (key) => key
}));
if (weekendChartMarkup.includes("data-peak-region")) throw new Error("weekend hourly chart must not render peak regions");
if (!weekendChartMarkup.includes("chart.weekendOffPeakNote")) throw new Error("weekend hourly chart must render its off-peak note");
const weekdayChartMarkup = renderToStaticMarkup(react.createElement(exports_.HourlyChart, {
	day: { date: "2026-08-24", hours: chartHours },
	peakHours: [[9, 12], [14, 18]],
	weekendOffPeakFrom: "2026-08-23",
	money: String,
	translate: (key) => key
}));
if ((weekdayChartMarkup.match(/data-peak-region/g) ?? []).length !== 2) throw new Error("weekday hourly chart must render both peak regions");
if (!weekdayChartMarkup.includes("chart.peakNote")) throw new Error("weekday hourly chart must render its peak note");

const cacheOnlyHours = Array.from({ length: 24 }, (_, hour) => ({
	hour,
	tokens: hour === 9 ? 100 : 0,
	cost: 0,
	inputTokens: 0,
	outputTokens: 0,
	cacheReadTokens: hour === 9 ? 100 : 0,
	cacheWriteTokens: 0,
	models: []
}));
const cacheOnlyChartMarkup = renderToStaticMarkup(react.createElement(exports_.HourlyChart, {
	day: { date: "2026-08-26", hours: cacheOnlyHours },
	tokenMode: true,
	money: String,
	translate: (key) => key
}));
const cacheOnlyHourMarkup = cacheOnlyChartMarkup.match(/data-hour="9"[\s\S]*?<\/button>/)?.[0] ?? "";
if (!cacheOnlyHourMarkup.includes('class="usg_hourInput" style="flex-basis:100%"')) throw new Error("cache-only hourly usage must render a visible input-side bar");

// Build dates relative to today so the 14-day window assertions hold on any day.
const d0 = new Date();
const d1 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 1);
const keyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const TODAY_KEY = keyOf(d0);
const YESTERDAY_KEY = keyOf(d1);

if (activeDayKeyOf("yesterday", null, TODAY_KEY) !== YESTERDAY_KEY) throw new Error("yesterday range must resolve to yesterday's active chart day");
if (activeDayKeyOf("today", null, TODAY_KEY) !== TODAY_KEY) throw new Error("today range must resolve to today's active chart day");
if (activeDayKeyOf("custom", "2026-08-19", TODAY_KEY) !== "2026-08-19") throw new Error("custom range must retain its selected day");
if (!source.includes('disabled: recentList.length === 0 || activeDayKey <= recentList[recentList.length - 1].date')) throw new Error("previous-day navigation must disable at the oldest day");
if (!source.includes('disabled: recentList.length === 0 || activeDayKey >= recentList[0].date')) throw new Error("next-day navigation must disable at the newest day");

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
const unsubscribedPlanSidebarSummary = sidebarSummaryOf(
	{ ok: true, days: [wireDay], pricing: { currency: "CNY" } },
	{ ok: true, account: { status: "not-subscribed", capabilities: ["plan_quota"] } },
	undefined,
	undefined,
	"opencode-go",
	"opencode-go",
	{ capabilities: ["plan_quota"] }
);
if (unsubscribedPlanSidebarSummary.accountStatus !== "not-subscribed") throw new Error(`unsubscribed plan sidebar status ${JSON.stringify(unsubscribedPlanSidebarSummary)}`);
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
if (!isWeekendOffPeakDay("2026-08-23", "2026-08-23")) throw new Error("effective Sunday must be weekend off-peak");
if (isWeekendOffPeakDay("2026-08-22", "2026-08-23")) throw new Error("pre-effective Saturday must keep the old peak schedule");
if (isPeak(10, [[9, 12]], "2026-08-23", "2026-08-23")) throw new Error("effective Sunday 10:00 must not be peak");
if (!isPeak(10, [[9, 12]], "2026-08-24", "2026-08-23")) throw new Error("Monday 10:00 must remain peak");

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
// recentDays must derive both bounds from the server-provided Beijing day.
const overriddenRecent = recentDays([
	{ ...wireDay, date: "2020-01-01", tokens: 5 },
	{ ...wireDay, date: "2020-01-02", tokens: 6 },
	{ ...wireDay, date: beijingToday, tokens: 7 },
	wireDay
], beijingToday);
if (overriddenRecent.length !== 2 || overriddenRecent[0].date !== beijingToday || overriddenRecent[1].date !== "2020-01-02") throw new Error(`recentDays Beijing bounds ${JSON.stringify(overriddenRecent)}`);
const sparseActiveRecent = recentDays([
	{ ...wireDay, date: "2020-01-15", tokens: 7 },
	{ ...wireDay, date: "2020-01-13", tokens: 5 }
], "2020-01-15", "2020-01-14");
if (sparseActiveRecent.map((day) => day.date).join(",") !== "2020-01-15,2020-01-14,2020-01-13") throw new Error(`recentDays must retain a selected no-usage date for adjacent navigation: ${JSON.stringify(sparseActiveRecent)}`);
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
	if (!source.includes('usage.requestCount') || !source.includes('model.requestCount')) throw new Error("model usage rows must expose provider/model request counts");
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
	const detailMarkup = renderToStaticMarkup(react.createElement(exports_.DayDetail, {
		day: { models: [{ model: "deepseek-official/deepseek-v4-flash", tokens: 100, requestCount: 2, cost: 1, inputTokens: 80, outputTokens: 20 }] },
		money: () => "¥1",
		translate: (key) => key
	}));
	if (!detailMarkup.includes("usage.requestCount 2")) throw new Error("DayDetail must render the model request count");
	console.log("provider-grouped model breakdown ok");
}
//#endregion

console.log("\nclient smoke: all passed");
