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
			".usg_headerActions{align-items:center;gap:2px;display:flex}",
			".usg_iconButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;padding:0;display:inline-flex;flex:none}",
			".usg_iconButton:hover{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_iconButton[disabled]{cursor:default;opacity:.45}",
			"@keyframes usg_spin{to{transform:rotate(360deg)}}",
			".usg_iconButton[data-loading=true] svg{animation:usg_spin .75s linear infinite;transform-origin:center}",
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
			".usg_peakRegion{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--usg-blue) 5%,transparent);border-left:1px solid color-mix(in srgb,var(--usg-blue) 14%,transparent);border-right:1px solid color-mix(in srgb,var(--usg-blue) 14%,transparent);pointer-events:none;z-index:0}",
			".usg_hourTooltip{position:absolute;z-index:60;top:8px;min-width:174px;max-width:230px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;box-shadow:var(--dsw-shadow-lv2);font-size:11px;line-height:17px;pointer-events:none}",
			".usg_hourTooltipHead{justify-content:space-between;align-items:center;gap:16px;margin-bottom:3px;font-size:12px;font-weight:600;display:flex}",
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
			".usg_limitGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}",
			".usg_limitField{flex-direction:column;gap:4px;display:flex}",
			".usg_limitFieldLabel{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px;display:flex;align-items:center;justify-content:space-between}",
			".usg_inputWrapper{position:relative;display:flex;align-items:center}",
			".usg_inputPrefix{position:absolute;left:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;pointer-events:none}",
			".usg_inputSuffix{position:absolute;right:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;pointer-events:none}",
			".usg_input{box-sizing:border-box;width:100%;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 12px;font:inherit;font-size:13px;line-height:1.5;box-shadow:none}",
			".usg_input.has_prefix{padding-left:28px}",
			".usg_input.has_suffix{padding-right:28px}",
			".usg_input::placeholder{color:var(--dsw-alias-label-tertiary);opacity:1}",
			".usg_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}",
			".usg_toggleGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
			".usg_toggleRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base)}",
			".usg_toggleInfo{display:flex;flex-direction:column;gap:1px}",
			".usg_toggleTitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}",
			".usg_toggleDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}",
			".usg_switch{position:relative;display:inline-block;width:32px;height:18px;flex:none;cursor:pointer}",
			".usg_switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;appearance:none;z-index:2}",
			".usg_switchSlider{position:absolute;cursor:pointer;inset:0;background-color:rgba(128,128,128,.28);border:1px solid rgba(128,128,128,.18);box-sizing:border-box;border-radius:20px;transition:.2s}",
			".usg_switchSlider:before{position:absolute;content:\"\";height:12px;width:12px;left:3px;bottom:3px;background-color:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}",
			".usg_switch input:focus-visible + .usg_switchSlider{outline:2px solid color-mix(in srgb,var(--usg-action) 35%,transparent);outline-offset:2px}",
			".usg_switch input:checked + .usg_switchSlider{background-color:var(--usg-action);border-color:var(--usg-action)}",
			".usg_switch input:checked + .usg_switchSlider:before{transform:translateX(14px)}",
			".usg_alertCard{grid-column:1/-1;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:9px;background:var(--dsw-alias-bg-base)}",
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
			".usg_settingsLink{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;padding:2px 6px;font:inherit;font-size:12px;line-height:20px;flex:none;white-space:nowrap}",
			".usg_settingsLink:hover{color:var(--usg-blue);background:var(--dsw-alias-interactive-bg-hover)}",
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
			hourTooltip: "usg_hourTooltip",
			hourTooltipHead: "usg_hourTooltipHead",
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
			settingsLink: "usg_settingsLink"
		};
		//#endregion

		//#region helpers
		const BLUE_RGB = [31, 111, 235];
		const GREEN_RGB = [35, 168, 120];

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
			let todayTokens = 0;
			let todayCost = 0;
			let todayPriced = true;
			let monthTokens = 0;
			let monthCost = 0;
			let monthPriced = true;
			let totalTokens = 0;
			let totalCost = 0;
			let totalPriced = true;
			for (const raw of days) {
				const day = filterDay(raw, modelId);
				if (day === null) continue;
				totalTokens += day.tokens ?? 0;
				if (day.cost === null) totalPriced = false;
				else totalCost += Number(day.cost) || 0;
				if (day.date.startsWith(month)) {
					monthTokens += day.tokens ?? 0;
					if (day.cost === null) monthPriced = false;
					else monthCost += Number(day.cost) || 0;
				}
				if (day.date === dayKey) {
					todayTokens = day.tokens ?? 0;
					todayPriced = day.cost !== null;
					todayCost = day.cost === null ? null : Number(day.cost) || 0;
				}
			}
			return {
				todayTokens,
				todayCost: todayPriced ? todayCost : null,
				monthTokens,
				monthCost: monthPriced ? monthCost : null,
				totalTokens,
				totalCost: totalPriced ? totalCost : null
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

		async function fetchJson(path) {
			let response;
			try {
				response = await fetch(path, {
					headers: { accept: "application/json" },
					signal: AbortSignal.timeout(30000)
				});
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
				return ["normal", "warning", "exceeded", "blocked", "stale", "unavailable"].includes(status)
					? `limits.status.${status}`
					: "limits.status.normal";
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
		function BalanceCard({ keys, selectedKey, onSelectKey, account, accountLoading, accountError, balanceTone = "muted", translate, onRefresh }) {
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
										balanceTone !== "muted" ? react_jsx_runtime.jsx("span", {
											className: S.statusDot,
											"data-tone": balanceTone,
											"data-balance-indicator": true,
											"aria-label": `balance ${balanceTone}`
										}) : null,
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
							react_jsx_runtime.jsx("button", { type: "button", className: S.retry, onClick: onRefresh, children: translate("action.retry") })
						]
					}) : balance !== null && react_jsx_runtime.jsx("div", {
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

		/** 24-hour token/cost bars for one (filtered) day. */
		function HourlyChart({ day, peakHours, money, translate }) {
			const [hoveredHour, setHoveredHour] = react.useState(null);
			const hours = day?.hours ?? [];
			if (hours.length === 0) return react_jsx_runtime.jsx("p", { className: S.note, children: translate("chart.empty") });
			const max = Math.max(...hours.map((hour) => hour.tokens ?? 0), 1);
			const hovered = hours.find((hour) => hour.hour === hoveredHour) ?? null;
			const tooltipPosition = hovered === null ? null : {
				left: `${((hovered.hour + 0.5) / 24 * 100).toFixed(2)}%`,
				transform: hovered.hour <= 4 ? "translateX(0)" : hovered.hour >= 19 ? "translateX(-100%)" : "translateX(-50%)"
			};
			// Peak windows are rendered as full-height background REGIONS across
			// the plot area — a time-of-day hint that must never be mistaken for
			// a token bar (zero-token hours render no bar element at all).
			const peakRegions = Array.isArray(peakHours)
				? peakHours.filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
					.map(([start, end]) => ({
						left: `${((start / 24) * 100).toFixed(2)}%`,
						width: `${(((end - start) / 24) * 100).toFixed(2)}%`
					}))
				: [];
			return react_jsx_runtime.jsxs("div", {
				className: S.chart,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.chartInner,
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.chartBody,
								children: [
								peakRegions.map((region, index) => react_jsx_runtime.jsx("div", {
									className: S.peakRegion,
									"data-peak-region": true,
									"aria-hidden": true,
									style: { left: region.left, width: region.width }
								}, `peak-${index}`)),
								hours.map((hour) => {
									const input = hour.inputTokens ?? 0;
									const output = hour.outputTokens ?? 0;
									const cacheRead = hour.cacheReadTokens ?? 0;
									const cacheWrite = hour.cacheWriteTokens ?? 0;
									const visualInput = input + cacheRead + cacheWrite;
									const tokens = hour.tokens ?? 0;
									const parts = Math.max(visualInput + output, 1);
									const peak = isPeak(hour.hour, peakHours);
									const barHeight = tokens > 0 ? Math.max(1, Math.round(100 * tokens / max)) : 0;
									const title = `${String(hour.hour).padStart(2, "0")}:00 · ${translate("usage.input")} ${fmt(input)} · ${translate("usage.output")} ${fmt(output)} · ${translate("usage.cost")} ${money !== void 0 ? money(hour.cost) : ""}`;
									return react_jsx_runtime.jsx("button", {
										type: "button",
										className: S.hourSlot,
										"data-hour": hour.hour,
										"data-peak": peak ? "true" : void 0,
										"aria-label": title,
										onMouseEnter: () => setHoveredHour(hour.hour),
										onMouseLeave: () => setHoveredHour(null),
										onFocus: () => setHoveredHour(hour.hour),
										onBlur: () => setHoveredHour(null),
										// Tap (touch) support: toggle the pinned tooltip.
										onClick: () => setHoveredHour(hoveredHour === hour.hour ? null : hour.hour),
										children: tokens > 0 && react_jsx_runtime.jsxs("div", {
											className: S.hourBar,
											style: { height: `${barHeight}%` },
											children: [
												visualInput > 0 && react_jsx_runtime.jsx("div", { className: S.hourInput, style: { flexGrow: visualInput / parts } }),
												output > 0 && react_jsx_runtime.jsx("div", { className: S.hourOutput, style: { flexGrow: output / parts } }),
											]
										})
									}, hour.hour);
								}),
								hovered !== null && react_jsx_runtime.jsxs("div", {
									className: S.hourTooltip,
									role: "tooltip",
									style: tooltipPosition,
									children: [
										react_jsx_runtime.jsxs("div", { className: S.hourTooltipHead, children: [
											react_jsx_runtime.jsx("span", { children: `${String(hovered.hour).padStart(2, "0")}:00` }),
											react_jsx_runtime.jsx("strong", { children: `${fmt(hovered.tokens ?? 0)} tokens` })
										] }),
										react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [react_jsx_runtime.jsx("span", { children: translate("usage.input") }), react_jsx_runtime.jsx("span", { children: fmt(hovered.inputTokens ?? 0) })] }),
										react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [react_jsx_runtime.jsx("span", { children: translate("usage.output") }), react_jsx_runtime.jsx("span", { children: fmt(hovered.outputTokens ?? 0) })] }),
										react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [react_jsx_runtime.jsx("span", { children: translate("usage.cacheRead") }), react_jsx_runtime.jsx("span", { children: fmt(hovered.cacheReadTokens ?? Math.max(0, (hovered.tokens ?? 0) - (hovered.inputTokens ?? 0) - (hovered.outputTokens ?? 0))) })] }),
																	react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [react_jsx_runtime.jsx("span", { children: translate("usage.cost") }), react_jsx_runtime.jsx("span", { children: money !== void 0 ? money(hovered.cost) : "" })] }),
										Array.isArray(hovered.models) && hovered.models.length > 0 && react_jsx_runtime.jsx("div", {
											className: S.hourTooltipModels,
											children: hovered.models.slice(0, 4).map((model) => react_jsx_runtime.jsxs("div", {
												className: S.hourTooltipModel,
												children: [
													react_jsx_runtime.jsx("span", { children: modelIdOf(model.model) }),
																	react_jsx_runtime.jsx("span", { children: `${fmt(model.tokens ?? 0)} · ${money !== void 0 ? money(model.cost) : ""}` })
												]
											}, model.model))
										})
									]
								})
								]
							}),
							react_jsx_runtime.jsx("div", {
								className: S.chartAxis,
								children: [0, 3, 6, 9, 12, 15, 18, 21, 23].map((hour) => react_jsx_runtime.jsx("span", { children: `${String(hour).padStart(2, "0")}:00` }, hour))
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.legend,
								children: [
									react_jsx_runtime.jsx("span", {
										className: S.legendItem,
										children: [
											react_jsx_runtime.jsx("span", {
												className: S.legendSwatch,
												style: { background: `rgba(${BLUE_RGB[0]}, ${BLUE_RGB[1]}, ${BLUE_RGB[2]}, 1)` }
											}),
											translate("chart.inputWithCache")
										]
									}),
									react_jsx_runtime.jsx("span", {
										className: S.legendItem,
										children: [
											react_jsx_runtime.jsx("span", {
												className: S.legendSwatch,
												style: { background: `rgba(${GREEN_RGB[0]}, ${GREEN_RGB[1]}, ${GREEN_RGB[2]}, 1)` }
											}),
											translate("usage.output")
										]
									}),
									Array.isArray(peakHours) && peakHours.length > 0 && react_jsx_runtime.jsx("span", { className: S.peakNote, children: translate("chart.peakNote") })
								]
							})
						]
					})
				]
			});
		}

		/** Recent-days list; clicking selects the day for the hourly chart. */
		function DayList({ days, selectedDay, onSelect, money, translate }) {
			if (days.length === 0) return react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.noDays") });
			const max = Math.max(...days.map((day) => day.tokens ?? 0), 1);
			return react_jsx_runtime.jsx("div", {
				className: S.days,
				children: days.map((day) => {
					const tokens = day.tokens ?? 0;
					return react_jsx_runtime.jsxs("button", {
						type: "button",
						className: S.day,
						"data-active": day.date === selectedDay ? "true" : void 0,
						onClick: () => onSelect(day.date),
						children: [
							react_jsx_runtime.jsx("span", { className: S.dayDate, children: dayLabel(day.date, translate) }),
							react_jsx_runtime.jsx("span", { className: S.dayTokens, children: fmt(tokens) }),
								react_jsx_runtime.jsx("span", { className: S.dayCost, children: money !== void 0 ? money(day.cost) : "" }),
							react_jsx_runtime.jsx("div", {
								className: S.dayBar,
								style: { width: `${Math.max(4, Math.round(100 * tokens / max))}%` }
							})
						]
					}, day.date);
				})
			});
		}

		/** Per-model breakdown of one day (respects the model filter). */
		function DayDetail({ day, money, translate }) {
			const models = Array.isArray(day?.models) ? day.models : [];
			const tokens = day?.tokens ?? 0;
			return react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
				children: [
					react_jsx_runtime.jsx("p", {
						className: S.detailSummary,
						children: `${translate("usage.total")} ${fmt(tokens)} · ${translate("usage.input")} ${fmt(day?.inputTokens ?? 0)} · ${translate("usage.output")} ${fmt(day?.outputTokens ?? 0)} · ${translate("usage.cacheRead")} ${fmt(day?.cacheReadTokens ?? 0)}`
					}),
					models.length === 0 ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.noModels") }) : models.map((model) => {
						const share = tokens > 0 ? Math.max(3, Math.round(100 * (model.tokens ?? 0) / tokens)) : 0;
						return react_jsx_runtime.jsxs("div", {
							className: S.modelRow,
							children: [
								react_jsx_runtime.jsxs("div", {
									className: S.modelHead,
									children: [
										react_jsx_runtime.jsx("span", { className: S.modelName, title: model.model, children: modelLabelOf(model.model, translate) }),
										react_jsx_runtime.jsx("span", { className: S.modelTokens, children: fmt(model.tokens ?? 0) }),
											react_jsx_runtime.jsx("span", { className: S.modelCost, children: money !== void 0 ? money(model.cost) : "" })
									]
								}),
								react_jsx_runtime.jsx("div", {
									className: S.modelBarTrack,
									children: react_jsx_runtime.jsx("div", { className: S.modelBar, style: { width: `${share}%` } })
								}),
								react_jsx_runtime.jsx("div", {
									className: S.modelMeta,
									children: `${translate("usage.input")} ${fmt(model.inputTokens ?? 0)} · ${translate("usage.output")} ${fmt(model.outputTokens ?? 0)} · ${translate("usage.cacheRead")} ${fmt(model.cacheReadTokens ?? 0)} · ${translate("usage.hitRate")} ${fmtHit(model.cacheHitRate)}`
								})
							]
						}, model.model);
					})
				]
			});
		}

		/** `YYYY-MM-DD` → `MM-DD 周X` display label. */
		function dayLabel(key, translate) {
			const [, month, day] = key.split("-");
			const date = new Date(Number(key.slice(0, 4)), Number(month) - 1, Number(day));
			const weekdays = [translate("weekday.sun"), translate("weekday.mon"), translate("weekday.tue"), translate("weekday.wed"), translate("weekday.thu"), translate("weekday.fri"), translate("weekday.sat")];
			return `${month}-${day} ${weekdays[date.getDay()]}`;
		}

		/** Display label for a `provider/model` attribution key. */
		function modelLabelOf(key, translate) {
			if (typeof key !== "string") return "";
			const slash = key.indexOf("/");
			if (slash === -1) return key;
			const provider = key.slice(0, slash);
			const model = key.slice(slash + 1);
			const providerLabel = provider === "unknown" ? translate("usage.unknownModel") : provider;
			const modelLabel = model === "unknown" || model === "" ? translate("usage.unknownModel") : model;
			return `${providerLabel} · ${modelLabel}`;
		}

		function safeGetStorage(key) {
			try {
				if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
					return window.localStorage.getItem(key);
				}
			} catch {}
			return null;
		}

		function safeSetStorage(key, value) {
			try {
				if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
					window.localStorage.setItem(key, value);
				}
			} catch {}
		}

		/**
		 * Limits and alert configuration card.
		 */
		function LimitsCard({ keys, selectedKey, onSelectKey, pricing, todayCost, translate, onLimitsUpdated }) {
			const [limits, setLimits] = react.useState(null);
			const limitsRef = react.useRef(null);
			const [statusMap, setStatusMap] = react.useState({});
			const isSingleKey = (keys || []).length <= 1;
			const [activeKey, setActiveKey] = react.useState(() => {
				if (isSingleKey) return "__global__";
				const stored = safeGetStorage("dsh_usage_limits_active_key");
				if (stored !== null && stored !== "") return stored;
				return selectedKey ?? "__global__";
			});
			const [saving, setSaving] = react.useState(false);
			const [error, setError] = react.useState(null);
			const pendingRef = react.useRef(null);
			const debounceTimerRef = react.useRef(null);
			const savingRef = react.useRef(false);

			// Form state
			const [enabled, setEnabled] = react.useState(false);
			const [dailyCostLimit, setDailyCostLimit] = react.useState("");
				const [lowBalanceWarning, setLowBalanceWarning] = react.useState("");
				const [alertPercent, setAlertPercent] = react.useState(80);
				const [criticalPercent, setCriticalPercent] = react.useState(90);
				const [stopOnExceed, setStopOnExceed] = react.useState(false);

			const loadLimits = react.useCallback(async () => {
				try {
					setError(null);
					const payload = await fetchJson("/api/usage-stats/limits");
					if (payload.ok === true) {
						limitsRef.current = payload.limits;
						setLimits(payload.limits);
						setStatusMap(payload.status || {});
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			}, []);

			react.useEffect(() => {
				loadLimits();
			}, [loadLimits]);

			// Sync activeKey when selectedKey becomes available (if not explicitly chosen in storage)
			react.useEffect(() => {
				if (isSingleKey) {
					setActiveKey("__global__");
					return;
				}
				if (selectedKey !== null && selectedKey !== undefined && selectedKey !== "") {
					const stored = safeGetStorage("dsh_usage_limits_active_key");
					if (stored) {
						setActiveKey(stored);
						return;
					}
					setActiveKey(selectedKey);
				}
			}, [selectedKey, isSingleKey]);

			// Update form fields when activeKey or limits payload change
			react.useEffect(() => {
				const currentLimits = limitsRef.current || limits;
				if (!currentLimits) return;
				const rule = activeKey === "__global__"
					? (currentLimits.global || {})
					: (currentLimits.keys?.[activeKey] || currentLimits.global || {});
				setEnabled(rule.enabled === true);
				setDailyCostLimit(rule.dailyCostLimit !== null && rule.dailyCostLimit !== undefined ? String(rule.dailyCostLimit) : "");
					setLowBalanceWarning(rule.lowBalanceWarning !== null && rule.lowBalanceWarning !== undefined ? String(rule.lowBalanceWarning) : "");
					setAlertPercent(rule.alertPercent || 80);
					setCriticalPercent(Math.max(rule.alertPercent || 80, rule.criticalPercent || 90));
					setStopOnExceed(rule.stopOnExceed === true);
			}, [activeKey, limits]);

			const handleKeySelect = (newKey) => {
				if (isSingleKey) return;
				// Do not strand an unsaved batch on the previous key's form.
				if (pendingRef.current !== null && !savingRef.current) flushSave();
				setActiveKey(newKey);
				safeSetStorage("dsh_usage_limits_active_key", newKey);
				if (newKey !== "__global__" && typeof onSelectKey === "function") {
					onSelectKey(newKey);
				}
			};

			/** Snapshot the full rule for the active key from current form state plus this change. */
			const buildRuleFrom = (overrideRule) => {
				const currentLimits = limitsRef.current || limits || { version: 2, global: {}, keys: {} };
				const currentActiveKey = activeKey;
				const currentRule = currentActiveKey === "__global__"
					? (currentLimits.global || {})
					: (currentLimits.keys?.[currentActiveKey] || {});
				return {
					...currentRule,
					enabled: overrideRule?.enabled !== undefined ? overrideRule.enabled : enabled,
					dailyCostLimit: overrideRule?.dailyCostLimit !== undefined
						? overrideRule.dailyCostLimit
						: (dailyCostLimit.trim() !== "" && !isNaN(Number(dailyCostLimit)) ? Number(dailyCostLimit) : null),
					lowBalanceWarning: overrideRule?.lowBalanceWarning !== undefined
						? overrideRule.lowBalanceWarning
						: (lowBalanceWarning.trim() !== "" && !isNaN(Number(lowBalanceWarning)) ? Number(lowBalanceWarning) : null),
					alertPercent: overrideRule?.alertPercent !== undefined
						? Number(overrideRule.alertPercent)
						: (Number(alertPercent) || 20),
					criticalPercent: overrideRule?.criticalPercent !== undefined
						? Number(overrideRule.criticalPercent)
						: Math.max(Number(alertPercent) || 20, Number(criticalPercent) || 60),
					stopOnExceed: overrideRule?.stopOnExceed !== undefined ? overrideRule.stopOnExceed : stopOnExceed
				};
			};

			const handleSave = async (overrideRule, immediate = false) => {
				// Debounce + latest-value compensation: every change replaces the
				// pending batch with a full rule snapshot, so the flush always sends
				// the newest values even while a previous request is still in flight.
				pendingRef.current = { activeKey, rule: buildRuleFrom(overrideRule) };
				if (debounceTimerRef.current !== null) {
					window.clearTimeout(debounceTimerRef.current);
					debounceTimerRef.current = null;
				}
				if (immediate) {
					await flushSave();
				} else {
					debounceTimerRef.current = window.setTimeout(() => {
						debounceTimerRef.current = null;
						flushSave();
					}, 250);
				}
			};

			const flushSave = async () => {
				if (savingRef.current) return;
				const batch = pendingRef.current;
				if (batch === null) return;
				pendingRef.current = null;
				savingRef.current = true;
				setSaving(true);
				setError(null);
				try {
					const currentLimits = limitsRef.current || limits || { version: 2, global: {}, keys: {} };
					const currentActiveKey = batch.activeKey;
					const newRule = batch.rule;
					let updatedPayload;
					if (currentActiveKey === "__global__") {
						updatedPayload = {
							...currentLimits,
							global: newRule
						};
					} else {
						updatedPayload = {
							...currentLimits,
							keys: {
								...(currentLimits.keys || {}),
								[currentActiveKey]: newRule
							}
						};
					}

					const response = await fetch("/api/usage-stats/limits", {
						method: "POST",
						headers: { "content-type": "application/json; charset=utf-8", "accept": "application/json" },
						body: JSON.stringify(updatedPayload)
					});
					const payload = await response.json();
					if (!response.ok || !payload.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
					// Keep the latest server configuration for future key switches and
					// saves, but do not resync the active form from the response. A
					// response arriving after the user edits a field must never clear it.
					limitsRef.current = payload.limits;
					setStatusMap(payload.status || {});
					if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("usage-stats:limits-updated"));
					if (onLimitsUpdated) onLimitsUpdated(payload);
				} catch (err) {
					setError(translate("limits.saveError", { message: err instanceof Error ? err.message : String(err) }));
				} finally {
					savingRef.current = false;
					setSaving(false);
					// Edits landed while the request was in flight: re-arm the debounce
					// so the merged pending batch goes out as the next save.
					if (pendingRef.current !== null && debounceTimerRef.current === null) {
						debounceTimerRef.current = window.setTimeout(() => {
							debounceTimerRef.current = null;
							flushSave();
						}, 250);
					}
				}
			};

			const currentStatus = activeKey === "__global__"
					? (statusMap[selectedKey] || Object.values(statusMap)[0] || { status: "normal", todayCost, dailyCostLimit: null })
					: (statusMap[activeKey] || { status: "normal", todayCost, dailyCostLimit: null });

			const isLimitActive = enabled && (Number(dailyCostLimit) > 0 || Number(lowBalanceWarning) > 0);
			// Prefer the per-key status cost from the server (per-key attribution
			// via keyProviders); fall back to the section-level today cost.
			const spentNum = Number(currentStatus?.todayCost ?? todayCost) || 0;
			const limitNum = Number(dailyCostLimit) || 0;
			const percent = limitNum > 0 ? Math.min(100, Math.round((spentNum / limitNum) * 100)) : 0;
			const currSymbol = currencySymbol(pricing?.currency);

			return react_jsx_runtime.jsxs("section", {
				className: S.limitCard,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.limitCardHead,
						children: [
							react_jsx_runtime.jsxs("span", {
								className: S.limitTitle,
								children: [
															translate("limits.title")
								]
							}),
							react_jsx_runtime.jsx("span", {
								className: S.badge,
									"data-tone": !enabled ? "empty" : limitToneOf(currentStatus?.status),
									children: !enabled ? translate("limits.status.unlimited")
										: translate(limitStatusLabelKey(currentStatus?.status))
							})
						]
					}),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("limits.desc") }),
					error && react_jsx_runtime.jsx("div", { className: S.error, children: error }),
					// Key selection — hidden when only one key is configured (the global rule IS the key rule).
					keys.length > 1 && react_jsx_runtime.jsxs("label", {
						className: S.pickerRow,
						children: [
							react_jsx_runtime.jsxs("span", {
								className: S.pickerLabel,
								children: [
															translate("limits.apiKey")
								]
							}),
							react_jsx_runtime.jsxs("select", {
								className: S.select,
								value: activeKey,
								"aria-label": translate("limits.apiKey"),
								onChange: (e) => handleKeySelect(e.target.value),
								children: [
									react_jsx_runtime.jsx("option", { value: "__global__", children: translate("limits.global") }, "__global__"),
									keys.map((k) => react_jsx_runtime.jsx("option", { value: k.id, children: k.label }, k.id))
								]
							})
						]
					}),
					// Status Banner
						enabled && isLimitActive ? react_jsx_runtime.jsxs("div", {
						className: S.statusBanner,
						style: { "--usage-progress": `${percent}%` },
							"data-status": currentStatus?.status || "normal",
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.bannerHead,
								children: [
									react_jsx_runtime.jsx("span", {
										className: S.bannerTitle,
										children: translate(limitStatusLabelKey(currentStatus?.status))
									}),
									limitNum > 0 ? react_jsx_runtime.jsx("span", {
										className: S.bannerMsg,
										children: translate("limits.progress", {
											spent: `${currSymbol}${spentNum.toFixed(2)}`,
											limit: `${currSymbol}${limitNum.toFixed(2)}`,
														percent: String(percent)
													})
													}) : null,
													]
							}),
							currentStatus?.message ? react_jsx_runtime.jsx("span", { className: S.bannerMsg, children: currentStatus.message }) : null
						]
					}) : null,
					// Primary controls share one compact row on wide settings pages.
					react_jsx_runtime.jsxs("div", {
						className: S.toggleGrid,
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsxs("div", { className: S.toggleInfo, children: [
										react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate("limits.enable") }),
										react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate("limits.enableDesc") })
									] }),
									react_jsx_runtime.jsxs("label", { className: S.switch, children: [
										react_jsx_runtime.jsx("input", {
											type: "checkbox",
											checked: enabled,
											onChange: (e) => {
												const nextVal = e.target.checked;
												setEnabled(nextVal);
												handleSave({ enabled: nextVal }, true);
											}
										}),
										react_jsx_runtime.jsx("span", { className: S.switchSlider })
									] })
								]
							}),
							enabled ? react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsxs("div", { className: S.toggleInfo, children: [
										react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate("limits.stopOnExceed") }),
										react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate("limits.stopDesc") })
									] }),
									react_jsx_runtime.jsxs("label", { className: S.switch, children: [
										react_jsx_runtime.jsx("input", {
											type: "checkbox",
											checked: stopOnExceed,
											onChange: (e) => {
												const nextVal = e.target.checked;
												setStopOnExceed(nextVal);
												handleSave({ stopOnExceed: nextVal }, true);
											}
										}),
										react_jsx_runtime.jsx("span", { className: S.switchSlider })
									] })
								]
							}) : null
						]
					}),
						// Input fields
					enabled ? react_jsx_runtime.jsxs("div", {
						className: S.limitGrid,
						children: [
							react_jsx_runtime.jsxs("div", { className: S.limitField, children: [
								react_jsx_runtime.jsx("label", { className: S.limitFieldLabel, children: translate("limits.dailyLimit") }),
								react_jsx_runtime.jsxs("div", { className: S.inputWrapper, children: [
									react_jsx_runtime.jsx("span", { className: S.inputPrefix, children: currSymbol }),
									react_jsx_runtime.jsx("input", { type: "number", inputMode: "decimal", step: "0.01", min: "0", className: `${S.input} has_prefix`, placeholder: translate("limits.dailyLimitPlaceholder"), value: dailyCostLimit, onChange: (e) => { const value = e.target.value; setDailyCostLimit(value); handleSave({ dailyCostLimit: value.trim() !== "" && !isNaN(Number(value)) ? Number(value) : null }); } })
								] })
							] }),
							react_jsx_runtime.jsxs("div", { className: S.limitField, children: [
								react_jsx_runtime.jsx("label", { className: S.limitFieldLabel, children: translate("limits.lowBalance") }),
								react_jsx_runtime.jsxs("div", { className: S.inputWrapper, children: [
									react_jsx_runtime.jsx("span", { className: S.inputPrefix, children: currSymbol }),
									react_jsx_runtime.jsx("input", { type: "number", inputMode: "decimal", step: "0.01", min: "0", className: `${S.input} has_prefix`, placeholder: translate("limits.lowBalancePlaceholder"), value: lowBalanceWarning, onChange: (e) => { const value = e.target.value; setLowBalanceWarning(value); handleSave({ lowBalanceWarning: value.trim() !== "" && !isNaN(Number(value)) ? Number(value) : null }); } })
								] })
							] }),
							Number(dailyCostLimit) > 0 ? react_jsx_runtime.jsxs("div", {
								className: S.alertCard,
								style: { "--alert-percent": `${alertPercent}%`, "--critical-percent": `${criticalPercent}%` },
								children: [
									react_jsx_runtime.jsxs("div", { className: S.alertHead, children: [
										react_jsx_runtime.jsx("span", { children: translate("limits.alertPercent") }),
											null
									] }),
									react_jsx_runtime.jsxs("div", { className: S.alertTrack, children: [
									react_jsx_runtime.jsx("input", {
										type: "range",
										min: "1",
										max: "99",
										step: "1",
										className: S.alertRange,
										value: alertPercent,
										"aria-label": translate("limits.alertPercent"),
										onChange: (e) => { const value = Math.min(Number(e.target.value), criticalPercent - 1); setAlertPercent(value); handleSave({ alertPercent: value }); }
									}),
									react_jsx_runtime.jsx("input", { type: "range", min: "2", max: "100", step: "1", className: `${S.alertRange} is-overlay`, value: criticalPercent, "aria-label": translate("limits.criticalPercent"), onChange: (e) => { const value = Math.max(Number(e.target.value), alertPercent + 1); setCriticalPercent(value); handleSave({ criticalPercent: value }); } })
								] }),
									react_jsx_runtime.jsxs("div", { className: S.alertLegend, children: [
										react_jsx_runtime.jsx("span", { children: translate("limits.alertExceeded", { percent: alertPercent }) }),
										react_jsx_runtime.jsx("span", { children: translate("limits.alertWarning", { percent: alertPercent, critical: criticalPercent }) }),
										react_jsx_runtime.jsx("span", { children: translate("limits.alertNormal", { percent: criticalPercent }) })
									] })
								]
							}) : null
						]
					}) : null,
					// All controls save immediately after changes.
				]
			});
		}

		/**
		 * The settings-section root: balance + key switcher, model-filterable
		 * stats, limits & quota configuration, per-hour chart for a selected day,
		 * recent-days list and per-model detail.
		 * @param props - `t` bound by the slot runtime.
		 */
		function UsageStatsSection({ t, onClose, onOpenSettings }) {
			const [tab, setTab] = react.useState("overview");
			const translate = (key, params) => interpolate(t !== void 0 ? t(key) : key, params);
			const [usage, setUsage] = react.useState(null);
			const [usageError, setUsageError] = react.useState(null);
			const [refreshedAt, setRefreshedAt] = react.useState(null);
			const [pricing, setPricing] = react.useState({ currency: "CNY", peakHours: [[9, 12], [14, 18]], peakMultiplier: 2 });
			const [keys, setKeys] = react.useState([]);
			const [selectedKey, setSelectedKey] = react.useState(null);
			const [account, setAccount] = react.useState(null);
			const [accountLoading, setAccountLoading] = react.useState(false);
			const [accountError, setAccountError] = react.useState(null);
			const [limitStatusMap, setLimitStatusMap] = react.useState({});
			const [serverToday, setServerToday] = react.useState(null);
			const [modelFilter, setModelFilter] = react.useState("");
			const [selectedDay, setSelectedDay] = react.useState(null);
			const [selectedYear, setSelectedYear] = react.useState(() => new Date().getFullYear());
			const mountedRef = react.useRef(true);
			const usageLoaderRef = react.useRef(null);
			const accountLoaderRef = react.useRef(null);
			if (usageLoaderRef.current === null) usageLoaderRef.current = createLoader();
			if (accountLoaderRef.current === null) accountLoaderRef.current = createLoader();

			const loadUsage = react.useCallback(() => {
				const seq = usageLoaderRef.current.start();
				setUsageError(null);
				fetchJson("/api/usage-stats/usage").then((payload) => {
					if (!mountedRef.current || !usageLoaderRef.current.isCurrent(seq)) return;
					if (payload.ok !== true) {
						setUsageError(payload.message ?? "usage aggregation failed");
						return;
					}
					setUsage(payload);
					setPricing(pricingOf(payload));
					setServerToday(payload.today ?? null);
					setRefreshedAt(Date.now());
				}).catch((error) => {
					if (!mountedRef.current || !usageLoaderRef.current.isCurrent(seq)) return;
					setUsageError(error instanceof Error ? error.message : String(error));
				});
			}, []);

			const loadLimitStatuses = react.useCallback(() => {
				fetchJson("/api/usage-stats/limits").then((payload) => {
					if (!mountedRef.current || payload.ok !== true) return;
					setLimitStatusMap(payload.status || {});
				}).catch(() => {});
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

			const loadAccount = react.useCallback((keyId, force = false) => {
				const seq = accountLoaderRef.current.start();
				setAccountLoading(true);
				setAccountError(null);
				if (keyId === null) {
					setAccountLoading(false);
					return;
				}
				const query = `?key=${encodeURIComponent(keyId)}${force ? "&refresh=1" : ""}`;
				fetchJson(`/api/usage-stats/balance${query}`).then((payload) => {
					if (!mountedRef.current || !accountLoaderRef.current.isCurrent(seq)) return;
					if (payload.ok !== true) {
						setAccountError(payload.message ?? "balance fetch failed");
						return;
					}
					setAccount(payload.account);
				}).catch((error) => {
					if (!mountedRef.current || !accountLoaderRef.current.isCurrent(seq)) return;
					setAccountError(error instanceof Error ? error.message : String(error));
				}).finally(() => {
					if (mountedRef.current && accountLoaderRef.current.isCurrent(seq)) setAccountLoading(false);
				});
			}, []);

			react.useEffect(() => {
				mountedRef.current = true;
				return () => {
					mountedRef.current = false;
				};
			}, []);

			// Initial load + periodic refresh while the settings section is open.
			react.useEffect(() => {
				loadUsage();
				loadKeys();
				loadLimitStatuses();
				const usageTimer = window.setInterval(loadUsage, 60000);
				const limitsTimer = window.setInterval(loadLimitStatuses, 60000);
				const keysTimer = window.setInterval(loadKeys, 300000);
				return () => {
					window.clearInterval(usageTimer);
					window.clearInterval(limitsTimer);
					window.clearInterval(keysTimer);
				};
			}, [loadUsage, loadKeys, loadLimitStatuses]);

			// Balance follows the selected key; re-read the server cache every five minutes
			react.useEffect(() => {
				if (selectedKey === null) return;
				loadAccount(selectedKey);
				const cacheTimer = window.setInterval(() => loadAccount(selectedKey), 300000);
				return () => {
					window.clearInterval(cacheTimer);
				};
			}, [selectedKey, loadAccount]);

			const dayMap = react.useMemo(() => {
				const map = new Map();
				if (usage !== null && Array.isArray(usage.days)) {
					for (const day of usage.days) map.set(day.date, day);
				}
				return map;
			}, [usage]);

			const yearOptions = react.useMemo(() => {
				const current = new Date().getFullYear();
				const years = new Set(Array.from({ length: 6 }, (_, index) => current - index));
				for (const key of dayMap.keys()) {
					const year = Number(key.slice(0, 4));
					if (Number.isInteger(year) && year <= current) years.add(year);
				}
				return [...years].sort((left, right) => right - left);
			}, [dayMap]);
			const heat = react.useMemo(() => buildYearContributionHeatmap(dayMap, selectedYear), [dayMap, selectedYear]);

			react.useEffect(() => {
				if (selectedDay !== null && !dayMap.has(selectedDay)) setSelectedDay(null);
			}, [dayMap, selectedDay]);

			const days = react.useMemo(() => (usage !== null && Array.isArray(usage.days) ? usage.days : []), [usage]);
			const models = react.useMemo(() => modelChoicesOf(days), [days]);
			const recent = react.useMemo(() => recentDays(days, serverToday).map((day) => filterDay(day, modelFilter)), [days, serverToday, modelFilter]);
			const activeDayKey = selectedDay ?? serverToday ?? todayKey();
			const activeDay = react.useMemo(() => filterDay(dayMap.get(activeDayKey) ?? null, modelFilter), [dayMap, activeDayKey, modelFilter]);
			const stats = react.useMemo(() => summarize(days, modelFilter, serverToday), [days, modelFilter, serverToday]);
			const activeLimitStatus = selectedKey === null
				? (Object.values(limitStatusMap)[0] || null)
				: (limitStatusMap[selectedKey] || null);
			const todaySpendTone = limitToneOf(activeLimitStatus?.spendStatus);
			const todayLimitNum = Number(activeLimitStatus?.dailyCostLimit) || 0;
			const todaySpentNum = Number(activeLimitStatus?.todayCost ?? stats.todayCost) || 0;
			const todayLimitPercent = todayLimitNum > 0 ? Math.min(100, Math.round(todaySpentNum / todayLimitNum * 100)) : 0;

			const retry = () => {
				loadUsage();
				loadKeys();
				loadLimitStatuses();
				if (selectedKey !== null) loadAccount(selectedKey, true);
			};

			const money = react.useCallback((value) => value === null || value === void 0 ? "—" : `${currencySymbol(pricing.currency)}${fmtMoney(value)}`, [pricing.currency]);

			const updatedLabel = refreshedAt === null ? "" : translate("panel.updatedAt", {
				time: new Date(refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
			});

			return react_jsx_runtime.jsxs("div", {
				className: S.section,
				"data-usage-stats-section": true,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.header,
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.headerLeft,
								children: [
																react_jsx_runtime.jsx("span", { className: S.title, children: translate("panel.title") })
								]
							}),
							react_jsx_runtime.jsxs("div", {
							className: S.headerActions,
							children: [
								typeof onOpenSettings === "function" && react_jsx_runtime.jsx("button", {
									type: "button",
									className: S.settingsLink,
									"data-usage-stats-settings-link": true,
									"aria-label": translate("panel.gotoSettings"),
									onClick: onOpenSettings,
									children: translate("panel.gotoSettings")
								}),
									react_jsx_runtime.jsx(primitives.Tooltip, {
										label: translate("action.refresh"),
										side: "bottom",
										delayMs: 500,
										children: react_jsx_runtime.jsx("button", {
										type: "button",
										className: S.iconButton,
										"aria-label": translate("action.refresh"),
										"data-loading": accountLoading,
										onClick: retry,
											children: react_jsx_runtime.jsx(primitives.IconRefreshOutline14, { size: 14 })
										})
									}),
								updatedLabel !== "" && react_jsx_runtime.jsx("span", { className: S.updated, children: updatedLabel }),
								typeof onClose === "function" && react_jsx_runtime.jsx(primitives.Tooltip, {
									label: translate("action.close"),
									side: "bottom",
									delayMs: 500,
									children: react_jsx_runtime.jsx("button", {
										type: "button",
										className: S.iconButton,
										"aria-label": translate("action.close"),
										onClick: onClose,
										children: react_jsx_runtime.jsx(primitives.IconCloseOutline16, { size: 14 })
									})
								})
							]
							})
						]
					}),
					usageError !== null ? react_jsx_runtime.jsxs("div", {
						className: S.error,
						children: [
							react_jsx_runtime.jsx("span", { children: translate("usage.error", { message: usageError }) }),
							react_jsx_runtime.jsx("button", { type: "button", className: S.retry, onClick: loadUsage, children: translate("action.retry") })
						]
					}) : null,
					react_jsx_runtime.jsxs("div", {
						className: S.tabs,
						role: "tablist",
						"aria-label": translate("panel.tabs"),
						children: [
							react_jsx_runtime.jsx("button", {
								type: "button",
								role: "tab",
								className: S.tab,
								"data-active": tab === "overview" ? "true" : void 0,
								"aria-selected": tab === "overview",
								"data-usage-stats-tab": "overview",
								onClick: () => setTab("overview"),
								children: translate("panel.tabOverview")
							}),
							react_jsx_runtime.jsx("button", {
								type: "button",
								role: "tab",
								className: S.tab,
								"data-active": tab === "details" ? "true" : void 0,
								"aria-selected": tab === "details",
								"data-usage-stats-tab": "details",
								onClick: () => setTab("details"),
								children: translate("panel.tabDetails")
							})
						]
					}),
					tab === "overview" && react_jsx_runtime.jsx(BalanceCard, {
						keys,
						selectedKey,
						onSelectKey: setSelectedKey,
						account,
						accountLoading,
						accountError,
						balanceTone: limitToneOf(activeLimitStatus?.balanceAlertStatus),
						translate,
						onRefresh: () => {
							if (selectedKey !== null) loadAccount(selectedKey, true);
						}
					}),
				tab === "details" && models.length > 0 && react_jsx_runtime.jsxs("label", {
						className: S.pickerRow,
						children: [
							react_jsx_runtime.jsx("span", { className: S.pickerLabel, children: translate("usage.model") }),
							react_jsx_runtime.jsx("select", {
								className: S.select,
								value: modelFilter,
								"aria-label": translate("usage.model"),
								onChange: (event) => setModelFilter(event.target.value),
								children: [
									react_jsx_runtime.jsx("option", { value: "", children: translate("usage.allModels") }),
									models.map((model) => react_jsx_runtime.jsx("option", { value: model, children: model }, model))
								]
							})
						]
					}),
					usage === null ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.loading") }) : tab === "overview" ? react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
						children: [
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
									react_jsx_runtime.jsx("div", { className: S.stat, children: [react_jsx_runtime.jsx("span", { className: S.statValue, children: fmt(stats.todayTokens) }), react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.today") })] }),
									react_jsx_runtime.jsx("div", { className: S.stat, children: [react_jsx_runtime.jsx("span", { className: S.statValue, children: fmt(stats.monthTokens) }), react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.month") })] }),
									react_jsx_runtime.jsx("div", { className: S.stat, children: [react_jsx_runtime.jsx("span", { className: S.statValue, children: fmt(stats.totalTokens) }), react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.total") })] }),
								react_jsx_runtime.jsx("div", { className: S.stat, children: [
									react_jsx_runtime.jsxs("span", { className: `${S.statValue} ${S.statMoney} ${S.valueWithIndicator}`, children: [
										todaySpendTone !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot, "data-tone": todaySpendTone, "data-usage-cost-indicator": true, "aria-label": `today ${todaySpendTone}` }) : null,
										money(stats.todayCost)
									] }),
									react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.costToday") })
								] })
								]
							}),
							react_jsx_runtime.jsxs("section", {
								className: S.card,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.heatHeader,
										children: [
											react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("usage.heatmap", { year: selectedYear }) }),
											react_jsx_runtime.jsx("select", {
												className: S.yearSelect,
												"aria-label": translate("usage.year"),
												value: selectedYear,
												onChange: (event) => {
													setSelectedYear(Number(event.target.value));
													setSelectedDay(null);
												},
												children: yearOptions.map((year) => react_jsx_runtime.jsx("option", { value: year, children: year }, year))
											})
										]
									}),
									react_jsx_runtime.jsx(ContributionHeatmap, { heat, translate, selectedKey: selectedDay, onSelect: setSelectedDay, today: serverToday })
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
												className: S.dayNav,
												children: [
													react_jsx_runtime.jsx("button", {
														type: "button",
														className: S.navButton,
														"aria-label": translate("action.prevDay"),
														disabled: recent.length === 0 || activeDayKey >= recent[0].date,
														onClick: () => {
															const index = recent.findIndex((day) => day.date === activeDayKey);
															if (index < recent.length - 1) setSelectedDay(recent[index + 1].date);
														},
															children: react_jsx_runtime.jsx(primitives.IconChevronLeftOutline14, { size: 12 })
														}),
													react_jsx_runtime.jsx("span", { className: S.dayTitle, children: dayLabel(activeDayKey, translate) }),
													react_jsx_runtime.jsx("button", {
														type: "button",
														className: S.navButton,
														"aria-label": translate("action.nextDay"),
														disabled: activeDayKey <= recent[recent.length - 1]?.date,
														onClick: () => {
															const index = recent.findIndex((day) => day.date === activeDayKey);
															if (index > 0) setSelectedDay(recent[index - 1].date);
														},
														children: react_jsx_runtime.jsx(primitives.IconChevronRightOutline14, { size: 12 })
													}),
													selectedDay !== null && react_jsx_runtime.jsx("button", {
														type: "button",
														className: S.todayButton,
														onClick: () => setSelectedDay(null),
																children: translate("action.today")
															}),
												]
											})
										]
									}),
									activeDay === null ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("chart.empty") }) : react_jsx_runtime.jsx(HourlyChart, {
										day: activeDay,
										peakHours: pricing.peakHours,
										money,
										translate
									}),
									activeDay !== null && react_jsx_runtime.jsx(DayDetail, { day: activeDay, money, translate })
								]
							}),
						]
					}) : react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
						children: [
							react_jsx_runtime.jsxs("section", {
								className: S.card,
								children: [
									react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("usage.recent") }),
									react_jsx_runtime.jsx(DayList, {
										days: recent,
										selectedDay: activeDayKey,
										onSelect: (date) => setSelectedDay(date === (serverToday ?? todayKey()) ? null : date),
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
		 * behavior — starting with the quota/limit card migrated out of the query
		 * panel. The query panel stays read-only; every write-affecting control
		 * lives here (账户/价格/通知/数据管理 tabs arrive in later phases).
		 * @param props - t bound by the slot runtime (locale seat).
		 */
		function UsageBillingSettingsSection({ t }) {
			const translate = (key, params) => interpolate(t !== void 0 ? t(key) : key, params);
			const [keys, setKeys] = react.useState([]);
			const [selectedKey, setSelectedKey] = react.useState(null);
			const [pricing, setPricing] = react.useState({ currency: "CNY", peakHours: [[9, 12], [14, 18]], peakMultiplier: 2 });
			const [todayCost, setTodayCost] = react.useState(0);
			const [serverToday, setServerToday] = react.useState(null);
			const [loaded, setLoaded] = react.useState(false);
			const [error, setError] = react.useState(null);
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

			react.useEffect(() => {
				mountedRef.current = true;
				loadUsage();
				loadKeys();
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
					loaded === false ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.loading") }) : react_jsx_runtime.jsx(LimitsCard, {
						keys,
						selectedKey,
						onSelectKey: setSelectedKey,
						pricing,
						todayCost,
						translate,
						onLimitsUpdated: () => loadUsage()
					})
				]
			});
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
			const layerRef = react.useRef(null);
			const summaryRequestRef = react.useRef(0);
			const loadSummary = react.useCallback(() => {
				const request = ++summaryRequestRef.current;
				Promise.allSettled([
					fetchJson("/api/usage-stats/usage"),
					fetchJson("/api/usage-stats/balance"),
					fetchJson("/api/usage-stats/limits")
				]).then(([usageResult, balanceResult, limitsResult]) => {
					if (summaryRequestRef.current !== request) return;
					setSummary(sidebarSummaryOf(
						usageResult.status === "fulfilled" ? usageResult.value : null,
						balanceResult.status === "fulfilled" ? balanceResult.value : null,
						limitsResult.status === "fulfilled" ? limitsResult.value : null
					));
				});
			}, []);
			const summaryText = interpolate(t("panel.summary"), summary);

			react.useEffect(() => {
				loadSummary();
				// Open panel: refresh every 60s; closed: back off to every 5min so an
				// idle sidebar never hammers the loopback endpoints.
				const pollMs = open ? SIDEBAR_POLL_MS_OPEN : SIDEBAR_POLL_MS_CLOSED;
				const timer = window.setInterval(loadSummary, pollMs);
				const onLimitsUpdated = () => loadSummary();
				window.addEventListener("usage-stats:limits-updated", onLimitsUpdated);
				return () => {
					window.clearInterval(timer);
					window.removeEventListener("usage-stats:limits-updated", onLimitsUpdated);
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
										summary.balanceStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot, "data-tone": summary.balanceStatus }) : null,
										summary.todayStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot, "data-tone": summary.todayStatus }) : null,
										summaryText
									]
								})
									]
								})
							]
						})
					})
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
			"usage.costToday": "今日消费(估算)",
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
			"chart.empty": "这一天没有用量数据。",
			"chart.inputWithCache": "输入（含缓存）",
			"chart.peakNote": "高峰：北京时间 09-12 / 14-18，费用×2",
			"limits.title": "用量提醒与限额设置",
			"limits.desc": "按指定 API Key 或全局设置每日消费限额与预警比例；硬停止默认关闭，仅在主动开启后阻止新调用。",
			"limits.apiKey": "目标 API Key",
			"limits.global": "全局默认 (全部 Key)",
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
			"limits.status.unlimited": "未限制",
			"limits.progress": "今日已消费 {spent} / 限额 {limit} ({percent}%)",
			"limits.save": "保存设置",
			"limits.saving": "保存中…",
			"limits.saveError": "保存失败：{message}",
			"settings.nav": "用量与计费",
			"settings.title": "用量与计费",
			"settings.desc": "这里承载会改变计费或调用行为的配置。查询与配置已分离：余额、用量与图表请在侧栏「用量/余额」查询中心查看。",
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
			"usage.costToday": "Spend today (est.)",
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
			"chart.empty": "No usage data for this day.",
			"chart.inputWithCache": "Input (incl. cache)",
			"chart.peakNote": "Peak: Beijing 09-12 / 14-18, ×2 price",
			"limits.title": "Usage Alerts & Quota Limits",
			"limits.desc": "Configure daily spend limits and alert thresholds per API key or globally. Hard stop is off by default and only blocks new calls after you opt in.",
			"limits.apiKey": "Target API Key",
			"limits.global": "Global Default (All Keys)",
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
			"limits.status.unlimited": "No Limit",
			"limits.progress": "Spent today {spent} / Limit {limit} ({percent}%)",
			"limits.save": "Save Settings",
			"limits.saving": "Saving…",
			"limits.saveError": "Save failed: {message}",
			"settings.nav": "Usage & Billing",
			"settings.title": "Usage & Billing",
			"settings.desc": "Configuration that changes billing or call behavior lives here. Querying is separate: open the sidebar Usage/Balance panel for balances, usage and charts.",
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
		exports.ContributionHeatmap = ContributionHeatmap;
		exports.HourlyChart = HourlyChart;
		exports.DayList = DayList;
		exports.DayDetail = DayDetail;
		exports.filterDay = filterDay;
		exports.summarize = summarize;
		exports.modelChoicesOf = modelChoicesOf;
		exports.recentDays = recentDays;
		exports.modelIdOf = modelIdOf;
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
