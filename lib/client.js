/**
 * dsh-usage-stats — browser half.
 *
 * Hand-written `__ModuleLoader__` bundle (no build step): registers a native
 * sidebar footer action that opens a floating Usage & Balance panel. The
 * panel keeps the DeepSeek balance, local provider-reported usage, calendar
 * heatmap, hourly/model drill-down and limit controls in one place.
 */
window.__ModuleLoader__.load({
	id: "dsh-usage-stats",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region css
		const css = [
			".usg_layer{flex:none;align-items:center;width:100%;height:49px;margin:8px 0 0;display:flex;position:relative}",
			".usg_footerButtons{align-items:center;width:100%;display:flex}",
			".usg_sidebarButton{width:100%;height:49px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:8px;padding:0 8px 0 6px;font:inherit;font-size:14px;display:inline-flex;overflow:hidden}",
			".usg_sidebarButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}",
			".usg_sidebarButton[data-active]{background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_sidebarText{min-width:0;flex:1;flex-direction:column;align-items:flex-start;display:flex;overflow:hidden}",
			".usg_sidebarLabel{text-overflow:ellipsis;white-space:nowrap;width:100%;line-height:20px;text-align:left;overflow:hidden}",
			".usg_sidebarSummary{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;width:100%;font-size:10px;line-height:14px;text-align:left;font-variant-numeric:tabular-nums;overflow:hidden}",
			".usg_statusItem{display:inline-flex;align-items:center;white-space:nowrap;vertical-align:middle}",
			".usg_statusDot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-caption);display:inline-block;flex:none;margin-inline-end:5px;vertical-align:middle;box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-label-caption) 12%,transparent)}",
			".usg_statusDot[data-tone=ok]{background:#22a06b;box-shadow:0 0 0 2px color-mix(in srgb,#22a06b 14%,transparent)}",
			".usg_statusDot[data-tone=warn]{background:#d99b00;box-shadow:0 0 0 2px color-mix(in srgb,#d99b00 14%,transparent)}",
			".usg_statusDot[data-tone=bad]{background:#e5484d;box-shadow:0 0 0 2px color-mix(in srgb,#e5484d 14%,transparent)}",
			".usg_layer.usg_rail{width:36px;height:36px;margin:0}",
			".usg_layer.usg_rail .usg_sidebarButton{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}",
			".usg_panel{z-index:100;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));width:760px;max-width:calc(100vw - 32px);max-height:86vh;box-shadow:var(--dsw-shadow-lv2);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);--usg-blue:#1f6feb;--usg-green:#23a878;--usg-cellEmpty:rgba(128,128,128,.16);border-radius:14px;position:fixed;bottom:72px;left:12px;overflow:hidden}",
			".usg_panelBody{box-sizing:border-box;max-height:86vh;padding:14px;overflow-y:auto}",
			".usg_panel .usg_section{max-width:none}",
			".usg_section{--usg-blue:#1f6feb;--usg-action:var(--dsw-alias-label-primary,#171717);--usg-action-text:var(--dsw-alias-bg-base,#fff);--usg-control-bg:var(--dsw-alias-bg-base,#fff);--usg-control-text:var(--dsw-alias-label-primary,#171717);--usg-control-border:rgba(128,128,128,.24);--usg-control-placeholder:rgba(128,128,128,.48);--usg-success:#22a06b;--usg-warning:#d99b00;--usg-danger:#e5484d;box-sizing:border-box;flex-direction:column;gap:12px;width:100%;max-width:720px;display:flex}",
			".usg_section[data-usage-billing-settings]{gap:12px;max-width:760px}",
			".usg_section[data-usage-billing-settings] .usg_title{margin:0;font-size:18px;font-weight:600;line-height:25px}",
			".usg_section[data-usage-billing-settings] .usg_note{margin:0;font-size:13px;line-height:20px}",
			".usg_header{position:sticky;top:-14px;z-index:11;justify-content:space-between;align-items:center;gap:8px;padding-top:14px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));display:flex}",
			".usg_headerLeft{align-items:center;gap:8px;min-width:0;display:flex}",
			".usg_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:22px}",
			".usg_headerActions{align-items:center;gap:4px;display:flex}",
			".usg_iconButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;padding:0;display:inline-flex;flex:none}",
			".usg_iconButton:hover{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_iconButton[disabled]{cursor:default;opacity:.45}",
			".usg_refreshButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border:0;background:transparent;border-radius:8px}",
			".usg_refreshButton:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_refreshGlyph{display:block;pointer-events:none;transform-origin:center}",
			"@keyframes usg_spin{to{transform:rotate(360deg)}}",
			"@keyframes usg_refreshClick{0%{transform:rotate(0) scale(1)}50%{transform:rotate(200deg) scale(1.12)}100%{transform:rotate(360deg) scale(1)}}",
			".usg_refreshGlyphClick{animation:usg_refreshClick .6s ease-in-out}",
			".usg_iconButton[data-loading=true] svg,.usg_iconButton[data-loading=true] .usg_refreshGlyph{animation:usg_spin .75s linear infinite;transform-origin:center}",
			".usg_note{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}",
			".usg_error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;justify-content:space-between;align-items:flex-start;gap:8px;padding:7px 8px;font-size:12px;line-height:18px;display:flex}",
			".usg_retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0}",
			".usg_updated{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			// Balance card — the 消费金额 icon seat.
			".usg_balance{border:1px solid var(--dsw-alias-border-l2);background:linear-gradient(135deg,color-mix(in srgb,var(--usg-blue) 7%,transparent),transparent 45%);border-radius:14px;padding:12px 14px;flex-direction:column;gap:10px;display:flex}",
			".usg_balanceHead{align-items:center;gap:10px;display:flex}",
			".usg_balanceIcon{width:40px;height:40px;color:#fff;background:linear-gradient(135deg,#1f6feb,#0b3d91);border-radius:12px;justify-content:center;align-items:center;font-size:15px;font-weight:700;display:flex;flex:none;box-shadow:0 4px 12px rgba(31,111,235,.3)}",
			".usg_balanceIdentity{min-width:0;flex:1;display:flex;flex-direction:column}",
			".usg_balanceLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
			".usg_balanceMain{align-items:baseline;gap:8px;display:flex}",
			".usg_balanceAmount{color:var(--dsw-alias-label-primary);font-size:24px;font-weight:600;line-height:32px;font-variant-numeric:tabular-nums}",
			".usg_balanceCurrency{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-weight:500}",
			".usg_badge{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px;white-space:nowrap;flex:none}",
			".usg_badge[data-tone=ok]{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent)}",
			".usg_badge[data-tone=warn]{color:var(--dsw-alias-state-warning-primary);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary) 12%,transparent)}",
			".usg_badge[data-tone=bad]{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}",
			".usg_balanceRows{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:2px;font-size:12px;line-height:18px;display:flex}",
			".usg_balanceRow{justify-content:space-between;gap:8px;display:flex}",
			".usg_balanceRow b{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}",
			".usg_pickerRow{align-items:center;gap:8px;display:flex;flex-wrap:wrap}",
			".usg_pickerLabel{color:var(--dsw-alias-label-tertiary);align-items:center;gap:5px;font-size:12px;line-height:18px;display:inline-flex;flex:none}",
			".usg_select{box-sizing:border-box;min-width:0;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 12px;font:inherit;font-size:13px;line-height:20px;cursor:pointer}",
			".usg_statsRow{display:flex;gap:8px;flex-wrap:wrap}",
			".usg_stat{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;flex:1;min-width:110px;flex-direction:column;gap:1px;padding:8px 10px;display:flex}",
			".usg_statValue{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:22px;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".usg_statValue.usg_statMoney{color:var(--usg-blue)}",
			".usg_valueWithIndicator{display:inline-flex;align-items:center;gap:6px}",
			".usg_statLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
			".usg_card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 14px;flex-direction:column;gap:10px;display:flex}",
			".usg_cardHead{justify-content:space-between;align-items:center;gap:8px;display:flex}",
			".usg_cardTitle{color:var(--dsw-alias-label-primary);align-items:center;gap:6px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}",
			".usg_hourControls{align-items:center;gap:8px;display:flex;flex-wrap:wrap;justify-content:flex-end}",
			".usg_hourRangeSelect{height:28px;color:var(--dsw-alias-label-secondary);background:transparent;border:0;box-shadow:none;padding:0 22px 0 4px;font-size:12px;border-radius:7px;appearance:none;-webkit-appearance:none}",
			".usg_dayNav{align-items:center;gap:2px;display:flex}",
			".usg_navButton{cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}",
			".usg_navButton:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_navButton:disabled{color:var(--dsw-alias-label-caption);cursor:default}",
			".usg_dayTitle{color:var(--dsw-alias-label-primary);min-width:92px;font-size:12px;font-weight:500;line-height:24px;text-align:center;font-variant-numeric:tabular-nums}",
			".usg_todayButton{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;padding:0 6px;font-size:11px;line-height:24px}",
			".usg_todayButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			// Hourly bars.
			".usg_chart{width:100%;overflow-x:auto}",
			".usg_chartInner{min-width:560px;flex-direction:column;gap:6px;display:flex}",
			".usg_chartBody{height:132px;border-bottom:1px solid var(--dsw-alias-border-l2);align-items:flex-end;gap:2px;display:flex;position:relative;overflow:visible}",
			".usg_hourSlot{box-sizing:border-box;flex:1;min-width:0;height:100%;border:0;padding:0;background:transparent;flex-direction:column;justify-content:flex-end;align-items:stretch;display:flex;position:relative;border-radius:3px;cursor:crosshair}",
			".usg_hourSlot:hover,.usg_hourSlot:focus-visible{outline:none;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--usg-blue) 45%,transparent)}",
			".usg_hourBar{width:72%;margin:0 auto;border-radius:3px 3px 0 0;display:flex;flex:none;flex-direction:column;justify-content:flex-end;overflow:hidden}",
			".usg_hourInput{background:var(--usg-blue);width:100%;min-height:1px;flex-basis:0}",
			".usg_hourOutput{background:var(--usg-green);width:100%;min-height:1px;flex-basis:0}",
			".usg_dayBarsBody{height:132px;border-bottom:1px solid var(--dsw-alias-border-l2);align-items:flex-end;gap:2px;display:flex;position:relative;overflow:visible}",
			".usg_dayBarSlot{box-sizing:border-box;flex:1;min-width:0;height:100%;border:0;padding:0;background:transparent;flex-direction:column;justify-content:flex-end;align-items:stretch;display:flex;position:relative;border-radius:3px;cursor:crosshair}",
			".usg_dayBarSlot:hover,.usg_dayBarSlot:focus-visible{outline:none;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--usg-blue) 45%,transparent)}",
			".usg_dayBar{width:72%;margin:0 auto;border-radius:3px 3px 0 0;background:var(--usg-blue);flex:none}",
			".usg_peakRegion{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--usg-blue) 5%,transparent);border-left:1px solid color-mix(in srgb,var(--usg-blue) 14%,transparent);border-right:1px solid color-mix(in srgb,var(--usg-blue) 14%,transparent);pointer-events:none;z-index:0}",
			".usg_hourTooltip{position:absolute;z-index:60;top:8px;min-width:174px;max-width:230px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;box-shadow:var(--dsw-shadow-lv2);font-size:11px;line-height:17px;pointer-events:none}",
			".usg_hourTooltipHead{justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:3px;font-size:12px;font-weight:600;display:flex}",
			".usg_hourTooltipAmount{color:var(--dsw-alias-label-secondary);font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".usg_hourTooltipRow{justify-content:space-between;gap:12px;color:var(--dsw-alias-label-secondary);display:flex}",
			".usg_hourTooltipModels{border-top:1px solid var(--dsw-alias-border-l1);margin-top:5px;padding-top:4px;flex-direction:column;gap:1px;display:flex}",
			".usg_hourTooltipModel{justify-content:space-between;gap:10px;display:flex}",
			".usg_hourTooltipModel span:first-child{max-width:145px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}",
			".usg_chartAxis{justify-content:space-between;font-size:9px;line-height:14px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;display:flex}",
			".usg_legend{align-items:center;gap:10px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);display:flex;flex-wrap:wrap}",
			".usg_legendItem{align-items:center;gap:5px;display:inline-flex}",
			".usg_legendSwatch{width:10px;height:10px;border-radius:2px;display:inline-block}",
			".usg_peakNote{color:var(--dsw-alias-label-caption);font-size:10px;line-height:14px}",
			// Days list + day detail.
			".usg_days{flex-direction:column;display:flex}",
			".usg_day{width:100%;min-height:30px;align-items:center;gap:8px;border:0;background:0 0;border-bottom:1px solid var(--dsw-alias-border-l1);padding:5px 4px;font:inherit;text-align:left;cursor:pointer;display:flex;border-radius:6px}",
			".usg_day:last-child{border-bottom:0}",
			".usg_day:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_day[data-active]{background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_dayDate{color:var(--dsw-alias-label-secondary);flex:none;width:96px;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_dayTokens{color:var(--dsw-alias-label-primary);flex:none;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_dayCost{color:var(--dsw-alias-label-tertiary);flex:none;width:74px;font-size:11px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}",
			".usg_dayBar{background:var(--usg-blue);border-radius:2px;height:6px;flex:1;min-width:4px;opacity:.65}",
			".usg_detailSummary{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_providerGroup{flex-direction:column;gap:6px;display:flex;margin-top:8px}",
			".usg_providerGroup:first-child{margin-top:0}",
			".usg_providerHead{justify-content:space-between;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:600;line-height:18px;display:flex}",
			".usg_providerName{color:var(--dsw-alias-label-primary);min-width:0;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;font-weight:500;line-height:18px;overflow:hidden}",
			".usg_providerTokens{flex:none;font-variant-numeric:tabular-nums}",
			".usg_providerCost{flex:none;font-weight:500;font-variant-numeric:tabular-nums}",
			".usg_modelRow{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;flex-direction:column;gap:4px;display:flex}",
			".usg_modelHead{align-items:center;gap:8px;display:flex}",
			".usg_modelName{color:var(--dsw-alias-label-primary);min-width:0;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;font-weight:500;line-height:18px;overflow:hidden}",
			".usg_modelTokens{color:var(--dsw-alias-label-primary);flex:none;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}",
			".usg_modelCost{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}",
			".usg_modelBarTrack{background:var(--dsw-alias-fill-l2);border-radius:2px;height:5px;overflow:hidden}",
			".usg_modelBar{background:var(--usg-blue);border-radius:2px;height:5px}",
			".usg_modelMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			// GitHub-contributions-style rolling daily token heatmap.
			".usg_heatHeader{justify-content:space-between;align-items:center;gap:8px;display:flex}",
			".usg_contribScroll{width:100%;padding-bottom:2px;overflow-x:auto}",
			".usg_contribGrid{grid-template-rows:16px repeat(7,10px);gap:3px;min-width:max-content;display:grid}",
			".usg_contribMonth{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;white-space:nowrap;align-self:end}",
			".usg_contribWeekday{color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:10px;white-space:nowrap;align-self:center}",
			".usg_yearSelect{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:2px 24px 2px 8px;font:inherit;font-size:11px;line-height:20px}",
			".usg_heatCell{width:10px;height:10px;border-radius:2px;background:var(--usg-cellEmpty);border:0;padding:0;cursor:pointer;display:block}",
			".usg_heatCell:hover{box-shadow:0 0 0 1px var(--dsw-alias-label-secondary)}",
			".usg_heatCellToday{box-shadow:0 0 0 1px var(--usg-blue)}",
			".usg_heatCellSelected{box-shadow:0 0 0 2px var(--dsw-alias-label-primary)}",
			".usg_emptyCell{width:10px;height:10px;display:block}",
			".usg_heatLegend{justify-content:flex-end;align-items:center;gap:4px;margin-top:8px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);display:flex}",
			".usg_heatSwatch{width:10px;height:10px;border-radius:2px;background:var(--dsw-alias-fill-l2)}",
			// Limits & alert card
			".usg_limitCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:14px 16px;flex-direction:column;gap:12px;display:flex}",
			".usg_limitCardHead{justify-content:space-between;align-items:center;gap:8px;display:flex}",
			".usg_limitTitle{color:var(--dsw-alias-label-primary);align-items:center;gap:6px;font-size:15px;font-weight:600;line-height:22px;display:inline-flex}",
			".usg_limitSub{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;line-height:18px;margin:10px 0 0}",
			".usg_limitGrid{display:flex;flex-direction:column}",
			".usg_limitField{flex-direction:column;gap:4px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex}",
			".usg_limitField:last-child{border-bottom:0}",
			".usg_limitFieldLabel{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px;display:flex;align-items:center;justify-content:space-between}",
			".usg_inputWrapper{position:relative;display:flex;align-items:center}",
			".usg_inputPrefix{position:absolute;left:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;pointer-events:none}",
			".usg_inputSuffix{position:absolute;right:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;pointer-events:none}",
			".usg_input{box-sizing:border-box;width:100%;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 12px;font:inherit;font-size:13px;line-height:1.5;box-shadow:none}",
			".usg_input.has_prefix{padding-left:28px}",
			".usg_input.has_suffix{padding-right:28px}",
			".usg_input::placeholder{color:var(--dsw-alias-label-tertiary);opacity:1}",
			".usg_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}",
			".usg_toggleGrid{display:flex;flex-direction:column}",
			".usg_toggleRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".usg_toggleRow:last-child{border-bottom:0}",
			".usg_toggleInfo{display:flex;flex-direction:column;gap:4px}",
			".usg_toggleTitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}",
			".usg_toggleDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}",
			".usg_switch{position:relative;display:inline-block;width:32px;height:18px;flex:none;cursor:pointer}",
			".usg_switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;appearance:none;z-index:2}",
			".usg_switchSlider{position:absolute;cursor:pointer;inset:0;background-color:rgba(128,128,128,.28);border:1px solid rgba(128,128,128,.18);box-sizing:border-box;border-radius:20px;transition:.2s}",
			".usg_switchSlider:before{position:absolute;content:\"\";height:12px;width:12px;left:3px;bottom:3px;background-color:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}",
			".usg_switch input:focus-visible + .usg_switchSlider{outline:2px solid color-mix(in srgb,var(--usg-action) 35%,transparent);outline-offset:2px}",
			".usg_switch input:checked + .usg_switchSlider{background-color:var(--usg-action);border-color:var(--usg-action)}",
			".usg_switch input:checked + .usg_switchSlider:before{transform:translateX(14px)}",
			".usg_alertCard{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:9px;background:var(--dsw-alias-bg-base)}",
			".usg_alertHead{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}",
			".usg_alertValue{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}",
			".usg_alertTrack{position:relative;height:20px}",
			".usg_alertCard input.usg_alertRange{appearance:none!important;display:block;width:100%;height:20px!important;margin:1px 0!important;padding:0!important;border:0!important;outline:none;background:transparent!important;box-shadow:none!important;cursor:pointer;position:relative;z-index:1}",
			".usg_alertCard input.usg_alertRange.is-overlay{position:absolute;inset:0;z-index:2;pointer-events:none}",
			".usg_alertCard input.usg_alertRange::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:linear-gradient(to right,var(--usg-danger) 0 var(--alert-percent),var(--usg-warning) var(--alert-percent) var(--critical-percent),var(--usg-success) var(--critical-percent) 100%);box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}",
			".usg_alertCard input.usg_alertRange::-webkit-slider-thumb{appearance:none;width:16px;height:16px;margin-top:-5px;border:3px solid var(--usg-control-bg);border-radius:50%;background:var(--usg-action);box-shadow:0 0 0 2px rgba(0,0,0,.18);cursor:pointer;pointer-events:auto}",
			".usg_alertCard input.usg_alertRange::-moz-range-track{height:6px;border:0;border-radius:999px;background:linear-gradient(to right,var(--usg-danger) 0 var(--alert-percent),var(--usg-warning) var(--alert-percent) var(--critical-percent),var(--usg-success) var(--critical-percent) 100%);box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}",
			".usg_alertCard input.usg_alertRange::-moz-range-thumb{width:10px;height:10px;border:3px solid var(--usg-control-bg);border-radius:50%;background:var(--usg-action);box-shadow:0 0 0 2px rgba(0,0,0,.18);cursor:pointer;pointer-events:auto}",
			".usg_alertCard input.usg_alertRange.is-overlay::-webkit-slider-runnable-track{background:transparent;box-shadow:none}",
			".usg_alertCard input.usg_alertRange.is-overlay::-moz-range-track{background:transparent;box-shadow:none}",
			".usg_alertLegend{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px}",
			".usg_alertLegend span:nth-child(2){text-align:center}",
			".usg_alertLegend span:last-child{text-align:right}",
			".usg_statusBanner{position:relative;overflow:hidden;border-radius:8px;padding:8px 10px;font-size:12px;line-height:18px;display:flex;flex-direction:column;gap:6px;border:1px solid rgba(128,128,128,.22);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}",
			".usg_statusBanner:before{content:\"\";position:absolute;inset:0 auto 0 0;width:var(--usage-progress,0%);background:color-mix(in srgb,var(--usg-blue,#1f6feb) 12%,transparent);z-index:0}",
			".usg_statusBanner>*{position:relative;z-index:1}",
			".usg_statusBanner[data-status=warning]:before{background:rgba(217,155,0,.16)}",
			".usg_statusBanner[data-status=warning]{border-color:rgba(128,128,128,.22)!important;color:var(--dsw-alias-label-primary)}",
			".usg_statusBanner[data-status=warning] .usg_bannerTitle{color:var(--dsw-alias-state-warning-primary,#b26a00)}",
			".usg_statusBanner[data-status=exceeded]:before,.usg_statusBanner[data-status=blocked]:before{background:rgba(229,72,77,.16)}",
			".usg_statusBanner[data-status=stale],.usg_statusBanner[data-status=unavailable]{background:var(--dsw-alias-fill-l2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}",
			".usg_usageLimitBanner{border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;line-height:20px;background:color-mix(in srgb,var(--usg-blue,#1f6feb) 8%,transparent);border:1px solid color-mix(in srgb,var(--usg-blue,#1f6feb) 22%,transparent);color:var(--dsw-alias-label-primary)}",
			".usg_usageLimitBanner strong{font-size:16px;line-height:22px;font-weight:600}",
			".usg_usageLimitBanner span{font-size:14px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
			".usg_usageLimitBanner{position:relative;overflow:hidden}",
			".usg_usageLimitBanner:before{content:\"\";position:absolute;inset:0 auto 0 0;width:var(--usage-progress,0%);background:color-mix(in srgb,var(--usg-blue,#1f6feb) 12%,transparent);z-index:0}",
			".usg_usageLimitBanner>*{position:relative;z-index:1}",
			".usg_usageLimitBanner[data-status=warning]{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary) 12%,transparent);border-color:rgba(128,128,128,.22)!important}",
			".usg_usageLimitBanner[data-status=warning]:before{background:rgba(217,155,0,.16)}",
			".usg_usageLimitBanner[data-status=exceeded],.usg_usageLimitBanner[data-status=blocked]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);border-color:rgba(128,128,128,.22)!important}",
			".usg_usageLimitBanner[data-status=exceeded]:before,.usg_usageLimitBanner[data-status=blocked]:before{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 14%,transparent)}",
			".usg_bannerHead{display:flex;align-items:center;justify-content:space-between;gap:8px}",
			".usg_bannerTitle{font-weight:600;display:flex;align-items:center;gap:6px}",
			".usg_bannerMsg{font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".usg_progressTrack{background:var(--dsw-alias-fill-l2);border-radius:999px;height:5px;overflow:hidden;width:100%}",
			".usg_progressBar{border-radius:999px;height:5px;transition:width .3s ease;background:var(--usg-blue)}",
			".usg_progressBar[data-status=warning]{background:var(--dsw-alias-state-warning-primary)}",
			".usg_progressBar[data-status=exceeded],.usg_progressBar[data-status=blocked]{background:var(--dsw-alias-state-error-primary)}",
			".usg_limitActions{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:2px}",
			".usg_saveBtn{cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;font-weight:500;line-height:1.5;display:inline-flex;align-items:center;gap:6px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);transition:background .16s,opacity .15s}",
			".usg_saveBtn:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}",
			".usg_saveBtn:disabled{opacity:.4;cursor:default}",
			// Query/settings split: in-panel tabs, the go-to-settings affordance.
			".usg_tabs{position:sticky;top:22px;z-index:10;border-bottom:1px solid var(--dsw-alias-border-l1);gap:2px;margin-bottom:12px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));display:flex}",
			".usg_tab{cursor:pointer;color:var(--dsw-alias-label-tertiary);background:0 0;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:6px 10px;font:inherit;font-size:13px;line-height:20px;font-weight:500}",
			".usg_tab:hover{color:var(--dsw-alias-label-primary)}",
			".usg_tab[data-active=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--usg-blue)}",
			".usg_section[data-usage-billing-settings] .usg_tabs{position:static;top:auto;z-index:auto;align-items:flex-end;gap:22px;margin:2px 0 0;border-bottom:1px solid var(--dsw-alias-border-l2);background:0 0}",
			".usg_section[data-usage-billing-settings] .usg_tab{position:relative;border:0;border-bottom:0;margin-bottom:0;padding:7px 1px 9px;font-weight:400}",
			".usg_section[data-usage-billing-settings] .usg_tab:hover,.usg_section[data-usage-billing-settings] .usg_tab[data-active=true]{color:var(--dsw-alias-label-primary)}",
			".usg_section[data-usage-billing-settings] .usg_tab[data-active=true]::after{position:absolute;right:0;bottom:-1px;left:0;height:2px;border-radius:2px 2px 0 0;background:var(--dsw-alias-label-primary);content:\"\"}",
			".usg_section[data-usage-billing-settings] .usg_tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;border-radius:2px;color:var(--dsw-alias-label-primary)}",
			".usg_settingsLink{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;padding:2px 6px;font:inherit;font-size:12px;line-height:20px;flex:none;white-space:nowrap}",
			".usg_settingsLink:hover{color:var(--usg-blue);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".usg_row:last-child{border-bottom:0}",
			".usg_rowLabel{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;flex:none}",
			".usg_rowValue{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-variant-numeric:tabular-nums;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis}",
			".usg_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:4px 0}",
			".usg_btn{cursor:pointer;color:var(--usg-action-text);background:var(--usg-action);border:1px solid transparent;border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;font-weight:500;line-height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:background .15s,border-color .15s,color .15s,opacity .15s}",
			".usg_btn:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--usg-action))}",
			".usg_btn:disabled{opacity:.45;cursor:not-allowed}",
			".usg_btnGhost{background:0 0;color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l2)}",
			".usg_btnGhost:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_btnDanger{background:var(--dsw-alias-state-error-primary);color:#fff}",
			".usg_btnDanger:hover:not(:disabled){filter:brightness(.92)}",
			".usg_btnRow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px}",
			".usg_tableScroll{width:100%;overflow-x:auto;margin:2px 0}",
			".usg_modelTable{width:100%;border-collapse:collapse;font-size:13px}",
			".usg_modelTable th{color:var(--dsw-alias-label-tertiary);font-weight:500;text-align:left;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}",
			".usg_modelTable td{padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);font-variant-numeric:tabular-nums}",
			".usg_modelTable th.usg_thGroup{text-align:center;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".usg_modelName{color:var(--dsw-alias-label-primary);font-weight:500;white-space:nowrap}",
			".usg_priceInput{width:88px;height:30px;box-sizing:border-box;background:var(--dsw-alias-input-bg,transparent);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:0 8px;font:inherit;font-size:13px;text-align:right;font-variant-numeric:tabular-nums}",
			".usg_priceInput:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}",
			".usg_diffCell{color:var(--dsw-alias-label-secondary)}",
			".usg_diffCell[data-diff=true]{color:var(--dsw-alias-label-error);font-weight:600}",
			".usg_clearConfirm{display:flex;flex-direction:column;gap:8px}",
			".usg_alertList{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto}",
			".usg_alertItem{display:flex;flex-direction:column;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 10px;font-size:12px;line-height:18px}",
			".usg_alertMeta{color:var(--dsw-alias-label-tertiary);display:flex;gap:8px;font-variant-numeric:tabular-nums}",
			".usg_alertMsg{color:var(--dsw-alias-label-primary)}",
			".usg_dataStat{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0}",
			".usg_dataStatCell{background:var(--dsw-alias-interactive-bg);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px}",
			".usg_dataStatLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
			".usg_dataStatValue{color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px;font-variant-numeric:tabular-nums;font-weight:600}",
			".usg_tag{display:inline-flex;align-items:center;border-radius:6px;padding:1px 6px;font-size:11px;line-height:16px;background:var(--dsw-alias-interactive-bg);color:var(--dsw-alias-label-tertiary)}",
			".usg_tag[data-tone=warn]{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary) 14%,transparent);color:var(--dsw-alias-state-warning-primary)}",
			".usg_tag[data-tone=bad]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);color:var(--dsw-alias-state-error-primary)}",
			".usg_tag[data-tone=ok]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}",
			"@media(max-width:640px){.usg_toggleGrid,.usg_limitGrid{grid-template-columns:1fr}}"
		].join("");
		const tagId = "dsh-usage-stats/UsageStats.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-usage-stats";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const S = {
			layer: "usg_layer",
			rail: "usg_rail",
			footerButtons: "usg_footerButtons",
			sidebarButton: "usg_sidebarButton",
			sidebarText: "usg_sidebarText",
			sidebarLabel: "usg_sidebarLabel",
			sidebarSummary: "usg_sidebarSummary",
			statusItem: "usg_statusItem",
			statusDot: "usg_statusDot",
			panel: "usg_panel",
			panelBody: "usg_panelBody",
			section: "usg_section",
			header: "usg_header",
			headerLeft: "usg_headerLeft",
			title: "usg_title",
			headerActions: "usg_headerActions",
			iconButton: "usg_iconButton",
			refreshButton: "usg_refreshButton",
			refreshGlyph: "usg_refreshGlyph",
			refreshGlyphClick: "usg_refreshGlyphClick",
			note: "usg_note",
			error: "usg_error",
			retry: "usg_retry",
			updated: "usg_updated",
			balance: "usg_balance",
			balanceHead: "usg_balanceHead",
			balanceIcon: "usg_balanceIcon",
			balanceIdentity: "usg_balanceIdentity",
			balanceLabel: "usg_balanceLabel",
			balanceMain: "usg_balanceMain",
			balanceAmount: "usg_balanceAmount",
			balanceCurrency: "usg_balanceCurrency",
			badge: "usg_badge",
			balanceRows: "usg_balanceRows",
			balanceRow: "usg_balanceRow",
			pickerRow: "usg_pickerRow",
			pickerLabel: "usg_pickerLabel",
			select: "usg_select",
			statsRow: "usg_statsRow",
			stat: "usg_stat",
			statValue: "usg_statValue",
			statMoney: "usg_statMoney",
			valueWithIndicator: "usg_valueWithIndicator",
			statLabel: "usg_statLabel",
			card: "usg_card",
			cardHead: "usg_cardHead",
			cardTitle: "usg_cardTitle",
			hourControls: "usg_hourControls",
			hourRangeSelect: "usg_hourRangeSelect",
			dayNav: "usg_dayNav",
			navButton: "usg_navButton",
			dayTitle: "usg_dayTitle",
			todayButton: "usg_todayButton",
			chart: "usg_chart",
			chartInner: "usg_chartInner",
			chartBody: "usg_chartBody",
			hourSlot: "usg_hourSlot",
			peak: "usg_peak",
			hourBar: "usg_hourBar",
			hourInput: "usg_hourInput",
			hourOutput: "usg_hourOutput",
			dayBarsBody: "usg_dayBarsBody",
			dayBarSlot: "usg_dayBarSlot",
			dayBar: "usg_dayBar",
			hourTooltip: "usg_hourTooltip",
			hourTooltipHead: "usg_hourTooltipHead",
			hourTooltipAmount: "usg_hourTooltipAmount",
			hourTooltipRow: "usg_hourTooltipRow",
			hourTooltipModels: "usg_hourTooltipModels",
			hourTooltipModel: "usg_hourTooltipModel",
			chartAxis: "usg_chartAxis",
			legend: "usg_legend",
			legendItem: "usg_legendItem",
			legendSwatch: "usg_legendSwatch",
			peakNote: "usg_peakNote",
			days: "usg_days",
			day: "usg_day",
			dayDate: "usg_dayDate",
			dayTokens: "usg_dayTokens",
			dayCost: "usg_dayCost",
			dayBar: "usg_dayBar",
			detailSummary: "usg_detailSummary",
			providerGroup: "usg_providerGroup",
			providerHead: "usg_providerHead",
			providerName: "usg_providerName",
			providerTokens: "usg_providerTokens",
			providerCost: "usg_providerCost",
			modelRow: "usg_modelRow",
			modelHead: "usg_modelHead",
			modelName: "usg_modelName",
			modelTokens: "usg_modelTokens",
			modelCost: "usg_modelCost",
			modelBarTrack: "usg_modelBarTrack",
			modelBar: "usg_modelBar",
			modelMeta: "usg_modelMeta",
			heatHeader: "usg_heatHeader",
			contribScroll: "usg_contribScroll",
			contribGrid: "usg_contribGrid",
			contribMonth: "usg_contribMonth",
			contribWeekday: "usg_contribWeekday",
			yearSelect: "usg_yearSelect",
			heatCell: "usg_heatCell",
			heatCellToday: "usg_heatCellToday",
			heatCellSelected: "usg_heatCellSelected",
			emptyCell: "usg_emptyCell",
			heatLegend: "usg_heatLegend",
			heatSwatch: "usg_heatSwatch",
			limitCard: "usg_limitCard",
			limitCardHead: "usg_limitCardHead",
			limitTitle: "usg_limitTitle",
			limitSub: "usg_limitSub",
			limitGrid: "usg_limitGrid",
			limitField: "usg_limitField",
			limitFieldLabel: "usg_limitFieldLabel",
			inputWrapper: "usg_inputWrapper",
			inputPrefix: "usg_inputPrefix",
			inputSuffix: "usg_inputSuffix",
			input: "usg_input",
			toggleGrid: "usg_toggleGrid",
			toggleRow: "usg_toggleRow",
			toggleInfo: "usg_toggleInfo",
			toggleTitle: "usg_toggleTitle",
			toggleDesc: "usg_toggleDesc",
			switch: "usg_switch",
			switchSlider: "usg_switchSlider",
			alertCard: "usg_alertCard",
			alertHead: "usg_alertHead",
			alertValue: "usg_alertValue",
			alertTrack: "usg_alertTrack",
			alertRange: "usg_alertRange",
			alertLegend: "usg_alertLegend",
			statusBanner: "usg_statusBanner",
			usageLimitBanner: "usg_usageLimitBanner",
			bannerHead: "usg_bannerHead",
			bannerTitle: "usg_bannerTitle",
			bannerMsg: "usg_bannerMsg",
			progressTrack: "usg_progressTrack",
			progressBar: "usg_progressBar",
			limitActions: "usg_limitActions",
			saveBtn: "usg_saveBtn",
			peakRegion: "usg_peakRegion",
			tabs: "usg_tabs",
			tab: "usg_tab",
			settingsLink: "usg_settingsLink",
			row: "usg_row",
			rowLabel: "usg_rowLabel",
			rowValue: "usg_rowValue",
			hint: "usg_hint",
			btn: "usg_btn",
			btnGhost: "usg_btnGhost",
			btnDanger: "usg_btnDanger",
			btnRow: "usg_btnRow",
			tableScroll: "usg_tableScroll",
			thGroup: "usg_thGroup",
			modelTable: "usg_modelTable",
			modelName: "usg_modelName",
			priceInput: "usg_priceInput",
			diffCell: "usg_diffCell",
			clearConfirm: "usg_clearConfirm",
			alertList: "usg_alertList",
			alertItem: "usg_alertItem",
			alertMeta: "usg_alertMeta",
			alertMsg: "usg_alertMsg",
			dataStat: "usg_dataStat",
			dataStatCell: "usg_dataStatCell",
			dataStatLabel: "usg_dataStatLabel",
			dataStatValue: "usg_dataStatValue",
			tag: "usg_tag"
		};
		//#endregion

		//#region helpers
		const BLUE_RGB = [31, 111, 235];
		const GREEN_RGB = [35, 168, 120];
		/** First selectable year for the annual daily-usage heatmap. */
		const YEAR_START = 2026;

		/** Local `YYYY-MM-DD` for a Date. */
		function dayKeyOf(date) {
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			return `${date.getFullYear()}-${month}-${day}`;
		}

		/** Today's local `YYYY-MM-DD`. */
		function todayKey() {
			return dayKeyOf(new Date());
		}

		/** Shift a `YYYY-MM-DD` key by whole days (local calendar). */
		function shiftDayKey(key, delta) {
			const [year, month, day] = key.split("-").map(Number);
			const date = new Date(year, month - 1, day);
			date.setDate(date.getDate() + delta);
			return dayKeyOf(date);
		}

		/** Ordered date keys for a time-range bucket (ascending, inclusive). */
		function daysInRange(range, today) {
			const list = [];
			const [year, month, dayNum] = today.split("-").map(Number);
			const pad = (n) => String(n).padStart(2, "0");
			if (range === "today") {
				list.push(today);
			} else if (range === "yesterday") {
				list.push(shiftDayKey(today, -1));
			} else if (range === "7d" || range === "30d") {
				const span = range === "7d" ? 7 : 30;
				for (let i = span - 1; i >= 0; i -= 1) list.push(shiftDayKey(today, -i));
			} else if (range === "month") {
				for (let d = 1; d <= dayNum; d += 1) list.push(`${year}-${pad(month)}-${pad(d)}`);
			} else if (range === "lastMonth") {
				const lastMonth = month === 1 ? 12 : month - 1;
				const lastMonthYear = month === 1 ? year - 1 : year;
				const daysInLastMonth = new Date(lastMonthYear, lastMonth, 0).getDate();
				for (let d = 1; d <= daysInLastMonth; d += 1) list.push(`${lastMonthYear}-${pad(lastMonth)}-${pad(d)}`);
			}
			return list;
		}

		/** Active chart day for ranges that represent exactly one calendar day. */
		function activeDayKeyOf(range, selectedDay, today) {
			if (range === "today") return today;
			if (range === "yesterday") return shiftDayKey(today, -1);
			if (range === "custom") return selectedDay;
			return null;
		}

		function monthName(month, translate) {
			const names = translate("month.names").split(",");
			return names[month] ?? String(month + 1);
		}

		/** Build a GitHub-style Sunday-first grid for one natural calendar year. */
		function buildYearContributionHeatmap(dayMap, year) {
			const start = new Date(year, 0, 1);
			start.setDate(start.getDate() - start.getDay());
			const end = new Date(year, 11, 31);
			end.setDate(end.getDate() + (6 - end.getDay()));
			const weekCount = Math.floor((end - start) / (7 * 86400000)) + 1;
			const weeks = [];
			const months = Array.from({ length: 12 }, (_, month) => {
				const first = new Date(year, month, 1);
				return { weekIndex: Math.floor((first - start) / (7 * 86400000)), month };
			});
			let max = 0;
			for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
				const week = [];
				for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
					const date = new Date(start);
					date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
					if (date.getFullYear() !== year) {
						week.push(null);
						continue;
					}
					const key = dayKeyOf(date);
					const entry = dayMap.get(key);
					const tokens = entry?.tokens ?? 0;
					week.push({ key, tokens, hitRate: entry?.cacheHitRate ?? null });
					if (tokens > max) max = tokens;
				}
				weeks.push(week);
			}
			return { year, weeks, months, max };
		}

		/** Continuous blue intensity for a daily contribution cell. */
		function cellColor(tokens, max) {
			if (tokens <= 0) return { background: "var(--usg-cellEmpty)", color: "var(--dsw-alias-label-secondary)" };
			const ratio = max > 0 ? Math.sqrt(tokens / max) : 1;
			const alpha = Math.min(1, 0.22 + 0.78 * ratio);
			return {
				background: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, ${alpha.toFixed(3)})`,
				color: alpha >= 0.6 ? "rgba(255,255,255,.95)" : "var(--dsw-alias-label-primary)"
			};
		}

		/** Group thousands. */
		function fmt(n) {
			return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}

		/** Compact form: 1234 → "1.2k". */
		function fmtCompact(n) {
			if (n < 1000) return String(n);
			if (n < 1000000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
			return `${(n / 1000000).toFixed(1)}m`;
		}

		/** Hit-rate display: null/undefined → "—". */
		function fmtHit(hitRate) {
			return hitRate === null || hitRate === void 0 ? "—" : `${hitRate}%`;
		}

		/** Currency-aware amount: `¥36.44` / `$12.00` (Intl, fallback keeps the raw value). */
		function fmtCurrency(amount, currency) {
			if (amount === void 0 || amount === null || !Number.isFinite(Number(amount))) return "—";
			try {
				return new Intl.NumberFormat(undefined, { style: "currency", currency: currency ?? "CNY" }).format(Number(amount));
			} catch {
				return `${currency ?? "CNY"} ${amount}`;
			}
		}

		/** Short money: 3.14159 → "3.14" (USD cost), 0 → "0.00". */
		function fmtMoney(value) {
			if (value === null || value === void 0) return "—";
			const numeric = Number(value);
			if (!Number.isFinite(numeric) || numeric === 0) return "0.00";
			if (Math.abs(numeric) < 0.01) return "<0.01";
			if (Math.abs(numeric) >= 1000) return numeric.toFixed(0);
			return numeric.toFixed(2);
		}

		/** Currency symbol for cost displays. */
		function currencySymbol(currency) {
			if (currency === "CNY") return "¥";
			if (currency === void 0 || currency === null || currency === "") return "¥";
			if (currency === "USD") return "$";
			return `${currency} `;
		}

		/** Bare model id of a `provider/model` key. */
		function modelIdOf(modelKey) {
			if (typeof modelKey !== "string") return "";
			const slash = modelKey.indexOf("/");
			return slash === -1 ? modelKey : modelKey.slice(slash + 1);
		}

		/** Provider part of a `provider/model` key ("" when absent). */
		function providerOf(modelKey) {
			if (typeof modelKey !== "string") return "";
			const slash = modelKey.indexOf("/");
			return slash === -1 ? "" : modelKey.slice(0, slash);
		}

		/** Group day-level model rows by provider, summing tokens per supplier. */
		function groupModelsByProvider(models) {
			const groups = new Map();
			for (const model of models ?? []) {
				const provider = providerOf(model.model) || "unknown";
				let group = groups.get(provider);
				if (group === void 0) {
					group = { provider, tokens: 0, models: [] };
					groups.set(provider, group);
				}
				group.tokens += Number(model.tokens) || 0;
				group.models.push(model);
			}
			return [...groups.values()];
		}

		/** Prompt-side cache hit rate percent, or null. */
		function hitRateOf(buckets) {
			const input = buckets?.inputTokens ?? 0;
			const cacheRead = buckets?.cacheReadTokens ?? 0;
			const cacheWrite = buckets?.cacheWriteTokens ?? 0;
			const promptTokens = input + cacheRead + cacheWrite;
			if (promptTokens <= 0) return null;
			return Math.round((cacheRead / promptTokens) * 1000) / 10;
		}

		/** Sum a list of model rows into one bucket view. */
		function sumRows(rows) {
			const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
			let tokens = 0;
			let cost = 0;
			let priced = true;
			for (const row of rows) {
				totals.inputTokens += row?.inputTokens ?? 0;
				totals.outputTokens += row?.outputTokens ?? 0;
				totals.cacheReadTokens += row?.cacheReadTokens ?? 0;
				totals.cacheWriteTokens += row?.cacheWriteTokens ?? 0;
				tokens += row?.tokens ?? 0;
				if (row?.cost === null) priced = false;
				else if (Number.isFinite(Number(row?.cost))) cost += Number(row.cost);
			}
			return { ...totals, tokens, cost: priced ? cost : null };
		}

		/**
		 * Filter a wire day entry by a bare model id (`""`/null → all models).
		 * Recomputes totals from the matching model rows so charts and stats
		 * stay consistent with the filter.
		 */
		function filterDay(day, modelId) {
			if (day === null || day === void 0) return null;
			if (modelId === null || modelId === "") return day;
			const models = (day.models ?? []).filter((model) => modelIdOf(model.model) === modelId);
			const totals = sumRows(models);
			const hours = (day.hours ?? []).map((hour) => {
				const rows = (hour.models ?? []).filter((model) => modelIdOf(model.model) === modelId);
				const summed = sumRows(rows);
				return { hour: hour.hour, ...summed };
			});
			return {
				date: day.date,
				...totals,
				cacheHitRate: hitRateOf(totals),
				models,
				hours
			};
		}

		/** Distinct bare model ids across all days, ascending. */
		function modelChoicesOf(days) {
			const seen = new Set();
			for (const day of days) {
				for (const model of day?.models ?? []) {
					const id = modelIdOf(model.model);
					if (id !== "" && id !== "unknown") seen.add(id);
				}
			}
			return [...seen].sort();
		}

		/** Today / month / all-time stats from the wire days list. */
		function summarize(days, modelId, today) {
			const dayKey = today ?? todayKey();
			const month = dayKey.slice(0, 7);
			// 未定价模型时 day.cost 整体为 null（防把未知模型当 0 消费）；这里额外
			// 汇总「已定价模型」的费用和未定价标记，供展示与提示。
			const pricedModelCost = (day) => (day.models ?? []).reduce((sum, model) => {
				const cost = Number(model.cost);
				return sum + (model.cost !== null && Number.isFinite(cost) ? cost : 0);
			}, 0);
			let todayTokens = 0;
			let todayCost = 0;
			let todayPriced = true;
			let todayUnpriced = false;
			let todayPricedCost = 0;
			let monthTokens = 0;
			let monthCost = 0;
			let monthPriced = true;
			let monthUnpriced = false;
			let monthPricedCost = 0;
			let totalTokens = 0;
			let totalCost = 0;
			let totalPriced = true;
			let totalUnpriced = false;
			let totalPricedCost = 0;
			for (const raw of days) {
				const day = filterDay(raw, modelId);
				if (day === null) continue;
				totalTokens += day.tokens ?? 0;
				if (day.cost === null) { totalPriced = false; totalUnpriced = true; totalPricedCost += pricedModelCost(day); }
				else { totalCost += Number(day.cost) || 0; totalPricedCost += Number(day.cost) || 0; }
				if (day.date.startsWith(month)) {
					monthTokens += day.tokens ?? 0;
					if (day.cost === null) { monthPriced = false; monthUnpriced = true; monthPricedCost += pricedModelCost(day); }
					else { monthCost += Number(day.cost) || 0; monthPricedCost += Number(day.cost) || 0; }
				}
				if (day.date === dayKey) {
					todayTokens = day.tokens ?? 0;
					todayPriced = day.cost !== null;
					todayCost = day.cost === null ? null : Number(day.cost) || 0;
					todayPricedCost = day.cost === null ? pricedModelCost(day) : (Number(day.cost) || 0);
					todayUnpriced = day.cost === null;
				}
			}
			return {
				todayTokens,
				todayCost: todayPriced ? todayCost : null,
				todayCostPriced: todayPricedCost,
				todayUnpriced,
				monthTokens,
				monthCost: monthPriced ? monthCost : null,
				monthCostPriced: monthPricedCost,
				monthUnpriced,
				totalTokens,
				totalCost: totalPriced ? totalCost : null,
				totalCostPriced: totalPricedCost,
				totalUnpriced
			};
		}

		/** Last 14 CALENDAR days with usage, descending (newest first). */
		function recentDays(usageDays, today) {
			if (!Array.isArray(usageDays)) return [];
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 13);
			const cutoffKey = dayKeyOf(cutoff);
			const dayKey = today ?? todayKey();
			return usageDays.filter((day) => day.date >= cutoffKey && day.date <= dayKey).reverse();
		}

		/** Locale-safe template interpolation: `t("key", {a})` replaces `{a}`. */
		function interpolate(template, params) {
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/g, (match, key) => (Object.hasOwn(params, key) ? String(params[key]) : match));
		}

		/**
		 * Per-request staleness guard: each `start()` bumps a counter and only
		 * the most recent start may `isCurrent()`.
		 */
		function createLoader() {
			let current = 0;
			return {
				start: () => ++current,
				isCurrent: (id) => id === current
			};
		}

		async function fetchJson(path, options = {}) {
			let response;
			const init = {
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(30000)
			};
			if (options.method !== undefined) init.method = options.method;
			if (options.body !== undefined) {
				init.headers = { ...init.headers, "content-type": "application/json" };
				init.body = JSON.stringify(options.body);
			}
			try {
				response = await fetch(path, init);
			} catch (err) {
				if (err !== null && typeof err === "object" && (err.name === "TimeoutError" || err.name === "AbortError")) {
					throw new Error("request timed out");
				}
				throw err;
			}
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const payload = await response.json();
			if (payload === null || typeof payload !== "object") throw new Error("unexpected response");
			return payload;
		}

		/** Normalize the usage payload's pricing extras (server-provided). */
		function pricingOf(payload) {
			const pricing = payload?.pricing;
			return {
				currency: typeof pricing?.currency === "string" && pricing.currency !== "" ? pricing.currency : "CNY",
				peakHours: Array.isArray(pricing?.peakHours) ? pricing.peakHours : [[9, 12], [14, 18]],
				peakMultiplier: Number(pricing?.peakMultiplier) || 2
			};
		}

		/** Derive the compact balance + today-spend line shown in the sidebar. */
		function sidebarSummaryOf(usagePayload, balancePayload, limitsPayload, today) {
			const balance = balancePayload?.ok === true ? balancePayload.account?.balance ?? null : null;
			const usageReady = usagePayload?.ok === true && Array.isArray(usagePayload.days);
			const dayKey = today ?? usagePayload?.today ?? todayKey();
			const todayDay = usageReady ? usagePayload.days.find((day) => day.date === dayKey) : null;
			const pricing = pricingOf(usagePayload);
			const defaultKeyRef = limitsPayload?.defaultKeyRef;
			const limitStatus = limitsPayload?.ok === true
				? (limitsPayload.status?.[defaultKeyRef] || Object.values(limitsPayload.status || {})[0])
				: null;
			const status = limitStatus?.status;
				return {
				balance: balance === null ? "—" : fmtCurrency(balance.total, balance.currency),
				today: usageReady && todayDay?.cost !== null && todayDay?.cost !== void 0 ? `${currencySymbol(pricing.currency)}${fmtMoney(todayDay.cost)}` : "—",
				todayTokens: usageReady ? todayDay?.tokens ?? 0 : null,
					status: limitToneOf(status),
					balanceStatus: limitToneOf(limitStatus?.balanceAlertStatus ?? (Number(limitStatus?.lowBalanceWarning) > 0 ? limitStatus?.status : null)),
					todayStatus: limitToneOf(limitStatus?.spendStatus ?? (Number(limitStatus?.dailyCostLimit) > 0 ? limitStatus?.status : null))
				};
			}

			function limitToneOf(status) {
				if (status === "blocked" || status === "exceeded") return "bad";
				if (status === "warning") return "warn";
				if (status === "normal" || status === "ok") return "ok";
				return "muted";
			}

			function limitStatusLabelKey(status) {
				return ["normal", "warning", "exceeded", "blocked", "stale", "unavailable", "unpriced"].includes(status)
					? `limits.status.${status}`
					: "limits.status.normal";
			}

			/** `MM-DD 周X` label for a `YYYY-MM-DD` key. */
			function dayLabel(key, translate) {
				if (typeof key !== "string" || key.length < 10) return "—";
				const [, month, day] = key.split("-");
				const date = new Date(Number(key.slice(0, 4)), Number(month) - 1, Number(day));
				const weekdays = [translate("weekday.sun"), translate("weekday.mon"), translate("weekday.tue"), translate("weekday.wed"), translate("weekday.thu"), translate("weekday.fri"), translate("weekday.sat")];
				return `${month}-${day} ${weekdays[date.getDay()]}`;
			}

		/** True when a local hour lands in a peak window. */
		function isPeak(hour, peakHours) {
			for (const [start, end] of peakHours) {
				if (hour >= start && hour < end) return true;
			}
			return false;
		}
		//#endregion

		//#region components
		function UsageCurrencyIcon({ size = 18 }) {
			return react_jsx_runtime.jsx("svg", { width: size, height: size, viewBox: "0 0 1024 1024", fill: "none", "aria-hidden": true, children: react_jsx_runtime.jsx("path", { d: "M929.984 394.688a318.976 318.976 0 0 0-182.656-91.072V195.008h-0.128l0.064-2.368c0-34.24-35.968-63.296-103.936-83.968-60.544-18.432-140.8-28.544-225.792-28.544s-165.184 10.176-225.728 28.608c-67.968 20.608-103.936 49.664-103.936 83.904 0 2.432 0.192 4.736 0.576 7.104h-0.128v78.4a317.824 317.824 0 0 0-32.064 15.36C19.072 314.368 0.32 338.112 0.448 363.968c0 2.368 0.192 4.672 0.64 7.04H0.96V491.52H0.64c0 17.024 7.552 32.832 22.464 46.976 14.912 14.144 37.12 26.24 64.064 36.224v101.056h-0.256c0 17.472 8.128 33.984 24.256 49.152 53.056 49.472 189.696 77.632 301.76 77.632 7.744 0 15.36-0.128 22.784-0.384 11.456 16.896 24.576 32.768 39.232 47.488a320 320 0 0 0 227.52 94.272c85.952 0 166.72-33.472 227.52-94.272s94.208-141.504 94.208-227.52a319.296 319.296 0 0 0-94.208-227.456zM123.776 300.48v-53.824c16.896 11.264 39.68 21.376 68.032 30.016 60.544 18.368 140.736 28.544 225.728 28.544s165.248-10.176 225.792-28.544c28.672-8.704 51.712-18.944 68.608-30.4v54.4l-9.408-0.192a319.616 319.616 0 0 0-243.392 111.232c-142.336 6.208-285.312-31.488-325.568-69.76-5.888-5.568-9.088-10.752-9.088-14.656h-0.704V302.72a8.064 8.064 0 0 1 0.64-0.192l-0.64-2.048z m78.4-157.888c57.28-17.344 133.76-26.944 215.36-26.944s158.144 9.6 215.488 26.944c58.176 17.664 78.784 38.016 78.784 50.048s-20.608 32.384-78.784 50.048c-57.344 17.408-133.888 27.008-215.488 27.008s-158.144-9.6-215.36-27.008c-58.24-17.6-78.848-38.016-78.848-50.048s20.608-32.384 78.848-50.048z m-113.856 174.208v10.496h0.704c0 14.08 6.72 27.648 20.096 40.32 48.768 46.4 185.792 80 318.016 80.128-106.24 12.8-188.992 3.136-240.064-7.36-59.968-12.352-111.168-33.28-137.024-56.064-10.432-9.152-14.144-16.512-14.144-20.48-0.064-15.36 23.296-33.152 52.416-47.04z m-40.768 195.968c-6.592-6.272-10.24-12.16-11.2-18.176V418.752c32 23.68 83.392 43.968 143.616 56.32 45.888 9.472 95.552 14.208 146.944 14.208 27.712 0 55.872-1.344 84.288-4.096-13.44 28.544-22.528 58.944-27.072 90.56A929.152 929.152 0 0 1 182.144 563.2c-65.024-11.776-112.832-29.696-134.592-50.432z m334.016 131.264c-89.152 2.24-172.992-22.4-220.032-48.768a938.688 938.688 0 0 0 219.456 16c-0.064 3.648-0.192 7.232-0.192 10.88 0 7.36 0.32 14.592 0.768 21.888z m-246.272 54.848c-8.192-7.616-12.544-14.976-12.992-22.016h0.256V612.352c26.496 19.52 67.008 37.376 113.728 49.728 32.64 8.64 79.424 17.472 133.568 17.472 5.248 0 10.56-0.128 15.936-0.256 5.44 30.656 15.296 60.096 29.248 87.744-111.616 0.576-237.888-29.184-279.744-68.16z m567.232 209.472A286.592 286.592 0 0 1 416.256 622.08a286.656 286.656 0 0 1 286.272-286.272 286.592 286.592 0 0 1 286.336 286.272 286.656 286.656 0 0 1-286.336 286.272z m93.824-466.176l-56.96 104.96c-15.168 28.48-24.512 47.424-27.904 56.768h-0.96c-10.048-22.72-38.4-76.672-84.928-161.728h-53.504l99.584 171.2H590.016v37.76h95.808v52.096H590.016v38.272h95.808v75.904h47.488v-75.904h92.288v-38.272h-92.288v-52.096h92.288v-37.76h-79.232l100.544-171.2h-50.56z", fill: "currentColor" }) });
		}
		/** Rolling 53-week daily token graph, matching GitHub Contributions. */
		function ContributionHeatmap({ heat, translate, selectedKey, onSelect, today }) {
			const weekdayLabels = [
				{ dayIndex: 1, label: translate("weekday.mon") },
				{ dayIndex: 3, label: translate("weekday.wed") },
				{ dayIndex: 5, label: translate("weekday.fri") }
			];
			return react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
				children: [
					react_jsx_runtime.jsx("div", {
						className: S.contribScroll,
						children: react_jsx_runtime.jsxs("div", {
							className: S.contribGrid,
							style: { gridTemplateColumns: `28px repeat(${heat.weeks.length},10px)` },
							children: [
								heat.months.map((item, index) => react_jsx_runtime.jsx("span", {
									className: S.contribMonth,
									style: { gridColumn: item.weekIndex + 2, gridRow: 1 },
									children: monthName(item.month, translate)
								}, `${item.weekIndex}-${index}`)),
								weekdayLabels.map((item) => react_jsx_runtime.jsx("span", {
									className: S.contribWeekday,
									style: { gridColumn: 1, gridRow: item.dayIndex + 2 },
									children: item.label
								}, item.dayIndex)),
								heat.weeks.flatMap((week, weekIndex) => week.map((cell, dayIndex) => {
									const position = { gridColumn: weekIndex + 2, gridRow: dayIndex + 2 };
									if (cell === null) return react_jsx_runtime.jsx("span", { className: S.emptyCell, style: position, "aria-hidden": true }, `${weekIndex}-${dayIndex}`);
									const colors = cellColor(cell.tokens, heat.max);
									const isToday = cell.key === (today ?? todayKey());
									const hit = cell.hitRate === null || cell.hitRate === void 0 ? "" : ` · ${translate("usage.hitRate")} ${fmtHit(cell.hitRate)}`;
									const title = `${cell.key} · ${fmt(cell.tokens)} tokens${hit}`;
									return react_jsx_runtime.jsx("button", {
										type: "button",
										className: `${S.heatCell}${isToday ? ` ${S.heatCellToday}` : ""}${selectedKey === cell.key ? ` ${S.heatCellSelected}` : ""}`,
										style: { ...position, background: colors.background },
										title,
										"aria-label": title,
										onClick: () => onSelect(cell.key)
									}, cell.key);
								}))
							]
						})
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.heatLegend,
						children: [
							react_jsx_runtime.jsx("span", { children: translate("usage.legendLess") }),
							[0.22, 0.42, 0.6, 0.8, 1].map((alpha, index) => react_jsx_runtime.jsx("span", {
								className: S.heatSwatch,
								style: { background: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, ${alpha})` }
							}, index)),
							react_jsx_runtime.jsx("span", { children: translate("usage.legendMore") })
						]
					})
				]
			});
		}

		/**
		 * Balance card: the 消费金额 icon seat. Shows the selected API key's
		 * DeepSeek official balance with a key switcher.
		 */
		function BalanceCard({ keys, selectedKey, onSelectKey, account, accountLoading, accountError, balanceTone = "muted", translate, onRetry }) {
			const balance = account?.balance ?? null;
			const status = accountLoading && account === null ? "loading"
				: accountError !== null ? "error"
					: account === null ? "empty"
						: account.status === "ok" || account.status === "unavailable" ? account.status
							: account.status ?? "empty";
			const tone = status === "ok" ? "ok"
				: status === "loading" || status === "empty" ? "ok"
					: "bad";
			const statusText = status === "loading" ? translate("balance.status.loading")
				: status === "error" ? translate("balance.status.error")
					: status === "empty" ? translate("balance.status.empty")
						: status === "not-configured" ? translate("balance.status.notConfigured")
							: status === "unauthorized" ? translate("balance.status.unauthorized")
								: status === "rate-limited" ? translate("balance.status.rateLimited")
									: status === "unavailable" ? translate("balance.status.unavailable")
										: translate("balance.status.ok");
			const currencySymbol = balance?.currency === "USD" ? "$" : balance?.currency === "CNY" || balance?.currency === void 0 ? "¥" : balance?.currency;
			return react_jsx_runtime.jsxs("section", {
				className: S.balance,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.balanceHead,
						children: [
							react_jsx_runtime.jsx("span", {
								className: S.balanceIcon,
								"aria-hidden": true,
								children: currencySymbol
							}),
							react_jsx_runtime.jsxs("span", {
								className: S.balanceIdentity,
								children: [
									react_jsx_runtime.jsx("span", { className: S.balanceLabel, children: translate("balance.label") }),
									react_jsx_runtime.jsxs("span", {
										className: S.balanceMain,
										children: [
											react_jsx_runtime.jsx("span", {
												className: S.balanceAmount,
												children: status === "loading" ? "…" : balance === null ? "—" : fmtCurrency(balance.total, balance.currency)
											}),
											balance !== null && react_jsx_runtime.jsx("span", { className: S.balanceCurrency, children: balance.currency })
										]
									})
								]
							}),
							react_jsx_runtime.jsx("span", { className: S.badge, "data-tone": tone, children: statusText })
						]
					}),
					keys.length > 1 && react_jsx_runtime.jsxs("label", {
						className: S.pickerRow,
						children: [
							react_jsx_runtime.jsx("span", {
								className: S.pickerLabel,
								children: [
									react_jsx_runtime.jsx(primitives.IconApiOutline14, { size: 14 }),
									translate("balance.apiKey")
								]
							}),
							react_jsx_runtime.jsx("select", {
								className: S.select,
								value: selectedKey ?? "",
								"aria-label": translate("balance.apiKey"),
								onChange: (event) => onSelectKey(event.target.value),
								children: keys.map((key) => react_jsx_runtime.jsx("option", {
									value: key.id,
									children: `${key.label}${key.configured ? "" : ` (${translate("balance.unconfigured")})`}`
								}, key.id))
							})
						]
					}),
					status === "error" ? react_jsx_runtime.jsxs("div", {
						className: S.error,
						children: [
							react_jsx_runtime.jsx("span", { children: translate("balance.error", { message: accountError ?? "" }) }),
						react_jsx_runtime.jsx("button", { type: "button", className: S.retry, onClick: onRetry, children: translate("action.retry") })
						]
					}) : balance !== null && react_jsx_runtime.jsxs("div", {
						className: S.balanceRows,
						children: [
							{ value: balance.toppedUp, label: translate("balance.toppedUp") },
							{ value: balance.granted, label: translate("balance.granted") }
						].filter((row) => row.value !== void 0 && row.value !== null).map((row, index) => react_jsx_runtime.jsxs("div", {
							className: S.balanceRow,
							children: [
								react_jsx_runtime.jsx("span", { children: row.label }),
								react_jsx_runtime.jsx("b", { children: fmtCurrency(row.value, balance.currency) })
							]
						}, `${row.label}-${index}`))
					})
				]
			});
		}

		/** 24-hour input/output bars for one (filtered) day, scaled by cost. */
		function HourlyChart({ day, peakHours, money, translate }) {
			const [hoveredHour, setHoveredHour] = react.useState(null);
			const hours = day?.hours ?? [];
			const maxCost = hours.reduce((max, hour) => Math.max(max, Number(hour.cost) || 0), 0) || 1;
			const hovered = hoveredHour === null ? null : hours.find((item) => item.hour === hoveredHour) ?? null;
			return react_jsx_runtime.jsxs("div", {
				className: S.chart,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.chartInner,
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.chartBody,
								children: [
									peakHours.map(([start, end], index) => react_jsx_runtime.jsx("div", {
										className: S.peakRegion,
										"data-peak-region": true,
										style: { left: `${100 * start / 24}%`, width: `${100 * (end - start) / 24}%` }
									}, `peak-${index}`)),
									hours.map((hour) => {
										const cost = Number(hour.cost) || 0;
										const input = Number(hour.inputTokens) || 0;
										const output = Number(hour.outputTokens) || 0;
										return react_jsx_runtime.jsx("button", {
											type: "button",
											className: S.hourSlot,
											"data-hour": hour.hour,
											onMouseEnter: () => setHoveredHour(hour.hour),
											onClick: () => setHoveredHour(hoveredHour === hour.hour ? null : hour.hour),
											children: react_jsx_runtime.jsxs("div", {
												className: S.hourBar,
												style: { height: `${100 * cost / maxCost}%` },
												children: [
													react_jsx_runtime.jsx("div", {
														className: S.hourOutput,
														style: { flexBasis: `${100 * output / Math.max(input + output, 1)}%` }
													}),
													react_jsx_runtime.jsx("div", {
														className: S.hourInput,
														style: { flexBasis: `${100 * input / Math.max(input + output, 1)}%` }
													})
												]
											})
										}, hour.hour);
									}),
									hovered !== null && react_jsx_runtime.jsxs("div", {
										className: S.hourTooltip,
										style: { left: `${Math.min(72, 100 * (hovered.hour + 0.5) / 24)}%` },
										children: [
											react_jsx_runtime.jsxs("div", {
												className: S.hourTooltipHead,
												children: [
													`${String(hovered.hour).padStart(2, "0")}:00`,
													react_jsx_runtime.jsx("span", { className: S.hourTooltipAmount, children: money(hovered.cost) })
												]
											}),
											react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.input"), fmt(hovered.inputTokens)] }),
											react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.output"), fmt(hovered.outputTokens)] }),
											react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.cacheRead"), fmt(hovered.cacheReadTokens ?? 0)] }),
											react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.hitRate"), fmtHit(hitRateOf(hovered))] }),
											(hovered.models ?? []).length > 0 && react_jsx_runtime.jsxs("div", {
												className: S.hourTooltipModels,
												children: hovered.models.map((model) => react_jsx_runtime.jsxs("div", {
													className: S.hourTooltipModel,
													children: [
														react_jsx_runtime.jsx("span", { children: modelIdOf(model.model) }),
														react_jsx_runtime.jsx("span", { children: `${fmt(model.tokens)} · ${money(model.cost)}` })
													]
												}, model.model))
											})
										]
									})
								]
							}),
							react_jsx_runtime.jsx("div", {
								className: S.chartAxis,
								children: [0, 6, 12, 18, 23].map((hour) => react_jsx_runtime.jsx("span", { children: hour }, hour))
							})
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.legend,
						children: [
							react_jsx_runtime.jsxs("span", { className: S.legendItem, children: [
								react_jsx_runtime.jsx("span", { className: S.legendSwatch, style: { background: "var(--usg-blue)" } }),
								translate("usage.input")
							] }),
							react_jsx_runtime.jsxs("span", { className: S.legendItem, children: [
								react_jsx_runtime.jsx("span", { className: S.legendSwatch, style: { background: "var(--usg-green)" } }),
								translate("usage.output")
							] }),
							react_jsx_runtime.jsx("span", { className: S.peakNote, children: translate("chart.peakNote") })
						]
					})
				]
			});
		}

		/** One bar per day for a multi-day range, scaled by tokens. */
		function DayBarsChart({ rangeDays, money, translate }) {
			const [hoveredDay, setHoveredDay] = react.useState(null);
			const days = rangeDays ?? [];
			const maxTokens = days.reduce((max, day) => Math.max(max, Number(day.tokens) || 0), 0) || 1;
			const hovered = hoveredDay === null ? null : days.find((item) => item.date === hoveredDay) ?? null;
			return react_jsx_runtime.jsxs("div", {
				className: S.chart,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.dayBarsBody,
						children: [
							days.map((day) => react_jsx_runtime.jsx("button", {
								type: "button",
								className: S.dayBarSlot,
								"data-day": day.date,
								onMouseEnter: () => setHoveredDay(day.date),
								onMouseLeave: () => setHoveredDay((current) => current === day.date ? null : current),
								onClick: () => setHoveredDay(hoveredDay === day.date ? null : day.date),
								children: react_jsx_runtime.jsx("div", {
									className: S.dayBar,
									style: { width: "72%", height: `${100 * (Number(day.tokens) || 0) / maxTokens}%`, flex: "none", margin: "0 auto" }
								})
							}, day.date)),
							hovered !== null && react_jsx_runtime.jsxs("div", {
								className: S.hourTooltip,
								style: { left: `${Math.min(72, 100 * (days.indexOf(hovered) + 0.5) / days.length)}%` },
								children: [
									react_jsx_runtime.jsxs("div", { className: S.hourTooltipHead, children: [hovered.date, react_jsx_runtime.jsx("span", { className: S.hourTooltipAmount, children: money(hovered.cost) })] }),
									react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.total"), fmt(hovered.tokens)] }),
									react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.hitRate"), fmtHit(hitRateOf(hovered))] })
								]
							})
						]
					}),
					days.length > 0 && react_jsx_runtime.jsxs("div", {
						className: S.chartAxis,
						children: [days[0].date, days[days.length - 1].date].map((date) => react_jsx_runtime.jsx("span", { children: date }, date))
					})
				]
			});
		}

		/** Clickable recent-days list; selecting a day syncs the overview hourly chart. */
		function DayList({ days, selectedDay, onSelect, money, translate }) {
			const list = days ?? [];
			if (list.length === 0) return react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.noDays") });
			const maxTokens = list.reduce((max, day) => Math.max(max, Number(day.tokens) || 0), 0) || 1;
			return react_jsx_runtime.jsx("div", {
				className: S.days,
				children: list.map((day) => react_jsx_runtime.jsxs("button", {
					type: "button",
					className: S.day,
					"data-active": day.date === selectedDay ? "true" : void 0,
					onClick: () => onSelect(day.date),
					children: [
						react_jsx_runtime.jsx("span", { className: S.dayDate, children: day.date }),
						react_jsx_runtime.jsx("span", { className: S.dayTokens, children: fmt(day.tokens) }),
						react_jsx_runtime.jsx("span", { className: S.dayBar, style: { width: `${100 * (Number(day.tokens) || 0) / maxTokens}%` } }),
						react_jsx_runtime.jsx("span", { className: S.dayCost, children: money(day.cost) })
					]
				}, day.date))
			});
		}

		/** Per-model breakdown of one (filtered) day. */
		function DayDetail({ day, money, translate }) {
			if (day === null) return null;
			const models = day.models ?? [];
			const maxTokens = models.reduce((max, model) => Math.max(max, Number(model.tokens) || 0), 0) || 1;
			return react_jsx_runtime.jsxs("div", {
				className: S.detailSummary,
				children: [
					react_jsx_runtime.jsxs("div", { children: [translate("usage.input"), " ", fmt(day.inputTokens)] }),
					react_jsx_runtime.jsxs("div", { children: [translate("usage.output"), " ", fmt(day.outputTokens)] }),
					react_jsx_runtime.jsxs("div", { children: [translate("usage.cacheRead"), " ", fmt(day.cacheReadTokens ?? 0)] }),
					react_jsx_runtime.jsxs("div", { children: [translate("usage.hitRate"), " ", fmtHit(hitRateOf(day))] }),
					models.length === 0
						? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.noModels") })
						: react_jsx_runtime.jsxs("div", {
							children: groupModelsByProvider(models).map((group) => react_jsx_runtime.jsxs("div", {
								className: S.providerGroup,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.providerHead,
										children: [
											react_jsx_runtime.jsx("span", { className: S.providerName, children: group.provider === "deepseek-official" ? translate("usage.providerDeepseek") : group.provider }),
											react_jsx_runtime.jsx("span", { className: S.providerTokens, children: `${fmt(group.tokens)} tokens` }),
											react_jsx_runtime.jsx("span", { className: S.providerCost, children: group.models.some((model) => model.cost !== null) ? money(group.models.reduce((sum, model) => sum + (Number(model.cost) || 0), 0)) : translate("usage.notBilled") })
										]
									}),
									group.models.map((model) => react_jsx_runtime.jsxs("div", {
										className: S.modelRow,
										children: [
											react_jsx_runtime.jsxs("div", {
												className: S.modelHead,
												children: [
													react_jsx_runtime.jsx("span", { className: S.modelName, children: modelIdOf(model.model) }),
													react_jsx_runtime.jsx("span", { className: S.modelTokens, children: fmt(model.tokens) }),
													react_jsx_runtime.jsx("span", { className: S.modelCost, children: money(model.cost) })
												]
											}),
											react_jsx_runtime.jsx("div", {
												className: S.modelBarTrack,
												children: react_jsx_runtime.jsx("div", {
													className: S.modelBar,
													style: { width: `${100 * (Number(model.tokens) || 0) / maxTokens}%` }
												})
											}),
											react_jsx_runtime.jsx("div", { className: S.modelMeta, children: `${translate("usage.hitRate")} ${fmtHit(hitRateOf(model))}` })
										]
									}, model.model))
								]
							}, group.provider))
						})
				]
			});
		}

		/**
		 * Query-center body: overview/details tabs over the read-only usage data.
		 * All configuration lives in the native settings page; this panel only reads.
		 */
		function UsageStatsSection({ t, onClose, onOpenSettings }) {
			const translate = t ?? ((key) => key);
			const [usage, setUsage] = react.useState(null);
			const [keys, setKeys] = react.useState([]);
			const [selectedKey, setSelectedKey] = react.useState(null);
			const [balance, setBalance] = react.useState(null);
			const [balanceLoading, setBalanceLoading] = react.useState(false);
			const [usageLoading, setUsageLoading] = react.useState(false);
			const [loaded, setLoaded] = react.useState(false);
			const [error, setError] = react.useState(null);
			const [updatedAt, setUpdatedAt] = react.useState(null);
			const [refreshTick, setRefreshTick] = react.useState(0);
			const [activeTab, setActiveTab] = react.useState("overview");
			const [timeRange, setTimeRange] = react.useState("today");
			const [selectedDay, setSelectedDay] = react.useState(null);
			const [heatYear, setHeatYear] = react.useState(Number(todayKey().slice(0, 4)));
			const [modelFilter, setModelFilter] = react.useState("");
			const [limitStatusMap, setLimitStatusMap] = react.useState({});
			const loader = react.useRef(createLoader());

			const loadUsage = react.useCallback(() => {
				const request = loader.current.start();
				setUsageLoading(true);
				return fetchJson("/api/usage-stats/usage").then((payload) => {
					if (!loader.current.isCurrent(request)) return;
					setUsage(payload.ok === true ? payload : null);
					setError(null);
					setLoaded(true);
					setUpdatedAt(new Date().toLocaleTimeString());
				}).catch((err) => {
					if (!loader.current.isCurrent(request)) return;
					setError(err instanceof Error ? err.message : String(err));
					setLoaded(true);
				}).finally(() => {
					if (loader.current.isCurrent(request)) setUsageLoading(false);
				});
			}, []);
			const loadKeys = react.useCallback(() => {
				fetchJson("/api/usage-stats/keys").then((payload) => {
					if (payload.ok !== true) return;
					const list = Array.isArray(payload.keys) ? payload.keys : [];
					setKeys(list);
					setSelectedKey((current) => {
						if (current !== null && list.some((key) => key.id === current)) return current;
						return list.find((key) => key.default)?.id ?? list.find((key) => key.configured)?.id ?? list[0]?.id ?? null;
					});
				}).catch(() => {});
			}, []);
			const loadBalance = react.useCallback((keyRef) => {
				setBalanceLoading(true);
				const query = keyRef ? `?key=${encodeURIComponent(keyRef)}` : "";
				fetchJson(`/api/usage-stats/balance${query}`).then(setBalance).catch(() => setBalance(null)).finally(() => setBalanceLoading(false));
			}, []);
			react.useEffect(() => {
				loadUsage();
				loadKeys();
				fetchJson("/api/usage-stats/limits").then((payload) => setLimitStatusMap(payload.status ?? {})).catch(() => {});
				const timer = window.setInterval(loadUsage, 60000);
				return () => window.clearInterval(timer);
			}, [loadUsage, loadKeys]);
			react.useEffect(() => {
				loadBalance(selectedKey);
			}, [loadBalance, selectedKey]);

			const days = usage?.ok === true && Array.isArray(usage.days) ? usage.days : [];
			const serverToday = usage?.today ?? todayKey();
			const pricing = pricingOf(usage);
			const money = (value) => value === null || value === void 0 ? "—" : `${currencySymbol(pricing.currency)}${fmtMoney(value)}`;
			const stats = summarize(days, modelFilter, serverToday);
			const account = balance?.ok === true ? balance.account ?? null : null;
			const accountError = balance === null || balance?.ok === true ? null : balance?.message ?? "error";
			const balanceStatus = limitStatusMap?.[selectedKey ?? ""] ?? Object.values(limitStatusMap ?? {})[0] ?? null;
			const activeLimitStatus = balanceStatus;
			const todaySpendTone = limitToneOf(activeLimitStatus?.spendStatus);
			const todayLimitNum = Number(activeLimitStatus?.dailyCostLimit) || 0;
			const todaySpentNum = Number(activeLimitStatus?.todayCost ?? stats.todayCostPriced ?? stats.todayCost) || 0;
			const todayLimitPercent = todayLimitNum > 0 ? Math.min(100, Math.round(todaySpentNum / todayLimitNum * 100)) : 0;
				const activeDayKey = activeDayKeyOf(timeRange, selectedDay, serverToday);
			const activeDayObject = activeDayKey === null ? null : days.find((day) => day.date === activeDayKey) ?? null;
			const filteredActiveDay = activeDayObject === null ? null : filterDay(activeDayObject, modelFilter);
			const singleRange = timeRange === "today" || timeRange === "yesterday" || timeRange === "custom";
			const rangeDays = daysInRange(timeRange, serverToday).map((date) => days.find((day) => day.date === date) ?? { date, tokens: 0, cost: null });
			const recentList = recentDays(days.map((day) => filterDay(day, modelFilter)), serverToday);
			const timeRangeOptions = [
				{ value: "today", label: translate("usage.today") },
				{ value: "yesterday", label: translate("usage.rangeYesterday") },
				{ value: "7d", label: translate("usage.range7d") },
				{ value: "30d", label: translate("usage.range30d") },
				{ value: "month", label: translate("usage.month") },
				{ value: "lastMonth", label: translate("usage.rangeLastMonth") }
			];
			const heatDayMap = new Map(days.map((day) => [day.date, { tokens: day.tokens, cacheHitRate: hitRateOf(day) }]));
			const currentYear = Number(serverToday.slice(0, 4));
			const yearChoices = [];
			for (let year = YEAR_START; year <= currentYear; year += 1) yearChoices.push(year);
			const pickDay = (date) => {
				setSelectedDay(date === serverToday ? null : date);
				setTimeRange(date === serverToday ? "today" : "custom");
			};
			const refreshAll = () => {
				loadUsage();
				loadBalance(selectedKey);
				fetchJson("/api/usage-stats/limits").then((payload) => setLimitStatusMap(payload.status ?? {})).catch(() => {});
			};

			return react_jsx_runtime.jsxs("div", {
				className: S.section,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.header,
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.headerLeft,
								children: [
									react_jsx_runtime.jsx("span", { className: S.title, children: translate("panel.title") }),
									updatedAt !== null && react_jsx_runtime.jsx("span", { className: S.updated, children: translate("panel.updatedAt", { time: updatedAt }) })
								]
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.headerActions,
								children: [
									react_jsx_runtime.jsx("button", {
										type: "button",
									className: `${S.iconButton} ${S.refreshButton}`,
									"aria-label": translate("action.refresh"),
									"data-loading": usageLoading || balanceLoading,
									disabled: usageLoading || balanceLoading,
									onClick: () => {
										setRefreshTick((n) => n + 1);
										refreshAll();
									},
									children: react_jsx_runtime.jsxs("svg", { className: refreshTick > 0 ? `${S.refreshGlyph} ${S.refreshGlyphClick}` : S.refreshGlyph, width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [react_jsx_runtime.jsx("path", { d: "M21 12a9 9 0 1 1-6.22-8.56", key: "path1" }), react_jsx_runtime.jsx("polyline", { points: "21 3 21 9 15 9", key: "polyline1" })] }, refreshTick)
									}),
									react_jsx_runtime.jsx("button", {
										type: "button",
										className: S.settingsLink,
										"data-usage-stats-settings-link": true,
										onClick: onOpenSettings,
										children: translate("panel.gotoSettings")
									}),
									onClose !== undefined && react_jsx_runtime.jsx("button", {
										type: "button",
										className: S.iconButton,
										"aria-label": translate("action.close"),
										onClick: onClose,
										children: "✕"
									})
								]
							})
						]
					}),
					error !== null && react_jsx_runtime.jsxs("div", {
						className: S.error,
						children: [
							react_jsx_runtime.jsx("span", { children: translate("usage.error", { message: error }) }),
							react_jsx_runtime.jsx("button", { type: "button", className: S.retry, onClick: loadUsage, children: translate("action.retry") })
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.tabs,
						role: "tablist",
						"aria-label": translate("panel.tabs"),
						children: [
							react_jsx_runtime.jsx("button", {
								type: "button",
								role: "tab",
								className: S.tab,
								"data-active": activeTab === "overview" ? "true" : "false",
								"aria-selected": activeTab === "overview",
								onClick: () => setActiveTab("overview"),
								children: translate("panel.tabOverview")
							}),
							react_jsx_runtime.jsx("button", {
								type: "button",
								role: "tab",
								className: S.tab,
								"data-active": activeTab === "details" ? "true" : "false",
								"aria-selected": activeTab === "details",
								onClick: () => setActiveTab("details"),
								children: translate("panel.tabDetails")
							})
						]
					}),
					loaded === false ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.loading") }) : activeTab === "overview" ? react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
						children: [
							react_jsx_runtime.jsx(BalanceCard, {
								keys,
								selectedKey,
								onSelectKey: setSelectedKey,
								account,
								accountLoading: balanceLoading,
								accountError,
								balanceTone: limitToneOf(balanceStatus?.balanceAlertStatus),
								translate,
								onRetry: () => loadBalance(selectedKey)
							}),
							todayLimitNum > 0 && react_jsx_runtime.jsxs("div", {
								className: S.usageLimitBanner,
								style: { "--usage-progress": `${todayLimitPercent}%` },
								"data-status": activeLimitStatus?.status || "normal",
								children: [
									react_jsx_runtime.jsx("strong", { children: translate(limitStatusLabelKey(activeLimitStatus?.status)) }),
									react_jsx_runtime.jsx("span", { children: translate("limits.progress", { spent: money(todaySpentNum), limit: money(todayLimitNum), percent: String(todayLimitPercent) }) })
								]
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.statsRow,
								children: [
									react_jsx_runtime.jsxs("div", { className: S.stat, children: [
										react_jsx_runtime.jsx("span", { className: S.statValue, children: fmt(stats.todayTokens) }),
										react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.today") })
									] }),
									react_jsx_runtime.jsxs("div", { className: S.stat, children: [
										react_jsx_runtime.jsx("span", { className: S.statValue, children: fmt(stats.monthTokens) }),
										react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.month") })
									] }),
									react_jsx_runtime.jsxs("div", { className: S.stat, children: [
										react_jsx_runtime.jsx("span", { className: S.statValue, children: fmt(stats.totalTokens) }),
										react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.total") })
									] }),
									react_jsx_runtime.jsxs("div", { className: S.stat, children: [
										react_jsx_runtime.jsx("span", { className: `${S.statValue} ${S.statMoney}`, title: stats.todayUnpriced ? translate("usage.unpricedNote") : void 0, children: `${money(stats.todayCostPriced ?? stats.todayCost)}${stats.todayUnpriced ? " *" : ""}` }),
										react_jsx_runtime.jsx("span", { className: S.statLabel, children: stats.todayUnpriced ? translate("usage.costTodayUnpriced") : translate("usage.costToday") })
									] })
								]
							}),
							usage?.costBasis?.legacy === "legacy-estimated" && react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.legacyEstimated") }),
							react_jsx_runtime.jsxs("section", {
								className: S.card,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.heatHeader,
										children: [
											react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("usage.heatmap", { year: heatYear }) }),
											react_jsx_runtime.jsx("select", {
												className: S.yearSelect,
												"aria-label": translate("usage.year"),
												value: heatYear,
												onChange: (event) => setHeatYear(Number(event.target.value) || heatYear),
												children: yearChoices.map((year) => react_jsx_runtime.jsx("option", { value: year, children: year }, year))
											})
										]
									}),
									react_jsx_runtime.jsx(ContributionHeatmap, {
										heat: buildYearContributionHeatmap(heatDayMap, heatYear),
										translate,
										selectedKey: selectedDay,
										onSelect: pickDay,
										today: serverToday
									})
								]
							}),
							react_jsx_runtime.jsxs("section", {
								className: S.card,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.cardHead,
										children: [
											react_jsx_runtime.jsx("span", {
												className: S.cardTitle,
												children: [
													react_jsx_runtime.jsx(primitives.IconDataOutline16, { size: 14 }),
													translate("usage.hourly")
												]
											}),
											react_jsx_runtime.jsxs("div", {
												className: S.hourControls,
												children: [
													react_jsx_runtime.jsx("select", {
														className: `${S.select} ${S.hourRangeSelect}`,
														value: timeRange === "custom" ? "custom" : timeRange,
														"aria-label": translate("usage.timeRange"),
														onChange: (event) => {
															setTimeRange(event.target.value);
															if (event.target.value !== "custom") setSelectedDay(null);
														},
														children: [
															...timeRangeOptions.map((option) => react_jsx_runtime.jsx("option", { value: option.value, children: option.label }, option.value)),
															timeRange === "custom" ? react_jsx_runtime.jsx("option", { value: "custom", children: selectedDay ?? serverToday }, "custom") : null
														]
													}),
												singleRange && react_jsx_runtime.jsxs("div", {
													className: S.dayNav,
													children: [
																	react_jsx_runtime.jsx("button", { type: "button", className: S.navButton, "aria-label": translate("action.prevDay"), disabled: recentList.length === 0 || activeDayKey >= recentList[0].date, onClick: () => { const index = recentList.findIndex((day) => day.date === activeDayKey); if (index < recentList.length - 1) pickDay(recentList[index + 1].date); }, children: react_jsx_runtime.jsx(primitives.IconChevronLeftOutline14, { size: 12 }) }),
												react_jsx_runtime.jsx("span", { className: S.dayTitle, children: dayLabel(activeDayKey, translate) }),
																	react_jsx_runtime.jsx("button", { type: "button", className: S.navButton, "aria-label": translate("action.nextDay"), disabled: activeDayKey <= recentList[recentList.length - 1]?.date, onClick: () => { const index = recentList.findIndex((day) => day.date === activeDayKey); if (index > 0) pickDay(recentList[index - 1].date); }, children: react_jsx_runtime.jsx(primitives.IconChevronRightOutline14, { size: 12 }) }),
														react_jsx_runtime.jsx("button", { type: "button", className: S.todayButton, onClick: () => { setSelectedDay(null); setTimeRange("today"); }, children: translate("action.today") })
													]
												})
											]
										})
									]
								}),
									singleRange ? react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
										children: [
											activeDayKey === null
												? react_jsx_runtime.jsx("p", { className: S.note, children: translate("chart.empty") })
												: react_jsx_runtime.jsx(HourlyChart, { day: filteredActiveDay, peakHours: pricing.peakHours, money, translate }),
											filteredActiveDay !== null && react_jsx_runtime.jsx(DayDetail, { day: filteredActiveDay, money, translate })
										]
									}) : react_jsx_runtime.jsx(DayBarsChart, { rangeDays, money, translate })
								]
							})
						]
					}) : react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
						children: [
							react_jsx_runtime.jsxs("label", {
								className: S.pickerRow,
								children: [
									react_jsx_runtime.jsx("span", { className: S.pickerLabel, children: translate("usage.model") }),
									react_jsx_runtime.jsx("select", {
										className: S.select,
										value: modelFilter,
										"aria-label": translate("usage.model"),
										onChange: (event) => setModelFilter(event.target.value),
										children: [
											react_jsx_runtime.jsx("option", { value: "", children: translate("usage.allModels") }, "all"),
											...modelChoicesOf(days).map((model) => react_jsx_runtime.jsx("option", { value: model, children: model }, model))
										]
									})
								]
							}),
							react_jsx_runtime.jsxs("section", {
								className: S.card,
								children: [
									react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("usage.recent") }),
									usage?.costBasis?.legacy === "legacy-estimated" ? react_jsx_runtime.jsx("p", { className: S.hint, children: translate("usage.legacyEstimated") }) : null,
									react_jsx_runtime.jsx(DayList, {
										days: recentList,
										selectedDay: activeDayKey,
										onSelect: (date) => {
											pickDay(date);
											setActiveTab("overview");
										},
										money,
										translate
									})
								]
							})
						]
					})
				]
			});
		}
		//#endregion


		/**
		 * Open the native Harness settings dialog from the query panel. The
		 * settings shell exposes no programmatic open API to plugins, so this
		 * clicks the sidebar settings trigger — identified by its dialog
		 * affordance and scoped to the sidebar footer host that also contains
		 * our own trigger (never a broad substring match on labels). The
		 * registered「用量与计费」section then appears in the settings nav.
		 * @param layerEl - our sidebar layer element; the search walks up to
		 *   the footer host that contains both triggers.
		 * @returns whether the trigger was found and clicked.
		 */
		function openHarnessSettings(layerEl) {
			let host = layerEl?.parentElement ?? null;
			let opened = false;
			for (let depth = 0; host !== null && depth < 4; depth += 1) {
				const button = host.querySelector?.('button[aria-haspopup="dialog"]');
				if (button !== null && button !== void 0 && typeof button.click === "function") {
					button.click();
					opened = true;
					break;
				}
				host = host.parentElement;
			}
			if (!opened || typeof document === "undefined") return opened;
			const labels = new Set(["用量与计费", "Usage & Billing"]);
			let attempts = 0;
			const selectSection = () => {
				const candidates = document.querySelectorAll("button,[role=button],a,[tabindex]");
				for (const candidate of candidates) {
					if (labels.has(candidate.textContent?.trim()) && candidate.getClientRects().length > 0) {
						candidate.click();
						return;
					}
				}
				if (attempts++ < 12) window.setTimeout(selectSection, 50);
			};
			window.setTimeout(selectSection, 0);
			return true;
		}
		//#region settings section
		/**
		 * The「用量与计费」settings page, registered as a native
		 * `settings.section`. Hosts configuration that changes billing or call
		 * behavior: 账户与余额 / 预算与限额 / 价格设置 / 通知与提示 / 数据管理.
		 * The query panel stays read-only; every write-affecting control lives
		 * here.
		 * @param props - t bound by the slot runtime (locale seat).
		 */
		/** Settings tab: quota limits with immediate saves (no submit button). */
		function LimitsCard({ keys, selectedKey, onSelectKey, pricing, todayCost, translate, onLimitsUpdated }) {
			const [limits, setLimits] = react.useState(null);
			const limitsRef = react.useRef(null);
			const [statusMap, setStatusMap] = react.useState({});
			const [saving, setSaving] = react.useState(false);
			const [error, setError] = react.useState(null);
			const [stopOnExceed, setStopOnExceed] = react.useState(false);
			const multiKey = (keys ?? []).length > 1;
			const targetKey = multiKey ? (selectedKey ?? "__global__") : "__global__";

			react.useEffect(() => {
				fetchJson("/api/usage-stats/limits").then((payload) => {
					if (payload.ok !== true) return;
					limitsRef.current = payload.limits;
					setLimits(payload.limits);
					setStatusMap(payload.status ?? {});
				}).catch(() => {});
			}, []);

			const rule = limits === null
				? null
				: targetKey === "__global__"
					? limits.global ?? {}
					: limits.keys?.[targetKey] ?? {};
			const alertPercent = Number(rule?.alertPercent) || 80;
			const criticalPercent = Math.max(alertPercent, Number(rule?.criticalPercent) || 90);
			const disabled = limits === null || saving;

			const patchLocal = (patch) => {
				setLimits((doc) => {
					if (doc === null) return doc;
					if (targetKey === "__global__") return { ...doc, global: { ...doc.global, ...patch } };
					return { ...doc, keys: { ...(doc.keys ?? {}), [targetKey]: { ...(doc.keys?.[targetKey] ?? {}), ...patch } } };
				});
			};
			const parseAmount = (text) => {
				const trimmed = String(text ?? "").trim();
				if (trimmed === "") return null;
				const value = Number(trimmed);
				return Number.isFinite(value) && value > 0 ? value : null;
			};
			const handleSave = async (patch) => {
				const doc = limitsRef.current;
				if (doc === null) return;
				const isGlobal = targetKey === "__global__";
				const base = isGlobal ? doc.global ?? {} : doc.keys?.[targetKey] ?? {};
				const merged = { ...base, ...patch };
				const next = isGlobal
					? { ...doc, global: merged }
					: { ...doc, keys: { ...(doc.keys ?? {}), [targetKey]: merged } };
				setSaving(true);
				setError(null);
				try {
					const payload = await fetchJson("/api/usage-stats/limits", { method: "POST", body: next });
					if (payload.ok !== true) throw new Error(payload.message ?? "save failed");
					limitsRef.current = payload.limits;
					setStatusMap(payload.status ?? {});
					onLimitsUpdated?.();
					if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
						window.dispatchEvent(new Event("usage-stats:limits-updated"));
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			const currentStatus = statusMap[targetKey] ?? Object.values(statusMap)[0] ?? null;
			const currentStatusTone = limitToneOf(currentStatus?.status);
			const currentLimit = Number(currentStatus?.dailyCostLimit) || 0;
			const currentSpent = Number(currentStatus?.todayCost ?? todayCost) || 0;
			const currentPercent = currentLimit > 0 ? Math.min(100, Math.round(100 * currentSpent / currentLimit)) : 0;

			return react_jsx_runtime.jsxs("div", {
				className: S.limitCard,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.limitCardHead,
						children: [
							react_jsx_runtime.jsx("span", { className: S.limitTitle, children: translate("limits.title") }),
							saving ? react_jsx_runtime.jsx("span", { className: S.note, children: translate("limits.saving") }) : null
						]
					}),
					error !== null && react_jsx_runtime.jsxs("div", {
						className: S.error,
						children: [react_jsx_runtime.jsx("span", { children: translate("limits.saveError", { message: error }) })]
					}),
					multiKey && react_jsx_runtime.jsxs("label", {
						className: S.pickerRow,
						children: [
							react_jsx_runtime.jsx("span", { className: S.pickerLabel, children: translate("limits.apiKey") }),
							react_jsx_runtime.jsx("select", {
								className: S.select,
								value: targetKey,
								"aria-label": translate("limits.apiKey"),
								onChange: (event) => onSelectKey(event.target.value),
								children: [
									react_jsx_runtime.jsx("option", { value: "__global__", children: translate("limits.global") }, "__global__"),
									...keys.map((key) => react_jsx_runtime.jsx("option", { value: key.id, children: key.label }, key.id))
								]
							})
						]
					}),
					currentStatus !== null && react_jsx_runtime.jsxs("div", {
						className: S.statusBanner,
						"data-status": currentStatus.status,
						style: { "--usage-progress": `${currentPercent}%` },
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.bannerHead,
								children: [
									react_jsx_runtime.jsx("span", { className: S.bannerTitle, children: translate(limitStatusLabelKey(currentStatus.status)) }),
									currentStatus.status !== "normal" ? react_jsx_runtime.jsx("span", { className: S.badge, "data-tone": currentStatusTone, children: translate(limitStatusLabelKey(currentStatus.status)) }) : null
								]
							}),
							currentLimit > 0 && react_jsx_runtime.jsx("span", { className: S.bannerMsg, children: translate("limits.progress", { spent: currentSpent.toFixed(2), limit: currentLimit.toFixed(2), percent: currentPercent }) }),
							currentLimit > 0 && react_jsx_runtime.jsx("div", {
								className: S.progressTrack,
								children: react_jsx_runtime.jsx("div", {
									className: S.progressBar,
									"data-status": currentStatus.status,
									style: { width: `${currentPercent}%` }
								})
							}),
							typeof currentStatus.message === "string" && currentStatus.message !== "" ? react_jsx_runtime.jsx("span", { className: S.bannerMsg, children: currentStatus.message }) : null
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.limitGrid,
						children: [
							react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("limits.groupSpend") }),
							react_jsx_runtime.jsxs("div", {
								className: S.toggleGrid,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.toggleRow,
										children: [
											react_jsx_runtime.jsxs("div", {
												className: S.toggleInfo,
												children: [
													react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate("limits.enable") }),
													react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate("limits.enableDesc") })
												]
											}),
											react_jsx_runtime.jsxs("label", {
												className: S.switch,
												children: [
													react_jsx_runtime.jsx("input", {
														type: "checkbox",
														checked: rule?.enabled === true,
														disabled,
														onChange: (event) => {
															patchLocal({ enabled: event.target.checked });
															handleSave({ enabled: event.target.checked });
														}
													}),
													react_jsx_runtime.jsx("span", { className: S.switchSlider })
												]
											})
										]
									})
								]
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.limitField,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.limitFieldLabel,
										children: [
											react_jsx_runtime.jsx("span", { children: translate("limits.dailyLimit") }),
											pricing?.currency ? react_jsx_runtime.jsx("span", { className: S.note, children: pricing.currency }) : null
										]
									}),
									react_jsx_runtime.jsx("div", {
										className: S.inputWrapper,
										children: react_jsx_runtime.jsx("input", {
											type: "text",
											inputMode: "decimal",
											className: `${S.input} has_prefix`,
											disabled,
											placeholder: translate("limits.dailyLimitPlaceholder"),
											defaultValue: rule?.dailyCostLimit ?? "",
											onBlur: (event) => handleSave({ dailyCostLimit: parseAmount(event.currentTarget.value) }),
											onKeyDown: (event) => {
												if (event.key === "Enter") event.currentTarget.blur();
											}
										})
									})
								]
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.limitField,
								children: [
									react_jsx_runtime.jsx("div", {
										className: S.limitFieldLabel,
										children: react_jsx_runtime.jsx("span", { children: translate("limits.alertPercent") })
									}),
									react_jsx_runtime.jsxs("div", {
										className: S.alertCard,
										children: [
											react_jsx_runtime.jsxs("div", {
												className: S.alertHead,
												children: [
													react_jsx_runtime.jsx("span", { children: translate("limits.alertPercent") }),
													react_jsx_runtime.jsx("span", { className: S.alertValue, children: `${alertPercent}% / ${criticalPercent}%` })
												]
											}),
											react_jsx_runtime.jsxs("div", {
												className: S.alertTrack,
												style: { "--alert-percent": `${alertPercent}%`, "--critical-percent": `${criticalPercent}%` },
												children: [
													react_jsx_runtime.jsx("input", {
														type: "range",
														min: 1,
														max: 99,
														value: alertPercent,
														className: S.alertRange,
														disabled,
														onChange: (event) => patchLocal({ alertPercent: Math.min(Number(event.target.value), criticalPercent - 1) }),
														onPointerUp: () => handleSave({ alertPercent, criticalPercent }),
														onKeyUp: () => handleSave({ alertPercent, criticalPercent })
													}),
													react_jsx_runtime.jsx("input", {
														type: "range",
														min: 2,
														max: 100,
														value: criticalPercent,
														className: `${S.alertRange} is-overlay`,
														disabled,
														onChange: (event) => patchLocal({ criticalPercent: Math.max(Number(event.target.value), alertPercent + 1) }),
														onPointerUp: () => handleSave({ alertPercent, criticalPercent }),
														onKeyUp: () => handleSave({ alertPercent, criticalPercent })
													})
												]
											}),
											react_jsx_runtime.jsxs("div", {
												className: S.alertLegend,
												children: [
													react_jsx_runtime.jsx("span", { children: translate("limits.alertExceeded", { percent: alertPercent }) }),
													react_jsx_runtime.jsx("span", { children: translate("limits.alertWarning", { percent: alertPercent, critical: criticalPercent }) }),
													react_jsx_runtime.jsx("span", { children: translate("limits.alertNormal", { percent: criticalPercent }) })
												]
											})
										]
									})
								]
							}),
							react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("limits.groupBalance") }),
							react_jsx_runtime.jsxs("div", {
								className: S.limitField,
								children: [
									react_jsx_runtime.jsx("div", {
										className: S.limitFieldLabel,
										children: react_jsx_runtime.jsx("span", { children: translate("limits.lowBalance") })
									}),
									react_jsx_runtime.jsx("div", {
										className: S.inputWrapper,
										children: react_jsx_runtime.jsx("input", {
											type: "text",
											inputMode: "decimal",
											className: `${S.input} has_prefix`,
											disabled,
											placeholder: translate("limits.lowBalancePlaceholder"),
											defaultValue: rule?.lowBalanceWarning ?? "",
											onBlur: (event) => handleSave({ lowBalanceWarning: parseAmount(event.currentTarget.value) }),
											onKeyDown: (event) => {
												if (event.key === "Enter") event.currentTarget.blur();
											}
										})
									})
								]
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.limitField,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.limitFieldLabel,
										children: [
											react_jsx_runtime.jsx("span", { children: translate("limits.stopOnExceed") })
										]
									}),
									react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate("limits.stopDesc") }),
									react_jsx_runtime.jsxs("label", {
										className: S.switch,
										children: [
											react_jsx_runtime.jsx("input", {
												type: "checkbox",
												checked: stopOnExceed,
												disabled,
												onChange: (event) => {
													setStopOnExceed(event.target.checked);
													handleSave({ stopOnExceed: event.target.checked });
												}
											}),
											react_jsx_runtime.jsx("span", { className: S.switchSlider })
										]
									})
								]
							})
						]
					})
				]
			});
		}

		/** Settings tab: account snapshots, refresh cadence and sidebar display toggles. */
		function AccountsCard({ keys, translate }) {
			const [payload, setPayload] = react.useState(null);
			const [refreshing, setRefreshing] = react.useState(false);
			const [error, setError] = react.useState(null);
			const singleKey = (keys ?? []).length <= 1;
			const load = react.useCallback(() => {
				fetchJson("/api/usage-stats/accounts").then(setPayload).catch(() => {});
			}, []);
			react.useEffect(() => { load(); }, [load]);
			const display = payload?.settings?.display ?? { balance: true, todayCost: true, statusDot: true };
			const refreshMs = payload?.settings?.refreshMs ?? null;
			const accounts = payload?.accounts ?? {};
			const savePatch = async (patch) => {
				setError(null);
				try {
					const updated = await fetchJson("/api/usage-stats/accounts", { method: "POST", body: patch });
					if (updated.ok !== true) throw new Error(updated.message ?? "save failed");
					setPayload((current) => current === null ? current : { ...current, settings: updated.settings });
					if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
						window.dispatchEvent(new Event("usage-stats:accounts-updated"));
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const statusLabelKey = (status) => status === "ok" ? "balance.status.ok"
				: status === "not-configured" ? "balance.status.notConfigured"
					: status === "unauthorized" ? "balance.status.unauthorized"
						: status === "rate-limited" ? "balance.status.rateLimited"
							: status === "unavailable" ? "balance.status.unavailable"
								: status === "pending" ? "balance.status.loading"
									: "balance.status.error";
			return react_jsx_runtime.jsxs("section", {
				className: S.card,
				"data-usage-accounts-card": true,
				children: [
					react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("accounts.title") }),
					error !== null && react_jsx_runtime.jsx("div", { className: S.error, children: translate("accounts.saveError", { message: error }) }),
					(keys ?? []).map((key) => {
						const account = accounts[key.id];
						const balance = account?.balance ?? null;
						const tone = account?.status === "ok" ? "ok" : account?.status === "not-configured" || account?.status === "pending" ? "muted" : "bad";
						return react_jsx_runtime.jsxs("div", {
							className: S.row,
							children: [
								react_jsx_runtime.jsxs("div", {
									className: S.toggleInfo,
									children: [
										react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: singleKey ? translate("accounts.defaultAccount") : key.label }),
										key.default ? react_jsx_runtime.jsx("span", { className: S.tag, "data-tone": "ok", children: translate("accounts.default") }) : null,
										!key.configured ? react_jsx_runtime.jsx("span", { className: S.tag, "data-tone": "warn", children: translate("balance.unconfigured") }) : null
									]
								}),
								react_jsx_runtime.jsxs("div", {
									className: S.toggleInfo,
									children: [
										react_jsx_runtime.jsx("span", { className: S.rowValue, children: balance === null ? "—" : fmtCurrency(balance.total, balance.currency) }),
										react_jsx_runtime.jsx("span", { className: S.note, children: translate(statusLabelKey(account?.status ?? "pending")) })
									]
								})
							]
						}, key.id);
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.row,
						children: [
							react_jsx_runtime.jsx("span", { className: S.rowLabel, children: translate("accounts.refreshCadence") }),
							react_jsx_runtime.jsx("select", {
								className: S.select,
								value: refreshMs === null ? "off" : String(refreshMs),
								"aria-label": translate("accounts.refreshCadence"),
								onChange: (event) => {
									const next = event.target.value === "off" ? null : Number(event.target.value);
									savePatch({ refreshMs: next });
								},
								children: [
									react_jsx_runtime.jsx("option", { value: "off", children: translate("accounts.refreshOff") }, "off"),
									react_jsx_runtime.jsx("option", { value: "60000", children: translate("accounts.refresh1min") }, "60000"),
									react_jsx_runtime.jsx("option", { value: "300000", children: translate("accounts.refresh5min") }, "300000"),
									react_jsx_runtime.jsx("option", { value: "900000", children: translate("accounts.refresh15min") }, "900000"),
									react_jsx_runtime.jsx("option", { value: "1800000", children: translate("accounts.refresh30min") }, "1800000")
								]
							})
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.toggleGrid,
						children: [
							[["balance", "accounts.showBalance"], ["todayCost", "accounts.showToday"], ["statusDot", "accounts.showStatus"]].map(([field, labelKey]) => react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate(labelKey) }),
									react_jsx_runtime.jsxs("label", {
										className: S.switch,
										children: [
											react_jsx_runtime.jsx("input", {
												type: "checkbox",
												checked: display[field] !== false,
												onChange: (event) => savePatch({ display: { ...display, [field]: event.target.checked } })
											}),
											react_jsx_runtime.jsx("span", { className: S.switchSlider })
										]
									})
								]
							}, field))
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.btnRow,
						children: [
							react_jsx_runtime.jsx("button", {
								type: "button",
								className: S.btn,
								disabled: refreshing,
								onClick: () => {
									setRefreshing(true);
									fetchJson("/api/usage-stats/balance?refresh=1").catch(() => {}).finally(() => {
										load();
										setRefreshing(false);
									});
								},
								children: refreshing ? translate("accounts.refreshing") : translate("accounts.refreshNow")
							})
						]
					})
				]
			});
		}

		/** Settings tab: official vs custom pricing with a fork/restore editor. */
		function PricingCard({ translate, onPricingUpdated }) {
			const [payload, setPayload] = react.useState(null);
			const [draft, setDraft] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [saving, setSaving] = react.useState(false);
			const load = react.useCallback(() => {
				fetchJson("/api/usage-stats/pricing").then(setPayload).catch(() => {});
			}, []);
			react.useEffect(() => { load(); }, [load]);
			const current = payload?.current ?? null;
			const official = payload?.official ?? null;
			const usingCustom = payload?.usingCustom === true;
			const currency = current?.currency ?? "CNY";
			const PERIODS = ["offPeak", "peak"];
			const FIELDS = ["inputMiss", "inputHit", "output"];
			const draftOf = (models) => Object.fromEntries(Object.entries(models ?? {}).map(([model, row]) => [model, {
				offPeak: Object.fromEntries(FIELDS.map((field) => [field, String(row?.offPeak?.[field] ?? "")])),
				peak: Object.fromEntries(FIELDS.map((field) => [field, String(row?.peak?.[field] ?? "")]))
			}]));
			const toNumericModels = (models) => Object.fromEntries(Object.entries(models ?? {}).map(([model, row]) => [model, {
				offPeak: Object.fromEntries(FIELDS.map((field) => [field, Number(row?.offPeak?.[field]) || 0])),
				peak: Object.fromEntries(FIELDS.map((field) => [field, Number(row?.peak?.[field]) || 0]))
			}]));
			const handleFork = () => setDraft(draftOf(current?.models));
			const handleRestore = async () => {
				setSaving(true);
				setError(null);
				try {
					const result = await fetchJson("/api/usage-stats/pricing", { method: "POST", body: { action: "restore" } });
					if (result.ok !== true) throw new Error(result.message ?? "restore failed");
					setDraft(null);
					await load();
					onPricingUpdated?.();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			const handleSaveCustom = async () => {
				setSaving(true);
				setError(null);
				try {
					const result = await fetchJson("/api/usage-stats/pricing", { method: "POST", body: { mode: "custom", pricing: { currency, models: toNumericModels(draft) } } });
					if (result.ok !== true) throw new Error(result.message ?? "save failed");
					setDraft(null);
					await load();
					onPricingUpdated?.();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			const rows = Object.entries((draft ?? current)?.models ?? {});
			const checkedAtText = payload?.checkedAt ? new Date(payload.checkedAt).toLocaleString() : "—";
			const staleDays = payload?.checkedAt ? Math.floor((Date.now() - new Date(payload.checkedAt).getTime()) / 86400000) : 0;
			return react_jsx_runtime.jsxs("section", {
				className: S.card,
				"data-usage-pricing-card": true,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.cardHead,
						children: [
							react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("pricing.title") }),
							react_jsx_runtime.jsx("span", { className: S.tag, "data-tone": usingCustom ? "warn" : "ok", children: usingCustom ? translate("pricing.custom") : translate("pricing.official") })
						]
					}),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("pricing.basis", { currency }) }),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("pricing.checkedAt", { time: checkedAtText }) }),
					staleDays > 30 && react_jsx_runtime.jsx("p", { className: S.hint, children: translate("pricing.stale", { days: staleDays }) }),
					error !== null && react_jsx_runtime.jsx("div", { className: S.error, children: translate("pricing.saveError", { message: error }) }),
					react_jsx_runtime.jsx("div", {
						className: S.tableScroll,
						children: react_jsx_runtime.jsxs("table", {
							className: S.modelTable,
							children: [
								react_jsx_runtime.jsxs("thead", {
									children: [
										react_jsx_runtime.jsxs("tr", {
											children: [
												react_jsx_runtime.jsx("th", { rowSpan: 2, children: translate("usage.model") }),
												react_jsx_runtime.jsx("th", { className: S.thGroup, colSpan: 3, children: translate("pricing.offPeak") }),
												react_jsx_runtime.jsx("th", { className: S.thGroup, colSpan: 3, children: translate("pricing.peak") })
											]
										}),
										react_jsx_runtime.jsxs("tr", {
											children: [
												...PERIODS.map((period) => FIELDS.map((field) => {
													const labelKey = field === "inputMiss" ? "pricing.colMiss" : field === "inputHit" ? "pricing.colHit" : "pricing.colOutput";
													return react_jsx_runtime.jsx("th", { children: translate(labelKey) }, `${period}-${field}`);
												}))
											].flat()
										})
									]
								}),
								react_jsx_runtime.jsxs("tbody", {
									children: rows.map(([model, row]) => react_jsx_runtime.jsxs("tr", {
										children: [
											react_jsx_runtime.jsx("td", { className: S.modelName, children: model }),
											...PERIODS.map((period) => FIELDS.map((field) => {
												const officialRow = official?.models?.[model];
												const officialValue = period === "offPeak" ? officialRow?.offPeak?.[field] : officialRow?.peak?.[field];
												const liveValue = period === "offPeak" ? current?.models?.[model]?.offPeak?.[field] : current?.models?.[model]?.peak?.[field];
												if (draft !== null) {
													return react_jsx_runtime.jsx("td", {
														children: react_jsx_runtime.jsx("input", {
															type: "text",
															inputMode: "decimal",
															className: S.priceInput,
															value: row?.[period]?.[field] ?? "",
															onChange: (event) => setDraft((current2) => ({ ...current2, [model]: { ...current2[model], [period]: { ...current2[model]?.[period], [field]: event.target.value } } }))
														})
													}, `${model}-${period}-${field}`);
												}
												return react_jsx_runtime.jsx("td", {
													className: S.diffCell,
													"data-diff": officialValue !== liveValue ? "true" : void 0,
													children: String(liveValue ?? "—")
												}, `${model}-${period}-${field}`);
											})).flat()
										]
									}, model))
								})
							]
						})
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.btnRow,
						children: [
							draft !== null ? react_jsx_runtime.jsx("button", {
								type: "button",
								className: S.btn,
								disabled: saving,
								onClick: handleSaveCustom,
								children: translate("pricing.saveCustom")
							}) : react_jsx_runtime.jsx("button", {
								type: "button",
								className: S.btn,
								disabled: saving,
								onClick: handleFork,
								children: usingCustom ? translate("pricing.edit") : translate("pricing.fork")
							}),
							draft !== null ? react_jsx_runtime.jsx("button", {
								type: "button",
								className: `${S.btn} ${S.btnGhost}`,
								disabled: saving,
								onClick: () => setDraft(null),
								children: translate("data.cancel")
							}) : react_jsx_runtime.jsx("button", {
								type: "button",
								className: `${S.btn} ${S.btnGhost}`,
								disabled: saving || !usingCustom,
								onClick: handleRestore,
								children: translate("pricing.restore")
							})
						]
					})
				]
			});
		}

		/** Settings tab: notification channels, event types, cooldown and history. */
		function NotificationsCard({ translate }) {
			const [policy, setPolicy] = react.useState(null);
			const [alerts, setAlerts] = react.useState([]);
			const [error, setError] = react.useState(null);
			const load = react.useCallback(() => {
				fetchJson("/api/usage-stats/alerts").then((payload) => {
					setPolicy(payload.notifications ?? {});
					setAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
				}).catch(() => {});
			}, []);
			react.useEffect(() => { load(); }, [load]);
			const channels = policy?.channels ?? { sidebar: true, toast: false };
			const events = policy?.events ?? { warning: true, exceeded: true, lowBalance: true, recovery: true };
			const cooldownMs = Number(policy?.cooldownMs) || 1800000;
			const savePolicy = async (patch) => {
				setError(null);
				try {
					const updated = await fetchJson("/api/usage-stats/alerts", { method: "POST", body: { notifications: { ...(policy ?? {}), ...patch } } });
					if (updated.ok !== true) throw new Error(updated.message ?? "save failed");
					setPolicy(updated.notifications);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			return react_jsx_runtime.jsxs("section", {
				className: S.card,
				"data-usage-notifications-card": true,
				children: [
					react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("notifications.title") }),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("notifications.desc") }),
					error !== null && react_jsx_runtime.jsx("div", { className: S.error, children: translate("notifications.saveError", { message: error }) }),
					react_jsx_runtime.jsxs("div", {
						className: S.toggleGrid,
						children: [
							react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("notifications.channels") }),
							[["sidebar", "notifications.channelSidebar"], ["toast", "notifications.channelToast"]].map(([field, labelKey]) => react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate(labelKey) }),
									react_jsx_runtime.jsxs("label", {
										className: S.switch,
										children: [
											react_jsx_runtime.jsx("input", {
												type: "checkbox",
												checked: channels[field] !== false,
												onChange: (event) => savePolicy({ channels: { ...channels, [field]: event.target.checked } })
											}),
											react_jsx_runtime.jsx("span", { className: S.switchSlider })
										]
									})
								]
							}, field))
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.toggleGrid,
						children: [
							react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("notifications.events") }),
							[["warning", "notifications.eventWarning"], ["exceeded", "notifications.eventExceeded"], ["lowBalance", "notifications.eventLowBalance"], ["recovery", "notifications.eventRecovery"]].map(([field, labelKey]) => react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate(labelKey) }),
									react_jsx_runtime.jsxs("label", {
										className: S.switch,
										children: [
											react_jsx_runtime.jsx("input", {
												type: "checkbox",
												checked: events[field] !== false,
												onChange: (event) => savePolicy({ events: { ...events, [field]: event.target.checked } })
											}),
											react_jsx_runtime.jsx("span", { className: S.switchSlider })
										]
									})
								]
							}, field))
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.row,
						children: [
							react_jsx_runtime.jsx("span", { className: S.rowLabel, children: translate("notifications.cooldown") }),
							react_jsx_runtime.jsx("select", {
								className: S.select,
								value: String(cooldownMs),
								"aria-label": translate("notifications.cooldown"),
								onChange: (event) => savePolicy({ cooldownMs: Number(event.target.value) }),
								children: [
									react_jsx_runtime.jsx("option", { value: "300000", children: translate("notifications.cooldown5min") }, "300000"),
									react_jsx_runtime.jsx("option", { value: "900000", children: translate("notifications.cooldown15min") }, "900000"),
									react_jsx_runtime.jsx("option", { value: "1800000", children: translate("notifications.cooldown30min") }, "1800000"),
									react_jsx_runtime.jsx("option", { value: "3600000", children: translate("notifications.cooldown1h") }, "3600000"),
									react_jsx_runtime.jsx("option", { value: "7200000", children: translate("notifications.cooldown2h") }, "7200000")
								]
							})
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.toggleGrid,
						children: [
							react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("notifications.history") }),
							react_jsx_runtime.jsx("div", {
								className: S.alertList,
								children: alerts.length === 0
									? react_jsx_runtime.jsx("p", { className: S.note, children: translate("notifications.empty") })
									: alerts.map((item, index) => react_jsx_runtime.jsxs("div", {
										className: S.alertItem,
										children: [
											react_jsx_runtime.jsxs("span", {
												className: S.alertMeta,
												children: [
													(() => { const atMs = Number(item.at); return Number.isFinite(atMs) && atMs > 0 ? new Date(atMs).toLocaleString() : String(item.at ?? "—"); })(),
													item.keyRef ? react_jsx_runtime.jsx("span", { children: item.keyRef }) : null,
													react_jsx_runtime.jsx("span", { className: S.tag, "data-tone": item.type === "recovery" ? "ok" : "bad", children: item.type === "recovery" ? translate("notifications.type.recovery") : translate("notifications.type.alert") })
												]
											}),
											react_jsx_runtime.jsx("span", { className: S.alertMsg, children: item.message ?? "" })
										]
									}, `${item.at ?? index}-${index}`))
							})
						]
					})
				]
			});
		}

		/** Settings tab: data overview, retention trim and guarded history clear. */
		function DataCard({ translate }) {
			const [info, setInfo] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [retention, setRetention] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [result, setResult] = react.useState(null);
			const [confirmOpen, setConfirmOpen] = react.useState(false);
			const [confirmText, setConfirmText] = react.useState("");
			const confirmWord = translate("data.clearConfirmWord");
			const load = react.useCallback(() => {
				fetchJson("/api/usage-stats/data").then((payload) => setInfo(payload.info ?? null)).catch(() => {});
			}, []);
			react.useEffect(() => { load(); }, [load]);
			const run = async (action, extra = {}) => {
				setBusy(true);
				setError(null);
				try {
					const payload = await fetchJson("/api/usage-stats/data", { method: "POST", body: { action, ...extra } });
					if (payload.ok !== true) throw new Error(payload.message ?? "action failed");
					setResult(action === "rebuild" ? "data.rebuilt" : action === "clear" ? "data.cleared" : "data.trimmed");
					await load();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			};
			const dateRangeText = info?.dateRange ? `${info.dateRange.earliest} ~ ${info.dateRange.latest}` : "—";
			return react_jsx_runtime.jsxs("section", {
				className: S.card,
				"data-usage-data-card": true,
				children: [
					react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("data.title") }),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("data.desc") }),
					error !== null && react_jsx_runtime.jsx("div", { className: S.error, children: translate("data.saveError", { message: error }) }),
					result !== null && react_jsx_runtime.jsx("p", { className: S.hint, children: translate(result) }),
					react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("data.overview") }),
					react_jsx_runtime.jsxs("div", {
						className: S.dataStat,
						children: [
							react_jsx_runtime.jsxs("div", { className: S.dataStatCell, children: [
								react_jsx_runtime.jsx("div", { className: S.dataStatLabel, children: translate("data.ledgerEntries") }),
								react_jsx_runtime.jsx("div", { className: S.dataStatValue, children: fmt(info?.ledgerEntries ?? 0) })
							] }),
							react_jsx_runtime.jsxs("div", { className: S.dataStatCell, children: [
								react_jsx_runtime.jsx("div", { className: S.dataStatLabel, children: translate("data.ledgerCapacity") }),
								react_jsx_runtime.jsx("div", { className: S.dataStatValue, children: fmt(info?.ledgerCapacity ?? 0) })
							] }),
							react_jsx_runtime.jsxs("div", { className: S.dataStatCell, children: [
								react_jsx_runtime.jsx("div", { className: S.dataStatLabel, children: translate("data.foldedCount") }),
								react_jsx_runtime.jsx("div", { className: S.dataStatValue, children: fmt(info?.foldedCount ?? 0) })
							] }),
							react_jsx_runtime.jsxs("div", { className: S.dataStatCell, children: [
								react_jsx_runtime.jsx("div", { className: S.dataStatLabel, children: translate("data.dateRange") }),
								react_jsx_runtime.jsx("div", { className: S.dataStatValue, children: dateRangeText })
							] })
						]
					}),
					info?.legacyIsEstimated === true && react_jsx_runtime.jsx("p", { className: S.hint, children: translate("data.legacyEstimated") }),
					react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("data.retentionGroup") }),
					react_jsx_runtime.jsxs("div", {
						className: S.row,
						children: [
							react_jsx_runtime.jsx("span", { className: S.rowLabel, children: translate("data.retention") }),
							react_jsx_runtime.jsx("input", {
								type: "text",
								inputMode: "numeric",
								className: S.input,
								style: { width: "120px" },
								placeholder: translate("data.retentionPlaceholder"),
								value: retention,
								onChange: (event) => setRetention(event.target.value)
							})
						]
					}),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("data.retentionNote") }),
					react_jsx_runtime.jsxs("div", {
						className: S.btnRow,
						children: [
							react_jsx_runtime.jsx("button", {
								type: "button",
								className: S.btn,
								disabled: busy || Number(retention) <= 0,
								onClick: () => run("trim", { retentionDays: Number(retention) }),
								children: translate("data.trim")
							}),
							react_jsx_runtime.jsx("button", {
								type: "button",
								className: `${S.btn} ${S.btnGhost}`,
								disabled: busy,
								onClick: () => run("rebuild"),
								children: translate("data.rebuild")
							})
						]
					}),
					react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("data.dangerGroup") }),
					react_jsx_runtime.jsxs("div", {
						className: S.btnRow,
						children: [
							react_jsx_runtime.jsx("button", {
								type: "button",
								className: `${S.btn} ${S.btnDanger}`,
								disabled: busy,
								onClick: () => { setConfirmOpen(true); setConfirmText(""); },
								children: translate("data.clear")
							})
						]
					}),
					confirmOpen && react_jsx_runtime.jsx(primitives.Modal, {
						open: true,
						onClose: () => setConfirmOpen(false),
						children: react_jsx_runtime.jsxs("div", {
							className: S.clearConfirm,
							children: [
								react_jsx_runtime.jsx("p", { className: S.note, children: translate("data.clearConfirmDesc") }),
								react_jsx_runtime.jsx("input", {
									type: "text",
									className: S.input,
									"data.clearConfirmWord": true,
									placeholder: translate("data.clearConfirmPlaceholder"),
									value: confirmText,
									onChange: (event) => setConfirmText(event.target.value)
								}),
								react_jsx_runtime.jsx("p", { className: S.hint, children: translate("data.clearConfirmHint", { word: confirmWord }) }),
								react_jsx_runtime.jsxs("div", {
									className: S.btnRow,
									children: [
										react_jsx_runtime.jsx("button", {
											type: "button",
											className: `${S.btn} ${S.btnGhost}`,
											onClick: () => setConfirmOpen(false),
											children: translate("data.cancel")
										}),
										react_jsx_runtime.jsx("button", {
											type: "button",
											className: `${S.btn} ${S.btnDanger}`,
											"data.clearConfirmBtn": true,
											disabled: !(confirmText.trim() === confirmWord),
											onClick: () => {
												setConfirmOpen(false);
												run("clear");
											},
											children: translate("data.clearConfirmBtn")
										})
									]
								})
							]
						})
					}),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("data.tokenizerNote") })
				]
			});
		}

		/** Settings tab: conversation folding and token usage toggles. */
		function ConversationCard({ translate, conversation, onConversationUpdated }) {
			const [error, setError] = react.useState(null);
			const [saving, setSaving] = react.useState(false);
			const enabled = conversation?.enabled !== false;
			const showTokenUsage = conversation?.showTokenUsage !== false;
			const saveConversation = async (patch) => {
				setError(null);
				setSaving(true);
				try {
					const updated = await fetchJson("/api/usage-stats/accounts", { method: "POST", body: { conversation: { ...conversation, ...patch } } });
					if (updated.ok !== true) throw new Error(updated.message ?? "save failed");
					const next = updated.settings?.conversation;
					if (next === null || typeof next !== "object") throw new Error("settings response missing conversation");
					onConversationUpdated(next);
					window.dispatchEvent(new CustomEvent("usage-stats:conversation-settings", { detail: next }));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			return react_jsx_runtime.jsxs("section", {
				className: S.card,
				"data-usage-conversation-card": true,
				children: [
					react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("conversation.title") }),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("conversation.desc") }),
					error !== null && react_jsx_runtime.jsx("div", { className: S.error, children: translate("conversation.saveError", { message: error }) }),
					react_jsx_runtime.jsxs("div", {
						className: S.toggleGrid,
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.toggleInfo,
										children: [
											react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate("conversation.enable") }),
											react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate("conversation.enableDesc") })
										]
									}),
									react_jsx_runtime.jsxs("label", {
										className: S.switch,
										children: [
									react_jsx_runtime.jsx("input", {
										type: "checkbox",
										checked: enabled,
										disabled: saving,
										onChange: (event) => saveConversation({ enabled: event.target.checked })
											}),
											react_jsx_runtime.jsx("span", { className: S.switchSlider })
										]
									})
								]
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.toggleInfo,
										children: [
											react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate("conversation.showTokenUsage") }),
											react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate("conversation.showTokenUsageDesc") })
										]
									}),
									react_jsx_runtime.jsxs("label", {
										className: S.switch,
										children: [
									react_jsx_runtime.jsx("input", {
										type: "checkbox",
										checked: showTokenUsage,
										disabled: saving,
										onChange: (event) => saveConversation({ showTokenUsage: event.target.checked })
											}),
											react_jsx_runtime.jsx("span", { className: S.switchSlider })
										]
									})
								]
							})
						]
					})
				]
			});
		}

		const SETTINGS_TABS = [
			{ id: "accounts", label: "settings.tabAccounts" },
			{ id: "limits", label: "settings.tabLimits" },
			{ id: "pricing", label: "settings.tabPricing" },
			{ id: "notifications", label: "settings.tabNotifications" },
			{ id: "conversation", label: "settings.tabConversation" },
			{ id: "data", label: "settings.tabData" }
		];
		function UsageBillingSettingsSection({ t }) {
			const translate = (key, params) => interpolate(t !== void 0 ? t(key) : key, params);
			const [keys, setKeys] = react.useState([]);
			const [selectedKey, setSelectedKey] = react.useState(null);
			const [pricing, setPricing] = react.useState({ currency: "CNY", peakHours: [[9, 12], [14, 18]], peakMultiplier: 2 });
			const [todayCost, setTodayCost] = react.useState(0);
			const [serverToday, setServerToday] = react.useState(null);
			const [loaded, setLoaded] = react.useState(false);
			const [error, setError] = react.useState(null);
			const [activeTab, setActiveTab] = react.useState("accounts");
			const [conversation, setConversation] = react.useState({ enabled: true, showTokenUsage: true });
			const mountedRef = react.useRef(true);
			const usageLoaderRef = react.useRef(null);
			if (usageLoaderRef.current === null) usageLoaderRef.current = createLoader();

			const loadUsage = react.useCallback(() => {
				const seq = usageLoaderRef.current.start();
				setError(null);
				fetchJson("/api/usage-stats/usage").then((payload) => {
					if (!mountedRef.current || !usageLoaderRef.current.isCurrent(seq)) return;
					if (payload.ok !== true) {
						setError(payload.message ?? "usage aggregation failed");
						return;
					}
					setPricing(pricingOf(payload));
					setServerToday(payload.today ?? null);
					const todayDay = (payload.days ?? []).find((day) => day.date === (payload.today ?? todayKey()));
						setTodayCost(todayDay?.cost ?? null);
					setLoaded(true);
				}).catch((loadError) => {
					if (!mountedRef.current || !usageLoaderRef.current.isCurrent(seq)) return;
					setError(loadError instanceof Error ? loadError.message : String(loadError));
				});
			}, []);

			const loadKeys = react.useCallback(() => {
				fetchJson("/api/usage-stats/keys").then((payload) => {
					if (!mountedRef.current) return;
					if (payload.ok !== true) return;
					const list = Array.isArray(payload.keys) ? payload.keys : [];
					setKeys(list);
					setSelectedKey((current) => {
						if (current !== null && list.some((key) => key.id === current)) return current;
						return list.find((key) => key.default)?.id ?? list.find((key) => key.configured)?.id ?? list[0]?.id ?? null;
					});
				}).catch(() => {});
			}, []);

			const loadConversation = react.useCallback(() => {
				fetchJson("/api/usage-stats/accounts").then((payload) => {
					if (!mountedRef.current) return;
					if (payload.ok !== true) return;
					if (payload.settings?.conversation !== undefined) setConversation(payload.settings.conversation);
				}).catch(() => {});
			}, []);

			react.useEffect(() => {
				mountedRef.current = true;
				loadUsage();
				loadKeys();
				loadConversation();
				const usageTimer = window.setInterval(loadUsage, 60000);
				return () => {
					mountedRef.current = false;
					window.clearInterval(usageTimer);
				};
			}, [loadUsage, loadKeys]);

			return react_jsx_runtime.jsxs("div", {
				className: S.section,
				"data-usage-billing-settings": true,
				children: [
					react_jsx_runtime.jsx("h2", { className: S.title, children: translate("settings.title") }),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("settings.desc") }),
					error !== null ? react_jsx_runtime.jsxs("div", {
						className: S.error,
						children: [
							react_jsx_runtime.jsx("span", { children: translate("usage.error", { message: error }) }),
							react_jsx_runtime.jsx("button", { type: "button", className: S.retry, onClick: loadUsage, children: translate("action.retry") })
						]
					}) : null,
					react_jsx_runtime.jsxs("div", {
						className: S.tabs,
						role: "tablist",
						"aria-label": translate("settings.title"),
						children: SETTINGS_TABS.map((tab) => react_jsx_runtime.jsx("button", {
							type: "button",
							role: "tab",
							className: S.tab,
							"data-usage-billing-tab": tab.id,
							"data-active": activeTab === tab.id ? "true" : "false",
							"aria-selected": activeTab === tab.id,
							onClick: () => setActiveTab(tab.id),
							children: translate(tab.label)
						}, tab.id))
					}),
					activeTab === "accounts" ? react_jsx_runtime.jsx(AccountsCard, { keys, translate })
						: activeTab === "limits" ? (loaded === false ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.loading") }) : react_jsx_runtime.jsx(LimitsCard, {
							keys,
							selectedKey,
							onSelectKey: setSelectedKey,
							pricing,
							todayCost,
							translate,
							onLimitsUpdated: () => loadUsage()
						}))
						: activeTab === "pricing" ? react_jsx_runtime.jsx(PricingCard, { translate, onPricingUpdated: () => loadUsage() })
						: activeTab === "notifications" ? react_jsx_runtime.jsx(NotificationsCard, { translate })
						: activeTab === "conversation" ? react_jsx_runtime.jsx(ConversationCard, { translate, conversation, onConversationUpdated: (updated) => setConversation(updated) })
						: react_jsx_runtime.jsx(DataCard, { translate })
				]
			});
		}
		//#endregion
		//#region compact conversation controller
		const COMPACT_ATTR = "data-usc-fold";
		const COMPACT_CHILD_CLASS = "usc-fold-child";
		const COMPACT_REASONING_CLASS = "usc-fold-reasoning-child";
		const COMPACT_SETTINGS_EVENT = "usage-stats:conversation-settings";

		function compactNodeAt(store, key) {
			return store?.get?.(key);
		}

		function compactReasoningBlocks(blocks) {
			return (Array.isArray(blocks) ? blocks : []).filter((block) => block?.kind === "reasoning" && String(block.text ?? "").trim() !== "");
		}

		function compactHasAssistantOutput(blocks) {
			return (Array.isArray(blocks) ? blocks : []).some((block) => block?.kind === "text" ? String(block.text ?? "").trim() !== "" : block?.kind === "image" || block?.kind === "other");
		}

		function compactIsActivityNode(node) {
			if (node?.kind === "tool-call") return true;
			return node?.kind === "assistant-step"
				&& compactReasoningBlocks(node.data?.blocks).length > 0
				&& !compactHasAssistantOutput(node.data?.blocks);
		}

		function compactIsPartialActivityNode(node) {
			return node?.kind === "assistant-step"
				&& compactReasoningBlocks(node.data?.blocks).length > 0
				&& compactHasAssistantOutput(node.data?.blocks);
		}

		function compactTurnOf(node) {
			var location = node?.location;
			if (location?.kind === "turn" || location?.kind === "step") return location.turn;
			return null;
		}

		function compactTurnNumber(node) {
			return compactTurnOf(node)?.turn ?? node?.data?.turn ?? null;
		}

		function compactReasoningEntries(node) {
			var blocks = compactReasoningBlocks(node?.data?.blocks);
			var last = blocks.at(-1);
			return blocks.map((block) => {
				var terminal = block === last;
				var isFinalBlock = terminal && node.data.blocks.at(-1) === block;
				return {
					kind: "reasoning",
					running: node.data.status === "running" && isFinalBlock,
					error: node.data.status === "interrupted" && isFinalBlock,
					terminal
				};
			});
		}

		function compactToolEntries(block, terminal = true) {
			if (block === null || typeof block !== "object") return [];
			var settled = "kind" in block;
			var resultView = block.resultView;
			var failed = settled && (block.isError === true || (resultView?.card === "terminal"
				&& ((resultView.exitCode !== undefined && resultView.exitCode !== 0) || resultView.signal !== undefined)));
			var entries = [{ kind: "tool", running: !settled, error: failed, terminal }];
			var children = Array.isArray(block.subCalls) ? block.subCalls : [];
			for (var i = 0; i < children.length; i++) entries.push(...compactToolEntries(children[i], false));
			return entries;
		}

		function compactGroupFrom(order, store, start, end, partialKey) {
			var keys = [...order.slice(start, end), ...(partialKey === undefined ? [] : [partialKey])];
			var entries = [];
			for (var i = 0; i < keys.length; i++) {
				var node = compactNodeAt(store, keys[i]);
				if (node?.kind === "tool-call") entries.push(...compactToolEntries(node.data?.root));
				else if (node?.kind === "assistant-step") entries.push(...compactReasoningEntries(node));
			}
			var latest = null;
			for (var j = entries.length - 1; j >= 0; j--) {
				if (entries[j].running) { latest = entries[j]; break; }
			}
			if (latest === null) {
				for (var k = entries.length - 1; k >= 0; k--) {
					if (entries[k].terminal) { latest = entries[k]; break; }
				}
			}
			if (latest === null) return null;
			var firstNode = compactNodeAt(store, keys[0]);
			var turn = compactTurnOf(firstNode);
			var running = entries.some((entry) => entry.running);
			return {
				firstKey: keys[0],
				keys,
				partialKey,
				reasoning: entries.filter((entry) => entry.kind === "reasoning").length,
				tools: entries.filter((entry) => entry.kind === "tool").length,
				failures: entries.filter((entry) => entry.error).length,
				running,
				error: !running && latest.error === true,
				startTime: Number(turn?.start?.time) || null,
				endTime: Number(turn?.end?.time) || null
			};
		}

		/** Build one activity fold per request/turn from the authoritative Chat snapshot. */
		function compactActivityGroups(order, store) {
			var groups = [];
			var index = 0;
			while (index < order.length) {
				var current = compactNodeAt(store, order[index]);
				if (!compactIsActivityNode(current)) {
					if (compactIsPartialActivityNode(current)) {
						var partial = compactGroupFrom(order, store, index, index, current.key);
						if (partial !== null) groups.push(partial);
					}
					index++;
					continue;
				}
				var start = index;
				var turnNumber = compactTurnNumber(current);
				while (index < order.length) {
					var candidate = compactNodeAt(store, order[index]);
					if (!compactIsActivityNode(candidate) || compactTurnNumber(candidate) !== turnNumber) break;
					index++;
				}
				var boundary = compactNodeAt(store, order[index]);
				var partialKey = compactIsPartialActivityNode(boundary) && compactTurnNumber(boundary) === turnNumber ? boundary.key : undefined;
				var group = compactGroupFrom(order, store, start, index, partialKey);
				if (group !== null) groups.push(group);
				if (partialKey !== undefined) index++;
			}
			return groups;
		}

		function compactFormatDuration(ms) {
			if (ms === null || ms <= 0) return "";
			var s = ms / 1000;
			if (s < 60) return Math.round(s * 10) / 10 + "s";
			var whole = Math.round(s);
			return Math.floor(whole / 60) + "m" + (whole % 60) + "s";
		}

		function compactFormatTokens(n) {
			if (n < 1000) return String(n);
			if (n < 1000000) return (Math.round(n / 100) / 10) + "K";
			return (Math.round(n / 100000) / 10) + "M";
		}

		function compactRowsIn(container) {
			return new Map([...container.querySelectorAll("[data-chat-flow-key]")].map((row) => [row.dataset.chatFlowKey ?? "", row]));
		}

		function compactMarkerIn(container, firstKey, sessionKey) {
			return [...container.querySelectorAll("details[" + COMPACT_ATTR + "]")].find((marker) => marker.dataset.uscFold === firstKey && marker.dataset.uscSession === sessionKey) ?? null;
		}

		function compactSetGroupOpen(rows, group, open, sessionKey) {
			for (var i = 0; i < group.keys.length; i++) {
				var key = group.keys[i];
				var row = rows.get(key);
				if (row === undefined) continue;
				if (key === group.partialKey) {
					for (const reasoning of row.querySelectorAll("[data-variant='think']")) {
						reasoning.classList.toggle(COMPACT_REASONING_CLASS, !open);
						if (open) {
							if (reasoning.dataset.uscOwner === sessionKey) delete reasoning.dataset.uscOwner;
						} else reasoning.dataset.uscOwner = sessionKey;
					}
				} else {
					row.classList.toggle(COMPACT_CHILD_CLASS, !open);
					if (open) {
						if (row.dataset.uscOwner === sessionKey) delete row.dataset.uscOwner;
					} else row.dataset.uscOwner = sessionKey;
				}
			}
		}

		function compactBuildSummaryText(translate, group, tokenUsage, now) {
			var parts = [];
			if (group.reasoning > 0) parts.push(translate(group.reasoning === 1 ? "conversation.count.thought" : "conversation.count.thoughts", { count: group.reasoning }));
			if (group.tools > 0) parts.push(translate(group.tools === 1 ? "conversation.count.toolCall" : "conversation.count.toolCalls", { count: group.tools }));
			if (group.failures > 0) parts.push(translate(group.failures === 1 ? "conversation.count.failure" : "conversation.count.failures", { count: group.failures }));
			var text = parts.join(" · ");
			var durationMs = group.startTime === null ? null : (group.endTime ?? now) - group.startTime;
			var duration = compactFormatDuration(durationMs);
			if (duration) text += (text ? " · " : "") + duration;
			if (tokenUsage) text += (text ? " · " : "") + tokenUsage;
			return text;
		}

		function compactSetSummary(marker, translate, group, tokenUsage, now) {
			var statusText = group.running ? translate("conversation.status.running") : group.error ? translate("conversation.status.error") : translate("conversation.status.done");
			var detailText = compactBuildSummaryText(translate, group, tokenUsage, now);
			var sig = statusText + "|" + detailText + "|" + group.running + "|" + group.error;
			if (marker.dataset.sig === sig) return;
			marker.dataset.sig = sig;
			marker.dataset.running = String(group.running);
			var summary = marker.querySelector("summary");
			if (summary === null) {
				summary = document.createElement("summary");
				marker.prepend(summary);
			}
			summary.replaceChildren();
			summary.className = "usc-fold-summary";

			var chevron = document.createElement("span");
			chevron.className = "usc-fold-chevron";
			chevron.setAttribute("aria-hidden", "true");

			var label = document.createElement("span");
			label.className = "usc-fold-label";
			label.textContent = statusText;
			if (group.running || group.error) { label.setAttribute("role", "status"); label.setAttribute("aria-live", "polite"); }

			summary.append(chevron, label);
			if (detailText) {
				var sep = document.createElement("span");
				sep.className = "usc-fold-sep";
				sep.setAttribute("aria-hidden", "true");
				var detail = document.createElement("span");
				detail.className = "usc-fold-detail";
				detail.textContent = detailText;
				summary.append(sep, detail);
			}
		}

		function compactSyncContainer(container, groups, translate, tokenUsage, sessionKey, now) {
			container.dataset.uscSession = sessionKey;
			var rows = compactRowsIn(container);
			var visibleGroups = groups.filter((group) => group.keys.every((key) => rows.has(key)));
			var liveKeys = new Set(visibleGroups.map((group) => group.firstKey));
			for (const row of rows.values()) {
				row.classList.remove(COMPACT_CHILD_CLASS);
				for (const reasoning of row.querySelectorAll("." + COMPACT_REASONING_CLASS)) reasoning.classList.remove(COMPACT_REASONING_CLASS);
			}
			for (const marker of container.querySelectorAll("details[" + COMPACT_ATTR + "]")) {
				if (marker.dataset.uscSession === sessionKey && !liveKeys.has(marker.dataset.uscFold ?? "")) marker.remove();
			}
			for (var i = 0; i < visibleGroups.length; i++) {
				var group = visibleGroups[i];
				var firstRow = rows.get(group.firstKey);
				if (firstRow === undefined) continue;
				var domFailure = group.keys.some((key) => rows.get(key)?.querySelector("[data-tool][data-state='error'],[data-tool][data-state='stopped']") != null);
				if (domFailure && !group.error) group = { ...group, error: true, failures: Math.max(1, group.failures) };
				var marker = compactMarkerIn(container, group.firstKey, sessionKey);
				if (marker === null) {
					marker = document.createElement("details");
					marker.className = "usc-fold-group";
					marker.dataset.uscFold = group.firstKey;
					marker.dataset.uscSession = sessionKey;
					firstRow.before(marker);
				} else if (marker.nextElementSibling !== firstRow) {
					firstRow.before(marker);
				}
				marker.ontoggle = ((currentMarker, currentGroup) => () => {
					if (!currentMarker.isConnected) return;
					compactSetGroupOpen(compactRowsIn(container), currentGroup, currentMarker.open, sessionKey);
				})(marker, group);
				var previousRunning = marker.dataset.running;
				if (previousRunning === undefined) marker.open = group.running;
				else if (previousRunning === "true" && !group.running) marker.open = false;
				else if (previousRunning === "false" && group.running) marker.open = true;
				compactSetSummary(marker, translate, group, tokenUsage, now);
				compactSetGroupOpen(rows, group, marker.open, sessionKey);
			}
		}

		function compactSync(groups, translate, tokenUsage, sessionKey) {
			var now = Date.now();
			for (const container of document.querySelectorAll("[data-chat-flow]")) compactSyncContainer(container, groups, translate, tokenUsage, sessionKey, now);
		}

		function compactCleanup(sessionKey) {
			// Track ownership on hidden nodes as well as the container/marker. The
			// host may remove a chat-flow container while the settings event is being
			// delivered, so relying only on the current ancestor can leave stale
			// display classes behind.
			for (const owned of document.querySelectorAll("[data-usc-owner]")) {
				if (owned.dataset.uscOwner !== sessionKey) continue;
				owned.classList.remove(COMPACT_CHILD_CLASS, COMPACT_REASONING_CLASS);
				delete owned.dataset.uscOwner;
			}
			for (const container of document.querySelectorAll("[data-chat-flow]")) {
				if (container.dataset.uscSession !== sessionKey) continue;
				for (const row of container.querySelectorAll("[data-chat-flow-key]")) {
					row.classList.remove(COMPACT_CHILD_CLASS);
					for (const reasoning of row.querySelectorAll("." + COMPACT_REASONING_CLASS)) reasoning.classList.remove(COMPACT_REASONING_CLASS);
				}
				delete container.dataset.uscSession;
			}
			for (const marker of document.querySelectorAll("details[" + COMPACT_ATTR + "]")) {
				if (marker.dataset.uscSession !== sessionKey) continue;
				marker.ontoggle = null;
				marker.remove();
			}
		}

		/** Codex-inspired minimal CSS: bottom border only, no box border. */
		const COMPACT_CSS = [
			".usc-fold-child,.usc-fold-reasoning-child{display:none!important}",
			// Fold group — only bottom border
			".usc-fold-group{position:relative;min-width:0;margin:0;border:none;background:transparent}",
			".usc-fold-group[data-running=true] .usc-fold-label{color:var(--dsw-alias-state-info-primary)}",
			// Summary bar — bottom border only, no background
			".usc-fold-summary{display:flex;box-sizing:border-box;min-width:0;height:26px;align-items:center;gap:6px;overflow:hidden;padding:0 8px 0 4px;list-style:none;border:0;border-bottom:1px solid var(--dsw-alias-border-l2);border-radius:0;background:transparent;cursor:pointer;user-select:none;margin:0}",
			".usc-fold-summary::-webkit-details-marker{display:none}",
			".usc-fold-summary:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			// Chevron
			".usc-fold-chevron{width:10px;height:10px;flex:none;display:flex;align-items:center;justify-content:center;transition:transform 120ms ease;color:var(--dsw-alias-label-tertiary)}",
			".usc-fold-chevron::before{content:'';border:3px solid transparent;border-left:4px solid currentColor;border-right:0;width:0;height:0;display:block}",
			".usc-fold-group[open] .usc-fold-chevron{transform:rotate(90deg)}",
			// Label
			".usc-fold-label{font-size:12px;font-weight:500;line-height:18px;flex:none;white-space:nowrap;color:var(--dsw-alias-label-secondary)}",
			// Dot separator
			".usc-fold-sep{width:3px;height:3px;flex:none;border-radius:50%;background:var(--dsw-alias-label-caption)}",
			// Detail text (counts + duration + tokens)
			".usc-fold-detail{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min:0;flex:1;font-variant-numeric:tabular-nums}",
			".usc-fold-summary:focus-visible{outline:2px solid var(--dsw-alias-state-info-primary);outline-offset:1px}"
		].join("\n");

		/**
		 * CompactConversationController: injected via 'conversation.session.header.actions' slot.
		 * Wraps activity rows into a <details> fold per turn. Final reply stays visible.
		 * Shows execution time + optional token usage on the fold summary.
		 */
		function CompactConversationController(props) {
			var useSession = props.useSession;
			var useProjection = props.useProjection;
			var sessionKey = String(props.sessionId ?? "");
			var t = props.t;
			var chat = useSession(function (snapshot) { return snapshot.chat; });
			var usage = useProjection("tokenUsage");
			var groups = react.useMemo(function () { return compactActivityGroups(chat.order, chat.nodes); }, [chat]);
			var groupsRef = react.useRef(groups);
			var usageRef = react.useRef(usage);
			var syncRef = react.useRef(function () {});
			var settingsRef = react.useRef({ enabled: true, showTokenUsage: true });
			var settingsRevisionRef = react.useRef(0);
			groupsRef.current = groups;
			usageRef.current = usage;

			function tokenUsageText() {
				var current = usageRef.current;
				if (current === null || typeof current !== "object") return "";
				var uncached = Number(current.uncachedInputTokens) || 0;
				var cacheRead = Number(current.cacheReadTokens) || 0;
				var cacheWrite = Number(current.cacheWriteTokens) || 0;
				var output = Number(current.outputTokens) || 0;
				return t("conversation.tokens.input") + " " + compactFormatTokens(uncached + cacheRead + cacheWrite) + " · " + t("conversation.tokens.output") + " " + compactFormatTokens(output);
			}

			react.useEffect(function () {
				var active = true;
				var revision = settingsRevisionRef.current;
				fetchJson("/api/usage-stats/accounts").then(function (payload) {
					if (active && revision === settingsRevisionRef.current && payload.ok === true && payload.settings?.conversation !== undefined) {
						settingsRef.current = payload.settings.conversation;
						syncRef.current();
					}
				}).catch(function () {});
				return function () { active = false; };
			}, []);

			react.useEffect(function () {
				var onSettings = function (event) {
					var next = event.detail;
					if (next === null || typeof next !== "object") return;
					settingsRevisionRef.current++;
					settingsRef.current = {
						enabled: next.enabled !== false,
						showTokenUsage: next.showTokenUsage !== false
					};
					syncRef.current();
				};
				window.addEventListener(COMPACT_SETTINGS_EVENT, onSettings);
				return function () { window.removeEventListener(COMPACT_SETTINGS_EVENT, onSettings); };
			}, []);

			react.useEffect(function () {
				syncRef.current = function () {
					if (!settingsRef.current.enabled) { compactCleanup(sessionKey); return; }
					compactSync(groupsRef.current, t, settingsRef.current.showTokenUsage ? tokenUsageText() : "", sessionKey);
				};
				syncRef.current();
			}, [groups, t, usage, sessionKey]);

			react.useEffect(function () {
				var queued = false, active = true;
				var schedule = function () {
					if (queued) return;
					queued = true;
					queueMicrotask(function () { queued = false; if (active) syncRef.current(); });
				};
				var observer = new MutationObserver(schedule);
				observer.observe(document.body, { childList: true, subtree: true, characterData: true });
				schedule();
				return function () { active = false; observer.disconnect(); };
			}, []);

			react.useEffect(function () {
				if (!groups.some(function (group) { return group.running; })) return void 0;
				var timer = window.setInterval(function () { syncRef.current(); }, 1000);
				return function () { window.clearInterval(timer); };
			}, [groups]);

			react.useEffect(function () { return function () { compactCleanup(sessionKey); }; }, [sessionKey]);
			return null;
		}
		//#endregion

		/** Sidebar summary poll cadence: 60s while the panel is open, 5min while closed. */
		const SIDEBAR_POLL_MS_OPEN = 60000;
		const SIDEBAR_POLL_MS_CLOSED = 300000;
		//#region sidebar panel
		/** Native Harness sidebar action that owns the floating usage panel. */
		function UsageStatsPanel({ wide, t }) {
			const [open, setOpen] = react.useState(false);
			const [panelLeft, setPanelLeft] = react.useState(12);
			const [summary, setSummary] = react.useState({ balance: "—", today: "—", todayTokens: null, status: "muted", balanceStatus: "muted", todayStatus: "muted" });
			const [display, setDisplay] = react.useState({ balance: true, todayCost: true, statusDot: true });
			const [notifications, setNotifications] = react.useState({ channels: { sidebar: true, toast: false }, events: {} });
			const [toasts, setToasts] = react.useState([]);
			const notifiedAlertsRef = react.useRef(new Set());
			const layerRef = react.useRef(null);
			const summaryRequestRef = react.useRef(0);
			// 把服务端下发的告警历史按「通知与提示」策略投递为页面内 Toast，并
			// 记住已提示的事件（跨轮询去重）；通道/事件/冷却已在服务端过滤。
			const deliverAlerts = react.useCallback((payload) => {
				if (payload === null || payload === undefined || payload.ok !== true) return;
				const policy = payload.notifications || {};
				setNotifications(policy);
				if (policy.channels?.toast !== true) return;
				const events = policy.events || {};
				const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
				const fresh = [];
				for (const item of alerts) {
					if (item.type !== "alert" && item.type !== "recovery") continue;
					const event = item.event ?? (item.type === "recovery" ? "recovery" : "warning");
					if (events[event] === false) continue;
					const key = `${item.at ?? 0}:${item.type}:${item.keyRef ?? ""}:${item.status ?? ""}`;
					if (notifiedAlertsRef.current.has(key)) continue;
					notifiedAlertsRef.current.add(key);
					fresh.push({
						key,
						tone: item.type,
						text: item.message || (item.type === "recovery" ? t("notifications.type.recovery") : t("notifications.type.alert"))
					});
				}
				if (fresh.length > 0) setToasts((prev) => [...prev, ...fresh].slice(-3));
			}, [t]);

			const loadSummary = react.useCallback(() => {
				const request = ++summaryRequestRef.current;
				Promise.allSettled([
					fetchJson("/api/usage-stats/usage"),
					fetchJson("/api/usage-stats/balance"),
					fetchJson("/api/usage-stats/limits"),
					fetchJson("/api/usage-stats/accounts"),
					fetchJson("/api/usage-stats/alerts")
				]).then(([usageResult, balanceResult, limitsResult, accountsResult, alertsResult]) => {
					if (summaryRequestRef.current !== request) return;
					if (accountsResult.status === "fulfilled" && accountsResult.value?.ok === true) {
						setDisplay(accountsResult.value.settings?.display || { balance: true, todayCost: true, statusDot: true });
					}
					setSummary(sidebarSummaryOf(
						usageResult.status === "fulfilled" ? usageResult.value : null,
						balanceResult.status === "fulfilled" ? balanceResult.value : null,
						limitsResult.status === "fulfilled" ? limitsResult.value : null
					));
					if (alertsResult.status === "fulfilled") deliverAlerts(alertsResult.value);
				});
			}, [deliverAlerts]);
			const showBalance = display.balance !== false;
			const showToday = display.todayCost !== false;
			// 侧栏状态点同时受「账户与余额」展示开关和「通知与提示」侧栏通道控制。
			const showStatusDot = display.statusDot !== false && notifications.channels?.sidebar !== false;
			const summaryText = [
				showBalance ? `余额 ${summary.balance}` : null,
				showToday ? `今日 ${summary.today}` : null
			].filter((part) => part !== null).join(" · ");

			react.useEffect(() => {
				loadSummary();
				// Open panel: refresh every 60s; closed: back off to every 5min so an
				// idle sidebar never hammers the loopback endpoints.
				const pollMs = open ? SIDEBAR_POLL_MS_OPEN : SIDEBAR_POLL_MS_CLOSED;
				const timer = window.setInterval(loadSummary, pollMs);
				const onLimitsUpdated = () => loadSummary();
				const onAccountsUpdated = () => loadSummary();
				window.addEventListener("usage-stats:limits-updated", onLimitsUpdated);
				window.addEventListener("usage-stats:accounts-updated", onAccountsUpdated);
				return () => {
					window.clearInterval(timer);
					window.removeEventListener("usage-stats:limits-updated", onLimitsUpdated);
					window.removeEventListener("usage-stats:accounts-updated", onAccountsUpdated);
					summaryRequestRef.current += 1;
				};
			}, [loadSummary, open]);
			react.useEffect(() => {
				if (!open) return void 0;
				const updatePosition = () => {
					const right = layerRef.current?.getBoundingClientRect?.().right;
					if (!Number.isFinite(right)) return;
					// The panel is 760px wide (max-width: calc(100vw - 32px)); clamp its
					// left edge so the right edge keeps a 12px viewport margin.
					const panelWidth = Math.min(760, window.innerWidth - 32);
					const maxPanelLeft = Math.max(0, window.innerWidth - panelWidth - 12);
					setPanelLeft(Math.min(Math.max(0, Math.round(right)), maxPanelLeft));
				};
				updatePosition();
				window.addEventListener("resize", updatePosition);
				return () => window.removeEventListener("resize", updatePosition);
			}, [open]);

			// Harness lays footer action registrations out in a row. Stack them so
			// this action and the built-in Settings action remain independently
			// visible in both wide and rail sidebar modes.
			react.useEffect(() => {
				let host = layerRef.current?.parentElement ?? null;
				for (let depth = 0; host !== null && depth < 3; depth += 1) {
					if (window.getComputedStyle(host).display.includes("flex")) break;
					host = host.parentElement;
				}
				if (host === null) return void 0;
				const style = window.getComputedStyle(host);
				if (!style.display.includes("flex") || style.flexDirection === "column") return void 0;
				const previous = host.style.flexDirection;
				host.style.flexDirection = "column";
				return () => { host.style.flexDirection = previous; };
			}, []);

			return react_jsx_runtime.jsxs("div", {
				ref: layerRef,
				className: wide ? S.layer : `${S.layer} ${S.rail}`,
				children: [
					open && react_dom.createPortal(react_jsx_runtime.jsx("section", {
						className: S.panel,
						style: { left: `${panelLeft}px` },
						"data-usage-stats-panel": true,
						"aria-label": t("panel.title"),
						children: react_jsx_runtime.jsx("div", {
							className: S.panelBody,
							children: react_jsx_runtime.jsx(UsageStatsSection, {
								t,
								onClose: () => setOpen(false),
								onOpenSettings: () => {
									setOpen(false);
									openHarnessSettings(layerRef.current);
								}
							})
						})
					}), document.body),
					react_jsx_runtime.jsx("div", {
						className: S.footerButtons,
						children: react_jsx_runtime.jsxs("button", {
							type: "button",
							className: S.sidebarButton,
							"data-usage-stats-trigger": true,
							"data-active": open ? "true" : void 0,
							"aria-label": t("panel.badge"),
							"aria-expanded": open,
							onClick: () => {
								if (!open) loadSummary();
								setOpen((value) => !value);
							},
						children: [
										react_jsx_runtime.jsx(UsageCurrencyIcon, { size: wide ? 18 : 20 }),
								wide && react_jsx_runtime.jsxs("span", {
									className: S.sidebarText,
									children: [
										react_jsx_runtime.jsx("span", { className: S.sidebarLabel, children: t("panel.badge") }),
									react_jsx_runtime.jsxs("span", {
									className: S.sidebarSummary,
									title: summaryText,
									children: [
										showBalance ? react_jsx_runtime.jsxs("span", { className: S.statusItem, children: [
											showStatusDot && summary.balanceStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot, "data-tone": summary.balanceStatus }) : null,
											`余额 ${summary.balance}`
										] }) : null,
										showBalance && showToday ? " · " : null,
										showToday ? react_jsx_runtime.jsxs("span", { className: S.statusItem, children: [
											showStatusDot && summary.todayStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot, "data-tone": summary.todayStatus }) : null,
											`今日 ${summary.today}`
										] }) : null
								]
								})
									]
								})
							]
						})
					}),
					// 页面内 Toast（通知通道）：primitives.Toast 自带 body portal 与
					// 自动淡出，onDone 时从队列移除；跨轮询用 notifiedAlertsRef 去重。
					toasts.map((toast) => react_jsx_runtime.jsx(primitives.Toast, {
						key: toast.key,
						text: toast.text,
						icon: toast.tone === "recovery"
							? react_jsx_runtime.jsx(primitives.IconCheckOutline16, { size: 14 })
							: react_jsx_runtime.jsx(primitives.IconWarningOutline16, { size: 14 }),
						onDone: () => setToasts((prev) => prev.filter((item) => item.key !== toast.key))
					}, toast.key))
				]
			});
		}
		//#endregion

		//#region locales
		/** `usageStats` namespace dictionaries (the zh key set is the source of truth). */
		const NS = "usageStats";
		const zh = {
			"nav": "用量统计",
			"panel.title": "用量与余额",
			"panel.badge": "用量/余额",
			"panel.summary": "余额 {balance} · 今日 {today}",
			"panel.updatedAt": "更新于 {time}",
			"panel.gotoSettings": "前往设置",
			"panel.tabs": "查询标签",
			"panel.tabOverview": "概览",
			"panel.tabDetails": "明细",
			"action.refresh": "刷新",
			"action.retry": "重试",
			"action.close": "关闭",
			"action.today": "回到今天",
			"action.prevMonth": "上个月",
			"action.nextMonth": "下个月",
			"action.prevDay": "前一天",
			"action.nextDay": "后一天",
			"balance.label": "DeepSeek 官方账户余额",
			"balance.apiKey": "API Key",
			"balance.unconfigured": "未配置",
			"balance.toppedUp": "充值余额",
			"balance.granted": "赠送余额",
			"balance.error": "余额获取失败：{message}",
			"balance.status.loading": "查询中",
			"balance.status.empty": "暂无数据",
			"balance.status.ok": "实时",
			"balance.status.notConfigured": "未配置",
			"balance.status.unauthorized": "密钥无效",
			"balance.status.rateLimited": "请求受限",
			"balance.status.unavailable": "暂不可用",
			"balance.status.error": "获取失败",
			"usage.model": "模型",
			"usage.allModels": "全部模型",
			"usage.today": "今日",
			"usage.month": "本月",
			"usage.total": "累计",
			"usage.timeRange": "时间维度",
			"usage.rangeToday": "今天",
			"usage.rangeYesterday": "昨天",
			"usage.range7d": "近 7 天",
			"usage.range30d": "近 30 天",
			"usage.rangeMonth": "本月",
			"usage.rangeLastMonth": "上月",
			"usage.costToday": "今日消费(估算)",
			"usage.costTodayUnpriced": "今日消费(部分未定价)",
			"usage.unpricedNote": "含未定价模型，金额仅统计已定价模型（DeepSeek）",
			"usage.legacyEstimated": "含历史估算区间（legacy 快照，费用按当前价格估算）",
			"usage.cost": "费用",
			"usage.loading": "正在统计用量…",
			"usage.error": "用量统计失败：{message}",
			"usage.hourly": "按小时统计",
			"usage.heatmap": "{year} 年每日用量",
			"usage.year": "选择年份",
			"usage.legendLess": "少",
			"usage.legendMore": "多",
			"usage.recent": "最近 14 天",
			"usage.noDays": "最近 14 天没有用量记录。",
			"usage.input": "输入",
			"usage.output": "输出",
			"usage.cacheRead": "缓存读",
			"usage.hitRate": "缓存命中",
			"usage.unknownModel": "未知模型",
			"usage.noModels": "这一天没有分模型数据。",
			"usage.providerDeepseek": "DeepSeek 官方",
			"usage.notBilled": "不计费",
			"chart.empty": "这一天没有用量数据。",
			"chart.peakNote": "高峰：北京时间 09-12 / 14-18，费用×2",
			"limits.title": "用量提醒与限额设置",
			"limits.apiKey": "目标 API Key",
			"limits.global": "全局默认 (全部 Key)",
			"limits.groupSpend": "消费限额与预警",
			"limits.groupBalance": "余额保障",
			"limits.enable": "启用用量提醒",
			"limits.enableDesc": "启用后根据每日消费限额和预警比例显示状态提醒",
			"limits.dailyLimit": "每日消费限额",
			"limits.dailyLimitPlaceholder": "例如 20.00 (不限留空)",
			"limits.lowBalance": "余额提醒",
			"limits.lowBalancePlaceholder": "例如 10.00 (不限留空)",
			"limits.alertPercent": "预警提醒比例",
			"limits.criticalPercent": "严重预警比例",
			"limits.alertNormal": "正常 ≥ {percent}%",
			"limits.alertWarning": "预警 {percent}%–{critical}%",
			"limits.alertExceeded": "严重 ≤ {percent}%",
			"limits.stopOnExceed": "超限时停止新调用",
			"limits.stopDesc": "仅使用可信的本地消费和新鲜余额判断；数据过期或查询失败时放行。",
			"limits.stopConfirm": "确定开启硬停止吗？费用为估算值，达到限额后新的模型调用会被阻止。",
			"limits.status.ok": "用量正常",
			"limits.status.normal": "用量正常",
			"limits.status.warning": "用量预警",
			"limits.status.exceeded": "已超限",
			"limits.status.blocked": "已停止新调用",
			"limits.status.stale": "余额数据已过期",
			"limits.status.unavailable": "余额暂不可用",
			"limits.status.unpriced": "费用不可靠（含未定价模型）",
			"limits.status.unlimited": "未限制",
			"limits.progress": "今日已消费 {spent} / 限额 {limit} ({percent}%)",
			"limits.save": "保存设置",
			"limits.saving": "保存中…",
			"limits.saveError": "保存失败：{message}",
			"settings.nav": "用量与计费",
			"settings.title": "用量与计费",
			"settings.desc": "这里承载会改变计费或调用行为的配置。查询与配置已分离：余额、用量与图表请在侧栏「用量/余额」查询中心查看。",
			"settings.tabAccounts": "账户与余额",
			"settings.tabLimits": "预算与限额",
			"settings.tabPricing": "价格设置",
			"settings.tabNotifications": "通知与提示",
			"settings.tabData": "数据管理",
			"settings.tabConversation": "折叠会话",
			"conversation.title": "折叠会话",
			"conversation.desc": "将对话中连续的思考和工具调用自动折叠为紧凑条目，减少滚动距离。",
			"conversation.enable": "折叠会话",
			"conversation.enableDesc": "开启后，连续的思考（Think）和工具调用自动收进一个折叠项，默认收起；模型最终回复始终正常显示。",
			"conversation.showTokenUsage": "统计会话 Token",
			"conversation.showTokenUsageDesc": "折叠条目后方显示当前会话的输入/输出 Token 用量。",
			"conversation.saveError": "保存失败：{message}",
			"conversation.status.running": "进行中…",
			"conversation.status.done": "已完成",
			"conversation.status.error": "执行错误",
			"conversation.status.thinking": "正在思考",
			"conversation.status.toolRunning": "正在调用工具",
			"conversation.count.thought": "×{count} 次思考",
			"conversation.count.thoughts": "×{count} 次思考",
			"conversation.count.toolCall": "×{count} 次工具",
			"conversation.count.toolCalls": "×{count} 次工具",
			"conversation.count.failure": "×{count} 次失败",
			"conversation.count.failures": "×{count} 次失败",
			"conversation.tokens.input": "输入",
			"conversation.tokens.output": "输出",
			"accounts.title": "账户与余额",
			"accounts.default": "默认",
			"accounts.defaultAccount": "默认账户",
			"accounts.refreshCadence": "余额刷新周期",
			"accounts.refreshOff": "关闭",
			"accounts.refresh1min": "1 分钟",
			"accounts.refresh5min": "5 分钟",
			"accounts.refresh15min": "15 分钟",
			"accounts.refresh30min": "30 分钟",
			"accounts.showBalance": "侧栏显示余额",
			"accounts.showToday": "侧栏显示今日消费",
			"accounts.showStatus": "侧栏显示状态点",
			"accounts.refreshNow": "立即刷新余额",
			"accounts.refreshing": "刷新中…",
			"accounts.saveError": "保存失败：{message}",
			"pricing.title": "价格设置",
			"pricing.official": "官方",
			"pricing.custom": "自定义",
			"pricing.basis": "价格单位：{currency} / 1M tokens",
			"pricing.checkedAt": "价格核对时间：{time}",
			"pricing.stale": "官方价格已超过 {days} 天未核对，请以官方价格页为准。",
			"pricing.offPeak": "空闲",
			"pricing.peak": "高峰",
			"pricing.inputMiss": "输入未命中",
			"pricing.inputHit": "输入命中",
			"pricing.output": "输出",
			"pricing.colMiss": "未命中",
			"pricing.colHit": "命中",
			"pricing.colOutput": "输出",
			"pricing.fork": "自定义价格",
			"pricing.edit": "编辑价格",
			"pricing.saveCustom": "保存自定义方案",
			"pricing.restore": "恢复官方价格",
			"pricing.saveError": "保存失败：{message}",
			"notifications.title": "通知与提示",
			"notifications.desc": "配置告警输出通道与冷却时间；侧栏状态点与页面内 Toast 提醒。系统通知不在本期范围。",
			"notifications.channels": "输出通道",
			"notifications.channelSidebar": "侧栏状态点",
			"notifications.channelToast": "页面内 Toast",
			"notifications.events": "事件类型",
			"notifications.eventWarning": "预警",
			"notifications.eventExceeded": "超限",
			"notifications.eventLowBalance": "余额不足",
			"notifications.eventRecovery": "恢复正常",
			"notifications.cooldown": "冷却时间",
			"notifications.cooldown5min": "5 分钟",
			"notifications.cooldown15min": "15 分钟",
			"notifications.cooldown30min": "30 分钟",
			"notifications.cooldown1h": "1 小时",
			"notifications.cooldown2h": "2 小时",
			"notifications.history": "告警历史",
			"notifications.empty": "暂无告警记录。",
			"notifications.type.alert": "告警",
			"notifications.type.recovery": "恢复",
			"notifications.saveError": "保存失败：{message}",
			"data.title": "数据管理",
			"data.desc": "查看本地统计数据的规模，按需裁剪保留天数或清除历史。provider usage 是账单真值，离线 tokenizer 不参与计费。",
			"data.overview": "数据概况",
			"data.retentionGroup": "数据保留",
			"data.dangerGroup": "危险操作",
			"data.ledgerEntries": "本地记录",
			"data.ledgerCapacity": "记录上限",
			"data.foldedCount": "已归档（估算）",
			"data.dateRange": "数据范围",
			"data.legacyEstimated": "部分更早记录已归档为估算值，金额按当前价格估算，非精确账单。",
			"data.retention": "保留天数",
			"data.retentionPlaceholder": "例如 1 = 只保留今天",
			"data.retentionNote": "保留天数含今天：1 天只保留今天，2 天保留今天和昨天；留空不裁剪。超出上限的旧记录自动归档为估算。",
			"data.rebuild": "重新统计",
			"data.trim": "按天数裁剪",
			"data.clear": "清除全部历史",
			"data.clearConfirmDesc": "此操作不可逆，将删除所有本地用量记录（账本与历史快照）。",
			"data.clearConfirmWord": "清除",
			"data.clearConfirmPlaceholder": "输入「清除」确认",
			"data.clearConfirmHint": "请输入「{word}」以确认删除。",
			"data.clearConfirmBtn": "确认清除",
			"data.cancel": "取消",
			"data.cleared": "历史已清除",
			"data.rebuilt": "统计已刷新",
			"data.trimmed": "已按保留天数裁剪",
			"data.tokenizerNote": "provider usage 是账单真值；离线 tokenizer 仅估算可见文本，不混入账单。",
			"data.saveError": "操作失败：{message}",
			"weekday.mon": "一",
			"weekday.tue": "二",
			"weekday.wed": "三",
			"weekday.thu": "四",
			"weekday.fri": "五",
			"weekday.sat": "六",
			"weekday.sun": "日",
			"month.year": "{year}年{month}",
			"month.names": "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月"
		};
		const en = {
			"nav": "Usage Stats",
			"panel.title": "Usage & Balance",
			"panel.badge": "Usage/Balance",
			"panel.summary": "Balance {balance} · today {today}",
			"panel.updatedAt": "Updated at {time}",
			"panel.gotoSettings": "Settings",
			"panel.tabs": "Panel sections",
			"panel.tabOverview": "Overview",
			"panel.tabDetails": "Details",
			"action.refresh": "Refresh",
			"action.retry": "Retry",
			"action.close": "Close",
			"action.today": "Today",
			"action.prevMonth": "Previous month",
			"action.nextMonth": "Next month",
			"action.prevDay": "Previous day",
			"action.nextDay": "Next day",
			"balance.label": "DeepSeek official balance",
			"balance.apiKey": "API Key",
			"balance.unconfigured": "not configured",
			"balance.toppedUp": "Topped up",
			"balance.granted": "Granted",
			"balance.error": "Balance fetch failed: {message}",
			"balance.status.loading": "Loading",
			"balance.status.empty": "No data",
			"balance.status.ok": "Live",
			"balance.status.notConfigured": "Not configured",
			"balance.status.unauthorized": "Invalid key",
			"balance.status.rateLimited": "Rate limited",
			"balance.status.unavailable": "Unavailable",
			"balance.status.error": "Failed",
			"usage.model": "Model",
			"usage.allModels": "All models",
			"usage.today": "Today",
			"usage.month": "This month",
			"usage.total": "All time",
			"usage.timeRange": "Time range",
			"usage.rangeToday": "Today",
			"usage.rangeYesterday": "Yesterday",
			"usage.range7d": "Last 7 days",
			"usage.range30d": "Last 30 days",
			"usage.rangeMonth": "This month",
			"usage.rangeLastMonth": "Last month",
			"usage.costToday": "Spend today (est.)",
			"usage.costTodayUnpriced": "Spend today (some unpriced)",
			"usage.unpricedNote": "Includes unpriced models; amount covers priced (DeepSeek) models only",
			"usage.legacyEstimated": "Includes estimated legacy history (costs estimated at current prices)",
			"usage.cost": "Cost",
			"usage.loading": "Aggregating usage…",
			"usage.error": "Usage aggregation failed: {message}",
			"usage.hourly": "Per-hour usage",
			"usage.heatmap": "Daily usage in {year}",
			"usage.year": "Select year",
			"usage.legendLess": "Less",
			"usage.legendMore": "More",
			"usage.recent": "Last 14 days",
			"usage.noDays": "No usage in the last 14 days.",
			"usage.input": "Input",
			"usage.output": "Output",
			"usage.cacheRead": "Cache read",
			"usage.hitRate": "Cache hit",
			"usage.unknownModel": "Unknown model",
			"usage.noModels": "No per-model data for this day.",
			"usage.providerDeepseek": "DeepSeek Official",
			"usage.notBilled": "Not billed",
			"chart.empty": "No usage data for this day.",
			"chart.peakNote": "Peak: Beijing 09-12 / 14-18, ×2 price",
			"limits.title": "Usage Alerts & Quota Limits",
			"limits.apiKey": "Target API Key",
			"limits.global": "Global Default (All Keys)",
			"limits.groupSpend": "Spend Limit & Alerts",
			"limits.groupBalance": "Balance Safety",
			"limits.enable": "Enable Usage Alerts",
			"limits.enableDesc": "Show status alerts based on daily spend and the selected alert percentage",
			"limits.dailyLimit": "Daily Spend Limit",
			"limits.dailyLimitPlaceholder": "e.g. 20.00 (blank for no limit)",
			"limits.lowBalance": "Balance Alert",
			"limits.lowBalancePlaceholder": "e.g. 10.00 (blank for no alert)",
			"limits.alertPercent": "Alert Threshold",
			"limits.criticalPercent": "Critical Threshold",
			"limits.alertNormal": "Normal ≥ {percent}%",
			"limits.alertWarning": "Warning {percent}%–{critical}%",
			"limits.alertExceeded": "Critical ≤ {percent}%",
			"limits.stopOnExceed": "Stop New Calls on Exceed",
			"limits.stopDesc": "Only trusted local usage and fresh balance data can block; stale or failed balance checks fail open.",
			"limits.stopConfirm": "Enable hard stop? Costs are estimates, and new model calls will be blocked after a limit is reached.",
			"limits.status.ok": "Normal",
			"limits.status.normal": "Normal",
			"limits.status.warning": "Warning",
			"limits.status.exceeded": "Exceeded",
			"limits.status.blocked": "New Calls Blocked",
			"limits.status.stale": "Balance Data Stale",
			"limits.status.unavailable": "Balance Unavailable",
			"limits.status.unpriced": "Cost Unreliable (Unpriced Models)",
			"limits.status.unlimited": "No Limit",
			"limits.progress": "Spent today {spent} / Limit {limit} ({percent}%)",
			"limits.save": "Save Settings",
			"limits.saving": "Saving…",
			"limits.saveError": "Save failed: {message}",
			"settings.nav": "Usage & Billing",
			"settings.title": "Usage & Billing",
			"settings.desc": "Configuration that changes billing or call behavior lives here. Querying is separate: open the sidebar Usage/Balance panel for balances, usage and charts.",
			"settings.tabAccounts": "Account & Balance",
			"settings.tabLimits": "Budget & Limits",
			"settings.tabPricing": "Pricing",
			"settings.tabNotifications": "Notifications",
			"settings.tabData": "Data Management",
			"settings.tabConversation": "Compact Conversation",
			"conversation.title": "Compact Conversation",
			"conversation.desc": "Automatically collapse consecutive thinking and tool calls into a compact row to reduce scrolling.",
			"conversation.enable": "Compact conversation",
			"conversation.enableDesc": "When on, consecutive thinking (Think) and tool calls are folded into a single collapsed item by default; the model's final reply always shows normally.",
			"conversation.showTokenUsage": "Count session tokens",
			"conversation.showTokenUsageDesc": "Show input/output token usage beside the collapsed item.",
			"conversation.saveError": "Save failed: {message}",
			"conversation.status.running": "Running…",
			"conversation.status.done": "Done",
			"conversation.status.error": "Error",
			"conversation.status.thinking": "Thinking",
			"conversation.status.toolRunning": "Calling tool",
			"conversation.count.thought": "×{count} thought",
			"conversation.count.thoughts": "×{count} thoughts",
			"conversation.count.toolCall": "×{count} tool",
			"conversation.count.toolCalls": "×{count} tools",
			"conversation.count.failure": "×{count} failure",
			"conversation.count.failures": "×{count} failures",
			"conversation.tokens.input": "In",
			"conversation.tokens.output": "Out",
			"accounts.title": "Account & Balance",
			"accounts.default": "Default",
			"accounts.defaultAccount": "Default account",
			"accounts.refreshCadence": "Balance refresh cadence",
			"accounts.refreshOff": "Off",
			"accounts.refresh1min": "1 min",
			"accounts.refresh5min": "5 min",
			"accounts.refresh15min": "15 min",
			"accounts.refresh30min": "30 min",
			"accounts.showBalance": "Show balance in sidebar",
			"accounts.showToday": "Show today's spend in sidebar",
			"accounts.showStatus": "Show status dot in sidebar",
			"accounts.refreshNow": "Refresh balance now",
			"accounts.refreshing": "Refreshing…",
			"accounts.saveError": "Save failed: {message}",
			"pricing.title": "Pricing",
			"pricing.official": "Official",
			"pricing.custom": "Custom",
			"pricing.basis": "Unit: {currency} per 1M tokens",
			"pricing.checkedAt": "Price checked at: {time}",
			"pricing.stale": "Official prices haven't been verified for {days} days; please check the official pricing page.",
			"pricing.offPeak": "Off-peak",
			"pricing.peak": "Peak",
			"pricing.inputMiss": "Input miss",
			"pricing.inputHit": "Input hit",
			"pricing.output": "Output",
			"pricing.colMiss": "Miss",
			"pricing.colHit": "Hit",
			"pricing.colOutput": "Output",
			"pricing.fork": "Customize pricing",
			"pricing.edit": "Edit pricing",
			"pricing.saveCustom": "Save custom scheme",
			"pricing.restore": "Restore official prices",
			"pricing.saveError": "Save failed: {message}",
			"notifications.title": "Notifications",
			"notifications.desc": "Configure alert channels and cooldown: sidebar status dot and in-page toast. System notifications are out of scope.",
			"notifications.channels": "Channels",
			"notifications.channelSidebar": "Sidebar status dot",
			"notifications.channelToast": "In-page toast",
			"notifications.events": "Event types",
			"notifications.eventWarning": "Warning",
			"notifications.eventExceeded": "Exceeded",
			"notifications.eventLowBalance": "Low balance",
			"notifications.eventRecovery": "Recovery",
			"notifications.cooldown": "Cooldown",
			"notifications.cooldown5min": "5 min",
			"notifications.cooldown15min": "15 min",
			"notifications.cooldown30min": "30 min",
			"notifications.cooldown1h": "1 hour",
			"notifications.cooldown2h": "2 hours",
			"notifications.history": "Alert history",
			"notifications.empty": "No alerts yet.",
			"notifications.type.alert": "Alert",
			"notifications.type.recovery": "Recovery",
			"notifications.saveError": "Save failed: {message}",
			"data.title": "Data Management",
			"data.desc": "See how much local usage data is kept, trim retention, or clear history. Provider usage is the billing truth; the offline tokenizer never affects billing.",
			"data.overview": "Overview",
			"data.retentionGroup": "Retention",
			"data.dangerGroup": "Danger zone",
			"data.ledgerEntries": "Local records",
			"data.ledgerCapacity": "Record limit",
			"data.foldedCount": "Archived (estimated)",
			"data.dateRange": "Data range",
			"data.legacyEstimated": "Some older records were archived as estimates; their cost uses current prices, not exact billing.",
			"data.retention": "Retention days",
			"data.retentionPlaceholder": "e.g. 1 = today only",
			"data.retentionNote": "Retention includes today: 1 day keeps today only, 2 days keep today and yesterday; leave blank to keep all. Entries beyond the cap are archived as estimates.",
			"data.rebuild": "Recompute stats",
			"data.trim": "Trim by days",
			"data.clear": "Clear all history",
			"data.clearConfirmDesc": "This cannot be undone: it deletes all local usage records (ledger and historical snapshot).",
			"data.clearConfirmWord": "DELETE",
			"data.clearConfirmPlaceholder": "Type DELETE to confirm",
			"data.clearConfirmHint": "Type \"{word}\" to confirm deletion.",
			"data.clearConfirmBtn": "Confirm clear",
			"data.cancel": "Cancel",
			"data.cleared": "History cleared",
			"data.rebuilt": "Stats recomputed",
			"data.trimmed": "Trimmed by retention",
			"data.tokenizerNote": "Provider usage is the billing truth; the offline tokenizer only estimates visible text.",
			"data.saveError": "Operation failed: {message}",
			"weekday.mon": "M",
			"weekday.tue": "T",
			"weekday.wed": "W",
			"weekday.thu": "T",
			"weekday.fri": "F",
			"weekday.sat": "S",
			"weekday.sun": "S",
			"month.year": "{month} {year}",
			"month.names": "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec"
		};
		//#endregion

		//#region plugin body
		/** Services required by the client plugin body. */
		const inject = ["slots", "locale"];

		/**
		 * Client plugin body: register dictionaries and the sidebar footer action.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "usage-stats: dictionaries");
			ctx.effect(() => {
				if (typeof document === "undefined") return void 0;
				const markNav = () => {
					const source = document.querySelector('[data-usage-stats-trigger] svg');
					for (const node of document.querySelectorAll("button,a,[role=button]")) {
						if (node.textContent?.trim() !== "用量与计费" && node.textContent?.trim() !== "Usage & Billing") continue;
						const item = node.closest("li,[role=tab],.settings-nav-item") || node;
						item.dataset.usageBillingNav = "true";
						if (source && !item.querySelector("svg[data-usage-currency-icon]")) {
							const icon = source.cloneNode(true);
							icon.dataset.usageCurrencyIcon = "true";
							icon.setAttribute("width", "20");
							icon.setAttribute("height", "20");
							const existing = item.querySelector("svg");
							if (existing) existing.replaceWith(icon);
						}
					}
				};
				markNav();
				const observer = new MutationObserver(markNav);
				observer.observe(document.body, { childList: true, subtree: true });
				return () => observer.disconnect();
			}, "usage-stats: settings navigation icon");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "usage-stats",
				order: 10,
				locale: NS
			}, UsageStatsPanel));
			// 设置 → 用量与计费：独立设置入口承载配置（限额等），查询弹窗保持只读。
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "usage-stats",
				order: 60,
				label: () => t("settings.nav"),
				icon: () => react_jsx_runtime.jsx(UsageCurrencyIcon, { size: 20 }),
				locale: NS
			}, UsageBillingSettingsSection));
			// 折叠会话控制器：注入对话头部，自动折叠连续的思考和工具调用。
			ctx.effect(() => {
				if (typeof document === "undefined") return void 0;
				var style = document.createElement("style");
				style.dataset.plugin = "usage-stats-compact";
				style.textContent = COMPACT_CSS;
				document.head.appendChild(style);
				return () => { style.remove(); };
			}, "usage-stats: compact conversation styles");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "usage-stats-compact-conversation",
				order: -100,
				locale: NS
			}, CompactConversationController));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.UsageStatsPanel = UsageStatsPanel;
		exports.UsageStatsSection = UsageStatsSection;
		exports.UsageBillingSettingsSection = UsageBillingSettingsSection;
		exports.openHarnessSettings = openHarnessSettings;
		exports.BalanceCard = BalanceCard;
		exports.LimitsCard = LimitsCard;
		exports.AccountsCard = AccountsCard;
		exports.PricingCard = PricingCard;
		exports.NotificationsCard = NotificationsCard;
		exports.DataCard = DataCard;
		exports.ConversationCard = ConversationCard;
		exports.CompactConversationController = CompactConversationController;
		exports.SETTINGS_TABS = SETTINGS_TABS;
		exports.ContributionHeatmap = ContributionHeatmap;
		exports.HourlyChart = HourlyChart;
		exports.DayList = DayList;
			exports.DayDetail = DayDetail;
			exports.activeDayKeyOf = activeDayKeyOf;
			exports.filterDay = filterDay;
		exports.summarize = summarize;
		exports.modelChoicesOf = modelChoicesOf;
		exports.recentDays = recentDays;
		exports.modelIdOf = modelIdOf;
		exports.providerOf = providerOf;
		exports.groupModelsByProvider = groupModelsByProvider;
		exports.fmt = fmt;
		exports.fmtMoney = fmtMoney;
		exports.currencySymbol = currencySymbol;
		exports.sidebarSummaryOf = sidebarSummaryOf;
		exports.fmtCurrency = fmtCurrency;
		exports.isPeak = isPeak;
		exports.buildYearContributionHeatmap = buildYearContributionHeatmap;
		exports.cellColor = cellColor;
		return module.exports;
	}
});
