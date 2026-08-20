/** Versioned DeepSeek pricing helpers.  The legacy `pricing`/`peakMultiplier`
 * fields remain supported so existing plugin configuration and cache entries
 * continue to load without a destructive migration. */

export const OFFICIAL_PRICING_SOURCE = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";

export function defaultPricingVersion(checkedAt = "2026-08-19T00:00:00.000Z") {
	return {
		id: "deepseek-cn-official-2026-08",
		name: "DeepSeek 中国区官方价格",
		currency: "CNY",
		timezone: "Asia/Shanghai",
		sourceUrl: OFFICIAL_PRICING_SOURCE,
		checkedAt,
		effectiveFrom: checkedAt,
		mode: "official",
		windows: [
			{ id: "peak-am", start: "09:00", end: "12:00", tier: "peak" },
			{ id: "peak-pm", start: "14:00", end: "18:00", tier: "peak" }
		],
		// 2026-08-19 核对官方价格页：在售仅 deepseek-v4-flash / deepseek-v4-pro
		// （版本 DeepSeek-V4-Flash-0731 / DeepSeek-V4-Pro-0813）；v3 系
		// deepseek-chat / deepseek-reasoner 未在页面列出，不臆造价格。
		models: {
			"deepseek-v4-flash": {
				offPeak: { inputHit: 0.05, inputMiss: 1.5, output: 4.5 },
				peak: { inputHit: 0.10, inputMiss: 3, output: 9 }
			},
			"deepseek-v4-pro": {
				offPeak: { inputHit: 0.15, inputMiss: 4.5, output: 13.5 },
				peak: { inputHit: 0.30, inputMiss: 9, output: 27 }
			}
		}
	};
}

export function normalizePricing(raw = {}) {
	const base = defaultPricingVersion();
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return base;
	const models = raw.models && typeof raw.models === "object" && !Array.isArray(raw.models) ? raw.models : {};
	const legacy = raw.pricing && typeof raw.pricing === "object" && !Array.isArray(raw.pricing) ? raw.pricing : {};
	for (const [model, row] of Object.entries(models)) {
		if (row === null || typeof row !== "object") continue;
		const off = row.offPeak ?? row.offpeak ?? row;
		const peak = row.peak ?? off;
		base.models[model] = {
			offPeak: { inputHit: finite(off.inputHit, 0), inputMiss: finite(off.inputMiss, 0), output: finite(off.output, 0) },
			peak: { inputHit: finite(peak.inputHit, finite(off.inputHit, 0)), inputMiss: finite(peak.inputMiss, finite(off.inputMiss, 0)), output: finite(peak.output, finite(off.output, 0)) }
		};
	}
	// Apply legacy overrides last. validateConfig builds a merged object that
	// contains both default versioned `models` and user-provided legacy
	// `pricing`; the explicit user values must win over those defaults.
	for (const [model, row] of Object.entries(legacy)) {
		if (row === null || typeof row !== "object") continue;
		const offPeak = {
			inputHit: finite(row.inputHit, 0), inputMiss: finite(row.inputMiss, 0), output: finite(row.output, 0)
		};
		base.models[model] = { offPeak, peak: {
			inputHit: finite(row.peak?.inputHit, offPeak.inputHit * (Number(raw.peakMultiplier) || 1)),
			inputMiss: finite(row.peak?.inputMiss, offPeak.inputMiss * (Number(raw.peakMultiplier) || 1)),
			output: finite(row.peak?.output, offPeak.output * (Number(raw.peakMultiplier) || 1))
		} };
	}
	if (typeof raw.id === "string" && raw.id.trim()) base.id = raw.id.trim();
	if (typeof raw.name === "string" && raw.name.trim()) base.name = raw.name.trim();
	if (typeof raw.sourceUrl === "string" && raw.sourceUrl.trim()) base.sourceUrl = raw.sourceUrl.trim();
	if (typeof raw.checkedAt === "string") base.checkedAt = raw.checkedAt;
	if (typeof raw.effectiveFrom === "string") base.effectiveFrom = raw.effectiveFrom;
	if (raw.mode === "custom" || raw.mode === "official") base.mode = raw.mode;
	if (typeof raw.timezone === "string" && raw.timezone.trim()) base.timezone = raw.timezone.trim();
	if (Array.isArray(raw.windows)) base.windows = raw.windows.filter((w) => w && typeof w.start === "string" && typeof w.end === "string").map((w, i) => ({ id: typeof w.id === "string" ? w.id : `window-${i + 1}`, start: w.start, end: w.end, tier: w.tier === "offPeak" ? "offPeak" : "peak" }));
	if (typeof raw.currency === "string" && raw.currency.trim()) base.currency = raw.currency.trim();
	// Legacy wire consumers still read these fields.
	base.pricing = Object.fromEntries(Object.entries(base.models).map(([model, row]) => [model, row.offPeak]));
	base.peakHours = Array.isArray(raw.peakHours) ? raw.peakHours : [[9, 12], [14, 18]];
	base.peakMultiplier = Number(raw.peakMultiplier) || 2;
	return base;
}

export function migratePricingConfig(raw = {}) {
	return normalizePricing(raw);
}

/**
 * Canonical default pricing object (the ONLY price source in the codebase).
 * Other modules should `import { defaultPricing } from "./pricing.js"` and
 * treat the result as read-only; configuration overrides flow back through
 * `normalizePricing` so user values always win over these defaults.
 */
export function defaultPricing() {
	return normalizePricing(defaultPricingVersion());
}

function finite(value, fallback) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}
