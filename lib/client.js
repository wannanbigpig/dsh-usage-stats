/**
 * dsh-usage-stats — browser half.
 *
 * Hand-written `__ModuleLoader__` bundle (no build step): registers a native
 * sidebar footer action that opens a floating Usage & Balance panel. The
 * panel keeps the selected provider balance/plan, local provider-reported usage, calendar
 * heatmap, hourly/model drill-down and limit controls in one place.
 */
window.__ModuleLoader__.load({
	id: "@wannanbigpig/dsh-usage-stats",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const XIAOMI_MIMO_LOGO_DATA_URL = "data:image/jpeg;base64,/9j/2wCEAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDIBCQkJDAsMGA0NGDIhHCEyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMv/AABEIAMgAyAMBIgACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APn+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKK2/CkGgXXiC3tvEst3Bp0x2NPauqtEx6MdytlfX8+2CAYlFd18S/h3N4F1aNraSS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";

		// OpenCode mark from Javis603/token-monitor (.github/assets/tools-icon/opencode.png, MIT).
		const OPENCODE_LOGO_DATA_URL = "data:image/png;base64,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MFlAAJwMbHoCBAgQIECAQJqAAJjWEfUQIECAAAECBCYLCICTgU1PgAABAgQIEEgTEADTOqIeAgQIECBAgMBkAQFwMrDpCRAgQIAAAQJpAm/SClIPAQLnC/z9738/fPvtt4cPHz6c/2GfIDAocHd3d3j37t3hpz/96eAnDCNAIFVAAEztjLoInCHwpz/96fD1118fvv/++zM+ZSiB8wQ++uijw1dffXX4zW9+c94HjSZAIE5AAIxriYIInC/wl7/85fDHP/7x8I9//OP8D/sEgUGBTz755PDb3/52cLRhBAgkC/gdwOTuqI0AAQIECBAgMEFAAJyAakoCBAgQIECAQLKAAJjcHbURIECAAAECBCYICIATUE1JgAABAgQIEEgWEACTu6M2AgQIECBAgMAEAQFwAqopCRAgQIAAAQLJAgJgcnfURoAAAQIECBCYICAATkA1JQECBAgQIEAgWUAATO6O2ggQIECAAAECEwQEwAmopiRAgAABAgQIJAsIgMndURsBAgQIECBAYIKAADgB1ZQECBAgQIAAgWQBATC5O2ojQIAAAQIECEwQEAAnoJqSAAECBAgQIJAsIAAmd0dtBAgQIECAAIEJAgLgBFRTEiBAgAABAgSSBQTA5O6ojQABAgQIECAwQUAAnIBqSgIECBAgQIBAsoAAmNwdtREgQIAAAQIEJggIgBNQTUmAAAECBAgQSBYQAJO7ozYCBAgQIECAwAQBAXACqikJECBAgAABAskCAmByd9RGgAABAgQIEJggIABOQDUlAQIECBAgQCBZQABM7o7aCBAgQIAAAQITBATACaimJECAAAECBAgkCwiAyd1RGwECBAgQIEBggoAAOAHVlAQIECBAgACBZAEBMLk7aiNAgAABAgQITBAQACegmpIAAQIECBAgkCwgACZ3R20ECBAgQIAAgQkCAuAEVFMSIECAAAECBJIFBMDk7qiNAAECBAgQIDBBQACcgGpKAgQIECBAgECygACY3B21ESBAgAABAgQmCAiAE1BNSYAAAQIECBBIFhAAk7ujNgIECBAgQIDABAEBcAKqKQkQIECAAAECyQICYHJ31EaAAAECBAgQmCAgAE5ANSUBAgQIECBAIFlAAEzujtoIECBAgAABAhMEBMAJqKYkQIAAAQIECCQLCIDJ3VEbAQIECBAgQGCCgAA4AdWUBAgQIECAAIFk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AGb0QRUECBAgQIAAgTIBAbCM2kIECBAgQIAAgQwBATCjD6ogQIAAAQIECJQJCIBl1BYiQIAAAQIECGQICIAZfVAFAQIECBAgQKBMQAAso7YQAQIECBAgQCBDQADM6IMqCBAgQIAAAQJlAgJgGbWFCBAgQIAAAQIZAgJgRh9UQYAAAQIECBAoExAAy6gtRIAAAQIECBDIEBAAM/qgCgIECBAgQIBAmcCbspUsRIDANIF3794d/vvXvz7861//mraGiQm8efPmsFxrXgQIbF9AANx+D+2AwOG/fvWrw//8/veHw4cPNAjME7i7O3z22Wfz5jczAQJlAgJgGbWFCMwT+Pjjjw/L/7wIECBAgMCIgN8BHFEyhgABAgQIECDQSEAAbNRMWyFAgAABAgQIjAgIgCNKxhAgQIAAAQIEGgkIgI2aaSsECBAgQIAAgREBAXBEyRgCBAgQIECAQCMBAbBRM22FAAECBAgQIDAiIACOKBlDgAABAgQIEGgkIAA2aqatECBAgAABAgRGBATAESVjCBAgQIAAAQKNBATARs20FQIECBAgQIDAiIAAOKJkDAECBAgQIECgkYAA2KiZtkKAAAECBAgQGBEQAEeUjCFAgAABAgQINBIQABs101YIECBAgAABAiMCAuCIkjEECBAgQIAAgUYCAmCjZtoKAQIECBAgQGBEQAAcUTKGAAECBAgQINBIQABs1ExbIUCAAAECBAiMCAiAI0rGECBAgAABAgQaCQiAjZppKwQIECBAgACBEQEBcETJGAIECBAgQIBAIwEBsFEzbYUAAQIECBAgMCIgAI4oGUOAAAECBAgQaCQgADZqpq0QIECAAAECBEYEBMARJWMIECBAgAABAo0EBMBGzbQVAgQIECBAgMCIgAA4omQMAQIECBAgQKCRgADYqJm2QoAAAQIECBAYERAAR5SMIUCAAAECBAg0EhAAGzXTVggQIECAAAECIwIC4IiSMQQIECBAgACBRgICYKNm2goBAgQIECBAYERAABxRMoYAAQIECBAg0EhAAGzUTFshQIAAAQIECIwICIAjSsYQIECAAAECBBoJCICNmmkrBAgQIECAAIERAQFwRMkYAgQIECBAgEAjAQGwUTNthQABAgQIECAwIiAAjigZQ4AAAQIECBBoJCAANmqmrRAgQIAAAQIERgQEwBElYwgQIECAAAECjQQEwEbNtBUCBAgQIECAwIiAADiiZAwBAgQIECBAoJGAANiombZCgAABAgQIEBgREABHlIwhQIAAAQIECDQSEAAbNdNWCBAgQIAAAQIjAgLgiJIxBAgQIECAAIFGAgJgo2baCgECBAgQIEBgREAAHFEyhgABAgQIECDQSEAAbNRMWyFAgAABAgQIjAgIgCNKxhAgQIAAAQIEGgkIgI2aaSsECBAgQIAAgREBAXBEyRgCBAgQIECAQCMBAbBRM22FAAECBAgQIDAiIACOKBlDgAABAgQIEGgkIAA2aqatECBAgAABAgRGBATAESVjCBAgQIAAAQKNBATARs20FQIECBAgQIDAiIAAOKJkDAECBAgQIECgkYAA2KiZtkKAAAECBAgQGBEQAEeUjCFAgAABAgQINBIQABs101YIECBAgAABAiMCAuCIkjEECBAgQIAAgUYCAmCjZtoKAQIECBAgQGBEQAAcUTKGAAECBAgQINBIQABs1ExbIUCAAAECBAiMCAiAI0rGECBAgAABAgQaCQiAjZppKwQIECBAgACBEQEBcETJGAIECBAgQIBAIwEBsFEzbYUAAQIECBAgMCIgAI4oGUOAAAECBAgQaCQgADZqpq0QIECAAAECBEYEBMARJWMIECBAgAABAo0EBMBGzbQVAgQIECBAgMCIwJuRQcYQqBT429/+dvjzn/9cuaS1CBAgME1g+f80LwJpAndv3779kFaUegh8+eWXEAgQINBC4JtvvmmxD5voJSAA9uqn3RAgQIAAAQIETgr4HcCTRAYQIECAAAECBHoJCIC9+mk3BAgQIECAAIGTAgLgSSIDCBAgQIAAAQK9BATAXv20GwIECBAgQIDASQEB8CSRAQQIECBAgACBXgICYK9+2g0BAgQIECBA4KSAAHiSyAACBAgQIECAQC8BAbBXP+2GAAECBAgQIHBSQAA8SWQAAQIECBAgQKCXgADYq592Q4AAAQIECBA4KSAAniQygAABAgQIECDQS0AA7NVPuyFAgAABAgQInBQQAE8SGUCAAAECBAgQ6CUgAPbqp90QIECAAAECBE4KCIAniQwgQIAAAQIECPQSEAB79dNuCBAgQIAAAQInBQTAk0QGECBAgAABAgR6CQiAvfppNwQIECBAgACBkwIC4EkiAwgQIECAAAECvQQEwF79tBsCBAgQIECAwIsC33333c9+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";

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
			".usg_planWindowItem{display:inline-flex;align-items:center;white-space:nowrap}",
			".usg_planWindowDotSlot{width:12px;display:inline-flex;align-items:center;justify-content:flex-start;flex:none}",
			".usg_planWindowSeparator{display:inline-block;margin-inline:6px}",
			".usg_layer.usg_rail{width:36px;height:36px;margin:0}",
			".usg_layer.usg_rail .usg_sidebarButton{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}",
			".usg_panel{z-index:100;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);width:920px;max-width:calc(100vw - 48px);max-height:94vh;box-shadow:var(--dsw-shadow-lv3);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);--usg-blue:var(--dsw-alias-state-business-primary,var(--dsw-static-deepseek-500,#4176e6));--usg-green:var(--dsw-alias-state-success-primary,#23a878);--usg-cellEmpty:var(--dsw-alias-bg-module-platform,rgba(128,128,128,.12));border-radius:24px;position:fixed;bottom:24px;left:12px;overflow:hidden}",
			".usg_panelBody{box-sizing:border-box;max-height:94vh;padding:18px;overflow-y:auto}",
			".usg_panel .usg_section{max-width:none}",
			".usg_section{--usg-blue:var(--dsw-alias-state-business-primary,var(--dsw-static-deepseek-500,#4176e6));--usg-action:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#0f1115));--usg-action-text:var(--dsw-alias-label-primary-foreground,#fff);--usg-control-bg:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff));--usg-control-text:var(--dsw-alias-label-primary,#171717);--usg-control-border:var(--dsw-alias-border-l2,rgba(128,128,128,.24));--usg-control-placeholder:var(--dsw-alias-label-dimmed,rgba(128,128,128,.48));--usg-success:var(--dsw-alias-state-success-primary,#22a06b);--usg-warning:var(--dsw-alias-state-warn-primary,#d99b00);--usg-danger:var(--dsw-alias-state-error-primary,#e5484d);box-sizing:border-box;flex-direction:column;gap:14px;width:100%;max-width:920px;display:flex}",
			".usg_section[data-usage-billing-settings]{gap:12px;max-width:760px}",
			".usg_section[data-usage-billing-settings] .usg_title{margin:0;font-size:18px;font-weight:600;line-height:25px}",
			".usg_section[data-usage-billing-settings] .usg_note{margin:0;font-size:13px;line-height:20px}",
			".usg_header{position:sticky;top:-18px;z-index:11;justify-content:space-between;align-items:center;gap:12px;padding:0;background:var(--dsw-alias-bg-layer-2);display:grid;grid-template-columns:minmax(190px,1fr) auto auto}",
			".usg_headerLeft{min-width:0;display:flex}",
			".usg_headerText{min-width:0;display:flex;flex-direction:column}",
			".usg_title{color:var(--dsw-alias-label-primary);font-size:16px;font-weight:500;line-height:24px}",
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
			".usg_toast{position:fixed;top:120px;left:50%;z-index:1100;pointer-events:none;display:flex;align-items:center;gap:10px;max-width:min(560px,calc(100vw - 48px));padding:12px 16px;border-radius:14px;background:var(--dsw-alias-button-contrast-fill);color:var(--dsw-alias-label-primary-inverted);font-size:14px;line-height:22px;box-shadow:var(--dsw-shadow-lv3);transform:translateX(-50%);animation:usg_toast_in 160ms ease-out,usg_toast_fade 1000ms ease 4000ms forwards}",
			".usg_toastIcon{display:grid;place-items:center;flex:none;color:var(--dsw-alias-state-warn-label)}",
			".usg_toastText{min-width:0}",
			"@keyframes usg_toast_in{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translate(-50%,0)}}",
			"@keyframes usg_toast_fade{to{opacity:0}}",
			"@media(prefers-reduced-motion:reduce){.usg_toast{animation:usg_toast_fade 1000ms ease 4000ms forwards}}",
			".usg_updated{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			".usg_animatedNumber{display:inline-block;font-variant-numeric:tabular-nums}",
			// Balance card — the 消费金额 icon seat.
			".usg_balance{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:20px;padding:16px;flex-direction:column;gap:12px;display:flex}",
			".usg_balanceHead{align-items:center;gap:10px;display:flex}",
			".usg_balanceIcon{width:36px;height:36px;color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--dsw-alias-brand-primary,#0f1115);border-radius:10px;justify-content:center;align-items:center;font-size:14px;font-weight:700;display:flex;flex:none}",
			".usg_balanceIcon[data-provider-id=deepseek-official],.usg_balanceIcon[data-provider-id=zai-coding-cn]{color:#fff;background:#111}",
			".usg_balanceIcon[data-provider-id=moonshotai],.usg_balanceIcon[data-provider-id=moonshotai-cn]{color:#fff;background:#111}",
			".usg_balanceIcon[data-provider-id=xiaomi-token-plan-cn]{color:#fff;background:#000;overflow:hidden}",
			".usg_providerLogoImage{display:block;width:100%;height:100%;object-fit:cover}",
			".usg_balanceIdentity{min-width:0;flex:1;display:flex;flex-direction:column}",
			".usg_balanceLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
			".usg_localProviderName{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:18px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}",
			".usg_localUsageNote{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}",
			".usg_balanceMain{align-items:baseline;gap:8px;display:flex}",
			".usg_balanceAmount{color:var(--dsw-alias-label-primary);font-size:26px;font-weight:500;line-height:34px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}",
			".usg_planName{align-self:center;max-width:100%;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform);border-radius:7px;padding:2px 9px;font-size:14px;font-weight:600;line-height:20px;text-transform:capitalize;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}",
			".usg_balanceCurrency{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-weight:500}",
			".usg_badge{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px;white-space:nowrap;flex:none}",
			".usg_badge[data-tone=ok]{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent)}",
			".usg_badge[data-tone=warn]{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent)}",
			".usg_badge[data-tone=bad]{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}",
			".usg_balanceStatus{align-self:stretch;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);border-radius:8px;padding:7px 9px;font-size:11px;line-height:16px}",
			".usg_balanceStatus[data-tone=bad]{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent)}",
			".usg_balanceRows{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:2px;font-size:12px;line-height:18px;display:flex}",
			".usg_balanceRow{justify-content:space-between;gap:8px;display:flex}",
			".usg_balanceRow b{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}",
			".usg_planQuotaWindow{display:flex;flex-direction:column;gap:4px}",
			".usg_planQuotaWindowReset{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;text-align:right;padding-right:8px;font-variant-numeric:tabular-nums}",
			".usg_pickerRow{align-items:center;gap:8px;display:flex;flex-wrap:wrap}",
			".usg_pickerLabel{color:var(--dsw-alias-label-tertiary);align-items:center;gap:5px;font-size:12px;line-height:18px;display:inline-flex;flex:none}",
			".usg_select{box-sizing:border-box;min-width:0;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 12px;font:inherit;font-size:13px;line-height:20px;cursor:pointer}",
			".usg_statsRow{display:flex;gap:8px;flex-wrap:wrap}",
			".usg_stat{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:12px;flex:1;min-width:110px;flex-direction:column;gap:2px;padding:10px 11px;display:flex}",
			".usg_statValue{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:22px;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".usg_statValue.usg_statMoney{color:var(--usg-blue)}",
			".usg_valueWithIndicator{display:inline-flex;align-items:center;gap:6px}",
			".usg_statLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
			".usg_card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:16px;padding:14px 16px;flex-direction:column;gap:12px;display:flex}",
			".usg_cardHead{justify-content:space-between;align-items:center;gap:8px;display:flex}",
			".usg_cardTitle{color:var(--dsw-alias-label-primary);align-items:center;gap:6px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}",
			".usg_overviewWorkbench{display:grid;grid-template-columns:minmax(0,1fr) 264px;grid-template-areas:\"activity rail\" \"heat heat\";gap:14px;align-items:start}",
			".usg_activityStage{grid-area:activity;min-width:0;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:16px}",
			".usg_activityLead{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:2px 2px 0}",
			".usg_activityMetric{min-width:0;display:flex;flex-direction:column;gap:2px}",
			".usg_activityKicker{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}",
			".usg_activityReading{display:flex;align-items:baseline;gap:7px;min-width:0}",
			".usg_activityValue{color:var(--dsw-alias-label-primary);font-size:36px;font-weight:500;line-height:42px;letter-spacing:-.035em;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".usg_activityUnit{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px}",
			".usg_activityMeta{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);border-radius:999px;padding:4px 10px;font-size:11px;line-height:18px;white-space:nowrap;font-variant-numeric:tabular-nums}",
			".usg_hourCard{border:0;background:transparent;border-radius:0;padding:0;min-width:0}",
			".usg_hourCard .usg_chartBody{height:176px}",
			".usg_insightRail{grid-area:rail;min-width:0;display:flex;flex-direction:column;gap:10px}",
			".usg_insightRail .usg_statsRow{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
			".usg_insightRail .usg_stat{min-width:0}",
			".usg_insightRail .usg_stat:last-child:nth-child(odd){grid-column:1/-1}",
			".usg_insightRail .usg_statValue{font-size:14px;line-height:20px;overflow:hidden;text-overflow:ellipsis}",
			".usg_overviewWorkbench[data-usage-summary=true] .usg_insightRail{align-self:start;min-height:0}",
			".usg_providerUsageCard{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:16px;padding:13px;display:flex;flex-direction:column;gap:10px}",
			".usg_overviewWorkbench[data-usage-summary=true] .usg_providerUsageCard{min-height:0}",
			".usg_providerUsageList{display:flex;flex-direction:column;gap:7px}",
			".usg_providerUsageRow{min-width:0;border-radius:11px;background:var(--dsw-alias-bg-module-platform);padding:9px;display:grid;grid-template-columns:30px minmax(0,1fr) auto;grid-template-areas:\"logo identity value\" \"request request request\" \"track track track\";column-gap:9px;row-gap:6px;align-items:center}",
			".usg_providerUsageRow[data-usage-provider-placeholder=true]{visibility:hidden;pointer-events:none}",
			".usg_providerUsageLogo{grid-area:logo;width:30px;height:30px;border-radius:9px;color:#fff;background:#111318;display:flex;align-items:center;justify-content:center;overflow:hidden}",
			".usg_providerUsageLogo svg{max-width:22px;max-height:22px}",
			".usg_providerUsageIdentity{grid-area:identity;min-width:0;display:flex;flex-direction:column;gap:1px}",
			".usg_providerUsageName{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:500;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}",
			".usg_modelNameCopyTip{position:fixed;z-index:1200;width:max-content;max-width:min(260px,calc(100vw - 24px));transform:translate(-50%,-100%);color:var(--dsw-alias-label-primary-inverted,#fff);background:var(--dsw-alias-button-contrast-fill,#1f2329);border:0;border-radius:8px;padding:6px 9px;box-shadow:var(--dsw-shadow-lv2);font-size:11px;font-weight:400;line-height:16px;white-space:normal;overflow-wrap:anywhere;pointer-events:auto;user-select:text;cursor:text}",
			".usg_providerUsageMeta{color:var(--dsw-alias-label-caption);font-size:10px;line-height:15px}",
			".usg_providerUsageRequest{grid-area:request;white-space:nowrap}",
			".usg_providerUsageValue{grid-area:value;color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".usg_providerUsageTrack{grid-area:track;height:4px;border-radius:999px;background:var(--dsw-alias-fill-l2);overflow:hidden}",
			".usg_providerUsageBar{display:block;height:100%;border-radius:inherit;background:var(--usg-blue);opacity:.78}",
			".usg_heatStrip{grid-area:heat;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-3);border-radius:20px;padding:16px 18px;min-width:0;display:flex;flex-direction:column;gap:10px}",
			".usg_hourControls{align-items:center;gap:8px;display:flex;flex-wrap:wrap;justify-content:flex-end}",
			".usg_hourRangeSelect{height:28px;color:var(--dsw-alias-label-secondary);background:transparent;border:0;box-shadow:none;padding:0 22px 0 4px;font-size:12px;border-radius:7px;appearance:none;-webkit-appearance:none}",
			".usg_hourRangeSelect:focus,.usg_hourRangeSelect:focus-visible{outline:none;border-color:transparent;box-shadow:none}",
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
			".usg_hourInput{background:var(--dsw-static-blue-500,#3b82f6);width:100%;min-height:1px;flex-basis:0}",
			".usg_hourOutput{background:var(--dsw-static-green-500,#22c55e);width:100%;min-height:1px;flex-basis:0}",
			".usg_dayBarsBody{height:132px;border-bottom:1px solid var(--dsw-alias-border-l2);align-items:flex-end;gap:2px;display:flex;position:relative;overflow:visible}",
			".usg_dayBarSlot{box-sizing:border-box;flex:1;min-width:0;height:100%;border:0;padding:0;background:transparent;flex-direction:column;justify-content:flex-end;align-items:stretch;display:flex;position:relative;border-radius:3px;cursor:crosshair}",
			".usg_dayBarSlot:hover,.usg_dayBarSlot:focus-visible{outline:none;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--usg-blue) 45%,transparent)}",
			".usg_dayBarSlot[data-active=true]{background:color-mix(in srgb,var(--usg-blue) 7%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--usg-blue) 55%,transparent)}",
			".usg_dayBar{width:72%;margin:0 auto;border-radius:3px 3px 0 0;background:var(--dsw-static-amber-500,#f59e0b);flex:none}",
			".usg_peakRegion{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--usg-blue) 5%,transparent);border-left:1px solid color-mix(in srgb,var(--usg-blue) 14%,transparent);border-right:1px solid color-mix(in srgb,var(--usg-blue) 14%,transparent);pointer-events:none;z-index:0}",
			".usg_hourTooltip{position:absolute;z-index:60;top:8px;min-width:174px;max-width:230px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;box-shadow:var(--dsw-shadow-lv2);font-size:11px;line-height:17px;pointer-events:auto}",
			".usg_dayTooltip{position:fixed;z-index:1200;max-width:min(230px,calc(100vw - 16px))}",
			".usg_hourTooltipHead{justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:3px;font-size:12px;font-weight:600;display:flex}",
			".usg_hourTooltipAmount{color:var(--dsw-alias-label-secondary);font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".usg_hourTooltipRow{justify-content:space-between;gap:12px;color:var(--dsw-alias-label-secondary);display:flex}",
			".usg_hourTooltipModels{border-top:1px solid var(--dsw-alias-border-l1);margin-top:5px;padding-top:4px;flex-direction:column;gap:1px;display:flex}",
			".usg_hourTooltipModel{justify-content:space-between;align-items:baseline;gap:10px;min-width:0;display:flex}",
			".usg_hourTooltipModel span:first-child{min-width:0;flex:1;max-width:145px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;cursor:default}",
			".usg_hourTooltipModel span:last-child{flex:none;white-space:nowrap;font-variant-numeric:tabular-nums}",
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
			".usg_dayTokens{color:var(--dsw-alias-label-primary);flex:none;width:88px;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}",
			".usg_dayCost{color:var(--dsw-alias-label-tertiary);flex:none;width:74px;font-size:11px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}",
			".usg_dayTrack{background:var(--dsw-alias-fill-l2);border-radius:3px;height:6px;flex:1;min-width:80px;overflow:hidden}",
			".usg_dayValueBar{display:block;height:100%;border-radius:inherit;background:var(--usg-blue);opacity:.72}",
			".usg_detailSummary{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;max-height:180px;overflow-y:auto;scrollbar-gutter:stable;overscroll-behavior:contain;padding-right:2px}",
			".usg_providerGroup{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;display:grid;margin-top:8px}",
			".usg_providerGroup:first-child{margin-top:0}",
			".usg_providerHead{grid-column:1/-1;justify-content:space-between;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:600;line-height:18px;display:flex}",
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
			".usg_contribGrid{grid-template-rows:16px repeat(7,10px);gap:5px;min-width:max-content;width:100%;justify-content:center;display:grid}",
			".usg_contribMonth{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;white-space:nowrap;align-self:end}",
			".usg_contribWeekday{color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:10px;white-space:nowrap;align-self:center}",
			".usg_yearPicker{position:relative;display:inline-flex;flex:none}",
			".usg_yearPicker::after{content:\"\";position:absolute;right:10px;top:50%;width:5px;height:5px;border-right:1.5px solid var(--dsw-alias-label-tertiary);border-bottom:1.5px solid var(--dsw-alias-label-tertiary);transform:translateY(-65%) rotate(45deg);pointer-events:none}",
			".usg_yearSelect{appearance:none;-webkit-appearance:none;box-sizing:border-box;min-width:76px;height:28px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);border:0;box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1);border-radius:9px;padding:0 28px 0 10px;font:inherit;font-size:11px;font-weight:500;line-height:28px;cursor:pointer}",
			".usg_yearSelect:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
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
			".usg_providerAccountRow{align-items:center;gap:12px}",
			".usg_providerAccountIdentity{align-items:flex-start;flex:1;min-width:0}",
			".usg_providerAccountValues{align-items:flex-end;text-align:right;flex:none;gap:3px}",
			".usg_providerAccountBalanceValues{display:grid;grid-template-columns:max-content max-content;column-gap:8px;row-gap:3px;align-items:baseline}",
			".usg_providerAccountPlanValues{display:grid;grid-template-columns:max-content max-content max-content;column-gap:8px;row-gap:3px;align-items:baseline}",
			".usg_providerAccountBalanceValues .usg_providerBalanceRow,.usg_providerAccountPlanValues .usg_providerPlanWindow{grid-column:1 / -1;grid-template-columns:subgrid}",
			".usg_providerBalanceRow{display:grid;grid-template-columns:max-content max-content;column-gap:8px;align-items:baseline;justify-content:end;white-space:nowrap}",
			".usg_providerBalanceLabel{color:var(--dsw-alias-label-secondary);text-align:right}",
			".usg_providerBalanceValue{font-weight:600;text-align:right}",
			".usg_providerPlanWindow{display:grid;grid-template-columns:max-content max-content max-content;column-gap:8px;align-items:baseline;justify-content:end;white-space:nowrap}",
			".usg_providerPlanLabel{color:var(--dsw-alias-label-secondary);text-align:right}",
			".usg_providerPlanPercent{font-weight:600;text-align:right}",
			".usg_providerReset{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;white-space:nowrap}",
			".usg_providerPicker{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-3);overflow:hidden}",
			".usg_providerPicker>summary{list-style-position:inside;padding:9px 12px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}",
			".usg_providerPicker>summary,.usg_providerPicker>summary *{cursor:pointer!important}",
			".usg_providerPicker[open]>summary{color:var(--dsw-alias-label-primary);border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".usg_providerPickerBody{padding:4px 12px 8px}",
			".usg_providerPicker input[type=checkbox]{cursor:pointer!important}",
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
			".usg_statusBanner[data-status=warning] .usg_bannerTitle{color:var(--dsw-alias-state-warn-primary,#b26a00)}",
			".usg_statusBanner[data-status=exceeded]:before,.usg_statusBanner[data-status=blocked]:before{background:rgba(229,72,77,.16)}",
			".usg_statusBanner[data-status=stale],.usg_statusBanner[data-status=unavailable]{background:var(--dsw-alias-fill-l2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}",
			".usg_usageLimitBanner{border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:7px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}",
			".usg_usageLimitBanner strong{font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-secondary)}",
			".usg_usageLimitBanner span{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
			".usg_usageLimitBanner{position:relative;overflow:hidden}",
			".usg_usageLimitBanner:before{content:\"\";position:absolute;inset:auto 0 0;height:3px;background:var(--dsw-alias-border-l2);z-index:0}",
			".usg_usageLimitBanner:after{content:\"\";position:absolute;inset:auto auto 0 0;width:var(--usage-progress,0%);height:3px;background:var(--dsw-alias-brand-primary);z-index:1}",
			".usg_usageLimitBanner>*{position:relative;z-index:2}",
			".usg_bannerHead{display:flex;align-items:center;justify-content:space-between;gap:8px}",
			".usg_bannerTitle{font-weight:600;display:flex;align-items:center;gap:6px}",
			".usg_bannerMsg{font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".usg_progressTrack{background:var(--dsw-alias-fill-l2);border-radius:999px;height:5px;overflow:hidden;width:100%}",
			".usg_progressBar{border-radius:999px;height:5px;transition:width .3s ease;background:var(--usg-blue)}",
			".usg_progressBar[data-status=warning]{background:var(--dsw-alias-state-warn-primary)}",
			".usg_progressBar[data-status=exceeded],.usg_progressBar[data-status=blocked]{background:var(--dsw-alias-state-error-primary)}",
			".usg_limitActions{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:2px}",
			".usg_saveBtn{cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;font-weight:500;line-height:1.5;display:inline-flex;align-items:center;gap:6px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);transition:background .16s,opacity .15s}",
			".usg_saveBtn:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}",
			".usg_saveBtn:disabled{opacity:.4;cursor:default}",
			// Query/settings split: compact in-header view switch, native settings tabs.
			".usg_tabs{gap:2px;padding:3px;border-radius:10px;background:var(--dsw-alias-bg-module-platform);display:flex}",
			".usg_tab{cursor:pointer;color:var(--dsw-alias-label-tertiary);background:transparent;border:0;border-radius:7px;padding:4px 11px;font:inherit;font-size:12px;line-height:18px;font-weight:500}",
			".usg_tab:hover{color:var(--dsw-alias-label-primary)}",
			".usg_tab[data-active=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);box-shadow:var(--dsw-shadow-lv1)}",
			".usg_section[data-usage-billing-settings] .usg_tabs{position:static;top:auto;z-index:auto;align-items:flex-end;gap:22px;margin:2px 0 0;padding:0;border-radius:0;border-bottom:1px solid var(--dsw-alias-border-l2);background:0 0;box-shadow:none}",
			".usg_section[data-usage-billing-settings] .usg_tab{position:relative;border:0;border-bottom:0;margin-bottom:0;padding:7px 1px 9px;font-weight:400}",
			".usg_section[data-usage-billing-settings] .usg_tab:hover,.usg_section[data-usage-billing-settings] .usg_tab[data-active=true]{color:var(--dsw-alias-label-primary)}",
			".usg_section[data-usage-billing-settings] .usg_tab[data-active=true]::after{position:absolute;right:0;bottom:-1px;left:0;height:2px;border-radius:2px 2px 0 0;background:var(--dsw-alias-label-primary);content:\"\"}",
			".usg_section[data-usage-billing-settings] .usg_tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;border-radius:2px;color:var(--dsw-alias-label-primary)}",
			".usg_settingsLink{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;padding:2px 6px;font:inherit;font-size:12px;line-height:20px;flex:none;white-space:nowrap}",
			".usg_settingsLink:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".usg_row:last-child{border-bottom:0}",
			".usg_rowLabel{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;flex:none}",
			".usg_rowValue{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-variant-numeric:tabular-nums;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis}",
			".usg_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:4px 0}",
			".usg_btn{cursor:pointer;color:var(--usg-action-text);background:var(--usg-action);border:1px solid transparent;border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;font-weight:500;line-height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:background .15s,border-color .15s,color .15s,opacity .15s}",
			".usg_btnCompact{padding:3px 9px;border-radius:7px;font-size:12px;line-height:18px}",
			".usg_btn:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--usg-action))}",
			".usg_btn:disabled{opacity:.45;cursor:not-allowed}",
			".usg_btnGhost{background:0 0;color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l2)}",
			".usg_btnGhost:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:var(--dsw-alias-interactive-bg-hover)}",
			".usg_btnDanger{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-label-primary-foreground,#fff)}",
			".usg_btnDanger:hover:not(:disabled){filter:brightness(.92)}",
			".usg_btnRow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px}",
			".usg_sourceLink{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;text-decoration:none;align-self:flex-start}",
			".usg_sourceLink:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}",
			".usg_providerAccountValues>.usg_sourceLink{grid-column:1 / -1;justify-self:end;align-self:auto}",
			".usg_tableScroll{width:100%;overflow-x:auto;margin:2px 0}",
			".usg_modelTable{width:100%;border-collapse:collapse;font-size:13px}",
			".usg_modelTable th{color:var(--dsw-alias-label-tertiary);font-weight:500;text-align:left;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}",
			".usg_modelTable td{padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);font-variant-numeric:tabular-nums}",
			".usg_modelTable th.usg_thGroup{text-align:center;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".usg_modelName{color:var(--dsw-alias-label-primary);font-weight:500;white-space:nowrap}",
			".usg_priceInput{width:88px;height:30px;box-sizing:border-box;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:0 8px;font:inherit;font-size:13px;text-align:right;font-variant-numeric:tabular-nums}",
			".usg_priceInput:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}",
			".usg_select:focus,.usg_select:focus-visible{outline:none;box-shadow:none;border-color:var(--dsw-alias-border-l2)}",
			".usg_yearSelect:focus,.usg_yearSelect:focus-visible{outline:none;box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2)}",
			".usg_input:focus,.usg_input:focus-visible{outline:none;box-shadow:none;border-color:var(--dsw-alias-border-l2)}",
			".usg_priceInput:focus,.usg_priceInput:focus-visible{outline:none;box-shadow:none;border-color:var(--dsw-alias-border-l1)}",
			".usg_hourRangeSelect:focus,.usg_hourRangeSelect:focus-visible{border-color:transparent}",
			".usg_diffCell{color:var(--dsw-alias-label-secondary)}",
			".usg_diffCell[data-diff=true]{color:var(--dsw-alias-state-error-primary);font-weight:600}",
			".usg_clearConfirm{display:flex;flex-direction:column;gap:8px}",
			".usg_alertList{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto}",
			".usg_alertItem{display:flex;flex-direction:column;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 10px;font-size:12px;line-height:18px}",
			".usg_alertMeta{color:var(--dsw-alias-label-tertiary);display:flex;gap:8px;font-variant-numeric:tabular-nums}",
			".usg_alertMsg{color:var(--dsw-alias-label-primary)}",
			".usg_dataStat{margin:8px 0 2px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-3);overflow:hidden}",
			".usg_dataStatMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}",
			".usg_dataStatCell{min-width:0;padding:14px 16px;border-right:1px solid var(--dsw-alias-border-l1)}",
			".usg_dataStatCell:last-child{border-right:0}",
			".usg_dataStatLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin-bottom:3px}",
			".usg_dataStatValue{color:var(--dsw-alias-label-primary);font-size:19px;line-height:26px;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}",
			".usg_dataStatRange{grid-template-columns:auto minmax(0,1fr);align-items:center;gap:16px;padding:11px 16px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-module-platform);display:grid}",
			".usg_dataStatRangeValue{white-space:nowrap;text-align:right;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-weight:500;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}",
			".usg_dataActionPanel{margin-top:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-3);padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center}",
			".usg_dataActionInfo{min-width:0;display:flex;flex-direction:column;gap:4px}",
			".usg_dataActionInfo .usg_note{margin:0}",
			".usg_dataActionControls{display:flex;align-items:center;justify-content:flex-end;gap:8px}",
			".usg_dataRetentionInput{width:112px;flex:none}",
			".usg_dataDangerPanel{margin-top:8px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 24%,var(--dsw-alias-border-l1));border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 4%,var(--dsw-alias-bg-layer-3));padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:18px}",
			".usg_dataDangerPanel .usg_note{margin:0;max-width:560px}",
			".usg_tag{display:inline-flex;align-items:center;border-radius:6px;padding:1px 6px;font-size:11px;line-height:16px;background:var(--dsw-alias-interactive-bg);color:var(--dsw-alias-label-tertiary)}",
			".usg_tag[data-tone=warn]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 14%,transparent);color:var(--dsw-alias-state-warn-primary)}",
			".usg_tag[data-tone=bad]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);color:var(--dsw-alias-state-error-primary)}",
			".usg_tag[data-tone=ok]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}",
			"@media(max-width:840px){.usg_overviewWorkbench{grid-template-columns:1fr;grid-template-areas:\"activity\" \"rail\" \"heat\"}.usg_header{grid-template-columns:minmax(0,1fr) auto}.usg_headerLeft{grid-column:1;grid-row:1}.usg_header>.usg_tabs{grid-column:1/-1;grid-row:2;justify-self:start}.usg_headerActions{grid-column:2;grid-row:1}.usg_insightRail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}.usg_insightRail .usg_statsRow{grid-column:1/-1}.usg_hourCard .usg_chartBody{height:150px}}",
			"@media(max-width:560px){.usg_panel{max-width:calc(100vw - 24px);bottom:12px;border-radius:20px}.usg_panelBody{padding:12px}.usg_header{top:-12px;padding:0 0 10px}.usg_settingsLink{display:none}.usg_activityStage,.usg_heatStrip{padding:14px;border-radius:16px}.usg_activityLead{align-items:flex-start;flex-direction:column;gap:8px}.usg_activityValue{font-size:32px;line-height:38px}.usg_hourCard .usg_cardHead{align-items:flex-start;flex-direction:column}.usg_hourCard .usg_hourControls{width:100%;justify-content:space-between}.usg_providerGroup{grid-template-columns:1fr}.usg_insightRail{display:flex}.usg_insightRail .usg_statsRow{grid-template-columns:1fr 1fr}.usg_dataStatCell{padding:12px 10px}.usg_dataStatRange{grid-template-columns:1fr;gap:2px}.usg_dataStatRangeValue{text-align:left}.usg_dataActionPanel{grid-template-columns:1fr;gap:12px}.usg_dataActionControls{justify-content:flex-start}.usg_dataDangerPanel{align-items:flex-start;flex-direction:column}}",
			"@media(max-width:640px){.usg_toggleGrid,.usg_limitGrid{grid-template-columns:1fr}}",
			"@media(max-width:420px){.usg_dataStatMetrics{grid-template-columns:1fr}.usg_dataStatCell{border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1)}.usg_dataStatCell:last-child{border-bottom:0}.usg_dataActionControls{align-items:stretch;flex-direction:column}.usg_dataRetentionInput{width:100%}}"
		].join("");
		const tagId = "dsh-usage-stats/UsageStats.module.css";
		if (typeof document !== "undefined") {
			let tag = document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]");
			if (tag === null) {
				tag = document.createElement("style");
				tag.dataset.plugin = "dsh-usage-stats";
				tag.dataset.pluginCss = tagId;
				document.head.appendChild(tag);
			}
			tag.textContent = css;
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
			planWindowItem: "usg_planWindowItem",
			planWindowDotSlot: "usg_planWindowDotSlot",
			planWindowSeparator: "usg_planWindowSeparator",
			panel: "usg_panel",
			panelBody: "usg_panelBody",
			section: "usg_section",
				header: "usg_header",
				headerLeft: "usg_headerLeft",
				headerText: "usg_headerText",
				title: "usg_title",
			headerActions: "usg_headerActions",
			iconButton: "usg_iconButton",
			refreshButton: "usg_refreshButton",
			refreshGlyph: "usg_refreshGlyph",
			refreshGlyphClick: "usg_refreshGlyphClick",
			note: "usg_note",
			error: "usg_error",
			retry: "usg_retry",
			toast: "usg_toast",
			toastIcon: "usg_toastIcon",
			toastText: "usg_toastText",
			updated: "usg_updated",
			animatedNumber: "usg_animatedNumber",
			balance: "usg_balance",
			balanceHead: "usg_balanceHead",
			balanceIcon: "usg_balanceIcon",
			providerLogoImage: "usg_providerLogoImage",
			balanceIdentity: "usg_balanceIdentity",
			balanceLabel: "usg_balanceLabel",
			localProviderName: "usg_localProviderName",
			localUsageNote: "usg_localUsageNote",
			balanceMain: "usg_balanceMain",
			balanceAmount: "usg_balanceAmount",
			planName: "usg_planName",
			balanceCurrency: "usg_balanceCurrency",
			badge: "usg_badge",
			balanceStatus: "usg_balanceStatus",
			balanceRows: "usg_balanceRows",
			balanceRow: "usg_balanceRow",
			planQuotaWindow: "usg_planQuotaWindow",
			planQuotaWindowReset: "usg_planQuotaWindowReset",
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
				overviewWorkbench: "usg_overviewWorkbench",
				activityStage: "usg_activityStage",
				activityLead: "usg_activityLead",
				activityMetric: "usg_activityMetric",
				activityKicker: "usg_activityKicker",
				activityReading: "usg_activityReading",
				activityValue: "usg_activityValue",
				activityUnit: "usg_activityUnit",
				activityMeta: "usg_activityMeta",
				hourCard: "usg_hourCard",
				insightRail: "usg_insightRail",
				providerUsageCard: "usg_providerUsageCard",
				providerUsageList: "usg_providerUsageList",
				providerUsageRow: "usg_providerUsageRow",
				providerUsageLogo: "usg_providerUsageLogo",
				providerUsageIdentity: "usg_providerUsageIdentity",
				providerUsageName: "usg_providerUsageName",
				modelNameCopyTip: "usg_modelNameCopyTip",
				providerUsageMeta: "usg_providerUsageMeta",
				providerUsageRequest: "usg_providerUsageRequest",
				providerUsageValue: "usg_providerUsageValue",
				providerUsageTrack: "usg_providerUsageTrack",
				providerUsageBar: "usg_providerUsageBar",
				heatStrip: "usg_heatStrip",
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
			dayTooltip: "usg_dayTooltip",
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
			dayTrack: "usg_dayTrack",
			dayValueBar: "usg_dayValueBar",
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
			yearPicker: "usg_yearPicker",
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
			providerAccountRow: "usg_providerAccountRow",
			providerAccountIdentity: "usg_providerAccountIdentity",
			providerAccountValues: "usg_providerAccountValues",
			providerAccountBalanceValues: "usg_providerAccountBalanceValues",
			providerAccountPlanValues: "usg_providerAccountPlanValues",
			providerBalanceRow: "usg_providerBalanceRow",
			providerBalanceLabel: "usg_providerBalanceLabel",
			providerBalanceValue: "usg_providerBalanceValue",
			providerPlanWindow: "usg_providerPlanWindow",
			providerPlanLabel: "usg_providerPlanLabel",
			providerPlanPercent: "usg_providerPlanPercent",
			providerReset: "usg_providerReset",
			providerPicker: "usg_providerPicker",
			providerPickerBody: "usg_providerPickerBody",
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
			btnCompact: "usg_btnCompact",
			btnGhost: "usg_btnGhost",
			btnDanger: "usg_btnDanger",
			btnRow: "usg_btnRow",
			sourceLink: "usg_sourceLink",
			tableScroll: "usg_tableScroll",
			thGroup: "usg_thGroup",
			modelTable: "usg_modelTable",
			priceInput: "usg_priceInput",
			diffCell: "usg_diffCell",
			clearConfirm: "usg_clearConfirm",
			alertList: "usg_alertList",
			alertItem: "usg_alertItem",
			alertMeta: "usg_alertMeta",
			alertMsg: "usg_alertMsg",
			dataStat: "usg_dataStat",
			dataStatMetrics: "usg_dataStatMetrics",
			dataStatCell: "usg_dataStatCell",
			dataStatLabel: "usg_dataStatLabel",
			dataStatValue: "usg_dataStatValue",
			dataStatRange: "usg_dataStatRange",
			dataStatRangeValue: "usg_dataStatRangeValue",
			dataActionPanel: "usg_dataActionPanel",
			dataActionInfo: "usg_dataActionInfo",
			dataActionControls: "usg_dataActionControls",
			dataRetentionInput: "usg_dataRetentionInput",
			dataDangerPanel: "usg_dataDangerPanel",
			tag: "usg_tag"
		};
		//#endregion

		//#region helpers
		/** First selectable year for the annual daily-usage heatmap. */
		const YEAR_START = 2026;

		/** Anchor chart tooltips from the nearest edge so scroll containers do not clip them. */
		function chartTooltipAnchorStyle(index, count) {
			const total = Math.max(1, Number(count) || 1);
			const safeIndex = Math.min(total - 1, Math.max(0, Number(index) || 0));
			const center = (safeIndex + 0.5) / total;
			const edgeOffset = 100 * Math.min(center, 1 - center);
			return center > 2 / 3 ? { right: `${edgeOffset}%` } : { left: `${edgeOffset}%` };
		}

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

		/** Build a compact Monday-first grid for one natural calendar year. */
		function buildYearContributionHeatmap(dayMap, year) {
			const start = new Date(year, 0, 1);
			const startDay = (start.getDay() + 6) % 7;
			start.setDate(start.getDate() - startDay);
			const end = new Date(year, 11, 31);
			const endDay = (end.getDay() + 6) % 7;
			end.setDate(end.getDate() + (6 - endDay));
			const weekCount = Math.round((end - start) / (7 * 86400000));
			const weeks = [];
			const months = Array.from({ length: 12 }, (_, month) => {
				const first = new Date(year, month, 1);
				return { weekIndex: Math.round((first - start) / (7 * 86400000)), month };
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
					week.push({ key, tokens, hitRate: entry?.cacheHitRate ?? null, day: entry?.day ?? entry ?? null });
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
			const intensity = Math.round(Math.min(1, 0.22 + 0.78 * ratio) * 100);
			return {
				background: `color-mix(in srgb,var(--dsw-alias-state-business-primary) ${intensity}%,var(--usg-cellEmpty))`,
				color: intensity >= 60 ? "rgba(255,255,255,.95)" : "var(--dsw-alias-label-primary)"
			};
		}

		/** Group thousands. */
		function fmt(n) {
			return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}

		/** Compact token totals for the sidebar: 238910 → "238.91 K". */
		function fmtSidebarTokens(n) {
			const value = Math.max(0, Number(n) || 0);
			if (value < 1000) return fmt(value);
			const divisor = value < 1000000 ? 1000 : 1000000;
			const suffix = value < 1000000 ? "K" : "M";
			return `${(value / divisor).toFixed(2).replace(/\.?0+$/, "")} ${suffix}`;
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

		/** Ease from the currently displayed number to the newest value without overshoot. */
		function animateNumberValue(from, to, progress) {
			const start = Number(from);
			const target = Number(to);
			if (!Number.isFinite(start) || !Number.isFinite(target)) return target;
			const t = Math.max(0, Math.min(1, Number(progress) || 0));
			const eased = 1 - Math.pow(1 - t, 3);
			return start + (target - start) * eased;
		}

		/** Manual refresh replays from zero; ordinary updates continue from the current reading. */
		function animationStartValue(current, target, replay) {
			if (replay && Number.isFinite(Number(target))) return 0;
			return current;
		}

		/** Animate refreshed readings only; the first render and reduced-motion mode stay static. */
		function useAnimatedNumber(value, duration = 500, animationKey = 0) {
			const target = Number(value);
			const validTarget = value !== null && value !== void 0 && Number.isFinite(target);
			const initialRef = react.useRef(validTarget ? target : null);
			const [displayed, setDisplayed] = react.useState(initialRef.current);
			const displayedRef = react.useRef(initialRef.current);
			const frameRef = react.useRef(null);
			const animationKeyRef = react.useRef(animationKey);
			react.useEffect(() => {
				const cancel = () => {
					if (frameRef.current === null) return;
					if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frameRef.current);
					else window.clearTimeout(frameRef.current);
					frameRef.current = null;
				};
				cancel();
				if (!validTarget) {
					displayedRef.current = null;
					setDisplayed(null);
					return void 0;
				}
				const replay = animationKeyRef.current !== animationKey;
				animationKeyRef.current = animationKey;
				const from = animationStartValue(displayedRef.current, target, replay);
				const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
				if (!Number.isFinite(from) || from === target || reduceMotion) {
					displayedRef.current = target;
					setDisplayed(target);
					return void 0;
				}
				const requestFrame = typeof window.requestAnimationFrame === "function"
					? window.requestAnimationFrame.bind(window)
					: (callback) => window.setTimeout(() => callback(Date.now()), 16);
				const startedAt = typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now();
				const totalDuration = Math.max(1, Number(duration) || 360);
				const tick = (now) => {
					const progress = Math.min(1, Math.max(0, (now - startedAt) / totalDuration));
					const next = animateNumberValue(from, target, progress);
					displayedRef.current = next;
					setDisplayed(next);
					if (progress < 1) frameRef.current = requestFrame(tick);
					else frameRef.current = null;
				};
				frameRef.current = requestFrame(tick);
				return cancel;
			}, [target, validTarget, duration, animationKey]);
			return displayed;
		}

		function AnimatedNumber({ value, format, className, animationKey = 0 }) {
			const displayed = useAnimatedNumber(value, 500, animationKey);
			return react_jsx_runtime.jsx("span", {
				className: [className, S.animatedNumber].filter(Boolean).join(" "),
				"data-usage-animated-number": true,
				children: displayed === null ? "—" : typeof format === "function" ? format(displayed) : fmt(Math.round(displayed))
			});
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

		/** Whether an ellipsized text node is actually hiding content. */
		function isTruncatedTextNode(node) {
			return node !== null && node !== void 0 && Number(node.scrollWidth) > Number(node.clientWidth);
		}

		/**
		 * A model label that exposes a selectable full name only when ellipsis is
		 * active. The fixed-position tip remains a DOM descendant so pointer travel
		 * into it does not tear down the surrounding chart tooltip.
		 */
		function TruncatedModelName({ value, className }) {
			const labelRef = react.useRef(null);
			const closeTimerRef = react.useRef(null);
			const [tipPosition, setTipPosition] = react.useState(null);
			const cancelClose = () => {
				if (closeTimerRef.current === null) return;
				window.clearTimeout(closeTimerRef.current);
				closeTimerRef.current = null;
			};
			const scheduleClose = () => {
				cancelClose();
				closeTimerRef.current = window.setTimeout(() => {
					closeTimerRef.current = null;
					setTipPosition(null);
				}, 180);
			};
			const showTip = (event) => {
				cancelClose();
				if (!isTruncatedTextNode(labelRef.current)) return setTipPosition(null);
				const rect = labelRef.current.getBoundingClientRect();
				const estimatedWidth = Math.min(260, Math.max(96, String(value).length * 7 + 18));
				const viewportWidth = Number(window.innerWidth) || 1024;
				const preferredLeft = Number(event?.clientX) || rect.left + rect.width / 2;
				const left = Math.max(estimatedWidth / 2 + 12, Math.min(viewportWidth - estimatedWidth / 2 - 12, preferredLeft));
				setTipPosition({ left, top: Math.max(12, rect.top - 6) });
			};
			react.useEffect(() => () => {
				if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
			}, []);
			return react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
				children: [
					react_jsx_runtime.jsx("span", {
						ref: labelRef,
						className,
						onMouseEnter: showTip,
						onMouseLeave: scheduleClose,
						children: value
					}),
					tipPosition !== null && react_jsx_runtime.jsx("span", {
						className: S.modelNameCopyTip,
						role: "tooltip",
						"data-usage-model-name-tip": true,
						style: { left: `${tipPosition.left}px`, top: `${tipPosition.top}px` },
						onMouseEnter: cancelClose,
						onMouseLeave: scheduleClose,
						onMouseDown: cancelClose,
						children: value
					})
				]
			});
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
			let requestCount = 0;
			let requestCountKnown = true;
			for (const row of rows) {
				totals.inputTokens += row?.inputTokens ?? 0;
				totals.outputTokens += row?.outputTokens ?? 0;
				totals.cacheReadTokens += row?.cacheReadTokens ?? 0;
				totals.cacheWriteTokens += row?.cacheWriteTokens ?? 0;
				tokens += row?.tokens ?? 0;
				if (row?.cost === null) priced = false;
				else if (Number.isFinite(Number(row?.cost))) cost += Number(row.cost);
				const rowRequestCount = row?.requestCount === null || row?.requestCount === void 0 ? null : Number(row.requestCount);
				if (!Number.isSafeInteger(rowRequestCount) || rowRequestCount < 0 || !Number.isSafeInteger(requestCount + rowRequestCount)) requestCountKnown = false;
				else requestCount += rowRequestCount;
			}
			return { ...totals, tokens, requestCount: requestCountKnown ? requestCount : null, cost: priced ? cost : null };
		}

		function requestCountLabel(count, translate) {
			if (count === null || count === void 0) return `${translate("usage.requestCount")} —`;
			const value = Number(count);
			return `${translate("usage.requestCount")} ${Number.isSafeInteger(value) && value >= 0 ? fmt(value) : "—"}`;
		}

		function fmtRequestCount(count) {
			if (count === null || count === void 0) return "—";
			const value = Number(count);
			return Number.isSafeInteger(value) && value >= 0 ? fmt(value) : "—";
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
				return { hour: hour.hour, ...summed, models: rows };
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
		function recentDays(usageDays, today, activeDay = null) {
			if (!Array.isArray(usageDays)) return [];
			const dayKey = today ?? todayKey();
			const cutoffKey = shiftDayKey(dayKey, -13);
			const recent = usageDays.filter((day) => day.date >= cutoffKey && day.date <= dayKey);
			if (typeof activeDay === "string" && activeDay >= cutoffKey && activeDay <= dayKey && !recent.some((day) => day.date === activeDay)) {
				recent.push({ date: activeDay, tokens: 0, cost: null });
			}
			return recent.sort((left, right) => right.date.localeCompare(left.date));
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

		const RPC_ENDPOINTS = Object.freeze({
			usage: Object.freeze({ GET: "usage/get" }),
			keys: Object.freeze({ GET: "keys/list" }),
			providers: Object.freeze({ GET: "providers/list" }),
			balance: Object.freeze({ GET: "balance/get" }),
			limits: Object.freeze({ GET: "limits/get", POST: "limits/update" }),
			accounts: Object.freeze({ GET: "accounts/get", POST: "accounts/update" }),
			pricing: Object.freeze({ GET: "pricing/get", POST: "pricing/update" }),
			alerts: Object.freeze({ GET: "alerts/get", POST: "alerts/update" }),
			data: Object.freeze({ GET: "data/get" })
		});
		let connectionRpc;

		/** Map the existing component-local URL shape to the official RPC channel. */
		function rpcRequestOf(path, options = {}) {
			const url = new URL(path, "http://usage-stats.invalid");
			const prefix = "/api/usage-stats/";
			if (!url.pathname.startsWith(prefix)) throw new Error(`unsupported usage path: ${url.pathname}`);
			const resource = url.pathname.slice(prefix.length);
			const method = String(options.method ?? "GET").toUpperCase();
			let endpoint = RPC_ENDPOINTS[resource]?.[method];
			if (resource === "data" && method === "POST") {
				const action = options.body?.action;
				endpoint = action === "trim"
					? "data/trim"
					: action === "clear"
						? "data/clear"
						: action === "rebuild" || action === "rebuild-estimated"
							? "data/rebuild-estimated"
							: void 0;
			}
			if (endpoint === void 0) throw new Error(`unsupported usage request: ${method} ${url.pathname}`);
			const query = {};
			for (const [key, value] of url.searchParams) query[key] = value;
			const payload = { query };
			if (method === "POST") payload.body = options.body;
			return { endpoint, payload };
		}

		async function fetchJson(path, options = {}) {
			if (connectionRpc === void 0) throw new Error("usage stats RPC is unavailable");
			const request = rpcRequestOf(path, options);
			const timeoutSignal = AbortSignal.timeout(30000);
			const signal = options.signal === void 0
				? timeoutSignal
				: AbortSignal.any([timeoutSignal, options.signal]);
			const result = await connectionRpc.call("/usage-stats", request.endpoint, request.payload, signal);
			if (result === null || typeof result !== "object" || typeof result.ok !== "boolean") {
				throw new Error("unexpected RPC response");
			}
			if (!result.ok) {
				throw new Error(typeof result.error?.message === "string" ? result.error.message : "usage stats RPC failed");
			}
			const payload = result.value;
			if (payload === null || typeof payload !== "object") throw new Error("unexpected response");
			return payload;
		}

		/** Normalize provider/account payloads while keeping the legacy key shape usable. */
		function normalizeProviderKeys(value) {
			if (Array.isArray(value)) return value.map((item) => {
				if (typeof item === "string") return { id: item, label: item, configured: true };
				if (item === null || typeof item !== "object") return null;
				const id = String(item.id ?? item.keyRef ?? item.credentialRef ?? item.name ?? "");
				return id === "" ? null : { ...item, id, label: String(item.label ?? item.displayName ?? item.name ?? id) };
			}).filter(Boolean);
			if (value !== null && typeof value === "object") return Object.entries(value).map(([id, item]) => {
				if (item === null || typeof item !== "object") return { id, label: String(item ?? id), configured: Boolean(item) };
				return { ...item, id: String(item.id ?? id), label: String(item.label ?? item.displayName ?? item.name ?? id) };
			});
			return [];
		}

		function normalizeProviders(payload) {
			const list = Array.isArray(payload?.providers) ? payload.providers : [];
			return list.map((item) => {
				if (item === null || typeof item !== "object") return null;
				const id = String(item.id ?? item.providerId ?? item.provider ?? item.name ?? "");
				if (id === "") return null;
				const keys = normalizeProviderKeys(item.keys ?? item.accounts ?? item.credentials ?? item.credentialRefs);
				return {
					...item,
					id,
					label: String(item.label ?? item.displayName ?? item.name ?? id),
					displayName: String(item.displayName ?? item.label ?? item.name ?? id),
					keys
				};
			}).filter(Boolean);
		}

		function visibleProviderIdsForView(availableProviders, configuredIds, defaultProviderId) {
			const ids = (Array.isArray(availableProviders) ? availableProviders : []).map((provider) => provider?.id).filter((id) => typeof id === "string" && id !== "");
			const allowed = new Set(ids);
			const selected = [];
			for (const id of Array.isArray(configuredIds) ? configuredIds : []) {
				if (!allowed.has(id) || selected.includes(id)) continue;
				selected.push(id);
				if (selected.length >= 3) break;
			}
			const hasExplicitSelection = selected.length > 0;
			const preferred = allowed.has(defaultProviderId) ? defaultProviderId : ids[0];
			if (preferred && !selected.includes(preferred)) selected.unshift(preferred);
			if (!hasExplicitSelection) {
				for (const id of ids) {
					if (selected.length >= 3) break;
					if (!selected.includes(id)) selected.push(id);
				}
			}
			return selected.slice(0, 3);
		}

		function legacyDeepseekProvider(keys) {
			return {
				id: "deepseek-official",
				label: "DeepSeek 官方",
				displayName: "DeepSeek 官方",
				keys: normalizeProviderKeys(keys),
				legacy: true
			};
		}

		/** Filter an all-provider usage response on the client for older servers. */
		function filterDayByProvider(day, providerId) {
			if (day === null || day === void 0 || providerId === null || providerId === void 0 || providerId === "") return day;
			if (!Array.isArray(day.models)) return day;
			const models = day.models.filter((model) => providerOf(model.model) === providerId);
			const totals = sumRows(models);
			const hours = (day.hours ?? []).map((hour) => {
				const rows = (hour.models ?? []).filter((model) => providerOf(model.model) === providerId);
				return { hour: hour.hour, ...sumRows(rows), models: rows };
			});
			return { date: day.date, ...totals, cacheHitRate: hitRateOf(totals), models, hours };
		}

		function filterUsageByProvider(payload, providerId) {
			if (payload?.ok !== true || !providerId || !Array.isArray(payload.days)) return payload;
			const hasModelRows = payload.days.some((day) => Array.isArray(day?.models));
			const hasQualifiedModelRows = payload.days.some((day) => (day?.models ?? []).some((model) => providerOf(model.model) !== ""));
			return hasModelRows && hasQualifiedModelRows ? { ...payload, days: payload.days.map((day) => filterDayByProvider(day, providerId)) } : payload;
		}

		/** Only the official DeepSeek view has a configured CNY cost basis. */
		function chartUsesTokens(isSummaryTab, providerId) {
			return isSummaryTab || providerId !== "deepseek-official";
		}

		/** Normalize the remote presentation contract into three stable UI kinds. */
		function usageKindOf(provider, account) {
			const capabilities = new Set([...(Array.isArray(provider?.capabilities) ? provider.capabilities : []), ...(Array.isArray(account?.capabilities) ? account.capabilities : [])]);
			const hasWindows = Array.isArray(account?.windows) && account.windows.length > 0;
			const hasBalance = account?.balance !== null && account?.balance !== void 0;
			if (account?.status === "unsupported" && !hasWindows && !hasBalance) return "local_usage";
			if (capabilities.has("plan_quota") || hasWindows) return "plan_quota";
			if (capabilities.has("balance") || hasBalance) return "balance";
			return "local_usage";
		}

		function windowProgressOf(item) {
			const remainingPercent = Number(item?.remainingPercent);
			if (Number.isFinite(remainingPercent)) return Math.max(0, Math.min(100, remainingPercent));
			const remaining = Number(item?.remaining);
			const limit = Number(item?.limit);
			return Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0
				? Math.max(0, Math.min(100, remaining / limit * 100))
				: null;
		}

		function windowResetTextOf(value) {
			if (value === null || value === void 0 || value === "") return "";
			const date = new Date(value);
			return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
		}

		function windowResetCountdownOf(value, translate, now = Date.now()) {
			if (value === null || value === void 0 || value === "") return "";
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return "";
			const remainingMs = date.getTime() - now;
			if (remainingMs <= 0) return translate("balance.resetSoon");
			const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
			const days = Math.floor(totalMinutes / 1440);
			const hours = Math.floor(totalMinutes % 1440 / 60);
			const minutes = totalMinutes % 60;
			const parts = [];
			if (days > 0) parts.push(translate("duration.day", { value: days }));
			if (hours > 0) parts.push(translate("duration.hour", { value: hours }));
			parts.push(translate("duration.minute", { value: minutes }));
			return parts.join(" ");
		}

		function windowResetDateOf(value) {
			if (value === null || value === void 0 || value === "") return "";
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return "";
			const pad = (part) => String(part).padStart(2, "0");
			return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}

		function windowResetDisplayOf(value, translate, now = Date.now()) {
			const countdown = windowResetCountdownOf(value, translate, now);
			const date = windowResetDateOf(value);
			if (countdown === "" && date === "") return "";
			if (countdown === "") return `(${date})`;
			if (date === "") return countdown;
			return `${countdown} (${date})`;
		}

		/** Read reset timestamps across the provider-neutral aliases used by adapters. */
		function windowResetValueOf(item) {
			const reset = item?.reset;
			const nextReset = item?.nextReset ?? item?.next_reset;
			return item?.resetsAt
				?? item?.resetAt
				?? item?.reset_at
				?? item?.resetTime
				?? item?.reset_time
				?? item?.nextResetTime
				?? item?.next_reset_time
				?? item?.nextResetAt
				?? item?.next_reset_at
				?? item?.endTime
				?? item?.end_time
				?? (reset && typeof reset === "object" ? reset.at ?? reset.time : reset)
				?? (nextReset && typeof nextReset === "object" ? nextReset.at ?? nextReset.time : nextReset);
		}

		/** Keep an empty five-hour bucket visible without fabricating a reset time. */
		function windowResetDisplayForItem(item, translate, now = Date.now()) {
			const display = windowResetDisplayOf(windowResetValueOf(item), translate, now);
			if (display !== "") return display;
			if (item?.kind === "five_hour" && windowProgressOf(item) === 100) return translate("balance.resetNotStarted");
			return "";
		}

		/** Compact account-list form: countdown only, without an absolute date. */
		function windowResetCountdownForItem(item, translate, now = Date.now()) {
			const countdown = windowResetCountdownOf(windowResetValueOf(item), translate, now);
			if (countdown !== "") return countdown;
			if (item?.kind === "five_hour" && windowProgressOf(item) === 100) return translate("balance.resetNotStarted");
			return "";
		}

		function firstPlanWindowOf(account) {
			const windows = Array.isArray(account?.windows) ? account.windows : [];
			return windows.find((item) => item?.kind === "five_hour") ?? windows[0] ?? null;
		}

		/** Provider marks for the balance header. */
		function providerLogoOf(providerId) {
			if (providerId === "deepseek-official") return react_jsx_runtime.jsx(primitives.FishLogo, { size: 27 });
			if (providerId === "moonshotai" || providerId === "moonshotai-cn") return react_jsx_runtime.jsx("svg", {
				viewBox: "0 0 1024 1024",
				width: 28,
				height: 28,
				"aria-label": "Moonshot AI",
				children: react_jsx_runtime.jsx("path", {
					fill: "#fff",
					d: "M117.9648 684.6464l342.30272 93.57312v75.34592l209.7152 58.5728A428.99456 428.99456 0 0 1 512 942.08c-176.128 0-327.53664-105.8816-394.0352-257.4336zM83.29216 477.42976l407.30624 112.64-9.6256 37.00736-6.0416 35.0208 383.3856 104.96a432.5376 432.5376 0 0 1-65.10592 70.32832l-688.18944-185.9584A429.4656 429.4656 0 0 1 81.92 512c0-11.63264 0.47104-23.1424 1.37216-34.54976z m57.344-182.4768l429.07648 114.21696a279.94112 279.94112 0 0 0-23.06048 35.55328 201.17504 201.17504 0 0 0-14.70464 34.93888l403.08736 110.26432a426.8032 426.8032 0 0 1-23.552 81.7152L86.54848 448.7168a427.25376 427.25376 0 0 1 54.0672-153.76384z m158.47424-156.75392l404.23424 108.31872a190.2592 190.2592 0 0 0-32.80896 24.90368c-9.13408 8.8064-19.8656 21.4016-32.1536 37.74464l285.24544 77.78304c9.216 30.45376 15.03232 61.8496 17.32608 93.5936L156.61056 269.68064a432.27136 432.27136 0 0 1 142.49984-131.4816zM512 81.92c142.90944 0 269.55776 69.71392 347.7504 176.98816L337.26464 118.90688A428.50304 428.50304 0 0 1 512 81.92z"
				})
			});
			if (providerId === "opencode-go") return react_jsx_runtime.jsx("img", {
				className: S.providerLogoImage,
				src: OPENCODE_LOGO_DATA_URL,
				alt: "OpenCode"
			});
			if (providerId === "xiaomi-token-plan-cn") return react_jsx_runtime.jsx("img", {
				className: S.providerLogoImage,
				src: XIAOMI_MIMO_LOGO_DATA_URL,
				alt: ""
			});
			if (providerId === "zai-coding-cn") return react_jsx_runtime.jsx("svg", {
				viewBox: "0 0 1024 1024",
				width: 28,
				height: 28,
				"aria-label": "Z.ai",
				children: react_jsx_runtime.jsx("path", {
					fill: "currentColor",
					d: "M422.43584 883.5072H71.68L602.44992 133.12h346.94656L422.47168 883.5072h-0.03584z m509.40928-1.57184H495.68256l60.16-87.2192a48.768 48.768 0 0 1 40.1408-21.05344h335.86176v108.27264zM473.58464 220.3392a48.8448 48.8448 0 0 1-40.18176 21.0944H97.62304V133.12h436.16256L473.58464 220.3392z"
				})
			});
			return react_jsx_runtime.jsx("span", { "aria-label": providerId || "provider", children: String(providerId || "?").slice(0, 2).toUpperCase() });
		}

		/** Normalize the usage payload's pricing extras (server-provided). */
		function pricingOf(payload) {
			const pricing = payload?.pricing;
			return {
				currency: typeof pricing?.currency === "string" && pricing.currency !== "" ? pricing.currency : "CNY",
				peakHours: Array.isArray(pricing?.peakHours) ? pricing.peakHours : [[9, 12], [14, 18]],
				peakMultiplier: Number(pricing?.peakMultiplier) || 2,
				weekendOffPeakFrom: typeof pricing?.weekendOffPeakFrom === "string" ? pricing.weekendOffPeakFrom : "2026-08-23"
			};
		}

		/** Derive the compact balance + today-spend line shown in the sidebar. */
		function sidebarSummaryOf(usagePayload, balancePayload, limitsPayload, today, providerId = "deepseek-official", providerLabel = null, providerMeta = null) {
			const account = balancePayload?.ok === true ? balancePayload.account ?? null : null;
			const accountStatus = providerDisplayStatus(account?.status ?? (balancePayload?.ok === false ? "unavailable" : "empty"));
			const balance = account?.balance ?? null;
			const keyLimit = account?.keyLimit ?? null;
			const kind = usageKindOf(providerMeta, account);
			const primaryWindow = firstPlanWindowOf(account);
			const primaryWindowPercent = windowProgressOf(primaryWindow);
			const rawBalanceValue = kind === "balance" && balance !== null
				? balance.total
				: kind === "balance" && keyLimit !== null ? keyLimit.remaining ?? keyLimit.limit ?? keyLimit.used : null;
			const balanceValue = rawBalanceValue !== null && rawBalanceValue !== void 0 && Number.isFinite(Number(rawBalanceValue)) ? Number(rawBalanceValue) : null;
			const balanceCurrency = balance?.currency ?? keyLimit?.currency ?? null;
			const planWindows = (Array.isArray(account?.windows) ? account.windows : []).map((item) => ({
				kind: item?.kind ?? "quota",
				percent: windowProgressOf(item),
				reset: windowResetTextOf(windowResetValueOf(item))
			}));
			const usageReady = usagePayload?.ok === true && Array.isArray(usagePayload.days);
			const dayKey = today ?? usagePayload?.today ?? todayKey();
			const todayDay = usageReady ? usagePayload.days.find((day) => day.date === dayKey) : null;
			const pricing = pricingOf(usagePayload);
			const rawTodayValue = kind !== "plan_quota" && usageReady ? todayDay?.cost : null;
			const todayValue = rawTodayValue !== null && rawTodayValue !== void 0 && Number.isFinite(Number(rawTodayValue)) ? Number(rawTodayValue) : null;
			const defaultKeyRef = limitsPayload?.defaultKeyRef;
			const limitStatus = providerId === "deepseek-official" && limitsPayload?.ok === true
				? (limitsPayload.status?.[defaultKeyRef] || Object.values(limitsPayload.status || {})[0])
				: null;
			const status = limitStatus?.status;
				return {
				providerId,
				providerLabel: providerLabel || providerId,
				kind,
				accountStatus,
				balance: balanceValue !== null ? fmtCurrency(balanceValue, balanceCurrency) : "—",
				balanceValue,
				balanceCurrency,
				primaryWindowKind: primaryWindow?.kind ?? null,
				primaryWindowPercent,
					primaryWindowReset: windowResetTextOf(windowResetValueOf(primaryWindow)),
					planWindows,
				today: todayValue !== null ? `${currencySymbol(pricing.currency)}${fmtMoney(todayValue)}` : "—",
				todayValue,
				todayCurrency: pricing.currency,
					todayTokens: usageReady ? todayDay?.tokens ?? 0 : null,
					todayInputTokens: usageReady ? todayDay?.inputTokens ?? 0 : null,
					todayOutputTokens: usageReady ? todayDay?.outputTokens ?? 0 : null,
				todayAvailable: todayValue !== null,
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

			/** Normalize provider transport/parser failures for user-facing labels. */
			function providerDisplayStatus(status) {
				return status === "invalid-response" || status === "timeout" ? "unavailable" : status;
			}

			/** Sidebar dot tone from a plan window's remaining percentage. */
			function planQuotaToneOf(percent, policy, windowKind = null) {
				const value = Number(percent);
				if (!Number.isFinite(value)) return "muted";
				const scopedPolicy = policy?.windows?.[windowKind] ?? policy;
				const warning = Number(scopedPolicy?.warningRemainingPercent);
				const critical = Number(scopedPolicy?.criticalRemainingPercent);
				const warningThreshold = Number.isFinite(warning) ? warning : 30;
				const criticalThreshold = Number.isFinite(critical) ? critical : 10;
				if (value <= criticalThreshold) return "bad";
				if (value <= warningThreshold) return "warn";
				return "ok";
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

		/** True when a Beijing calendar day uses the weekend off-peak rule. */
		function isWeekendOffPeakDay(day, weekendOffPeakFrom = "2026-08-23") {
			if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < weekendOffPeakFrom) return false;
			const [year, month, date] = day.split("-").map(Number);
			const parsed = new Date(Date.UTC(year, month - 1, date));
			if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return false;
			return parsed.getUTCDay() === 0 || parsed.getUTCDay() === 6;
		}

		/** True when a Beijing date/hour lands in a billable peak window. */
		function isPeak(hour, peakHours, day = null, weekendOffPeakFrom = "2026-08-23") {
			if (isWeekendOffPeakDay(day, weekendOffPeakFrom)) return false;
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
		function ContributionHeatmap({ heat, translate, selectedKey, onSelect, today, money }) {
			const [hoveredCell, setHoveredCell] = react.useState(null);
			const weekdayLabels = [
				{ dayIndex: 0, label: translate("weekday.mon") },
				{ dayIndex: 2, label: translate("weekday.wed") },
				{ dayIndex: 4, label: translate("weekday.fri") }
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
																	"aria-label": title,
										onMouseEnter: (event) => setHoveredCell({ cell, x: event.clientX, y: event.clientY }),
										onMouseMove: (event) => setHoveredCell((current) => current === null ? current : { ...current, x: event.clientX, y: event.clientY }),
										onMouseLeave: () => setHoveredCell(null),
										onClick: () => onSelect(cell.key)
									}, cell.key);
								}))
								]
							})
					}),
					hoveredCell !== null && (() => {
						const day = hoveredCell.cell.day ?? {};
						const models = day.models ?? [];
						return react_jsx_runtime.jsxs("div", {
							className: S.hourTooltip,
							style: { position: "fixed", left: `${Math.min(window.innerWidth - 250, hoveredCell.x + 12)}px`, top: `${Math.min(window.innerHeight - 170, hoveredCell.y + 12)}px` },
							children: [
								react_jsx_runtime.jsxs("div", { className: S.hourTooltipHead, children: [hoveredCell.cell.key, react_jsx_runtime.jsx("span", { className: S.hourTooltipAmount, children: money(day.cost) })] }),
								react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.total"), fmt(day.tokens ?? hoveredCell.cell.tokens)] }),
								react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.input"), fmt(day.inputTokens ?? 0)] }),
								react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.output"), fmt(day.outputTokens ?? 0)] }),
								react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.cacheRead"), fmt(day.cacheReadTokens ?? 0)] }),
								react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.hitRate"), fmtHit(day.cacheHitRate ?? hoveredCell.cell.hitRate)] }),
								react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.requestCount"), fmtRequestCount(day.requestCount)] }),
							models.length > 0 && react_jsx_runtime.jsxs("div", { className: S.hourTooltipModels, children: models.map((model) => react_jsx_runtime.jsxs("div", { className: S.hourTooltipModel, children: [react_jsx_runtime.jsx(TruncatedModelName, { value: modelIdOf(model.model) }), react_jsx_runtime.jsx("span", { children: `${fmt(model.tokens)} · ${money(model.cost)}` })] }, model.model)) })
							]
						});
					})(),
						react_jsx_runtime.jsxs("div", {
						className: S.heatLegend,
						children: [
							react_jsx_runtime.jsx("span", { children: translate("usage.legendLess") }),
								[22, 42, 60, 80, 100].map((intensity, index) => react_jsx_runtime.jsx("span", {
									className: S.heatSwatch,
									style: { background: `color-mix(in srgb,var(--dsw-alias-state-business-primary) ${intensity}%,var(--usg-cellEmpty))` }
								}, index)),
							react_jsx_runtime.jsx("span", { children: translate("usage.legendMore") })
						]
					})
				]
			});
		}

		/**
		 * Balance card: the 消费金额 icon seat. Shows the provider selected in
		 * settings, with an API-key switcher only when that provider exposes keys.
		 */
		function BalanceCard({ keys, providers = [], selectedProviderId, selectedKey, onSelectKey, account, accountLoading, accountError, balanceTone = "muted", translate, onRetry, animationKey = 0 }) {
			const provider = providers.find((item) => item.id === selectedProviderId) ?? null;
			const providerKind = usageKindOf(provider, account);
			const balance = account?.balance ?? null;
			const keyLimit = account?.keyLimit ?? null;
			const balancePrimaryValue = balance !== null ? balance.total : keyLimit?.remaining ?? keyLimit?.limit ?? keyLimit?.used ?? null;
			const balancePrimaryCurrency = balance?.currency ?? keyLimit?.currency;
			const status = accountLoading && account === null ? "loading"
				: accountError !== null ? "error"
					: account === null ? "empty"
						: providerDisplayStatus(account.status ?? "empty");
			const tone = providerKind === "local_usage" || status === "unsupported" ? "muted" : providerKind === "balance" && status === "ok" && balanceTone !== "muted" ? balanceTone : status === "ok" ? "ok"
				: status === "loading" || status === "empty" ? "ok"
					: "bad";
			const statusText = providerKind === "local_usage" ? translate("balance.status.local") : status === "unsupported" ? translate("balance.status.unsupported") : status === "loading" ? translate("balance.status.loading")
				: status === "error" ? translate("balance.status.error")
					: status === "empty" ? translate("balance.status.empty")
						: status === "not-configured" ? translate("balance.status.notConfigured")
							: status === "not-subscribed" ? translate("balance.status.subscriptionRequired")
								: status === "unauthorized" ? translate("balance.status.unauthorized")
								: status === "rate-limited" ? translate("balance.status.rateLimited")
									: status === "unavailable" ? translate("balance.status.unavailable")
										: translate("balance.status.ok");
			const windows = Array.isArray(account?.windows) ? account.windows : [];
			const windowLabel = (kind) => kind === "five_hour" ? translate("balance.windowFiveHour") : kind === "weekly" ? translate("balance.windowWeekly") : kind === "monthly" ? translate("balance.windowMonthly") : String(kind ?? "quota");
			const stackedPlanStatus = providerKind === "plan_quota" && ["unsupported", "not-configured", "not-subscribed", "unauthorized", "rate-limited", "unavailable"].includes(status);
			const showPlanName = providerKind === "plan_quota" && (status === "ok" || status === "loading");
			const providerTitle = selectedProviderId === "opencode-go"
				? "OpenCode Go"
				: providers.find((item) => item.id === selectedProviderId)?.label ?? selectedProviderId ?? translate("balance.label");
			const keyLimitValue = keyLimit === null ? "—" : keyLimit.limit !== void 0
				? `${fmtCurrency(keyLimit.remaining ?? 0, keyLimit.currency)} / ${fmtCurrency(keyLimit.limit, keyLimit.currency)}`
				: fmtCurrency(keyLimit.remaining ?? keyLimit.used, keyLimit.currency);
			const managementMessage = account?.managementStatus === "not-configured"
				? translate("balance.managementKeyMissing")
				: account?.managementStatus && account.managementStatus !== "ok" ? translate("balance.managementKeyUnavailable") : null;
			return react_jsx_runtime.jsxs("section", {
				className: S.balance,
				"data-usage-provider-kind": providerKind,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.balanceHead,
						children: [
								react_jsx_runtime.jsx("span", {
									className: S.balanceIcon,
									"data-provider-id": selectedProviderId || "unknown",
									"aria-hidden": true,
									children: providerLogoOf(selectedProviderId)
								}),
							react_jsx_runtime.jsxs("span", {
								className: S.balanceIdentity,
								children: [
								react_jsx_runtime.jsx("span", { className: providerKind === "local_usage" ? S.localProviderName : S.balanceLabel, children: providerKind === "local_usage" ? providerTitle : providerKind === "balance"
									? `${providerTitle} ${translate("balance.providerSuffix")}`
									: providerKind === "plan_quota" ? `${providerTitle} ${translate("balance.planSuffix")}` : `${providerTitle} ${translate("balance.localSuffix")}` }),
								providerKind !== "local_usage" && (providerKind !== "plan_quota" || showPlanName) && react_jsx_runtime.jsxs("span", {
									className: S.balanceMain,
									children: [
								react_jsx_runtime.jsx("span", {
										className: providerKind === "plan_quota" ? S.planName : S.balanceAmount,
										"data-usage-plan-name": providerKind === "plan_quota" ? true : void 0,
									children: status === "loading" ? "…" : providerKind === "balance" ? react_jsx_runtime.jsx(AnimatedNumber, { className: S.balanceAmount, value: balancePrimaryValue, format: (value) => fmtCurrency(value, balancePrimaryCurrency), animationKey }) : providerKind === "plan_quota" ? account?.planName ?? translate("balance.plan") : translate("balance.local")
								}),
								providerKind === "balance" && (balance !== null || keyLimit !== null) && react_jsx_runtime.jsx("span", { className: S.balanceCurrency, children: balance?.currency ?? keyLimit?.currency })
										]
									}),
								providerKind === "local_usage" && react_jsx_runtime.jsx("span", { className: S.localUsageNote, children: translate("balance.localOnly") })
								]
							}),
							providerKind !== "local_usage" && !stackedPlanStatus && react_jsx_runtime.jsx("span", { className: S.badge, "data-tone": tone, children: statusText })
						]
					}),
					stackedPlanStatus && react_jsx_runtime.jsx("span", { className: S.balanceStatus, "data-tone": tone, "data-usage-account-status": status, children: statusText }),
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
					providerKind !== "local_usage" && status === "error" ? react_jsx_runtime.jsxs("div", {
						className: S.error,
						children: [
							react_jsx_runtime.jsx("span", { children: translate("balance.error", { message: accountError ?? "" }) }),
						react_jsx_runtime.jsx("button", { type: "button", className: S.retry, onClick: onRetry, children: translate("action.retry") })
						]
					}) : providerKind === "balance" && (balance !== null || keyLimit !== null) && react_jsx_runtime.jsxs("div", {
						className: S.balanceRows,
						children: [
							balance !== null && [
								{ value: balance.toppedUp, label: translate("balance.toppedUp") },
								{ value: balance.granted, label: translate("balance.granted") }
							].filter((row) => row.value !== void 0 && row.value !== null).map((row, index) => react_jsx_runtime.jsxs("div", {
								className: S.balanceRow,
								children: [
									react_jsx_runtime.jsx("span", { children: row.label }),
								react_jsx_runtime.jsx("b", { children: react_jsx_runtime.jsx(AnimatedNumber, { value: row.value, format: (value) => fmtCurrency(value, balance.currency), animationKey }) })
								]
							}, `${row.label}-${index}`)),
							keyLimit !== null && react_jsx_runtime.jsxs("div", {
								className: S.balanceRow,
								"data-usage-key-limit": true,
								children: [
									react_jsx_runtime.jsx("span", { children: translate("balance.keyLimit") }),
									react_jsx_runtime.jsx("b", { children: keyLimitValue })
								]
							}),
							managementMessage !== null && react_jsx_runtime.jsx("span", { className: S.note, children: managementMessage })
						]
					}),
					providerKind === "plan_quota" && windows.length > 0 && react_jsx_runtime.jsxs("div", {
						className: S.balanceRows,
						"data-usage-plan-windows": true,
						children: windows.map((item, index) => {
								const remainingPercent = windowProgressOf(item);
								const amount = remainingPercent !== null
									? `${remainingPercent.toFixed(0)}%`
									: item.limit !== void 0 || item.remaining !== void 0 ? `${fmt(item.remaining ?? 0)} / ${fmt(item.limit ?? 0)}` : "—";
								const reset = windowResetDisplayForItem(item, translate);
								return react_jsx_runtime.jsxs("div", {
									className: S.planQuotaWindow,
									"data-usage-window-kind": item.kind ?? "quota",
									children: [
										react_jsx_runtime.jsxs("div", { className: S.balanceRow, children: [
											react_jsx_runtime.jsx("span", { children: windowLabel(item.kind) }),
										react_jsx_runtime.jsx("b", { children: amount })
									] }),
										remainingPercent !== null && react_jsx_runtime.jsx("div", {
											className: S.progressTrack,
											"data-usage-window-progress": true,
											children: react_jsx_runtime.jsx("div", { className: S.progressBar, style: { width: `${remainingPercent}%` }, "data-usage-window-progress-bar": true })
										}),
										reset !== "" && react_jsx_runtime.jsx("span", { className: S.planQuotaWindowReset, "data-usage-window-reset": true, children: reset })
									]
								}, `${item.kind ?? "window"}-${index}`);
						})
					})
				]
			});
		}

		/** 24-hour input/output bars for one (filtered) day, scaled by cost. */
		function HourlyChart({ day, peakHours = [], weekendOffPeakFrom = "2026-08-23", money, translate, tokenMode = false }) {
			const [hoveredHour, setHoveredHour] = react.useState(null);
			const hours = day?.hours ?? [];
			const weekendOffPeak = isWeekendOffPeakDay(day?.date, weekendOffPeakFrom);
			const visiblePeakHours = weekendOffPeak ? [] : peakHours;
			const maxValue = hours.reduce((max, hour) => Math.max(max, Number(tokenMode ? hour.tokens : hour.cost) || 0), 0) || 1;
			const hovered = hoveredHour === null ? null : hours.find((item) => item.hour === hoveredHour) ?? null;
			return react_jsx_runtime.jsxs("div", {
				className: S.chart,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.chartInner,
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.chartBody,
								onMouseLeave: () => setHoveredHour(null),
								children: [
									!tokenMode && visiblePeakHours.map(([start, end], index) => react_jsx_runtime.jsx("div", {
										className: S.peakRegion,
										"data-peak-region": true,
										style: { left: `${100 * start / 24}%`, width: `${100 * (end - start) / 24}%` }
									}, `peak-${index}`)),
								hours.map((hour) => {
									const cost = Number(hour.cost) || 0;
									const input = Number(hour.inputTokens) || 0;
									const output = Number(hour.outputTokens) || 0;
									const cache = (Number(hour.cacheReadTokens) || 0) + (Number(hour.cacheWriteTokens) || 0);
									const inputWithCache = input + cache;
									const compositionTotal = inputWithCache + output;
									const barValue = tokenMode ? Number(hour.tokens) || 0 : cost;
									const inputShare = compositionTotal > 0
										? 100 * inputWithCache / compositionTotal
										: barValue > 0 ? 100 : 0;
									return react_jsx_runtime.jsx("button", {
											type: "button",
											className: S.hourSlot,
											"data-hour": hour.hour,
											onMouseEnter: () => setHoveredHour(hour.hour),
											children: react_jsx_runtime.jsxs("div", {
										className: S.hourBar,
										style: { height: `${100 * barValue / maxValue}%` },
												children: [
											react_jsx_runtime.jsx("div", {
												className: S.hourOutput,
												style: { flexBasis: `${compositionTotal > 0 ? 100 * output / compositionTotal : 0}%` }
											}),
											react_jsx_runtime.jsx("div", {
												className: S.hourInput,
												style: { flexBasis: `${inputShare}%` }
													})
												]
											})
										}, hour.hour);
									}),
									hovered !== null && react_jsx_runtime.jsxs("div", {
										className: S.hourTooltip,
										style: chartTooltipAnchorStyle(hovered.hour, 24),
										children: [
											react_jsx_runtime.jsxs("div", {
												className: S.hourTooltipHead,
												children: [
													`${String(hovered.hour).padStart(2, "0")}:00`,
																react_jsx_runtime.jsx("span", { className: S.hourTooltipAmount, children: tokenMode ? `${fmt(hovered.tokens)} tokens` : money(hovered.cost) })
												]
											}),
											react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.input"), fmt(hovered.inputTokens)] }),
							react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.output"), fmt(hovered.outputTokens)] }),
							react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.cacheRead"), fmt(hovered.cacheReadTokens ?? 0)] }),
							react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.hitRate"), fmtHit(hitRateOf(hovered))] }),
							react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.requestCount"), fmtRequestCount(hovered.requestCount)] }),
											(hovered.models ?? []).length > 0 && react_jsx_runtime.jsxs("div", {
												className: S.hourTooltipModels,
												children: hovered.models.map((model) => react_jsx_runtime.jsxs("div", {
													className: S.hourTooltipModel,
													children: [
														react_jsx_runtime.jsx(TruncatedModelName, { value: modelIdOf(model.model) }),
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
								react_jsx_runtime.jsx("span", { className: S.legendSwatch, style: { background: "var(--dsw-static-blue-500,#3b82f6)" } }),
								translate("usage.input")
							] }),
							react_jsx_runtime.jsxs("span", { className: S.legendItem, children: [
								react_jsx_runtime.jsx("span", { className: S.legendSwatch, style: { background: "var(--dsw-static-green-500,#22c55e)" } }),
								translate("usage.output")
							] }),
																		!tokenMode && react_jsx_runtime.jsx("span", { className: S.peakNote, children: translate(weekendOffPeak ? "chart.weekendOffPeakNote" : "chart.peakNote") })
						]
					})
				]
			});
		}

		/** One bar per day for a multi-day range, scaled by the active chart metric. */
		function DayBarsChart({ rangeDays, money, translate, tokenMode = false, selectedDay = null, onDayHover, onDaySelect }) {
			const [hoveredDay, setHoveredDay] = react.useState(null);
			const closeTimer = react.useRef(null);
			const tooltipRef = react.useRef(null);
			const days = rangeDays ?? [];
			const metricOf = (day) => tokenMode ? Number(day.tokens) || 0 : Number(day.cost) || 0;
			const maxMetric = days.reduce((max, day) => Math.max(max, metricOf(day)), 0) || 1;
			const hovered = hoveredDay === null ? null : days.find((item) => item.date === hoveredDay.date) ?? null;
			const cancelClose = () => {
				if (closeTimer.current !== null) {
					window.clearTimeout(closeTimer.current);
					closeTimer.current = null;
				}
			};
			const scheduleClose = () => {
				cancelClose();
				closeTimer.current = window.setTimeout(() => {
					setHoveredDay(null);
					onDayHover?.(null);
					closeTimer.current = null;
				}, 160);
			};
			react.useEffect(() => () => cancelClose(), []);
			react.useEffect(() => {
				if (hoveredDay === null || hoveredDay.positioned || tooltipRef.current === null) return;
				const tooltipRect = tooltipRef.current.getBoundingClientRect();
				const gap = 10;
				const viewportHeight = window.innerHeight || tooltipRect.height + gap * 2 + 16;
				const aboveSpace = Math.max(0, hoveredDay.anchor.top - gap - 8);
				const belowSpace = Math.max(0, viewportHeight - hoveredDay.anchor.bottom - gap - 8);
				const placeAbove = aboveSpace >= tooltipRect.height || (belowSpace < tooltipRect.height && aboveSpace >= belowSpace);
				const availableHeight = placeAbove ? aboveSpace : belowSpace;
				const top = placeAbove
					? Math.max(8, hoveredDay.anchor.top - gap - Math.min(tooltipRect.height, availableHeight))
					: Math.min(viewportHeight - Math.min(tooltipRect.height, availableHeight) - 8, hoveredDay.anchor.bottom + gap);
				setHoveredDay((current) => current === null || current.date !== hoveredDay.date || current.positioned
					? current
					: {
						...current,
						positioned: true,
						style: {
							...current.style,
							top: `${Math.round(top)}px`,
							maxHeight: `${Math.floor(availableHeight)}px`,
							overflowY: tooltipRect.height > availableHeight ? "auto" : void 0,
							visibility: "visible"
						}
					});
			}, [hoveredDay]);
			const showDay = (day, event) => {
				cancelClose();
				const rect = event.currentTarget.getBoundingClientRect();
				const tooltipWidth = 230;
				const viewportWidth = window.innerWidth || tooltipWidth + 16;
				const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, viewportWidth - tooltipWidth - 8));
				setHoveredDay({
					date: day.date,
					anchor: { top: rect.top, bottom: rect.bottom },
					positioned: false,
					style: { left: `${Math.round(left)}px`, top: `${Math.round(rect.bottom + 10)}px`, visibility: "hidden" }
				});
				onDayHover?.(day.date);
			};
			const tooltip = hovered !== null && typeof document !== "undefined" && document.body !== void 0
				? react_dom.createPortal(react_jsx_runtime.jsxs("div", {
					ref: tooltipRef,
					className: `${S.hourTooltip} ${S.dayTooltip}`,
					"data-usage-day-tooltip": true,
					style: hoveredDay.style,
					onMouseEnter: cancelClose,
					onMouseLeave: scheduleClose,
					children: [
						react_jsx_runtime.jsxs("div", { className: S.hourTooltipHead, children: [hovered.date, react_jsx_runtime.jsx("span", { className: S.hourTooltipAmount, children: tokenMode ? `${fmt(hovered.tokens)} tokens` : money(hovered.cost) })] }),
						react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.total"), fmt(hovered.tokens)] }),
						react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.input"), fmt(hovered.inputTokens ?? 0)] }),
							react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.output"), fmt(hovered.outputTokens ?? 0)] }),
							react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.cacheRead"), fmt(hovered.cacheReadTokens ?? 0)] }),
							react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.hitRate"), fmtHit(hitRateOf(hovered))] }),
							react_jsx_runtime.jsxs("div", { className: S.hourTooltipRow, children: [translate("usage.requestCount"), fmtRequestCount(hovered.requestCount)] }),
						(hovered.models ?? []).length > 0 && react_jsx_runtime.jsxs("div", {
							className: S.hourTooltipModels,
							children: hovered.models.map((model) => react_jsx_runtime.jsxs("div", {
								className: S.hourTooltipModel,
								children: [
									react_jsx_runtime.jsx(TruncatedModelName, { value: modelIdOf(model.model) }),
									react_jsx_runtime.jsx("span", { children: tokenMode ? fmt(model.tokens) : `${fmt(model.tokens)} · ${money(model.cost)}` })
								]
							}, model.model))
						})
					]
				}), document.body)
				: null;
			return react_jsx_runtime.jsxs("div", {
				className: S.chart,
				onMouseLeave: scheduleClose,
				children: [
					react_jsx_runtime.jsx("div", {
						className: S.dayBarsBody,
						children: days.map((day) => react_jsx_runtime.jsx("button", {
							type: "button",
							className: S.dayBarSlot,
							"data-day": day.date,
							"data-active": selectedDay === day.date ? "true" : void 0,
							onMouseEnter: (event) => showDay(day, event),
							onMouseLeave: scheduleClose,
							onFocus: (event) => showDay(day, event),
							onBlur: scheduleClose,
							onClick: () => onDaySelect?.(day.date),
							children: react_jsx_runtime.jsx("div", {
								className: S.dayBar,
								style: { width: "72%", height: `${100 * metricOf(day) / maxMetric}%`, flex: "none", margin: "0 auto" }
							})
						}, day.date))
					}),
					days.length > 0 && react_jsx_runtime.jsxs("div", {
						className: S.chartAxis,
						children: [...new Set([days[0].date, days[days.length - 1].date])].map((date) => react_jsx_runtime.jsx("span", { children: date }, date))
					}),
					tooltip
				]
			});
		}

		/** Clickable recent-days list; selecting a day syncs the overview hourly chart. */
		function DayList({ days, selectedDay, onSelect, money, translate, tokenMode = false, animationKey = 0 }) {
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
						react_jsx_runtime.jsx(AnimatedNumber, { className: S.dayTokens, value: day.tokens, animationKey }),
						react_jsx_runtime.jsx("span", {
							className: S.dayTrack,
							children: react_jsx_runtime.jsx("span", { className: S.dayValueBar, style: { width: `${100 * (Number(day.tokens) || 0) / maxTokens}%` } })
						}),
						tokenMode ? null : react_jsx_runtime.jsx("span", { className: S.dayCost, children: money(day.cost) })
					]
				}, day.date))
			});
		}

		/** Per-model breakdown of one (filtered) day. */
		function DayDetail({ day, money, translate, tokenMode = false, animationKey = 0 }) {
			if (day === null) return null;
			const models = day.models ?? [];
			const maxTokens = models.reduce((max, model) => Math.max(max, Number(model.tokens) || 0), 0) || 1;
			if (models.length === 0) return null;
			return react_jsx_runtime.jsxs("div", {
				className: S.detailSummary,
				children: [
					react_jsx_runtime.jsxs("div", {
							children: groupModelsByProvider(models).map((group) => react_jsx_runtime.jsxs("div", {
								className: S.providerGroup,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.providerHead,
										children: [
											react_jsx_runtime.jsx("span", { className: S.providerName, children: group.provider === "deepseek-official" ? translate("usage.providerDeepseek") : group.provider }),
										react_jsx_runtime.jsx(AnimatedNumber, { className: S.providerTokens, value: group.tokens, animationKey, format: (value) => `${fmt(Math.round(value))} tokens` }),
																	tokenMode ? null : react_jsx_runtime.jsx("span", { className: S.providerCost, children: group.models.some((model) => model.cost !== null) ? money(group.models.reduce((sum, model) => sum + (Number(model.cost) || 0), 0)) : translate("usage.notBilled") })
										]
									}),
									group.models.map((model) => react_jsx_runtime.jsxs("div", {
										className: S.modelRow,
										children: [
											react_jsx_runtime.jsxs("div", {
												className: S.modelHead,
												children: [
													react_jsx_runtime.jsx("span", { className: S.modelName, children: modelIdOf(model.model) }),
													react_jsx_runtime.jsx(AnimatedNumber, { className: S.modelTokens, value: model.tokens, animationKey }),
																tokenMode ? null : react_jsx_runtime.jsx("span", { className: S.modelCost, children: money(model.cost) })
												]
											}),
											react_jsx_runtime.jsx("div", {
												className: S.modelBarTrack,
												children: react_jsx_runtime.jsx("div", {
													className: S.modelBar,
													style: { width: `${100 * (Number(model.tokens) || 0) / maxTokens}%` }
												})
											}),
											react_jsx_runtime.jsx("div", { className: S.modelMeta, children: `${translate("usage.hitRate")} ${fmtHit(hitRateOf(model))} · ${requestCountLabel(model.requestCount, translate)}` })
										]
									}, model.model))
								]
							}, group.provider))
						})
				]
			});
		}

		/** Compact cross-provider model ranking for the summary insight rail. */
		function ProviderUsageList({ day, providers = [], translate, animationKey = 0, reservedModelCount = 0 }) {
			const models = [...(day?.models ?? [])].sort((left, right) => (Number(right.tokens) || 0) - (Number(left.tokens) || 0));
			const maxTokens = models.reduce((max, model) => Math.max(max, Number(model.tokens) || 0), 0) || 1;
			const placeholderCount = Math.max(0, Math.ceil(Number(reservedModelCount) || 0) - models.length);
			return react_jsx_runtime.jsxs("section", {
				className: S.providerUsageCard,
				"data-usage-provider-summary": true,
				children: [
					react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("usage.modelUsage") }),
					models.length === 0 && placeholderCount === 0 ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.noModelUsage") }) : react_jsx_runtime.jsx("div", {
						className: S.providerUsageList,
						children: [
							...models.map((model) => {
							const providerId = providerOf(model.model) || "unknown";
							const provider = providers.find((item) => item.id === providerId);
							const providerLabel = provider?.displayName ?? provider?.label ?? (providerId === "deepseek-official" ? translate("usage.providerDeepseek") : providerId);
							return react_jsx_runtime.jsxs("div", {
								className: S.providerUsageRow,
								"data-provider": providerId,
								children: [
									react_jsx_runtime.jsx("span", { className: S.providerUsageLogo, "data-provider": providerId, children: providerLogoOf(providerId) }),
									react_jsx_runtime.jsxs("span", { className: S.providerUsageIdentity, children: [
										react_jsx_runtime.jsx(TruncatedModelName, { className: S.providerUsageName, value: modelIdOf(model.model) }),
										react_jsx_runtime.jsx("span", { className: S.providerUsageMeta, children: providerLabel })
									] }),
									react_jsx_runtime.jsx(AnimatedNumber, { className: S.providerUsageValue, value: model.tokens, animationKey }),
									react_jsx_runtime.jsx("span", { className: `${S.providerUsageMeta} ${S.providerUsageRequest}`, children: requestCountLabel(model.requestCount, translate) }),
									react_jsx_runtime.jsx("span", { className: S.providerUsageTrack, children: react_jsx_runtime.jsx("span", { className: S.providerUsageBar, style: { width: `${100 * model.tokens / maxTokens}%` } }) })
								]
							}, model.model);
							}),
							...Array.from({ length: placeholderCount }, (_, index) => react_jsx_runtime.jsx("div", {
								className: S.providerUsageRow,
								"data-usage-provider-placeholder": true,
								"aria-hidden": true
							}, `placeholder-${index}`))
						]
					})
				]
			});
		}

		/**
		 * Query-center body: all-provider summary plus provider overview/details.
		 * All configuration lives in the native settings page; this panel only reads.
		 */
		function UsageStatsSection({ t, onClose, onOpenSettings }) {
			const translate = t ?? ((key) => key);
			const [usage, setUsage] = react.useState(null);
			const [keys, setKeys] = react.useState([]);
			const [providers, setProviders] = react.useState([]);
			const [selectedProviderId, setSelectedProviderId] = react.useState(null);
			const [selectedKey, setSelectedKey] = react.useState(null);
			const [balance, setBalance] = react.useState(null);
			const [balanceLoading, setBalanceLoading] = react.useState(false);
			const [usageLoading, setUsageLoading] = react.useState(false);
			const [loaded, setLoaded] = react.useState(false);
			const [error, setError] = react.useState(null);
			const [updatedAt, setUpdatedAt] = react.useState(null);
			const [refreshTick, setRefreshTick] = react.useState(0);
			const [activeTab, setActiveTab] = react.useState("overview");
			const sectionRef = react.useRef(null);
			const [detailsMinHeight, setDetailsMinHeight] = react.useState(null);
			const [timeRange, setTimeRange] = react.useState("today");
			const [selectedDay, setSelectedDay] = react.useState(null);
			const [rangeSelectedDay, setRangeSelectedDay] = react.useState(null);
			const [heatYear, setHeatYear] = react.useState(Number(todayKey().slice(0, 4)));
			const [modelFilter, setModelFilter] = react.useState("");
			const [limitStatusMap, setLimitStatusMap] = react.useState({});
			const loader = react.useRef(createLoader());
			const balanceLoader = react.useRef(createLoader());

			const loadUsage = react.useCallback(() => {
				const request = loader.current.start();
				setUsageLoading(true);
				if (activeTab !== "summary" && !selectedProviderId) { setUsageLoading(false); return Promise.resolve(); }
				const usageProviderId = activeTab === "summary" ? null : selectedProviderId;
				const providerQuery = usageProviderId ? `?provider=${encodeURIComponent(usageProviderId)}` : "";
				return fetchJson(`/api/usage-stats/usage${providerQuery}`).catch((error) => usageProviderId
					? fetchJson("/api/usage-stats/usage").catch(() => { throw error; })
					: Promise.reject(error)).then((payload) => {
					if (!loader.current.isCurrent(request)) return;
					setUsage(payload.ok === true ? filterUsageByProvider(payload, usageProviderId) : null);
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
			}, [activeTab, selectedProviderId]);
			const loadLimitStatus = react.useCallback(() => {
				return fetchJson("/api/usage-stats/limits").then((payload) => {
					if (payload?.ok === true) setLimitStatusMap(payload.status ?? {});
					return payload;
				}).catch(() => null);
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
			const loadProviders = react.useCallback(() => {
				return fetchJson("/api/usage-stats/providers").then((payload) => {
					const list = normalizeProviders(payload);
					if (payload.ok !== true || list.length === 0) throw new Error("provider endpoint unavailable");
					setProviders(list);
					const preferred = String(payload.defaultProviderId ?? "deepseek-official");
					setSelectedProviderId(list.some((item) => item.id === preferred) ? preferred : list.find((item) => item.id === "deepseek-official")?.id ?? list[0]?.id ?? "deepseek-official");
				}).catch((providerError) => fetchJson("/api/usage-stats/keys").then((payload) => {
					const list = payload.ok === true && Array.isArray(payload.keys) ? payload.keys : [];
					setProviders([legacyDeepseekProvider(list)]);
					setSelectedProviderId("deepseek-official");
				}).catch((fallbackError) => {
					setLoaded(true);
					setError(fallbackError instanceof Error ? fallbackError.message : providerError instanceof Error ? providerError.message : "provider endpoint unavailable");
				}));
			}, []);
			const retryLoad = react.useCallback(() => {
				setError(null);
				return loadProviders().then(() => loadUsage());
			}, [loadProviders, loadUsage]);
			const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? null;
			const providerKeys = selectedProvider?.keys?.length > 0 ? selectedProvider.keys : selectedProviderId === "deepseek-official" ? keys : [];
			const selectedProviderKind = usageKindOf(selectedProvider, null);
			const loadBalance = react.useCallback((keyRef) => {
				const request = balanceLoader.current.start();
				setBalanceLoading(true);
				// Drop the previous provider's account immediately: the header/logo
				// already switched, so showing the old balance while the new request
				// is in flight would mis-attribute it (up to the 30s timeout).
				setBalance(null);
				if (selectedProviderKind === "local_usage") {
					if (balanceLoader.current.isCurrent(request)) setBalance({ ok: true, account: { providerId: selectedProviderId, status: "local", capabilities: ["local_usage"] } });
					if (balanceLoader.current.isCurrent(request)) setBalanceLoading(false);
					return;
				}
				const params = new URLSearchParams();
				if (selectedProviderId) params.set("provider", selectedProviderId);
				if (keyRef) params.set("key", keyRef);
				const query = params.toString() ? `?${params.toString()}` : "";
				fetchJson(`/api/usage-stats/balance${query}`).then((payload) => {
					if (balanceLoader.current.isCurrent(request)) setBalance(payload);
				}).catch((error) => {
					if (balanceLoader.current.isCurrent(request)) setBalance({ ok: false, message: error instanceof Error ? error.message : String(error) });
				}).finally(() => {
					if (balanceLoader.current.isCurrent(request)) setBalanceLoading(false);
				});
			}, [selectedProviderId, selectedProviderKind]);
				react.useEffect(() => {
				loadUsage();
				loadKeys();
				loadProviders();
				loadLimitStatus();
				const timer = window.setInterval(loadUsage, 60000);
				const onAccountsUpdated = () => { loadProviders(); };
				const onLimitsUpdated = () => { loadLimitStatus(); };
				window.addEventListener("usage-stats:accounts-updated", onAccountsUpdated);
				window.addEventListener("usage-stats:limits-updated", onLimitsUpdated);
				return () => {
					window.clearInterval(timer);
					window.removeEventListener("usage-stats:accounts-updated", onAccountsUpdated);
					window.removeEventListener("usage-stats:limits-updated", onLimitsUpdated);
				};
			}, [loadUsage, loadKeys, loadProviders, loadLimitStatus]);
			react.useEffect(() => {
				setSelectedKey((current) => {
					if (current !== null && providerKeys.some((key) => key.id === current)) return current;
					return providerKeys.find((key) => key.default)?.id ?? providerKeys.find((key) => key.configured)?.id ?? providerKeys[0]?.id ?? null;
				});
			}, [selectedProviderId, providers, keys]);
			react.useEffect(() => {
				loadBalance(selectedKey);
			}, [loadBalance, selectedKey]);

			const days = usage?.ok === true && Array.isArray(usage.days) ? usage.days : [];
			const serverToday = usage?.today ?? todayKey();
			const pricing = pricingOf(usage);
			const money = (value) => value === null || value === void 0 ? "—" : `${currencySymbol(pricing.currency)}${fmtMoney(value)}`;
			const isSummaryTab = activeTab === "summary";
			const activeModelFilter = isSummaryTab ? "" : modelFilter;
			const stats = summarize(days, activeModelFilter, serverToday);
			const account = balance?.ok === true ? balance.account ?? null : null;
			const accountError = balance === null || balance?.ok === true ? null : balance?.message ?? "error";
			const balanceStatus = selectedProviderKind === "balance" && selectedProviderId === "deepseek-official"
				? limitStatusMap?.[selectedKey ?? ""] ?? Object.values(limitStatusMap ?? {})[0] ?? null
				: null;
			const activeLimitStatus = balanceStatus;
			const todaySpendTone = limitToneOf(activeLimitStatus?.spendStatus);
			const todayLimitNum = Number(activeLimitStatus?.dailyCostLimit) || 0;
			const todaySpentNum = Number(activeLimitStatus?.todayCost ?? stats.todayCostPriced ?? stats.todayCost) || 0;
			const todayLimitPercent = todayLimitNum > 0 ? Math.min(100, Math.round(todaySpentNum / todayLimitNum * 100)) : 0;
			const tokenMode = chartUsesTokens(isSummaryTab, selectedProviderId);
			const showCostStat = !isSummaryTab && selectedProviderKind !== "plan_quota" && (selectedProviderKind === "balance" || stats.todayCost !== null || stats.todayCostPriced !== null);
				const activeDayKey = activeDayKeyOf(timeRange, selectedDay, serverToday);
			const activeDayObject = activeDayKey === null ? null : days.find((day) => day.date === activeDayKey) ?? null;
			const filteredActiveDay = activeDayObject === null ? null : filterDay(activeDayObject, activeModelFilter);
			const singleRange = timeRange === "today" || timeRange === "yesterday" || timeRange === "custom";
			const rangeDays = daysInRange(timeRange, serverToday).map((date) => days.find((day) => day.date === date) ?? { date, tokens: 0, cost: null });
			const latestRangeDay = [...rangeDays].reverse().find((day) => (Number(day.tokens) || 0) > 0) ?? rangeDays[rangeDays.length - 1] ?? null;
			const focusedRangeKey = rangeSelectedDay ?? latestRangeDay?.date ?? null;
			const focusedRangeSourceDay = focusedRangeKey === null ? null : rangeDays.find((day) => day.date === focusedRangeKey) ?? null;
			const focusedRangeDay = focusedRangeSourceDay === null ? null : filterDay(focusedRangeSourceDay, activeModelFilter);
			const providerUsageDay = singleRange ? filteredActiveDay : focusedRangeDay;
			const providerUsageCapacity = singleRange
				? (providerUsageDay?.models?.length ?? 0)
				: rangeDays.reduce((max, day) => Math.max(max, (filterDay(day, activeModelFilter)?.models ?? []).length), 0);
			const recentList = recentDays(days.map((day) => filterDay(day, activeModelFilter)), serverToday, activeDayKey);
			const timeRangeOptions = [
				{ value: "today", label: translate("usage.today") },
				{ value: "yesterday", label: translate("usage.rangeYesterday") },
				{ value: "7d", label: translate("usage.range7d") },
				{ value: "30d", label: translate("usage.range30d") },
				{ value: "month", label: translate("usage.month") },
				{ value: "lastMonth", label: translate("usage.rangeLastMonth") }
			];
			const heatDayMap = new Map(days.map((day) => [day.date, { ...day, tokens: day.tokens, cacheHitRate: hitRateOf(day), day }]));
			const currentYear = Number(serverToday.slice(0, 4));
			const yearChoices = [];
			for (let year = YEAR_START; year <= currentYear; year += 1) yearChoices.push(year);
			const pickDay = (date) => {
				setSelectedDay(date === serverToday ? null : date);
				setTimeRange(date === serverToday ? "today" : "custom");
				setRangeSelectedDay(null);
			};
			const refreshAll = () => {
				loadUsage();
				loadBalance(selectedKey);
				loadLimitStatus();
			};
			const showDetails = () => {
				if (sectionRef.current !== null) setDetailsMinHeight(Math.ceil(sectionRef.current.getBoundingClientRect().height));
				setActiveTab("details");
			};

			return react_jsx_runtime.jsxs("div", {
				ref: sectionRef,
				className: S.section,
				style: activeTab === "details" && detailsMinHeight !== null ? { minHeight: `${detailsMinHeight}px` } : void 0,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.header,
						children: [
						react_jsx_runtime.jsx("div", {
							className: S.headerLeft,
							children: react_jsx_runtime.jsxs("span", {
									className: S.headerText,
									children: [
										react_jsx_runtime.jsx("span", { className: S.title, children: translate("panel.title") }),
										updatedAt !== null && react_jsx_runtime.jsx("span", { className: S.updated, children: translate("panel.updatedAt", { time: updatedAt }) })
									]
								})
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
									"data-active": activeTab === "summary" ? "true" : "false",
									"aria-selected": activeTab === "summary",
									onClick: () => setActiveTab("summary"),
									children: translate("panel.tabSummary")
								}),
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
									onClick: showDetails,
									children: translate("panel.tabDetails")
								})
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
									children: react_jsx_runtime.jsxs("svg", { className: refreshTick > 0 ? `${S.refreshGlyph} ${S.refreshGlyphClick}` : S.refreshGlyph, width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [react_jsx_runtime.jsx("path", { d: "M21 12a9 9 0 1 1-6.22-8.56" }, "path1"), react_jsx_runtime.jsx("polyline", { points: "21 3 21 9 15 9" }, "polyline1")] }, refreshTick)
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
							react_jsx_runtime.jsx("button", { type: "button", className: S.retry, onClick: retryLoad, children: translate("action.retry") })
						]
					}),
					loaded === false ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.loading") }) : (activeTab === "summary" || activeTab === "overview") ? react_jsx_runtime.jsxs("div", {
						className: S.overviewWorkbench,
						"data-usage-overview-workbench": true,
						"data-usage-summary": isSummaryTab,
						children: [
							react_jsx_runtime.jsxs("section", {
								className: S.activityStage,
								"data-usage-activity-stage": true,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.activityLead,
										children: [
											react_jsx_runtime.jsxs("div", {
												className: S.activityMetric,
												children: [
													react_jsx_runtime.jsx("span", { className: S.activityKicker, children: translate("usage.activityToday") }),
													react_jsx_runtime.jsxs("span", { className: S.activityReading, children: [
								react_jsx_runtime.jsx(AnimatedNumber, { className: S.activityValue, value: stats.todayTokens, animationKey: refreshTick }),
														react_jsx_runtime.jsx("span", { className: S.activityUnit, children: translate("usage.tokenUnit") })
													] })
												]
											}),
											showCostStat && react_jsx_runtime.jsx("span", {
												className: S.activityMeta,
												title: stats.todayUnpriced ? translate("usage.unpricedNote") : void 0,
								children: [
									translate(stats.todayUnpriced ? "usage.costTodayUnpriced" : "usage.costToday"),
									" ",
								react_jsx_runtime.jsx(AnimatedNumber, { value: stats.todayCostPriced ?? stats.todayCost, format: money, animationKey: refreshTick }),
									stats.todayUnpriced ? " *" : ""
								]
											})
										]
									}),
									react_jsx_runtime.jsxs("section", {
										className: `${S.card} ${S.hourCard}`,
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
														setRangeSelectedDay(null);
														},
														children: [
															...timeRangeOptions.map((option) => react_jsx_runtime.jsx("option", { value: option.value, children: option.label }, option.value)),
															timeRange === "custom" ? react_jsx_runtime.jsx("option", { value: "custom", children: selectedDay ?? serverToday }, "custom") : null
														]
													}),
												singleRange && react_jsx_runtime.jsxs("div", {
													className: S.dayNav,
													children: [
																									react_jsx_runtime.jsx("button", { type: "button", className: S.navButton, "aria-label": translate("action.prevDay"), disabled: recentList.length === 0 || activeDayKey <= recentList[recentList.length - 1].date, onClick: () => { const index = recentList.findIndex((day) => day.date === activeDayKey); if (index < recentList.length - 1) pickDay(recentList[index + 1].date); }, children: react_jsx_runtime.jsx(primitives.IconChevronLeftOutline14, { size: 12 }) }),
												react_jsx_runtime.jsx("span", { className: S.dayTitle, children: dayLabel(activeDayKey, translate) }),
																									react_jsx_runtime.jsx("button", { type: "button", className: S.navButton, "aria-label": translate("action.nextDay"), disabled: recentList.length === 0 || activeDayKey >= recentList[0].date, onClick: () => { const index = recentList.findIndex((day) => day.date === activeDayKey); if (index > 0) pickDay(recentList[index - 1].date); }, children: react_jsx_runtime.jsx(primitives.IconChevronRightOutline14, { size: 12 }) }),
														react_jsx_runtime.jsx("button", { type: "button", className: S.todayButton, onClick: () => { setSelectedDay(null); setTimeRange("today"); setRangeSelectedDay(null); }, children: translate("action.today") })
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
											: react_jsx_runtime.jsx(HourlyChart, { day: filteredActiveDay, peakHours: pricing.peakHours, weekendOffPeakFrom: pricing.weekendOffPeakFrom, money, translate, tokenMode }),
											filteredActiveDay !== null && react_jsx_runtime.jsx(DayDetail, { day: filteredActiveDay, money, translate, tokenMode, animationKey: refreshTick })
										]
									}) : react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
										children: [
											react_jsx_runtime.jsx(DayBarsChart, { rangeDays, money, translate, tokenMode, selectedDay: rangeSelectedDay, onDaySelect: (date) => setRangeSelectedDay((current) => current === date ? null : date) }),
											!isSummaryTab && focusedRangeDay !== null && react_jsx_runtime.jsx(DayDetail, { day: focusedRangeDay, money, translate, tokenMode, animationKey: refreshTick })
										]
									})
								]
										})
									]
								}),
							react_jsx_runtime.jsxs("aside", {
								className: S.insightRail,
								"data-usage-insight-rail": true,
								children: [
									isSummaryTab ? null : react_jsx_runtime.jsx(BalanceCard, {
										keys: providerKeys,
										providers,
										selectedProviderId,
										selectedKey,
										onSelectKey: setSelectedKey,
										account,
										accountLoading: balanceLoading,
										accountError,
									balanceTone: limitToneOf(balanceStatus?.balanceAlertStatus),
									translate,
									onRetry: () => loadBalance(selectedKey),
									animationKey: refreshTick
									}),
									!isSummaryTab && todayLimitNum > 0 && react_jsx_runtime.jsxs("div", {
										className: S.usageLimitBanner,
										style: { "--usage-progress": `${todayLimitPercent}%` },
										children: [
											react_jsx_runtime.jsx("strong", { children: translate("limits.dailySpendProgress") }),
											react_jsx_runtime.jsx("span", { children: translate("limits.progress", { spent: money(todaySpentNum), limit: money(todayLimitNum), percent: String(todayLimitPercent) }) })
										]
									}),
									react_jsx_runtime.jsxs("div", {
										className: S.statsRow,
										children: [
											react_jsx_runtime.jsxs("div", { className: S.stat, children: [
								react_jsx_runtime.jsx(AnimatedNumber, { className: S.statValue, value: stats.monthTokens, animationKey: refreshTick }),
												react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.month") })
											] }),
											react_jsx_runtime.jsxs("div", { className: S.stat, children: [
								react_jsx_runtime.jsx(AnimatedNumber, { className: S.statValue, value: stats.totalTokens, animationKey: refreshTick }),
												react_jsx_runtime.jsx("span", { className: S.statLabel, children: translate("usage.total") })
											] }),
											showCostStat && react_jsx_runtime.jsxs("div", { className: S.stat, children: [
								react_jsx_runtime.jsxs("span", { className: `${S.statValue} ${S.statMoney}`, title: stats.todayUnpriced ? translate("usage.unpricedNote") : void 0, children: [
									react_jsx_runtime.jsx(AnimatedNumber, { value: stats.todayCostPriced ?? stats.todayCost, format: money, animationKey: refreshTick }),
									stats.todayUnpriced ? " *" : ""
								] }),
												react_jsx_runtime.jsx("span", { className: S.statLabel, children: stats.todayUnpriced ? translate("usage.costTodayUnpriced") : translate("usage.costToday") })
											] })
										]
									}),
									isSummaryTab ? react_jsx_runtime.jsx(ProviderUsageList, { day: providerUsageDay, providers, translate, animationKey: refreshTick, reservedModelCount: providerUsageCapacity }) : null,
									usage?.hasEstimatedHistory === true && react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.legacyEstimated") })
								]
							}),
							react_jsx_runtime.jsxs("section", {
								className: S.heatStrip,
								"data-usage-heat-strip": true,
								children: [
									react_jsx_runtime.jsxs("div", {
										className: S.heatHeader,
										children: [
											react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("usage.heatmap", { year: heatYear }) }),
										react_jsx_runtime.jsx("span", {
											className: S.yearPicker,
											children: react_jsx_runtime.jsx("select", {
												className: S.yearSelect,
												"aria-label": translate("usage.year"),
												value: heatYear,
												onChange: (event) => setHeatYear(Number(event.target.value) || heatYear),
												children: yearChoices.map((year) => react_jsx_runtime.jsx("option", { value: year, children: year }, year))
											})
										})
										]
									}),
									react_jsx_runtime.jsx(ContributionHeatmap, {
										heat: buildYearContributionHeatmap(heatDayMap, heatYear),
										translate,
										selectedKey: selectedDay,
										onSelect: pickDay,
										today: serverToday,
										money
									})
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
									usage?.hasEstimatedHistory === true ? react_jsx_runtime.jsx("p", { className: S.hint, children: translate("usage.legacyEstimated") }) : null,
									react_jsx_runtime.jsx(DayList, {
										days: recentList,
										selectedDay: activeDayKey,
										onSelect: (date) => {
											pickDay(date);
											setActiveTab("overview");
										},
																				money,
																				translate,
																				tokenMode: selectedProviderKind === "plan_quota",
																				animationKey: refreshTick
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
			 * behavior: 供应商与账户 / 供应商用量与计费 / 通知与提示 / 数据管理.
		 * The query panel stays read-only; every write-affecting control lives
		 * here.
		 * @param props - t bound by the slot runtime (locale seat).
		 */
		/** Settings tab: quota limits with immediate saves (no submit button). */
		function LimitsCard({ keys, selectedKey, onSelectKey, pricing, todayCost, providers = [], providerId = "deepseek-official", providerKind = "balance", translate, onLimitsUpdated }) {
			const [limits, setLimits] = react.useState(null);
			const limitsRef = react.useRef(null);
			const committedLimitsRef = react.useRef(null);
			const [statusMap, setStatusMap] = react.useState({});
			const [saving, setSaving] = react.useState(false);
			const [error, setError] = react.useState(null);
			const providerOptions = providers.length > 0 ? providers : [{ id: providerId, label: providerId }];
			const selectedLimitProviderId = providerOptions.some((provider) => provider.id === providerId) ? providerId : providerOptions[0]?.id ?? providerId;
			const selectedLimitProvider = providerOptions.find((provider) => provider.id === selectedLimitProviderId) ?? providerOptions[0] ?? null;
			const selectedLimitProviderKind = selectedLimitProvider?.capabilities?.length > 0
				? usageKindOf(selectedLimitProvider, null)
				: providerKind;
			const multiKey = (keys ?? []).length > 1;
			const targetKey = multiKey ? (selectedKey ?? "__global__") : "__global__";

			react.useEffect(() => {
				fetchJson("/api/usage-stats/limits").then((payload) => {
					if (payload.ok !== true) return;
					limitsRef.current = payload.limits;
					committedLimitsRef.current = payload.limits;
					setLimits(payload.limits);
					setStatusMap(payload.status ?? {});
				}).catch(() => {});
			}, []);

			// Derive the visible rule from the always-fresh saved cache:
			// `limits` state lags a text-input save (handleSave intentionally never
			// setLimits — save responses must not overwrite active form fields),
			// so reading state here would show PRE-save values when the user
			// switches key A→B→A and the keyed inputs remount.
			const limitsDoc = limits === null ? null : limitsRef.current ?? limits;
			const rule = limitsDoc === null
				? null
				: targetKey === "__global__"
					? limitsDoc.global ?? {}
					: limitsDoc.keys?.[targetKey] ?? {};
			const alertPercent = Number(rule?.alertPercent) || 80;
			const criticalPercent = Math.max(alertPercent, Number(rule?.criticalPercent) || 90);
			const stopOnExceed = rule?.stopOnExceed === true;
			const disabled = limits === null || saving;

			const patchLocal = (patch) => {
				const current = limitsRef.current;
				if (current === null) return;
				const next = targetKey === "__global__"
					? { ...current, global: { ...(current.global ?? {}), ...patch } }
					: { ...current, keys: { ...(current.keys ?? {}), [targetKey]: { ...(current.keys?.[targetKey] ?? {}), ...patch } } };
				limitsRef.current = next;
				setLimits(next);
			};
			const rollbackToCommittedLimits = () => {
				const committed = committedLimitsRef.current;
				if (committed === null) return;
				limitsRef.current = committed;
				setLimits(committed);
			};
			const parseAmount = (text) => {
				const trimmed = String(text ?? "").trim();
				if (trimmed === "") return null;
				const value = Number(trimmed);
				return Number.isFinite(value) && value > 0 ? value : void 0;
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
					committedLimitsRef.current = payload.limits;
					setStatusMap(payload.status ?? {});
					onLimitsUpdated?.();
					if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
						window.dispatchEvent(new Event("usage-stats:limits-updated"));
					}
				} catch (err) {
					rollbackToCommittedLimits();
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			const currentStatus = statusMap[targetKey] ?? Object.values(statusMap)[0] ?? null;
			const spendStatus = currentStatus?.spendStatus ?? "muted";
			const spendBannerStatus = ["warning", "exceeded", "blocked"].includes(spendStatus) ? spendStatus : "normal";
			const spendBannerActive = spendBannerStatus !== "normal";
			const spendBannerMessage = currentStatus?.reason === "daily_cost" || currentStatus?.reason === "unpriced" ? currentStatus.message : "";
			const currentStatusTone = limitToneOf(spendBannerStatus);
			const currentLimit = Number(currentStatus?.dailyCostLimit) || 0;
			const currentSpent = Number(currentStatus?.todayCost ?? todayCost) || 0;
			const currentPercent = currentLimit > 0 ? Math.min(100, Math.round(100 * currentSpent / currentLimit)) : 0;
			const providerContext = react_jsx_runtime.jsxs("div", {
				children: [
					react_jsx_runtime.jsx("p", { className: S.note, "data-usage-limit-provider-name": true, children: `${translate("limits.currentProvider")}: ${selectedLimitProvider?.label ?? selectedLimitProvider?.id ?? providerId}` }),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("limits.providerSwitchDesc") })
				]
			});
			if (selectedLimitProvider?.id !== "deepseek-official" || selectedLimitProviderKind !== "balance") return react_jsx_runtime.jsxs("div", {
				className: S.limitCard,
				"data-usage-limit-provider": selectedLimitProvider?.id ?? providerId,
				children: [
					react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("limits.title") }),
					providerContext,
					supportsPlanQuota(selectedLimitProvider) || isZaiProvider(selectedLimitProvider?.id)
						? react_jsx_runtime.jsx(PlanQuotaCard, { translate })
						: react_jsx_runtime.jsx("p", { className: S.note, children: translate("limits.providerScoped") })
				]
			});

			return react_jsx_runtime.jsxs("div", {
				className: S.limitCard,
				children: [
					providerContext,
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
					currentStatus !== null && currentLimit > 0 && react_jsx_runtime.jsxs("div", {
						className: S.statusBanner,
						"data-status": spendBannerStatus,
						style: { "--usage-progress": `${currentPercent}%` },
						children: [
							react_jsx_runtime.jsxs("div", {
								className: S.bannerHead,
								children: [
									react_jsx_runtime.jsx("span", { className: S.bannerTitle, children: translate("limits.dailyLimitStatus") }),
								spendBannerActive ? react_jsx_runtime.jsx("span", { className: S.badge, "data-tone": currentStatusTone, children: translate(limitStatusLabelKey(spendBannerStatus)) }) : null
								]
							}),
							currentLimit > 0 && react_jsx_runtime.jsx("span", { className: S.bannerMsg, children: translate("limits.progress", { spent: currentSpent.toFixed(2), limit: currentLimit.toFixed(2), percent: currentPercent }) }),
							spendBannerActive && currentLimit > 0 && react_jsx_runtime.jsx("div", {
								className: S.progressTrack,
								children: react_jsx_runtime.jsx("div", {
									className: S.progressBar,
									"data-status": currentStatus.spendStatus ?? "muted",
									style: { width: `${currentPercent}%` }
								})
							}),
							spendBannerMessage !== "" ? react_jsx_runtime.jsx("span", { className: S.bannerMsg, children: spendBannerMessage }) : null
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
									children: react.createElement("input", {
											type: "text",
											inputMode: "decimal",
											className: `${S.input} has_prefix`,
											key: `${targetKey}:daily:${limits === null ? "loading" : "ready"}`,
													disabled,
											placeholder: translate("limits.dailyLimitPlaceholder"),
											defaultValue: rule?.dailyCostLimit ?? "",
								onBlur: (event) => { const value = parseAmount(event.currentTarget.value); if (value !== void 0) handleSave({ dailyCostLimit: value }); },
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
														onPointerUp: () => handleSave({}),
														onKeyUp: () => handleSave({})
													}),
													react_jsx_runtime.jsx("input", {
														type: "range",
														min: 2,
														max: 100,
														value: criticalPercent,
														className: `${S.alertRange} is-overlay`,
														disabled,
														onChange: (event) => patchLocal({ criticalPercent: Math.max(Number(event.target.value), alertPercent + 1) }),
															onPointerUp: () => handleSave({}),
															onKeyUp: () => handleSave({})
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
									children: react.createElement("input", {
											type: "text",
											inputMode: "decimal",
											className: `${S.input} has_prefix`,
											key: `${targetKey}:balance:${limits === null ? "loading" : "ready"}`,
													disabled,
											placeholder: translate("limits.lowBalancePlaceholder"),
											defaultValue: rule?.lowBalanceWarning ?? "",
								onBlur: (event) => { const value = parseAmount(event.currentTarget.value); if (value !== void 0) handleSave({ lowBalanceWarning: value }); },
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
													const nextValue = event.target.checked;
													if (nextValue && typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(translate("limits.stopConfirm"))) return;
													patchLocal({ stopOnExceed: nextValue });
													handleSave({ stopOnExceed: nextValue });
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

		function accountDisplayFields(display) {
			const fields = [["balance", "accounts.showBalance"]];
			if (display?.balance !== false) {
				fields.push(["todayCost", "accounts.showToday"], ["statusDot", "accounts.showStatus"]);
			}
			return fields;
		}

		/** Settings tab: account snapshots, refresh cadence and sidebar display toggles. */
		function AccountsCard({ keys, providers = [], defaultProviderId = "deepseek-official", onDefaultProviderUpdated, translate }) {
			const [payload, setPayload] = react.useState(null);
			const [refreshing, setRefreshing] = react.useState(false);
			const [credentialDrafts, setCredentialDrafts] = react.useState({});
			const [credentialSaving, setCredentialSaving] = react.useState(null);
			const [error, setError] = react.useState(null);
			const singleKey = (keys ?? []).length <= 1;
			const load = react.useCallback(() => {
				fetchJson("/api/usage-stats/accounts").then(setPayload).catch(() => {});
			}, []);
			react.useEffect(() => { load(); }, [load]);
			const display = payload?.settings?.display ?? { balance: true, todayCost: true, statusDot: true };
			const refreshMs = payload?.settings?.refreshMs ?? null;
			const accounts = payload?.accounts ?? {};
			const accountProviders = normalizeProviders(payload);
			const availableProviders = accountProviders.length > 0 ? accountProviders : providers;
			const effectiveDefaultProviderId = payload?.defaultProviderId ?? payload?.settings?.defaultProviderId ?? defaultProviderId ?? "deepseek-official";
			const configuredVisibleProviderIds = Array.isArray(payload?.settings?.visibleProviderIds) ? payload.settings.visibleProviderIds : [];
			const visibleProviderIds = visibleProviderIdsForView(availableProviders, configuredVisibleProviderIds, effectiveDefaultProviderId);
			const displayedProviders = availableProviders.filter((provider) => visibleProviderIds.includes(provider.id));
			const selectedProvider = availableProviders.find((provider) => provider.id === effectiveDefaultProviderId) ?? null;
			const providerAccountOf = (provider) => {
				const direct = accounts?.[provider.id];
				if (direct !== undefined) return direct;
				const firstKey = provider.keys?.[0]?.id;
				return firstKey !== undefined ? accounts?.[firstKey] : null;
			};
			const savePatch = async (patch) => {
				setError(null);
				try {
					const updated = await fetchJson("/api/usage-stats/accounts", { method: "POST", body: patch });
					if (updated.ok !== true) throw new Error(updated.message ?? "save failed");
					setPayload((current) => current === null ? current : { ...current, settings: updated.settings, defaultProviderId: updated.defaultProviderId ?? (patch.defaultProviderId ?? current.defaultProviderId) });
					if (patch.defaultProviderId !== undefined && typeof onDefaultProviderUpdated === "function") onDefaultProviderUpdated(patch.defaultProviderId);
					if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
						window.dispatchEvent(new Event("usage-stats:accounts-updated"));
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const saveCredential = async (field) => {
				const value = String(credentialDrafts[field.id] ?? "").trim();
				if (value === "") return;
				setError(null);
				setCredentialSaving(field.id);
				try {
					const updated = await fetchJson("/api/usage-stats/accounts", {
						method: "POST",
						body: { credential: { providerId: effectiveDefaultProviderId, fieldId: field.id, value } }
					});
					if (updated.ok !== true) throw new Error(updated.message ?? "save failed");
					setCredentialDrafts((current) => ({ ...current, [field.id]: "" }));
					load();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setCredentialSaving(null);
				}
			};
			const statusLabelKey = (status) => {
				const displayStatus = providerDisplayStatus(status);
				return displayStatus === "ok" ? "balance.status.ok"
					: displayStatus === "unsupported" ? "balance.status.unsupported"
					: displayStatus === "not-configured" ? "balance.status.notConfigured"
						: displayStatus === "not-subscribed" ? "balance.status.subscriptionRequired"
							: displayStatus === "unauthorized" ? "balance.status.unauthorized"
							: displayStatus === "rate-limited" ? "balance.status.rateLimited"
								: displayStatus === "unavailable" ? "balance.status.unavailable"
									: displayStatus === "pending" ? "balance.status.loading"
										: "balance.status.error";
			};
			return react_jsx_runtime.jsxs("section", {
				className: S.card,
				"data-usage-accounts-card": true,
				children: [
					react_jsx_runtime.jsxs("div", {
						className: S.cardHead,
						"data-usage-accounts-head": true,
						children: [
							react_jsx_runtime.jsx("span", { className: S.cardTitle, children: translate("accounts.title") }),
							react_jsx_runtime.jsx("button", {
							type: "button",
							className: `${S.btn} ${S.btnCompact}`,
							"data-usage-refresh-accounts": true,
							disabled: refreshing,
							onClick: () => {
								setRefreshing(true);
								const refreshTargets = displayedProviders.filter((provider) => provider.queryable !== false);
								Promise.allSettled(refreshTargets.map((provider) => fetchJson(`/api/usage-stats/balance?provider=${encodeURIComponent(provider.id)}&refresh=1`))).finally(() => {
									load();
									setRefreshing(false);
								});
							},
							children: refreshing ? translate("accounts.refreshing") : translate("accounts.refreshNow")
							})
						]
					}),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("accounts.desc") }),
					error !== null && react_jsx_runtime.jsx("div", { className: S.error, children: translate("accounts.saveError", { message: error }) }),
					availableProviders.length > 0 && react_jsx_runtime.jsxs("div", {
						className: S.row,
								children: [
							react_jsx_runtime.jsx("span", { className: S.rowLabel, children: translate("accounts.defaultProvider") }),
							react_jsx_runtime.jsx("select", {
								className: S.select,
								value: effectiveDefaultProviderId,
								"data-usage-default-provider-select": true,
								"aria-label": translate("accounts.defaultProvider"),
									onChange: (event) => {
										const nextDefault = event.target.value;
										const nextVisible = visibleProviderIds.includes(nextDefault) ? visibleProviderIds : [nextDefault, ...visibleProviderIds].slice(0, 3);
										savePatch({ defaultProviderId: nextDefault, visibleProviderIds: nextVisible });
									},
									children: availableProviders.map((provider) => react_jsx_runtime.jsx("option", {
									value: provider.id,
									children: provider.label
								}, provider.id))
							})
						]
					}),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("accounts.defaultProviderDesc") }),
					availableProviders.length > 1 && react_jsx_runtime.jsxs("details", {
						className: S.providerPicker,
						"data-usage-visible-provider-picker": true,
						children: [
							react_jsx_runtime.jsx("summary", { children: translate("accounts.visibleProvidersSummary", { count: visibleProviderIds.length }) }),
							react_jsx_runtime.jsxs("div", { className: S.providerPickerBody, children: [
								react_jsx_runtime.jsx("p", { className: S.note, children: translate("accounts.visibleProvidersDesc") }),
								availableProviders.map((provider) => {
								const checked = visibleProviderIds.includes(provider.id);
								const locked = provider.id === effectiveDefaultProviderId;
								return react_jsx_runtime.jsxs("label", {
									className: S.toggleRow,
									"data-usage-visible-provider": provider.id,
									children: [
										react_jsx_runtime.jsxs("span", { className: S.toggleInfo, children: [
											react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: provider.label }),
											locked && react_jsx_runtime.jsx("span", { className: S.note, children: translate("accounts.defaultAlwaysVisible") })
										] }),
										react_jsx_runtime.jsx("input", {
											type: "checkbox",
											checked,
											disabled: locked || (!checked && visibleProviderIds.length >= 3),
											onChange: (event) => {
												const next = event.target.checked ? [...visibleProviderIds, provider.id] : visibleProviderIds.filter((id) => id !== provider.id);
												savePatch({ visibleProviderIds: next });
											}
										})
									]
								}, provider.id);
								})
							] })
						]
					}),
					Array.isArray(selectedProvider?.extraCredentials) && selectedProvider.extraCredentials.length > 0 && react_jsx_runtime.jsxs("div", {
						className: S.toggleGrid,
						"data-usage-provider-extra-credentials": selectedProvider.id,
						children: [
							react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("accounts.extraCredentials") }),
							react_jsx_runtime.jsx("p", { className: S.note, children: translate("accounts.extraCredentialsDesc") }),
							selectedProvider.extraCredentials.map((field) => react_jsx_runtime.jsxs("div", {
								className: S.row,
								children: [
									react_jsx_runtime.jsxs("div", { className: S.toggleInfo, children: [
										react_jsx_runtime.jsx("span", { className: S.rowLabel, children: field.id === "managementApiKey" ? translate("accounts.managementApiKey") : field.label }),
										react_jsx_runtime.jsx("span", { className: S.note, children: field.configured ? translate("accounts.credentialConfigured") : translate("accounts.credentialMissing") })
									] }),
									react_jsx_runtime.jsx("input", {
										type: "password",
										className: S.input,
										value: credentialDrafts[field.id] ?? "",
										autoComplete: "off",
										placeholder: translate("accounts.credentialPlaceholder"),
										onChange: (event) => setCredentialDrafts((current) => ({ ...current, [field.id]: event.target.value }))
									}),
									react_jsx_runtime.jsx("button", {
										type: "button",
										className: S.btn,
										disabled: credentialSaving !== null || String(credentialDrafts[field.id] ?? "").trim() === "",
										onClick: () => saveCredential(field),
										children: credentialSaving === field.id ? translate("accounts.credentialSaving") : translate("accounts.credentialSave")
									})
								]
							}, field.id))
						]
					}),
					displayedProviders.length > 0 ? displayedProviders.map((provider) => {
						const account = providerAccountOf(provider);
						const providerKind = usageKindOf(provider, account);
						const planWindows = Array.isArray(account?.windows) ? account.windows : [];
						const unsupported = provider.queryable === false || account?.status === "unsupported";
						const balance = account?.balance ?? null;
						const keyLimit = account?.keyLimit ?? null;
						const today = account?.today ?? null;
						const keyLimitValue = keyLimit === null ? "—" : keyLimit.limit !== void 0
							? `${fmtCurrency(keyLimit.remaining ?? 0, keyLimit.currency)} / ${fmtCurrency(keyLimit.limit, keyLimit.currency)}`
							: fmtCurrency(keyLimit.remaining ?? keyLimit.used, keyLimit.currency);
						const managementMessage = account?.managementStatus === "not-configured"
							? translate("balance.managementKeyMissing")
							: account?.managementStatus && account.managementStatus !== "ok" ? translate("balance.managementKeyUnavailable") : null;
						return react_jsx_runtime.jsxs("div", {
							className: `${S.row} ${S.providerAccountRow}`,
							"data-usage-provider-account": provider.id,
							"data-usage-provider-kind": providerKind,
							children: [
								react_jsx_runtime.jsxs("div", {
									className: `${S.toggleInfo} ${S.providerAccountIdentity}`,
									children: [
										react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: provider.label }),
									provider.id === effectiveDefaultProviderId ? react_jsx_runtime.jsx("span", { className: S.tag, "data-tone": "ok", children: translate("accounts.default") }) : null,
									provider.keys?.length > 0 && react_jsx_runtime.jsx("span", { className: S.note, children: `${provider.keys.length} ${translate("balance.apiKey")}` })
									]
								}),
								react_jsx_runtime.jsxs("div", {
									className: `${S.toggleInfo} ${S.providerAccountValues}${providerKind === "balance" ? ` ${S.providerAccountBalanceValues}` : providerKind === "plan_quota" ? ` ${S.providerAccountPlanValues}` : ""}`,
									children: [
										providerKind === "balance" && react_jsx_runtime.jsxs("div", {
											className: S.providerBalanceRow,
											children: [
												react_jsx_runtime.jsx("span", { className: S.providerBalanceLabel, children: translate("panel.balance") }),
												react_jsx_runtime.jsx("span", { className: `${S.rowValue} ${S.providerBalanceValue}`, children: balance === null ? "—" : fmtCurrency(balance.total, balance.currency) })
											]
										}),
										providerKind === "balance" && today?.cost !== null && today?.cost !== void 0 && react_jsx_runtime.jsxs("div", {
											className: S.providerBalanceRow,
											"data-usage-provider-today": true,
											children: [
												react_jsx_runtime.jsx("span", { className: S.providerBalanceLabel, children: translate("accounts.today") }),
												react_jsx_runtime.jsx("span", { className: `${S.note} ${S.providerBalanceValue}`, children: fmtCurrency(today.cost, today.currency ?? balance?.currency ?? "CNY") })
											]
										}),
										providerKind === "balance" && keyLimit !== null && react_jsx_runtime.jsxs("div", {
											className: S.providerBalanceRow,
											"data-usage-key-limit": true,
											children: [
												react_jsx_runtime.jsx("span", { className: S.providerBalanceLabel, children: translate("balance.keyLimit") }),
												react_jsx_runtime.jsx("span", { className: `${S.rowValue} ${S.providerBalanceValue}`, children: keyLimitValue })
											]
										}),
										providerKind === "balance" && managementMessage !== null && react_jsx_runtime.jsx("span", { className: S.note, children: managementMessage }),
										unsupported && react_jsx_runtime.jsx("span", { className: S.rowValue, children: translate("accounts.unsupported") }),
									!unsupported && providerKind === "local_usage" && react_jsx_runtime.jsx("span", { className: S.rowValue, children: translate("balance.local") }),
										!unsupported && providerKind === "plan_quota" && planWindows.length === 0 && react_jsx_runtime.jsx("span", { className: S.rowValue, children: translate("balance.plan") }),
										!unsupported && providerKind === "plan_quota" && planWindows.map((window) => {
											const percent = windowProgressOf(window);
											const label = window.kind === "five_hour" ? translate("balance.windowFiveHour") : window.kind === "weekly" ? translate("balance.windowWeekly") : window.kind === "monthly" ? translate("balance.windowMonthly") : translate("balance.plan");
											const reset = windowResetCountdownForItem(window, translate);
											return react_jsx_runtime.jsxs("div", {
												className: S.providerPlanWindow,
												"data-usage-provider-plan-window": window.kind,
												children: [
													react_jsx_runtime.jsx("span", { className: S.providerPlanLabel, children: label }),
													react_jsx_runtime.jsx("span", { className: `${S.rowValue} ${S.providerPlanPercent}`, children: percent === null ? "—" : `${percent.toFixed(0)}%` }),
											reset !== "" && react_jsx_runtime.jsx("span", { className: S.providerReset, "data-usage-window-reset": true, children: `(${reset})` })
												]
											}, window.kind);
										}),
									!unsupported && providerKind !== "local_usage" && account?.status !== "ok" && react_jsx_runtime.jsx("span", { className: S.note, children: translate(statusLabelKey(account?.status ?? "pending")) }),
									provider.accountUrl && react_jsx_runtime.jsx("a", {
										className: S.sourceLink,
										"data-usage-web-query": provider.id,
										href: provider.accountUrl,
										target: "_blank",
										rel: "noreferrer",
										title: provider.accountUrl,
										children: translate("accounts.openWebQuery")
									})
									]
								})
							]
						}, provider.id);
					}) : (keys ?? []).map((key) => {
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
										account?.status !== "ok" && react_jsx_runtime.jsx("span", { className: S.note, children: translate(statusLabelKey(account?.status ?? "pending")) })
									]
								})
							]
						}, key.id);
					}),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("accounts.accountSnapshotDesc") }),
					react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("accounts.commonGroup") }),
					react_jsx_runtime.jsxs("div", {
						className: S.row,
						children: [
							react_jsx_runtime.jsxs("div", { className: S.toggleInfo, children: [
								react_jsx_runtime.jsx("span", { className: S.rowLabel, children: translate("accounts.refreshCadence") }),
								react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate("accounts.refreshDesc") })
							] }),
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
							accountDisplayFields(display).map(([field, labelKey]) => react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsxs("div", { className: S.toggleInfo, children: [
									react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate(labelKey) }),
									react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate(`${labelKey}Desc`) })
								] }),
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
					]
			});
		}

		function pricingWritePayload(current, currency, models) {
			const source = current !== null && typeof current === "object" && !Array.isArray(current) ? current : {};
			const { pricing: _legacyReadShape, ...base } = source;
			return { ...base, currency, models };
		}

		/** Settings tab: official vs custom pricing with a fork/restore editor. */
		function PricingCard({ translate, onPricingUpdated }) {
			const [payload, setPayload] = react.useState(null);
			const [draft, setDraft] = react.useState(null);
			const [officialPreview, setOfficialPreview] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [errorKind, setErrorKind] = react.useState("save");
			const [saving, setSaving] = react.useState(false);
			const [fetchingOfficial, setFetchingOfficial] = react.useState(false);
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
			const modelRowsOf = (scheme) => {
				const result = {};
				const models = scheme?.models && typeof scheme.models === "object" && !Array.isArray(scheme.models) ? scheme.models : {};
				for (const [model, row] of Object.entries(models)) {
					if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
					const offPeak = row.offPeak ?? row.offpeak ?? {};
					const peak = row.peak ?? {};
					result[model] = {
						offPeak: offPeak && typeof offPeak === "object" ? offPeak : {},
						peak: peak && typeof peak === "object" ? peak : {}
					};
				}
				const legacy = scheme?.pricing && typeof scheme.pricing === "object" && !Array.isArray(scheme.pricing) ? scheme.pricing : {};
				for (const [model, row] of Object.entries(legacy)) {
					if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
					const existing = result[model] ?? { offPeak: {}, peak: {} };
					result[model] = { ...existing, offPeak: { ...(existing.offPeak ?? {}), ...row } };
				}
				return result;
			};
			const liveModels = modelRowsOf(current);
			const officialModels = modelRowsOf(official);
			const mergeRate = (base, override) => Object.fromEntries(FIELDS.map((field) => [field, override?.[field] ?? base?.[field] ?? ""]));
			const editableModels = Object.fromEntries([...new Set([...Object.keys(officialModels), ...Object.keys(liveModels)])].map((model) => {
				const officialRow = officialModels[model] ?? {};
				const liveRow = liveModels[model] ?? {};
				return [model, {
					offPeak: mergeRate(officialRow.offPeak, liveRow.offPeak),
					peak: mergeRate(officialRow.peak, liveRow.peak)
				}];
			}));
			const draftOf = (models) => Object.fromEntries(Object.entries(models ?? {}).map(([model, row]) => [model, {
				offPeak: Object.fromEntries(FIELDS.map((field) => [field, String(row?.offPeak?.[field] ?? "")])),
				peak: Object.fromEntries(FIELDS.map((field) => [field, String(row?.peak?.[field] ?? "")]))
			}]));
			const toNumericModels = (models) => {
				const result = {};
				for (const [model, row] of Object.entries(models ?? {})) {
					result[model] = {};
					for (const period of PERIODS) {
						result[model][period] = {};
						for (const field of FIELDS) {
							const raw = String(row?.[period]?.[field] ?? "").trim();
							const value = Number(raw);
							if (raw === "" || !Number.isFinite(value) || value < 0) return { error: "pricing.invalidValue" };
							result[model][period][field] = value;
						}
					}
				}
				return { models: result };
			};
			const handleFork = () => setDraft(draftOf(editableModels));
			const handleFetchOfficial = async () => {
				setFetchingOfficial(true);
				setError(null);
				setErrorKind("fetch");
				try {
					const result = await fetchJson("/api/usage-stats/pricing", { method: "POST", body: { action: "fetch-official" } });
					if (result.ok !== true || Object.keys(modelRowsOf(result.candidate)).length === 0) throw new Error(result.message ?? "invalid official pricing response");
					setOfficialPreview(result.candidate);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setFetchingOfficial(false);
				}
			};
			const handleConfirmOfficial = () => {
				setDraft(draftOf(modelRowsOf(officialPreview)));
				setOfficialPreview(null);
			};
			const handleRestore = async () => {
				setSaving(true);
				setError(null);
				setErrorKind("save");
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
				setErrorKind("save");
				try {
					const numeric = toNumericModels(draft);
					if (numeric.error !== undefined) {
						setError(translate(numeric.error));
						return;
					}
					const result = await fetchJson("/api/usage-stats/pricing", { method: "POST", body: { mode: "custom", pricing: pricingWritePayload(current, currency, numeric.models) } });
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
			const rows = Object.entries(draft !== null ? draft : editableModels);
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
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("pricing.weekendRule", { date: current?.weekendOffPeakFrom ?? official?.weekendOffPeakFrom ?? "2026-08-23" }) }),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("pricing.providerScope") }),
					react_jsx_runtime.jsx("p", { className: S.note, children: translate("pricing.checkedAt", { time: checkedAtText }) }),
					staleDays > 30 && react_jsx_runtime.jsx("p", { className: S.hint, children: translate("pricing.stale", { days: staleDays }) }),
					error !== null && react_jsx_runtime.jsx("div", { className: S.error, children: translate(errorKind === "fetch" ? "pricing.fetchError" : "pricing.saveError", { message: error }) }),
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
												const officialRow = officialModels[model];
												const officialValue = period === "offPeak" ? officialRow?.offPeak?.[field] : officialRow?.peak?.[field];
												const liveRow = liveModels[model];
												const liveValue = period === "offPeak" ? (liveRow?.offPeak?.[field] ?? officialValue) : (liveRow?.peak?.[field] ?? officialValue);
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
								disabled: saving || fetchingOfficial,
								onClick: handleSaveCustom,
								children: translate("pricing.saveCustom")
							}) : react_jsx_runtime.jsx("button", {
								type: "button",
								className: S.btn,
								disabled: saving || fetchingOfficial,
								onClick: handleFork,
								children: usingCustom ? translate("pricing.edit") : translate("pricing.fork")
							}),
							draft !== null ? react_jsx_runtime.jsx("button", {
								type: "button",
								className: `${S.btn} ${S.btnGhost}`,
								disabled: saving || fetchingOfficial,
								onClick: () => setDraft(null),
								children: translate("data.cancel")
							}) : react_jsx_runtime.jsx("button", {
								type: "button",
								className: `${S.btn} ${S.btnGhost}`,
								disabled: saving || fetchingOfficial || !usingCustom,
								onClick: handleRestore,
								children: translate("pricing.restore")
							}),
							react_jsx_runtime.jsx("button", {
								type: "button",
								className: `${S.btn} ${S.btnGhost}`,
								disabled: saving || fetchingOfficial,
								onClick: handleFetchOfficial,
								children: translate(fetchingOfficial ? "pricing.fetchingOfficial" : "pricing.fetchOfficial")
							})
						]
					}),
					officialPreview !== null && react_jsx_runtime.jsx(primitives.Modal, {
						open: true,
						onClose: () => setOfficialPreview(null),
						children: react_jsx_runtime.jsxs("div", {
							className: S.clearConfirm,
							"data-usage-official-pricing-preview": true,
							children: [
								react_jsx_runtime.jsx("h3", { className: S.cardTitle, children: translate("pricing.confirmOfficialTitle") }),
								react_jsx_runtime.jsx("p", { className: S.note, children: translate("pricing.confirmOfficialDesc", { time: officialPreview.checkedAt ? new Date(officialPreview.checkedAt).toLocaleString() : "—" }) }),
								react_jsx_runtime.jsx("div", {
									className: S.tableScroll,
									children: react_jsx_runtime.jsxs("table", {
										className: S.modelTable,
										children: [
											react_jsx_runtime.jsxs("thead", {
												children: [
													react_jsx_runtime.jsxs("tr", { children: [
														react_jsx_runtime.jsx("th", { rowSpan: 2, children: translate("usage.model") }),
														react_jsx_runtime.jsx("th", { className: S.thGroup, colSpan: 3, children: translate("pricing.offPeak") }),
														react_jsx_runtime.jsx("th", { className: S.thGroup, colSpan: 3, children: translate("pricing.peak") })
													] }),
													react_jsx_runtime.jsx("tr", { children: PERIODS.flatMap((period) => FIELDS.map((field) => react_jsx_runtime.jsx("th", { children: translate(field === "inputMiss" ? "pricing.colMiss" : field === "inputHit" ? "pricing.colHit" : "pricing.colOutput") }, `${period}-${field}`))) })
												]
											}),
											react_jsx_runtime.jsx("tbody", {
												children: Object.entries(modelRowsOf(officialPreview)).map(([model, row]) => react_jsx_runtime.jsxs("tr", {
													children: [
														react_jsx_runtime.jsx("td", { className: S.modelName, children: model }),
														...PERIODS.flatMap((period) => FIELDS.map((field) => react_jsx_runtime.jsx("td", { className: S.diffCell, children: String(row?.[period]?.[field] ?? "—") }, `${model}-${period}-${field}`)))
													]
												}, model))
											})
										]
									})
								}),
								react_jsx_runtime.jsx("a", { className: S.sourceLink, href: officialPreview.sourceUrl, target: "_blank", rel: "noopener noreferrer", children: translate("pricing.officialSource") }),
								react_jsx_runtime.jsxs("div", {
									className: S.btnRow,
									children: [
										react_jsx_runtime.jsx("button", { type: "button", className: `${S.btn} ${S.btnGhost}`, onClick: () => setOfficialPreview(null), children: translate("data.cancel") }),
										react_jsx_runtime.jsx("button", { type: "button", className: S.btn, onClick: handleConfirmOfficial, children: translate("pricing.confirmOfficial") })
									]
								})
							]
						})
					})
				]
			});
		}

		function isZaiProvider(providerId) {
			return providerId === "zai" || providerId === "zai-coding-cn";
		}

		function supportsPlanQuota(provider) {
			return Array.isArray(provider?.planQuota?.windows) && provider.planQuota.windows.length > 0;
		}

		/** Provider plan quota thresholds shown in the provider-scoped billing tab. */
		function PlanQuotaCard({ translate }) {
			const [policy, setPolicy] = react.useState(null);
			const [error, setError] = react.useState(null);
			const planQuotaRef = react.useRef(null);
			const load = react.useCallback(() => {
				fetchJson("/api/usage-stats/alerts").then((payload) => {
					const nextPolicy = payload.notifications ?? {};
					planQuotaRef.current = nextPolicy.planQuota ?? null;
					setPolicy(nextPolicy);
				}).catch(() => {});
			}, []);
			react.useEffect(() => { load(); }, [load]);
			const planQuota = policy?.planQuota ?? { warningRemainingPercent: 30, criticalRemainingPercent: 10 };
			const quotaWindowsOf = (candidate) => ({
				five_hour: { warningRemainingPercent: candidate.windows?.five_hour?.warningRemainingPercent ?? candidate.warningRemainingPercent ?? 30, criticalRemainingPercent: candidate.windows?.five_hour?.criticalRemainingPercent ?? candidate.criticalRemainingPercent ?? 10 },
				weekly: { warningRemainingPercent: candidate.windows?.weekly?.warningRemainingPercent ?? candidate.warningRemainingPercent ?? 30, criticalRemainingPercent: candidate.windows?.weekly?.criticalRemainingPercent ?? candidate.criticalRemainingPercent ?? 10 }
			});
			const planQuotaWindows = quotaWindowsOf(planQuota);
			const publishPlanQuota = (nextPlanQuota) => {
				if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof window.CustomEvent !== "function") return;
				window.dispatchEvent(new window.CustomEvent("usage-stats:plan-quota-updated", { detail: { planQuota: nextPlanQuota } }));
			};
			const savePolicy = async (patch) => {
				setError(null);
				try {
					const updated = await fetchJson("/api/usage-stats/alerts", { method: "POST", body: { notifications: { ...(policy ?? {}), ...patch } } });
					if (updated.ok !== true) throw new Error(updated.message ?? "save failed");
					planQuotaRef.current = updated.notifications?.planQuota ?? planQuotaRef.current;
					if (planQuotaRef.current !== null) publishPlanQuota(planQuotaRef.current);
					setPolicy(updated.notifications);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const savePlanQuotaThreshold = (windowKind, field, rawValue) => {
				const value = Math.max(0, Math.min(100, Math.round(Number(rawValue) || 0)));
				const basePlanQuota = planQuotaRef.current ?? planQuota;
				const baseWindows = quotaWindowsOf(basePlanQuota);
				const next = { ...baseWindows[windowKind], [field]: value };
				if (field === "warningRemainingPercent" && next.criticalRemainingPercent > value) next.criticalRemainingPercent = value;
				if (field === "criticalRemainingPercent" && value > next.warningRemainingPercent) next.warningRemainingPercent = value;
				const nextPlanQuota = { ...basePlanQuota, windows: { ...baseWindows, [windowKind]: next } };
				planQuotaRef.current = nextPlanQuota;
				savePolicy({ planQuota: nextPlanQuota });
			};
			const updatePlanQuotaLocal = (windowKind, field, rawValue) => {
				const value = Math.max(0, Math.min(100, Math.round(Number(rawValue) || 0)));
				const basePlanQuota = planQuotaRef.current ?? planQuota;
				const baseWindows = quotaWindowsOf(basePlanQuota);
				const next = { ...baseWindows[windowKind], [field]: value };
				if (field === "warningRemainingPercent" && next.criticalRemainingPercent > value) next.criticalRemainingPercent = value;
				if (field === "criticalRemainingPercent" && value > next.warningRemainingPercent) next.warningRemainingPercent = value;
				const nextPlanQuota = { ...basePlanQuota, windows: { ...baseWindows, [windowKind]: next } };
				planQuotaRef.current = nextPlanQuota;
				publishPlanQuota(nextPlanQuota);
				setPolicy((current) => ({ ...(current ?? {}), planQuota: nextPlanQuota }));
			};
			const renderPlanQuotaWindow = (windowKind, labelKey) => {
				const thresholds = planQuotaWindows[windowKind];
				const criticalPercent = Number(thresholds.criticalRemainingPercent) || 0;
				const warningPercent = Math.max(criticalPercent, Number(thresholds.warningRemainingPercent) || 0);
				return react_jsx_runtime.jsxs("div", {
					className: S.limitField,
					"data-usage-plan-quota-window": windowKind,
					children: [
						react_jsx_runtime.jsx("div", { className: S.limitFieldLabel, children: translate(labelKey) }),
						react_jsx_runtime.jsxs("div", {
							className: S.alertCard,
							children: [
								react_jsx_runtime.jsxs("div", { className: S.alertHead, children: [
									react_jsx_runtime.jsx("span", { children: translate("limits.planQuotaRange") }),
									react_jsx_runtime.jsx("span", { className: S.alertValue, children: `${warningPercent}% / ${criticalPercent}%` })
							] }),
								react_jsx_runtime.jsxs("div", {
									className: S.alertTrack,
									style: { "--alert-percent": `${criticalPercent}%`, "--critical-percent": `${warningPercent}%` },
									children: [
										react_jsx_runtime.jsx("input", {
										type: "range", min: 0, max: 99, value: criticalPercent, className: S.alertRange,
										onChange: (event) => updatePlanQuotaLocal(windowKind, "criticalRemainingPercent", event.target.value),
										onPointerUp: (event) => savePlanQuotaThreshold(windowKind, "criticalRemainingPercent", event.currentTarget.value),
										onKeyUp: (event) => savePlanQuotaThreshold(windowKind, "criticalRemainingPercent", event.currentTarget.value)
									}),
									react_jsx_runtime.jsx("input", {
										type: "range", min: 1, max: 100, value: warningPercent, className: `${S.alertRange} is-overlay`,
										onChange: (event) => updatePlanQuotaLocal(windowKind, "warningRemainingPercent", event.target.value),
										onPointerUp: (event) => savePlanQuotaThreshold(windowKind, "warningRemainingPercent", event.currentTarget.value),
										onKeyUp: (event) => savePlanQuotaThreshold(windowKind, "warningRemainingPercent", event.currentTarget.value)
									})
									]
								}),
								react_jsx_runtime.jsxs("div", { className: S.alertLegend, children: [
									react_jsx_runtime.jsx("span", { children: translate("limits.planQuotaCriticalLegend", { percent: criticalPercent }) }),
									react_jsx_runtime.jsx("span", { children: translate("limits.planQuotaWarningLegend", { critical: criticalPercent, warning: warningPercent }) }),
									react_jsx_runtime.jsx("span", { children: translate("limits.planQuotaNormalLegend", { percent: warningPercent }) })
							] })
							]
						})
					]
				}, windowKind);
			};
			return react_jsx_runtime.jsxs("div", {
				className: S.toggleGrid,
				"data-usage-plan-quota-settings": true,
				children: [
					error !== null ? react_jsx_runtime.jsx("div", { className: S.error, children: translate("notifications.saveError", { message: error }) }) : null,
						react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("limits.planQuotaTitle") }),
						react_jsx_runtime.jsx("p", { className: S.note, children: translate("limits.planQuotaDesc") }),
						renderPlanQuotaWindow("five_hour", "limits.planQuotaFiveHour"),
						renderPlanQuotaWindow("weekly", "limits.planQuotaWeekly")
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
							react_jsx_runtime.jsx("p", { className: S.note, children: translate("notifications.channelsDesc") }),
							[["sidebar", "notifications.channelSidebar"], ["toast", "notifications.channelToast"]].map(([field, labelKey]) => react_jsx_runtime.jsxs("div", {
								className: S.toggleRow,
								children: [
									react_jsx_runtime.jsxs("div", { className: S.toggleInfo, children: [
									react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate(labelKey) }),
									react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate(`${labelKey}Desc`) })
								] }),
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
							react_jsx_runtime.jsx("p", { className: S.note, children: translate("notifications.eventsDesc") }),
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
							react_jsx_runtime.jsxs("div", { className: S.toggleInfo, children: [
								react_jsx_runtime.jsx("span", { className: S.rowLabel, children: translate("notifications.cooldown") }),
								react_jsx_runtime.jsx("span", { className: S.toggleDesc, children: translate("notifications.cooldownDesc") })
							] }),
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
							react_jsx_runtime.jsx("p", { className: S.note, children: translate("notifications.historyDesc") }),
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

		/** Normalize the editable detailed-ledger limit, or reject it. */
		function normalizeLedgerCapacity(value) {
			if (value === "" || value === null || value === void 0) return null;
			const numeric = Number(value);
			return Number.isSafeInteger(numeric) && numeric >= 100 && numeric <= 5000 ? numeric : null;
		}

		/** Settings tab: data overview, retention trim and guarded history clear. */
		function DataCard({ translate }) {
			const [info, setInfo] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [retention, setRetention] = react.useState("");
			const [ledgerCapacity, setLedgerCapacity] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [result, setResult] = react.useState(null);
			const [confirmOpen, setConfirmOpen] = react.useState(false);
			const [confirmText, setConfirmText] = react.useState("");
			const confirmWord = translate("data.clearConfirmWord");
			const load = react.useCallback(() => {
				fetchJson("/api/usage-stats/data").then((payload) => {
					const next = payload.info ?? null;
					setInfo(next);
					if (next?.ledgerCapacity !== void 0) setLedgerCapacity(String(next.ledgerCapacity));
				}).catch(() => {});
			}, []);
			react.useEffect(() => { load(); }, [load]);
			const run = async (action, extra = {}) => {
				setBusy(true);
				setError(null);
				try {
					const payload = await fetchJson("/api/usage-stats/data", { method: "POST", body: { action, ...extra } });
					if (payload.ok !== true) throw new Error(payload.message ?? "action failed");
					setResult(action === "clear" ? "data.cleared" : "data.trimmed");
					await load();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			};
			const saveLedgerCapacity = async () => {
				const value = normalizeLedgerCapacity(ledgerCapacity);
				if (value === null) {
					setError(translate("data.capacityInvalid"));
					return;
				}
				setBusy(true);
				setError(null);
				try {
					const payload = await fetchJson("/api/usage-stats/accounts", { method: "POST", body: { maxLedgerEntries: value } });
					if (payload.ok !== true) throw new Error(payload.message ?? "save failed");
					setResult("data.capacitySaved");
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
							react_jsx_runtime.jsxs("div", {
								className: S.dataStatMetrics,
								"data-usage-data-metrics": true,
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
									] })
								]
							}),
							react_jsx_runtime.jsxs("div", {
								className: S.dataStatRange,
								"data-usage-data-range": true,
								children: [
									react_jsx_runtime.jsx("span", { className: S.dataStatLabel, children: translate("data.dateRange") }),
									react_jsx_runtime.jsx("span", { className: S.dataStatRangeValue, title: dateRangeText, children: dateRangeText })
								]
							})
						]
					}),
					info?.hasEstimatedHistory === true && react_jsx_runtime.jsx("p", { className: S.hint, children: translate("data.legacyEstimated") }),
					react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("data.retentionGroup") }),
					react_jsx_runtime.jsxs("div", {
						className: S.dataActionPanel,
						"data-usage-ledger-capacity-control": true,
						children: [
							react_jsx_runtime.jsxs("div", { className: S.dataActionInfo, children: [
								react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate("data.capacityTitle") }),
								react_jsx_runtime.jsx("p", { className: S.note, children: translate("data.capacityNote") })
							] }),
							react_jsx_runtime.jsxs("div", { className: S.dataActionControls, children: [
								react_jsx_runtime.jsx("input", {
									type: "number",
									inputMode: "numeric",
									min: 100,
									max: 5000,
									step: 100,
									className: `${S.input} ${S.dataRetentionInput}`,
									placeholder: translate("data.capacityPlaceholder"),
									value: ledgerCapacity,
									onChange: (event) => setLedgerCapacity(event.target.value)
								}),
								react_jsx_runtime.jsx("button", {
									type: "button",
									className: S.btn,
									disabled: busy || normalizeLedgerCapacity(ledgerCapacity) === null,
									onClick: saveLedgerCapacity,
									children: translate("data.capacitySave")
								})
							] })
						]
					}),
					react_jsx_runtime.jsxs("div", {
						className: S.dataActionPanel,
						"data-usage-retention-panel": true,
						children: [
							react_jsx_runtime.jsxs("div", { className: S.dataActionInfo, children: [
								react_jsx_runtime.jsx("span", { className: S.toggleTitle, children: translate("data.retention") }),
								react_jsx_runtime.jsx("p", { className: S.note, children: translate("data.retentionNote") })
							] }),
							react_jsx_runtime.jsxs("div", { className: S.dataActionControls, children: [
								react_jsx_runtime.jsx("input", {
									type: "text",
									inputMode: "numeric",
									className: `${S.input} ${S.dataRetentionInput}`,
									placeholder: translate("data.retentionPlaceholder"),
									value: retention,
									onChange: (event) => setRetention(event.target.value)
								}),
								react_jsx_runtime.jsx("button", {
									type: "button",
									className: S.btn,
									disabled: busy || !Number.isFinite(Number(retention)) || Number(retention) <= 0,
									onClick: () => run("trim", { retentionDays: Number(retention) }),
									children: translate("data.trim")
								})
							] })
						]
					}),
					react_jsx_runtime.jsx("h4", { className: S.limitSub, children: translate("data.dangerGroup") }),
					react_jsx_runtime.jsxs("div", {
						className: S.dataDangerPanel,
						"data-usage-danger-panel": true,
						children: [
							react_jsx_runtime.jsx("p", { className: S.note, children: translate("data.clearConfirmDesc") }),
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
								run("clear", { confirmation: confirmText.trim() });
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


		const SETTINGS_TABS = [
			{ id: "accounts", label: "settings.tabAccounts" },
			{ id: "limits", label: "settings.tabLimits" },
			{ id: "notifications", label: "settings.tabNotifications" },
			{ id: "data", label: "settings.tabData" }
		];
		function UsageBillingSettingsSection({ t }) {
			const translate = (key, params) => interpolate(t !== void 0 ? t(key) : key, params);
			const [keys, setKeys] = react.useState([]);
			const [providers, setProviders] = react.useState([]);
			const [defaultProviderId, setDefaultProviderId] = react.useState("deepseek-official");
			const [selectedKey, setSelectedKey] = react.useState(null);
			const [pricing, setPricing] = react.useState({ currency: "CNY", peakHours: [[9, 12], [14, 18]], peakMultiplier: 2, weekendOffPeakFrom: "2026-08-23" });
			const [todayCost, setTodayCost] = react.useState(0);
			const [serverToday, setServerToday] = react.useState(null);
			const [loaded, setLoaded] = react.useState(false);
			const [error, setError] = react.useState(null);
			const [activeTab, setActiveTab] = react.useState("accounts");
			const effectiveBillingProviderId = providers.some((provider) => provider.id === defaultProviderId)
				? defaultProviderId
				: providers[0]?.id ?? "deepseek-official";
			const selectedBillingProvider = providers.find((provider) => provider.id === effectiveBillingProviderId) ?? null;
			const billingProviderKind = usageKindOf(selectedBillingProvider, null);
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
						setLoaded(true);
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
						setLoaded(true);
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
			const loadProviders = react.useCallback(() => {
				return fetchJson("/api/usage-stats/providers").then((payload) => {
					const list = normalizeProviders(payload);
					if (payload.ok !== true || list.length === 0) throw new Error("provider endpoint unavailable");
					setProviders(list);
					const preferredProviderId = String(payload.defaultProviderId ?? "deepseek-official");
					setDefaultProviderId(preferredProviderId);
				}).catch(() => fetchJson("/api/usage-stats/keys").then((payload) => {
					const list = payload.ok === true && Array.isArray(payload.keys) ? payload.keys : [];
					setProviders([legacyDeepseekProvider(list)]);
					setDefaultProviderId("deepseek-official");
				}).catch(() => {}));
			}, []);

			const loadAccountSettings = react.useCallback(() => {
				fetchJson("/api/usage-stats/accounts").then((payload) => {
				if (!mountedRef.current) return;
				if (payload.ok !== true) return;
				if (payload.defaultProviderId !== undefined || payload.settings?.defaultProviderId !== undefined) setDefaultProviderId(String(payload.defaultProviderId ?? payload.settings.defaultProviderId));
			}).catch(() => {});
			}, []);

				react.useEffect(() => {
				mountedRef.current = true;
				loadUsage();
				loadKeys();
				loadProviders();
				loadAccountSettings();
				const usageTimer = window.setInterval(loadUsage, 60000);
				return () => {
					mountedRef.current = false;
					window.clearInterval(usageTimer);
				};
			}, [loadUsage, loadKeys, loadProviders, loadAccountSettings]);

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
					activeTab === "accounts" ? react_jsx_runtime.jsx(AccountsCard, { keys, providers, defaultProviderId, onDefaultProviderUpdated: setDefaultProviderId, translate })
						: activeTab === "limits" ? (loaded === false ? react_jsx_runtime.jsx("p", { className: S.note, children: translate("usage.loading") }) : react_jsx_runtime.jsxs("div", {
							className: S.section,
							"data-usage-provider-billing-settings": true,
							children: [react_jsx_runtime.jsx(LimitsCard, {
							keys,
							selectedKey,
							onSelectKey: setSelectedKey,
							pricing,
							todayCost,
							providers,
							providerId: effectiveBillingProviderId,
							providerKind: billingProviderKind,
							translate,
							onLimitsUpdated: () => loadUsage()
						}), effectiveBillingProviderId === "deepseek-official" && billingProviderKind === "balance"
							? react_jsx_runtime.jsx(PricingCard, { translate, onPricingUpdated: () => loadUsage() })
							: null]
						}))
						: activeTab === "notifications" ? react_jsx_runtime.jsx(NotificationsCard, { translate })
						: react_jsx_runtime.jsx(DataCard, { translate })
				]
			});
		}
		//#endregion
		function mutationNodeMatches(node, selector) {
			return node?.nodeType === 1 && (node.matches?.(selector) === true || node.querySelector?.(selector) !== null);
		}

		function settingsNavMutationRelevant(records) {
			return (records ?? []).some((record) => record?.type === "childList"
				&& [...(record.addedNodes ?? []), ...(record.removedNodes ?? [])].some((node) => mutationNodeMatches(node, "button,a,[role=button], [data-usage-stats-trigger]")));
		}

		/** Sidebar summary poll cadence: 60s while the panel is open, 5min while closed. */
		const SIDEBAR_POLL_MS_OPEN = 60000;
		const SIDEBAR_POLL_MS_CLOSED = 300000;
		/** Total page Toast lifetime: 4s at full opacity + 1s fade-out. */
		const USAGE_TOAST_TOTAL_MS = 5000;

		function freshAlertsForProvider(alerts, events, currentProviderId, seen, sessionStartedAt, translate) {
			const fresh = [];
			for (const item of alerts) {
				if (item.type !== "alert" && item.type !== "recovery") continue;
				const event = item.event ?? (item.type === "recovery" ? "recovery" : "warning");
				if (events[event] === false) continue;
				const providerIds = Array.isArray(item.providerIds) && item.providerIds.length > 0
					? item.providerIds
					: [item.providerId ?? "deepseek-official"];
				if (!providerIds.includes(currentProviderId)) continue;
				const key = `${providerIds.slice().sort().join(",")}:${item.at ?? 0}:${item.type}:${item.keyRef ?? ""}:${item.status ?? ""}`;
				if (seen.has(key)) continue;
				seen.add(key);
				const itemAt = Number(item.at);
				if (!Number.isFinite(itemAt) || itemAt < sessionStartedAt) continue;
				fresh.push({
					key,
					tone: item.type,
					text: item.message || (item.type === "recovery" ? translate("notifications.type.recovery") : translate("notifications.type.alert"))
				});
			}
			return fresh;
		}

		/**
		 * Plugin-owned alert Toast. The host primitive currently hard-codes a
		 * 3s hold + 1s fade and does not accept a duration prop, so the usage
		 * alert channel owns this small wrapper to provide the requested 5s life.
		 */
		function UsageAlertToast({ text, icon, onDone }) {
			const onDoneRef = react.useRef(onDone);
			onDoneRef.current = onDone;
			react.useEffect(() => {
				const timer = window.setTimeout(() => onDoneRef.current(), USAGE_TOAST_TOTAL_MS);
				return () => window.clearTimeout(timer);
			}, []);
			return react_dom.createPortal(react_jsx_runtime.jsxs("div", {
				className: S.toast,
				role: "alert",
				children: [
					icon !== undefined ? react_jsx_runtime.jsx("span", { className: S.toastIcon, "aria-hidden": true, children: icon }) : null,
					react_jsx_runtime.jsx("span", { className: S.toastText, children: text })
				]
			}), document.body);
		}

		//#region sidebar panel
		/** Native Harness sidebar action that owns the floating usage panel. */
		function UsageStatsPanel({ wide, t }) {
			const [open, setOpen] = react.useState(false);
			const [panelLeft, setPanelLeft] = react.useState(12);
			const [summary, setSummary] = react.useState({ balance: "—", today: "—", todayTokens: null, status: "muted", balanceStatus: "muted", todayStatus: "muted" });
			const [display, setDisplay] = react.useState({ balance: true, todayCost: true, statusDot: true });
			const [notifications, setNotifications] = react.useState({ channels: { sidebar: true, toast: false }, events: {}, planQuota: { warningRemainingPercent: 30, criticalRemainingPercent: 10, windows: { five_hour: { warningRemainingPercent: 30, criticalRemainingPercent: 10 }, weekly: { warningRemainingPercent: 30, criticalRemainingPercent: 10 } } } });
			const [toasts, setToasts] = react.useState([]);
			const notifiedAlertsRef = react.useRef(new Set());
			const notificationSessionStartedAtRef = react.useRef(Date.now());
			const notificationProviderRef = react.useRef(null);
			const layerRef = react.useRef(null);
			const summaryRequestRef = react.useRef(0);
			// 把服务端下发的告警按「通知与提示」策略投递为页面内 Toast：
			// 页面会话开始前的历史只标记为已读，当前会话内跨轮询去重；
			// 通道/事件/冷却已在服务端过滤；这里再按当前默认展示供应商筛选。
			const deliverAlerts = react.useCallback((payload, providerId = "deepseek-official") => {
				if (payload === null || payload === undefined || payload.ok !== true) return;
				const currentProviderId = typeof providerId === "string" && providerId !== "" ? providerId : "deepseek-official";
				if (notificationProviderRef.current !== null && notificationProviderRef.current !== currentProviderId) setToasts([]);
				notificationProviderRef.current = currentProviderId;
				const policy = payload.notifications || {};
				setNotifications(policy);
				if (policy.channels?.toast !== true) return;
				const sessionStartedAt = notificationSessionStartedAtRef.current;
				const fresh = freshAlertsForProvider(
					Array.isArray(payload.alerts) ? payload.alerts : [],
					policy.events || {},
					currentProviderId,
					notifiedAlertsRef.current,
					sessionStartedAt,
					t
				);
				if (fresh.length > 0) setToasts((prev) => [...prev, ...fresh].slice(-3));
			}, [t]);

			const loadSummary = react.useCallback(() => {
				const request = ++summaryRequestRef.current;
				Promise.allSettled([
					fetchJson("/api/usage-stats/limits"),
					fetchJson("/api/usage-stats/accounts"),
					fetchJson("/api/usage-stats/alerts")
				]).then(([limitsResult, accountsResult, alertsResult]) => {
					if (summaryRequestRef.current !== request) return;
					const accountsPayload = accountsResult.status === "fulfilled" && accountsResult.value?.ok === true ? accountsResult.value : null;
					const providerId = accountsPayload?.defaultProviderId ?? accountsPayload?.settings?.defaultProviderId ?? "deepseek-official";
					const provider = normalizeProviders(accountsPayload).find((entry) => entry.id === providerId) ?? null;
					const providerQuery = providerId ? `?provider=${encodeURIComponent(providerId)}` : "";
					if (accountsResult.status === "fulfilled" && accountsResult.value?.ok === true) {
						setDisplay(accountsResult.value.settings?.display || { balance: true, todayCost: true, statusDot: true });
					}
					if (alertsResult.status === "fulfilled") deliverAlerts(alertsResult.value, providerId);
					return Promise.allSettled([
						fetchJson(`/api/usage-stats/usage${providerQuery}`),
						fetchJson(`/api/usage-stats/balance${providerQuery}`)
					]).then(([usageResult, balanceResult]) => {
						if (summaryRequestRef.current !== request) return;
						const usagePayload = usageResult.status === "fulfilled" ? filterUsageByProvider(usageResult.value, providerId) : null;
						setSummary(sidebarSummaryOf(
							usagePayload,
							balanceResult.status === "fulfilled" ? balanceResult.value : null,
								limitsResult.status === "fulfilled" ? limitsResult.value : null,
								undefined,
								providerId,
								provider?.label ?? providerId,
								provider
							));
					});
				});
			}, [deliverAlerts]);
			const showBalance = display.balance !== false;
			const showToday = display.todayCost !== false;
			// 侧栏状态点同时受「供应商与账户」展示开关和「通知与提示」侧栏通道控制。
			const showStatusDot = display.statusDot !== false && notifications.channels?.sidebar !== false;
			const windowLabel = summary.primaryWindowKind === "five_hour" ? t("balance.windowFiveHour") : summary.primaryWindowKind === "weekly" ? t("balance.windowWeekly") : summary.primaryWindowKind === "monthly" ? t("balance.windowMonthly") : t("balance.plan");
			const rawPlanWindows = (summary.planWindows ?? []).length > 0
				? summary.planWindows
				: summary.primaryWindowKind ? [{ kind: summary.primaryWindowKind, percent: summary.primaryWindowPercent }] : [];
			const planWindowItems = rawPlanWindows.map((item) => {
				const label = item.kind === "five_hour" ? t("balance.windowFiveHour") : item.kind === "weekly" ? t("balance.windowWeekly") : item.kind === "monthly" ? t("balance.windowMonthly") : t("balance.plan");
				return { ...item, label, text: `${label} ${item.percent === null ? "—" : `${item.percent.toFixed(0)}%`}`, tone: planQuotaToneOf(item.percent, notifications.planQuota, item.kind) };
			});
			const planWindowText = planWindowItems.map((item) => item.text).join(" · ");
			const planAccountStatusSummary = summary.accountStatus === "not-subscribed" ? t("balance.status.subscriptionRequired")
				: summary.accountStatus === "not-configured" ? t("balance.status.notConfigured")
					: summary.accountStatus === "unauthorized" ? t("balance.status.unauthorized")
						: summary.accountStatus === "rate-limited" ? t("balance.status.rateLimited")
							: summary.accountStatus === "unavailable" ? t("balance.status.unavailable")
								: summary.accountStatus === "unsupported" ? t("balance.status.unsupported")
									: null;
			const primarySummary = summary.kind === "plan_quota"
				? planAccountStatusSummary ?? (planWindowText || `${windowLabel}${summary.primaryWindowPercent === null ? "" : ` ${summary.primaryWindowPercent.toFixed(0)}%`}`)
				: summary.kind === "local_usage"
					? `${t("usage.input")} ${fmtSidebarTokens(summary.todayInputTokens ?? 0)} · ${t("usage.output")} ${fmtSidebarTokens(summary.todayOutputTokens ?? 0)}`
					: `${summary.balance}`;
			const primarySummaryNode = summary.kind === "plan_quota" && planWindowItems.length > 0
				? planWindowItems.map((item, index) => react_jsx_runtime.jsxs(react.Fragment, { children: [
					index > 0 ? react_jsx_runtime.jsx("span", { className: S.planWindowSeparator, children: "·" }) : null,
					react_jsx_runtime.jsxs("span", {
						className: S.planWindowItem,
						children: [
							react_jsx_runtime.jsx("span", {
								className: S.planWindowDotSlot,
								children: showStatusDot ? react_jsx_runtime.jsx("span", { className: S.statusDot, "data-tone": item.tone, "data-usage-plan-status-dot": true }) : null
							}),
							item.text
						]
					}, item.kind)
				] }, item.kind))
				: summary.kind === "local_usage"
					? react_jsx_runtime.jsxs(react.Fragment, { children: [
						t("usage.input"), " ", react_jsx_runtime.jsx(AnimatedNumber, { value: summary.todayInputTokens ?? 0, format: fmtSidebarTokens }),
						" · ", t("usage.output"), " ", react_jsx_runtime.jsx(AnimatedNumber, { value: summary.todayOutputTokens ?? 0, format: fmtSidebarTokens })
					] })
					: summary.balanceValue !== null && summary.balanceValue !== void 0
						? react_jsx_runtime.jsx(AnimatedNumber, { value: summary.balanceValue, format: (value) => fmtCurrency(value, summary.balanceCurrency) })
						: primarySummary;
			const todaySummaryNode = summary.todayValue !== null && summary.todayValue !== void 0
				? react_jsx_runtime.jsxs(react.Fragment, { children: [
					t("panel.today"), " ", react_jsx_runtime.jsx(AnimatedNumber, { value: summary.todayValue, format: (value) => `${currencySymbol(summary.todayCurrency)}${fmtMoney(value)}` })
				] })
				: `${t("panel.today")} ${summary.today}`;
			const showTodaySummary = showToday && summary.todayAvailable === true;
			const summaryText = [
				showBalance ? primarySummary : null,
				showTodaySummary ? `${t("panel.today")} ${summary.today}` : null
			].filter((part) => part !== null).join(" · ");

			react.useEffect(() => {
				loadSummary();
				// Open panel: refresh every 60s; closed: back off to every 5min so an
				// idle sidebar never hammers the loopback endpoints.
				const pollMs = open ? SIDEBAR_POLL_MS_OPEN : SIDEBAR_POLL_MS_CLOSED;
				const timer = window.setInterval(loadSummary, pollMs);
				const onLimitsUpdated = () => loadSummary();
				const onAccountsUpdated = () => loadSummary();
				const onPlanQuotaUpdated = (event) => {
					const nextPlanQuota = event.detail?.planQuota;
					if (nextPlanQuota === null || typeof nextPlanQuota !== "object") return;
					setNotifications((current) => ({ ...current, planQuota: nextPlanQuota }));
				};
				window.addEventListener("usage-stats:limits-updated", onLimitsUpdated);
				window.addEventListener("usage-stats:accounts-updated", onAccountsUpdated);
				window.addEventListener("usage-stats:plan-quota-updated", onPlanQuotaUpdated);
				return () => {
					window.clearInterval(timer);
					window.removeEventListener("usage-stats:limits-updated", onLimitsUpdated);
					window.removeEventListener("usage-stats:accounts-updated", onAccountsUpdated);
					window.removeEventListener("usage-stats:plan-quota-updated", onPlanQuotaUpdated);
					summaryRequestRef.current += 1;
				};
			}, [loadSummary, open]);
			react.useEffect(() => {
				if (!open) return void 0;
				const updatePosition = () => {
					const right = layerRef.current?.getBoundingClientRect?.().right;
					if (!Number.isFinite(right)) return;
					// Match the 920px workbench shell and keep the same responsive
					// viewport gutter as its CSS max-width.
					const panelGutter = window.innerWidth <= 560 ? 12 : 24;
					const panelWidth = Math.min(920, window.innerWidth - panelGutter * 2);
					const maxPanelLeft = Math.max(0, window.innerWidth - panelWidth - panelGutter);
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
							onClick: () => setOpen((value) => !value),
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
											primarySummaryNode
										] }) : null,
										showBalance && showTodaySummary ? " · " : null,
										showTodaySummary ? react_jsx_runtime.jsxs("span", { className: S.statusItem, children: [
											showStatusDot && summary.todayStatus !== "muted" ? react_jsx_runtime.jsx("span", { className: S.statusDot, "data-tone": summary.todayStatus }) : null,
											todaySummaryNode
										] }) : null
								]
								})
									]
								})
							]
						})
					}),
					// 页面内 Toast（通知通道）：历史告警在本次页面会话开始前已由
					// deliverAlerts 标记为已读；新告警使用固定 5 秒生命周期。
					toasts.map((toast) => react_jsx_runtime.jsx(UsageAlertToast, {
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
			"panel.balance": "余额",
			"panel.today": "今日",
			"panel.summary": "余额 {balance} · 今日 {today}",
			"panel.updatedAt": "更新于 {time}",
			"panel.gotoSettings": "前往设置",
			"panel.tabs": "查询标签",
			"panel.tabSummary": "全部",
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
			"balance.providerSuffix": "账户余额",
			"balance.planSuffix": "套餐用量",
			"balance.localSuffix": "本地用量",
			"balance.plan": "Token Plan",
			"balance.local": "本地统计",
			"balance.localOnly": "仅统计本地 Token 用量",
			"balance.reset": "重置：",
			"balance.resetSoon": "即将重置",
			"balance.resetNotStarted": "尚未开始",
			"duration.day": "{value}天",
			"duration.hour": "{value}小时",
			"duration.minute": "{value}分钟",
			"balance.status.local": "本地统计",
			"balance.status.unsupported": "暂不支持查询",
			"balance.provider": "供应商",
			"balance.windowFiveHour": "5 小时",
			"balance.windowWeekly": "每周",
			"balance.windowMonthly": "每月窗口",
			"balance.remaining": "剩余",
			"balance.apiKey": "API Key",
			"balance.unconfigured": "未配置",
			"balance.toppedUp": "充值余额",
			"balance.granted": "赠送余额",
			"balance.keyLimit": "普通 Key 额度",
			"balance.managementKeyMissing": "未配置 Management Key，仅显示普通 Key 额度",
			"balance.managementKeyUnavailable": "Management Credits 暂不可用",
			"balance.error": "余额获取失败：{message}",
			"balance.status.loading": "查询中",
			"balance.status.empty": "暂无数据",
			"balance.status.ok": "实时",
			"balance.status.notConfigured": "未配置",
			"balance.status.subscriptionRequired": "需要 OpenCode Go 订阅",
			"balance.status.unauthorized": "密钥无效",
			"balance.status.rateLimited": "请求受限",
			"balance.status.unavailable": "暂不可用",
			"balance.status.error": "获取失败",
			"usage.model": "模型",
			"usage.allModels": "全部模型",
			"usage.modelUsage": "模型用量",
			"usage.noModelUsage": "当天暂无模型用量",
			"usage.requestCount": "请求次数",
			"usage.activityToday": "今日 Token",
			"usage.tokenUnit": "tokens",
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
			"usage.legacyEstimated": "含迁移或恢复的历史估算区间（费用按当前价格估算）",
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
			"chart.peakNote": "工作日高峰：北京时间 09-12 / 14-18，费用×2",
			"chart.weekendOffPeakNote": "周末全天按低谷价",
			"limits.title": "用量提醒与限额设置",
			"limits.dailyLimitStatus": "今日消费限额",
			"limits.dailySpendProgress": "今日消费进度",
			"limits.provider": "供应商",
			"limits.currentProvider": "当前供应商",
			"limits.providerScoped": "金额限额仅适用于 DeepSeek 官方余额；当前供应商请查看套餐窗口或本地 Token 用量。",
			"limits.providerSwitchDesc": "这里跟随“供应商与账户”中的默认展示供应商，不会修改模型调用路由。",
			"limits.planQuotaTitle": "套餐额度预警",
			"limits.planQuotaDesc": "仅为当前供应商支持的套餐窗口设置剩余比例颜色，不会修改真实套餐额度；默认剩余 ≤10% 为严重、10%–30% 为预警、>30% 为正常，可分别调整。",
			"limits.planQuotaFiveHour": "5 小时",
			"limits.planQuotaWeekly": "每周",
			"limits.planQuotaRange": "预警比例",
			"limits.planQuotaCriticalLegend": "严重 ≤ {percent}%",
			"limits.planQuotaWarningLegend": "预警 {critical}%–{warning}%",
			"limits.planQuotaNormalLegend": "正常 ≥ {percent}%",
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
			"settings.desc": "在这里选择用量展示供应商，并配置该供应商的计费估算、限额、余额或套餐阈值；公共通知通道和事件在“通知与提示”中配置。余额、套餐额度与图表请在侧栏“用量/余额”查询；这里不会更改模型设置中的调用供应商或真实套餐。",
			"settings.tabAccounts": "供应商与账户",
			"settings.tabLimits": "供应商用量与计费",
			"settings.tabPricing": "价格设置",
			"settings.tabNotifications": "通知与提示",
			"settings.tabData": "数据管理",
			"accounts.title": "供应商与账户",
			"accounts.desc": "只显示模型设置中已添加的供应商。默认展示供应商会同步用于侧栏、查询浮层和本页供应商专属配置。",
			"accounts.defaultProvider": "默认展示供应商",
			"accounts.defaultProviderDesc": "切换后，侧栏、用量浮层和“供应商用量与计费”会显示对应供应商；不会改变模型调用所使用的供应商。",
			"accounts.visibleProviders": "账户概览显示",
			"accounts.visibleProvidersSummary": "账户概览显示（{count}/3）",
			"accounts.visibleProvidersDesc": "最多选择 3 个供应商；其他供应商不会在下面的账户概览中展开。默认供应商始终显示。",
			"accounts.defaultAlwaysVisible": "默认供应商，始终显示",
			"accounts.extraCredentials": "额外查询凭据",
			"accounts.extraCredentialsDesc": "仅在当前供应商的官方查询接口需要额外凭据时显示；密钥通过 Harness 凭据服务只写保存，不会回显。",
			"accounts.managementApiKey": "Management API Key",
			"accounts.credentialConfigured": "已配置；留空不会覆盖",
			"accounts.credentialMissing": "未配置",
			"accounts.credentialPlaceholder": "输入新的凭据",
			"accounts.credentialSave": "保存",
			"accounts.credentialSaving": "保存中…",
			"accounts.openWebQuery": "打开官网查询",
			"accounts.accountSnapshotDesc": "余额和套餐额度来自供应商官方接口；需要网页登录的供应商不会读取 Cookie 或登录态，只提供官网查询入口。",
			"accounts.commonGroup": "通用显示与刷新",
			"accounts.today": "今日消费",
			"accounts.unsupported": "暂不支持",
			"accounts.default": "默认",
			"accounts.defaultAccount": "默认账户",
			"accounts.refreshCadence": "账户数据刷新周期",
			"accounts.refreshOff": "关闭",
			"accounts.refresh1min": "1 分钟",
			"accounts.refresh5min": "5 分钟",
			"accounts.refresh15min": "15 分钟",
			"accounts.refresh30min": "30 分钟",
			"accounts.showBalance": "侧栏显示供应商摘要",
			"accounts.showBalanceDesc": "只控制侧栏底部摘要，不影响查询浮层和本地用量采集。",
			"accounts.showToday": "侧栏显示今日消费（仅余额型）",
			"accounts.showTodayDesc": "仅对余额型且支持本地计费的供应商显示今日消费。",
			"accounts.showStatus": "侧栏显示预警圆点",
			"accounts.showStatusDesc": "只控制侧栏摘要中的状态圆点；告警判断和通知通道仍按“通知与提示”设置执行。",
			"accounts.refreshDesc": "定时刷新可查询供应商的远程余额或套餐快照；关闭后仍可手动刷新。",
			"accounts.refreshNow": "立即刷新账户数据",
			"accounts.refreshing": "刷新中…",
			"accounts.saveError": "保存失败：{message}",
			"pricing.title": "价格设置",
			"pricing.official": "官方",
			"pricing.custom": "自定义",
			"pricing.basis": "价格单位：{currency} / 1M tokens",
			"pricing.weekendRule": "自 {date} 起，周六、周日全天按低谷价；工作日沿用峰谷分段。",
			"pricing.providerScope": "仅对 DeepSeek 官方供应商的本地费用估算和限额判断生效，不会改变供应商账单或套餐价格。",
			"pricing.checkedAt": "价格核对时间：{time}",
			"pricing.stale": "官方价格已超过 {days} 天未核对，请以官方价格页为准。",
			"pricing.offPeak": "低谷",
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
			"pricing.fetchOfficial": "获取官方定价",
			"pricing.fetchingOfficial": "正在获取…",
			"pricing.confirmOfficialTitle": "确认官方定价",
			"pricing.confirmOfficialDesc": "以下价格于 {time} 从 DeepSeek 官方页面获取。确认后将填入编辑表格，仍需保存才会生效。",
			"pricing.confirmOfficial": "确认并填入",
			"pricing.officialSource": "查看官方价格页",
			"pricing.invalidValue": "请输入不小于 0 的有效数字。",
			"pricing.saveError": "保存失败：{message}",
			"pricing.fetchError": "获取官方定价失败：{message}",
			"notifications.title": "通知与提示",
			"notifications.desc": "这里只配置所有供应商共用的告警输出通道、事件类型、冷却时间和历史；供应商专属的余额、消费和套餐阈值请在“供应商用量与计费”中配置。系统通知不在本期范围。",
			"notifications.channels": "输出通道",
			"notifications.channelsDesc": "仅控制告警显示位置，不影响限额判断、状态颜色或硬停止。",
			"notifications.channelSidebar": "侧栏状态点",
			"notifications.channelSidebarDesc": "允许告警状态出现在侧栏摘要和状态圆点中。",
			"notifications.channelToast": "页面内 Toast",
			"notifications.channelToastDesc": "允许新告警以页面内 Toast 提醒；每条提示显示 5 秒；系统通知不在本期范围。",
			"notifications.events": "事件类型",
			"notifications.eventsDesc": "关闭某类事件后，该事件不会进入 Toast 和告警历史；实时余额与套餐数据显示不受影响。",
			"notifications.eventWarning": "预警",
			"notifications.eventExceeded": "超限",
			"notifications.eventLowBalance": "余额不足",
			"notifications.eventRecovery": "恢复正常",
			"notifications.cooldown": "冷却时间",
			"notifications.cooldownDesc": "同一状态持续存在时，超过冷却时间才会再次提醒；状态变化仍会立即更新。",
			"notifications.cooldown5min": "5 分钟",
			"notifications.cooldown15min": "15 分钟",
			"notifications.cooldown30min": "30 分钟",
			"notifications.cooldown1h": "1 小时",
			"notifications.cooldown2h": "2 小时",
			"notifications.history": "告警历史",
			"notifications.historyDesc": "仅保留当前插件进程内最近 200 条记录，重启后清空。",
			"notifications.empty": "暂无告警记录。",
			"notifications.type.alert": "告警",
			"notifications.type.recovery": "恢复",
			"notifications.saveError": "保存失败：{message}",
			"data.title": "数据管理",
			"data.desc": "查看本地统计数据的规模，按需一次性裁剪历史或清除记录。provider usage 是账单真值，离线 tokenizer 不参与计费。",
			"data.overview": "数据概况",
			"data.retentionGroup": "数据保留",
			"data.dangerGroup": "危险操作",
			"data.ledgerEntries": "近期精细记录",
			"data.ledgerCapacity": "近期记录上限",
			"data.capacityTitle": "近期记录上限（100–5000）",
			"data.capacityNote": "达到上限后，最旧记录会压缩为按日期、小时、供应商和模型汇总的数据；Token、冻结费用和费用状态仍精确保留。压缩会永久丢失逐调用 ID、精确时间、单次 Token/费用和调用顺序，无法还原为逐调用记录。新上限在下一次调用落账时生效。",
			"data.capacityPlaceholder": "100–5000",
			"data.capacitySave": "保存上限",
			"data.capacitySaved": "近期记录上限已保存。",
			"data.capacityInvalid": "近期记录上限必须是 100–5000 的整数。",
			"data.foldedCount": "已归档调用",
			"data.dateRange": "数据范围",
			"data.legacyEstimated": "部分更早记录已归档为估算值，金额按当前价格估算，非精确账单。",
			"data.retention": "保留天数",
			"data.retentionPlaceholder": "例如 7",
			"data.retentionNote": "这是一次性裁剪操作，不会建立持续保留策略。天数含今天：1 天只保留今天，2 天保留今天和昨天；留空不裁剪。超出上限的旧记录会冻结金额精确归档。",
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
			"month.names": "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
		};
		const en = {
			"nav": "Usage Stats",
			"panel.title": "Usage & Balance",
			"panel.badge": "Usage/Balance",
			"panel.balance": "Balance",
			"panel.today": "Today",
			"panel.summary": "Balance {balance} · today {today}",
			"panel.updatedAt": "Updated at {time}",
			"panel.gotoSettings": "Settings",
			"panel.tabs": "Panel sections",
			"panel.tabSummary": "All",
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
			"balance.providerSuffix": "balance",
			"balance.planSuffix": "plan usage",
			"balance.localSuffix": "local usage",
			"balance.plan": "Token Plan",
			"balance.local": "Local stats",
			"balance.localOnly": "Local Token usage only",
			"balance.reset": "Reset: ",
			"balance.resetSoon": "Resetting soon",
			"balance.resetNotStarted": "Not started",
			"duration.day": "{value}d",
			"duration.hour": "{value}h",
			"duration.minute": "{value}m",
			"balance.status.local": "Local stats",
			"balance.status.unsupported": "Query not supported",
			"balance.provider": "Provider",
			"balance.windowFiveHour": "5-hour",
			"balance.windowWeekly": "Weekly",
			"balance.windowMonthly": "Monthly window",
			"balance.remaining": "remaining",
			"balance.apiKey": "API Key",
			"balance.unconfigured": "not configured",
			"balance.toppedUp": "Topped up",
			"balance.granted": "Granted",
			"balance.keyLimit": "API key limit",
			"balance.managementKeyMissing": "Management Key not configured; showing the ordinary key limit only",
			"balance.managementKeyUnavailable": "Management Credits unavailable",
			"balance.error": "Balance fetch failed: {message}",
			"balance.status.loading": "Loading",
			"balance.status.empty": "No data",
			"balance.status.ok": "Live",
			"balance.status.notConfigured": "Not configured",
			"balance.status.subscriptionRequired": "OpenCode Go subscription required",
			"balance.status.unauthorized": "Invalid key",
			"balance.status.rateLimited": "Rate limited",
			"balance.status.unavailable": "Unavailable",
			"balance.status.error": "Failed",
			"usage.model": "Model",
			"usage.allModels": "All models",
			"usage.modelUsage": "Model usage",
			"usage.noModelUsage": "No model usage for this day",
			"usage.requestCount": "Requests",
			"usage.activityToday": "Tokens today",
			"usage.tokenUnit": "tokens",
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
			"usage.legacyEstimated": "Includes migrated or rebuilt estimated history (costs use current prices)",
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
			"chart.peakNote": "Weekday peak: Beijing 09-12 / 14-18, ×2 price",
			"chart.weekendOffPeakNote": "Weekends use off-peak prices all day",
			"limits.title": "Usage Alerts & Quota Limits",
			"limits.dailyLimitStatus": "Daily Spend Limit",
			"limits.dailySpendProgress": "Today's Spend",
			"limits.provider": "Provider",
			"limits.currentProvider": "Current provider",
			"limits.providerScoped": "Amount limits apply only to the DeepSeek official balance; view plan windows or local token usage for the selected provider.",
			"limits.providerSwitchDesc": "This follows the default display provider under Providers & Accounts and does not change the model routing provider.",
			"limits.planQuotaTitle": "Plan quota alerts",
			"limits.planQuotaDesc": "Set remaining-percentage colors for the selected provider's supported plan windows; this does not change the real quota. Defaults are ≤10% critical, 10%–30% warning and >30% normal, and each window can be adjusted.",
			"limits.planQuotaFiveHour": "5-hour",
			"limits.planQuotaWeekly": "Weekly",
			"limits.planQuotaRange": "Alert thresholds",
			"limits.planQuotaCriticalLegend": "Critical ≤ {percent}%",
			"limits.planQuotaWarningLegend": "Warning {critical}%–{warning}%",
			"limits.planQuotaNormalLegend": "Normal ≥ {percent}%",
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
			"settings.desc": "Choose the provider used for usage display, then configure that provider's pricing, limits, balance or plan thresholds. Common notification channels and events live under Notifications; balances, plan quotas and charts are queried from the sidebar.",
			"settings.tabAccounts": "Providers & Accounts",
			"settings.tabLimits": "Provider Usage & Billing",
			"settings.tabPricing": "Pricing",
			"settings.tabNotifications": "Notifications",
			"settings.tabData": "Data Management",
			"accounts.title": "Providers & Accounts",
			"accounts.desc": "Only providers added in Model settings are shown. The default display provider is also used by the sidebar, query panel and provider-specific settings here.",
			"accounts.defaultProvider": "Default provider",
			"accounts.defaultProviderDesc": "Changing this updates the sidebar, usage panel and Provider Usage & Billing view; it does not change the provider used for model calls.",
			"accounts.visibleProviders": "Accounts shown",
			"accounts.visibleProvidersSummary": "Accounts shown ({count}/3)",
			"accounts.visibleProvidersDesc": "Select up to three providers for the account overview below. The default provider is always shown.",
			"accounts.defaultAlwaysVisible": "Default provider; always shown",
			"accounts.extraCredentials": "Additional query credentials",
			"accounts.extraCredentialsDesc": "Shown only when the selected provider's official query API requires additional credentials. Secrets are write-only through Harness credentials and are never echoed.",
			"accounts.managementApiKey": "Management API Key",
			"accounts.credentialConfigured": "Configured; leaving blank keeps it",
			"accounts.credentialMissing": "Not configured",
			"accounts.credentialPlaceholder": "Enter a new credential",
			"accounts.credentialSave": "Save",
			"accounts.credentialSaving": "Saving…",
			"accounts.openWebQuery": "Open official query page",
			"accounts.accountSnapshotDesc": "Balances and plan quotas come from official provider APIs. Providers requiring web login never expose cookies or sessions here; only an official query link is shown.",
			"accounts.commonGroup": "Common display & refresh",
			"accounts.today": "Today spend",
			"accounts.unsupported": "Not supported",
			"accounts.default": "Default",
			"accounts.defaultAccount": "Default account",
			"accounts.refreshCadence": "Account data refresh cadence",
			"accounts.refreshOff": "Off",
			"accounts.refresh1min": "1 min",
			"accounts.refresh5min": "5 min",
			"accounts.refresh15min": "15 min",
			"accounts.refresh30min": "30 min",
			"accounts.showBalance": "Show provider summary in sidebar",
			"accounts.showBalanceDesc": "Controls only the sidebar footer summary; the query panel and local usage collection are unchanged.",
			"accounts.showToday": "Show today's spend (balance providers only)",
			"accounts.showTodayDesc": "Shown only for balance providers with local cost estimation.",
			"accounts.showStatus": "Show alert dots in sidebar",
			"accounts.showStatusDesc": "Controls only status dots in the sidebar summary; alert evaluation and notification channels remain active.",
			"accounts.refreshDesc": "Refreshes remote balances or plan snapshots for queryable providers. Manual refresh still works when disabled.",
			"accounts.refreshNow": "Refresh account data now",
			"accounts.refreshing": "Refreshing…",
			"accounts.saveError": "Save failed: {message}",
			"pricing.title": "Pricing",
			"pricing.official": "Official",
			"pricing.custom": "Custom",
			"pricing.basis": "Unit: {currency} per 1M tokens",
			"pricing.weekendRule": "From {date}, Saturdays and Sundays use off-peak prices all day; weekday peak windows remain unchanged.",
			"pricing.providerScope": "Applies only to local cost estimates and limits for the official DeepSeek provider; it does not change provider billing or plan prices.",
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
			"pricing.fetchOfficial": "Fetch official pricing",
			"pricing.fetchingOfficial": "Fetching…",
			"pricing.confirmOfficialTitle": "Confirm official pricing",
			"pricing.confirmOfficialDesc": "These prices were fetched from DeepSeek's official page at {time}. Confirming fills the editor; you must still save before they take effect.",
			"pricing.confirmOfficial": "Confirm and fill",
			"pricing.officialSource": "View official pricing page",
			"pricing.invalidValue": "Enter a valid number that is zero or greater.",
			"pricing.saveError": "Save failed: {message}",
			"pricing.fetchError": "Failed to fetch official pricing: {message}",
			"notifications.title": "Notifications",
			"notifications.desc": "Configure shared alert channels, event types, cooldown and history here. Provider-specific balance, spend and plan thresholds live under Provider Usage & Billing. System notifications are out of scope.",
			"notifications.channels": "Channels",
			"notifications.channelsDesc": "Controls where alerts appear; it does not affect limit evaluation, status colors or hard stops.",
			"notifications.channelSidebar": "Sidebar status dot",
			"notifications.channelSidebarDesc": "Allow alert status to appear in the sidebar summary and dots.",
			"notifications.channelToast": "In-page toast",
			"notifications.channelToastDesc": "Show new alerts as in-page Toast messages for 5 seconds; system notifications are out of scope.",
			"notifications.events": "Event types",
			"notifications.eventsDesc": "Disabled events are omitted from Toasts and alert history; live balance and plan displays are unaffected.",
			"notifications.eventWarning": "Warning",
			"notifications.eventExceeded": "Exceeded",
			"notifications.eventLowBalance": "Low balance",
			"notifications.eventRecovery": "Recovery",
			"notifications.cooldown": "Cooldown",
			"notifications.cooldownDesc": "Repeated alerts for the same state wait for this interval; state changes still update immediately.",
			"notifications.cooldown5min": "5 min",
			"notifications.cooldown15min": "15 min",
			"notifications.cooldown30min": "30 min",
			"notifications.cooldown1h": "1 hour",
			"notifications.cooldown2h": "2 hours",
			"notifications.history": "Alert history",
			"notifications.historyDesc": "Only the latest 200 records are kept in the current plugin process and are cleared on restart.",
			"notifications.empty": "No alerts yet.",
			"notifications.type.alert": "Alert",
			"notifications.type.recovery": "Recovery",
			"notifications.saveError": "Save failed: {message}",
			"data.title": "Data Management",
			"data.desc": "See how much local usage data is kept, run a one-time history trim, or clear records. Provider usage is the billing truth; the offline tokenizer never affects billing.",
			"data.overview": "Overview",
			"data.retentionGroup": "Retention",
			"data.dangerGroup": "Danger zone",
			"data.ledgerEntries": "Recent detailed records",
			"data.ledgerCapacity": "Recent record limit",
			"data.capacityTitle": "Recent record limit (100–5000)",
			"data.capacityNote": "At the limit, the oldest records are compressed into date, hour, provider, and model aggregates; tokens, frozen costs, and cost states remain exact. Compression permanently discards per-call IDs, exact timestamps, individual token/cost values, and call order, so those details cannot be reconstructed. The new limit takes effect when the next call is recorded.",
			"data.capacityPlaceholder": "100–5000",
			"data.capacitySave": "Save limit",
			"data.capacitySaved": "Recent record limit saved.",
			"data.capacityInvalid": "The recent record limit must be an integer from 100 to 5000.",
			"data.foldedCount": "Archived calls",
			"data.dateRange": "Data range",
			"data.legacyEstimated": "Some older records were archived as estimates; their cost uses current prices, not exact billing.",
			"data.retention": "Retention days",
			"data.retentionPlaceholder": "e.g. 7",
			"data.retentionNote": "This is a one-time trim, not a persistent retention policy. Retention includes today: 1 day keeps today, 2 days keeps today and yesterday; leave blank to skip trimming. Entries beyond the cap are archived with their frozen exact costs.",
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
			"month.names": "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec",
		};
		//#endregion

		//#region plugin body
		/** Services required by the client plugin body. */
		const inject = ["slots", "locale", "connection"];

		/**
		 * Client plugin body: register dictionaries and the sidebar footer action.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			connectionRpc = ctx.connection.rpc;
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
					let queued = false;
					const scheduleMarkNav = () => {
						if (queued) return;
						queued = true;
						queueMicrotask(() => { queued = false; markNav(); });
					};
					const observer = new MutationObserver((records) => { if (settingsNavMutationRelevant(records)) scheduleMarkNav(); });
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
		exports.fetchJson = fetchJson;
		exports.rpcRequestOf = rpcRequestOf;
		exports.UsageStatsPanel = UsageStatsPanel;
		exports.UsageStatsSection = UsageStatsSection;
		exports.UsageBillingSettingsSection = UsageBillingSettingsSection;
		exports.openHarnessSettings = openHarnessSettings;
		exports.BalanceCard = BalanceCard;
		exports.LimitsCard = LimitsCard;
		exports.AccountsCard = AccountsCard;
		exports.accountDisplayFields = accountDisplayFields;
		exports.PricingCard = PricingCard;
		exports.NotificationsCard = NotificationsCard;
		exports.DataCard = DataCard;
		exports.normalizeLedgerCapacity = normalizeLedgerCapacity;
		exports.SETTINGS_TABS = SETTINGS_TABS;
		exports.ContributionHeatmap = ContributionHeatmap;
		exports.HourlyChart = HourlyChart;
		exports.DayBarsChart = DayBarsChart;
			exports.DayList = DayList;
			exports.DayDetail = DayDetail;
			exports.ProviderUsageList = ProviderUsageList;
			exports.activeDayKeyOf = activeDayKeyOf;
			exports.filterDay = filterDay;
		exports.summarize = summarize;
		exports.modelChoicesOf = modelChoicesOf;
		exports.recentDays = recentDays;
		exports.modelIdOf = modelIdOf;
		exports.isTruncatedTextNode = isTruncatedTextNode;
		exports.TruncatedModelName = TruncatedModelName;
		exports.providerOf = providerOf;
		exports.chartUsesTokens = chartUsesTokens;
		exports.groupModelsByProvider = groupModelsByProvider;
		exports.chartTooltipAnchorStyle = chartTooltipAnchorStyle;
		exports.fmt = fmt;
		exports.fmtMoney = fmtMoney;
		exports.animateNumberValue = animateNumberValue;
		exports.animationStartValue = animationStartValue;
		exports.currencySymbol = currencySymbol;
		exports.sidebarSummaryOf = sidebarSummaryOf;
		exports.windowResetCountdownOf = windowResetCountdownOf;
		exports.windowResetDisplayOf = windowResetDisplayOf;
		exports.windowResetDisplayForItem = windowResetDisplayForItem;
		exports.windowResetCountdownForItem = windowResetCountdownForItem;
		exports.fmtCurrency = fmtCurrency;
		exports.visibleProviderIdsForView = visibleProviderIdsForView;
		exports.isWeekendOffPeakDay = isWeekendOffPeakDay;
		exports.isPeak = isPeak;
		exports.buildYearContributionHeatmap = buildYearContributionHeatmap;
		exports.cellColor = cellColor;
		exports.freshAlertsForProvider = freshAlertsForProvider;
		exports.pricingWritePayload = pricingWritePayload;
		exports.settingsNavMutationRelevant = settingsNavMutationRelevant;
		return module.exports;
	}
});
