/** Versioned DeepSeek pricing helpers.  The legacy `pricing`/`peakMultiplier`
 * fields remain supported so existing plugin configuration and cache entries
 * continue to load without a destructive migration. */

export const OFFICIAL_PRICING_SOURCE = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
const RATE_FIELDS = ["inputMiss", "inputHit", "output"];
const MAX_OFFICIAL_PRICING_HTML_BYTES = 2 * 1024 * 1024;

function decodeHtmlEntities(value) {
	return String(value ?? "")
		.replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'");
}

function htmlText(value) {
	return decodeHtmlEntities(String(value ?? "")
		.replace(/<br\s*\/?\s*>/gi, " ")
		.replace(/<[^>]*>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}

function positiveSpan(attributes, name) {
	const match = String(attributes ?? "").match(new RegExp(`\\b${name}\\s*=\\s*["']?(\\d+)`, "i"));
	const value = Number(match?.[1] ?? 1);
	return Number.isInteger(value) && value > 0 ? value : 1;
}

function tableGrid(tableHtml) {
	const rows = [];
	const activeRowSpans = new Map();
	for (const rowMatch of String(tableHtml).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const row = [];
		const occupied = new Set();
		for (const [column, span] of activeRowSpans) {
			row[column] = span.value;
			occupied.add(column);
			span.rowsLeft -= 1;
			if (span.rowsLeft === 0) activeRowSpans.delete(column);
		}
		let column = 0;
		for (const cellMatch of rowMatch[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
			while (occupied.has(column)) column += 1;
			const value = htmlText(cellMatch[2]);
			const colspan = positiveSpan(cellMatch[1], "colspan");
			const rowspan = positiveSpan(cellMatch[1], "rowspan");
			for (let offset = 0; offset < colspan; offset += 1) {
				const target = column + offset;
				row[target] = value;
				if (rowspan > 1) activeRowSpans.set(target, { value, rowsLeft: rowspan - 1 });
			}
			column += colspan;
		}
		if (row.some((cell) => typeof cell === "string" && cell !== "")) rows.push(row);
	}
	return rows;
}

function rateOf(value) {
	const text = String(value ?? "").replace(/,/g, "");
	const match = text.match(/(?:¥|￥)?\s*(\d+(?:\.\d+)?)\s*元?/);
	const number = Number(match?.[1]);
	return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Parse the fixed DeepSeek Chinese pricing table into the plugin's model shape. */
export function parseOfficialPricingHtml(html, options = {}) {
	const source = String(html ?? "").replace(/\0/g, "");
	let matchedTable = null;
	let modelIds = null;
	for (const tableMatch of source.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
		const rows = tableGrid(tableMatch[0]);
		for (const row of rows) {
			const start = row.findIndex((cell) => /^deepseek-[a-z0-9][a-z0-9._-]*$/i.test(String(cell ?? "").trim()));
			if (start < 0) continue;
			const ids = row.slice(start).map((cell) => String(cell ?? "").trim().toLowerCase()).filter((cell) => /^deepseek-[a-z0-9][a-z0-9._-]*$/.test(cell));
			if (ids.length === 0 || new Set(ids).size !== ids.length) continue;
			matchedTable = rows;
			modelIds = ids;
			break;
		}
		if (matchedTable !== null) break;
	}
	if (matchedTable === null || modelIds === null) throw new Error("DeepSeek official pricing table was not found");
	const models = Object.fromEntries(modelIds.map((model) => [model, { offPeak: {}, peak: {} }]));
	for (const row of matchedTable) {
		const joined = row.join(" ").replace(/\s+/g, " ");
		const field = /缓存未命中/.test(joined)
			? "inputMiss"
			: /缓存命中/.test(joined)
				? "inputHit"
				: /百万\s*tokens?\s*输出|百万tokens输出/i.test(joined)
					? "output"
					: null;
		if (field === null) continue;
		const periodIndex = row.findIndex((cell) => /^(空闲时段|高峰时段)$/.test(String(cell ?? "").trim()));
		if (periodIndex < 0) continue;
		const period = String(row[periodIndex]).trim() === "空闲时段" ? "offPeak" : "peak";
		for (let index = 0; index < modelIds.length; index += 1) {
			const rate = rateOf(row[periodIndex + 1 + index]);
			if (rate !== null) models[modelIds[index]][period][field] = rate;
		}
	}
	for (const [model, row] of Object.entries(models)) {
		if (!completeRate(row.offPeak) || !completeRate(row.peak)) throw new Error(`DeepSeek official pricing is incomplete for ${model}`);
	}
	return {
		currency: "CNY",
		sourceUrl: OFFICIAL_PRICING_SOURCE,
		checkedAt: typeof options.checkedAt === "string" ? options.checkedAt : new Date().toISOString(),
		models
	};
}

/** Fetch only the fixed official source; callers cannot provide a URL. */
export async function fetchOfficialPricing(options = {}) {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable in this Node.js runtime");
	const controller = new AbortController();
	const timeoutMs = Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(OFFICIAL_PRICING_SOURCE, {
			method: "GET",
			headers: { accept: "text/html,application/xhtml+xml", "user-agent": "dsh-usage-stats official-pricing-check" },
			signal: controller.signal,
			redirect: "follow"
		});
		if (!response?.ok) throw new Error(`DeepSeek official pricing request returned HTTP ${response?.status ?? "unknown"}`);
		const html = await response.text();
		if (Buffer.byteLength(html, "utf8") > MAX_OFFICIAL_PRICING_HTML_BYTES) throw new Error("DeepSeek official pricing page is too large");
		const now = typeof options.now === "function" ? options.now() : Date.now();
		return parseOfficialPricingHtml(html, { checkedAt: new Date(now).toISOString() });
	} catch (error) {
		if (error?.name === "AbortError") throw new Error("DeepSeek official pricing request timed out");
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

function completeRate(row) {
	return row !== null && typeof row === "object" && !Array.isArray(row)
		&& RATE_FIELDS.every((field) => {
			if (!Object.hasOwn(row, field) || row[field] === null || row[field] === "") return false;
			const value = Number(row[field]);
			return Number.isFinite(value) && value >= 0;
		});
}

export function defaultPricingVersion(checkedAt = "2026-08-24T15:45:22.034Z") {
	return {
		id: "deepseek-cn-official-2026-08-24",
		name: "DeepSeek 中国区官方价格",
		currency: "CNY",
		timezone: "Asia/Shanghai",
		sourceUrl: OFFICIAL_PRICING_SOURCE,
		checkedAt,
		effectiveFrom: "2026-08-23T00:00:00+08:00",
		mode: "official",
		// 自北京时间 2026-08-23 00:00 起，周六、周日全天使用低谷价。
		weekendOffPeakFrom: "2026-08-23",
		windows: [
			{ id: "peak-am", start: "09:00", end: "12:00", tier: "peak" },
			{ id: "peak-pm", start: "14:00", end: "18:00", tier: "peak" }
		],
		// 2026-08-24 核对官方价格页：在售 deepseek-v4-flash、
		// deepseek-v4-pro、deepseek-v4-flash-vision-exp；v3 系
		// deepseek-chat / deepseek-reasoner 未在页面列出，不臆造价格。
		models: {
			"deepseek-v4-flash": {
				offPeak: { inputHit: 0.05, inputMiss: 1.5, output: 4.5 },
				peak: { inputHit: 0.10, inputMiss: 3, output: 9 }
			},
			"deepseek-v4-pro": {
				offPeak: { inputHit: 0.15, inputMiss: 4.5, output: 13.5 },
				peak: { inputHit: 0.30, inputMiss: 9, output: 27 }
			},
			"deepseek-v4-flash-vision-exp": {
				offPeak: { inputHit: 0.05, inputMiss: 1.5, output: 4.5 },
				peak: { inputHit: 0.10, inputMiss: 3, output: 9 }
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
		const current = base.models[model] ?? {};
		if (Object.keys(current).length === 0 && !completeRate(off)) continue;
		const currentOff = current.offPeak ?? {};
		const offPeak = {
			inputHit: finite(off.inputHit, finite(currentOff.inputHit, 0)),
			inputMiss: finite(off.inputMiss, finite(currentOff.inputMiss, 0)),
			output: finite(off.output, finite(currentOff.output, 0))
		};
		const currentPeak = current.peak ?? {};
		base.models[model] = {
			offPeak,
			peak: {
				inputHit: finite(peak.inputHit, finite(currentPeak.inputHit, offPeak.inputHit)),
				inputMiss: finite(peak.inputMiss, finite(currentPeak.inputMiss, offPeak.inputMiss)),
				output: finite(peak.output, finite(currentPeak.output, offPeak.output))
			}
		};
	}
	// Apply legacy overrides last. validateConfig builds a merged object that
	// contains both default versioned `models` and user-provided legacy
	// `pricing`; the explicit user values must win over those defaults.
	for (const [model, row] of Object.entries(legacy)) {
		if (row === null || typeof row !== "object") continue;
		const current = base.models[model] ?? {};
		if (Object.keys(current).length === 0 && !completeRate(row)) continue;
		const currentOff = current.offPeak ?? {};
		const offPeak = {
			inputHit: finite(row.inputHit, finite(currentOff.inputHit, 0)),
			inputMiss: finite(row.inputMiss, finite(currentOff.inputMiss, 0)),
			output: finite(row.output, finite(currentOff.output, 0))
		};
		const currentPeak = current.peak ?? {};
		const multiplierNumber = Number(raw.peakMultiplier);
		const multiplier = Number.isFinite(multiplierNumber) && multiplierNumber > 0 ? multiplierNumber : 1;
		base.models[model] = { offPeak, peak: {
			inputHit: finite(row.peak?.inputHit, finite(currentPeak.inputHit, offPeak.inputHit * multiplier)),
			inputMiss: finite(row.peak?.inputMiss, finite(currentPeak.inputMiss, offPeak.inputMiss * multiplier)),
			output: finite(row.peak?.output, finite(currentPeak.output, offPeak.output * multiplier))
		} };
	}
	if (typeof raw.id === "string" && raw.id.trim()) base.id = raw.id.trim();
	if (typeof raw.name === "string" && raw.name.trim()) base.name = raw.name.trim();
	if (typeof raw.sourceUrl === "string" && raw.sourceUrl.trim()) base.sourceUrl = raw.sourceUrl.trim();
	if (typeof raw.checkedAt === "string") base.checkedAt = raw.checkedAt;
	if (typeof raw.effectiveFrom === "string") base.effectiveFrom = raw.effectiveFrom;
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw.weekendOffPeakFrom)) base.weekendOffPeakFrom = raw.weekendOffPeakFrom;
	if (raw.mode === "custom" || raw.mode === "official") base.mode = raw.mode;
	if (typeof raw.timezone === "string" && raw.timezone.trim()) base.timezone = raw.timezone.trim();
	if (Array.isArray(raw.windows)) {
		const clockMinutes = (value) => {
			if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
			const [hour, minute] = value.split(":").map(Number);
			return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
		};
		const windows = raw.windows.filter((w) => {
			const start = clockMinutes(w?.start);
			const end = clockMinutes(w?.end);
			return start !== null && end !== null && end > start;
		});
		if (windows.length > 0) base.windows = windows.map((w, i) => ({ id: typeof w.id === "string" ? w.id : `window-${i + 1}`, start: w.start, end: w.end, tier: w.tier === "offPeak" ? "offPeak" : "peak" }));
	}
	if (typeof raw.currency === "string" && raw.currency.trim()) base.currency = raw.currency.trim();
	// Legacy wire consumers still read these fields.
	base.pricing = Object.fromEntries(Object.entries(base.models).map(([model, row]) => [model, row.offPeak]));
	const peakHours = Array.isArray(raw.peakHours)
		? raw.peakHours.filter((pair) => Array.isArray(pair) && pair.length === 2 && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1])) && Number(pair[0]) >= 0 && Number(pair[1]) <= 24 && Number(pair[1]) > Number(pair[0])).map((pair) => [Number(pair[0]), Number(pair[1])])
		: [];
	base.peakHours = peakHours.length > 0 ? peakHours : [[9, 12], [14, 18]];
	const peakMultiplier = Number(raw.peakMultiplier);
	base.peakMultiplier = Number.isFinite(peakMultiplier) && peakMultiplier > 0 ? peakMultiplier : 2;
	return base;
}

/**
 * Validate pricing supplied by a user-facing write endpoint.
 *
 * normalizePricing remains lenient because it is also used while loading
 * persisted settings. New writes must reject malformed peak windows instead
 * of silently persisting values that produce incorrect attribution.
 */
export function validatePricingInput(raw = {}) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		throw new TypeError("pricing must be an object");
	}
	if (raw.peakHours !== void 0) {
		if (!Array.isArray(raw.peakHours)) {
			throw new TypeError("pricing.peakHours must be an array of [start, end) Beijing-time hour pairs");
		}
		for (const pair of raw.peakHours) {
			if (!Array.isArray(pair) || pair.length !== 2 || !Number.isFinite(Number(pair[0])) || !Number.isFinite(Number(pair[1]))) {
				throw new TypeError("pricing.peakHours entries must be finite [start, end) pairs");
			}
			const start = Number(pair[0]);
			const end = Number(pair[1]);
			if (start < 0 || start > 23 || end < 0 || end > 24 || end <= start) {
				throw new TypeError("pricing.peakHours must satisfy 0 <= start < end <= 24");
			}
		}
	}
	if (raw.peakMultiplier !== void 0) {
		const multiplier = typeof raw.peakMultiplier === "boolean" || raw.peakMultiplier === null || (typeof raw.peakMultiplier === "string" && raw.peakMultiplier.trim() === "") ? NaN : Number(raw.peakMultiplier);
		if (!Number.isFinite(multiplier) || multiplier <= 0) throw new TypeError("pricing.peakMultiplier must be a positive number");
	}
	const fields = ["inputMiss", "inputHit", "output"];
	const validateRate = (row, path, requireComplete = false) => {
		if (row === null || typeof row !== "object" || Array.isArray(row)) throw new TypeError(`${path} must be an object`);
		for (const field of fields) {
			if (!Object.hasOwn(row, field)) continue;
			const value = row[field];
			const number = typeof value === "boolean" || value === null || (typeof value === "string" && value.trim() === "") ? NaN : Number(value);
			if (!Number.isFinite(number) || number < 0) throw new TypeError(`${path}.${field} must be a non-negative number`);
		}
		if (requireComplete && !fields.every((field) => Object.hasOwn(row, field))) throw new TypeError(`${path} must specify inputMiss, inputHit, and output`);
	};
	for (const sourceName of ["models", "pricing"]) {
		if (raw[sourceName] === void 0) continue;
		const source = raw[sourceName];
		if (source === null || typeof source !== "object" || Array.isArray(source)) throw new TypeError(`pricing.${sourceName} must be an object keyed by model id`);
		for (const [model, row] of Object.entries(source)) {
			const path = `pricing.${sourceName}.${model}`;
			validateRate(row, path, sourceName === "pricing");
			for (const period of ["offPeak", "offpeak", "peak"]) {
				if (row?.[period] !== void 0) validateRate(row[period], `${path}.${period}`, sourceName === "models");
			}
		}
	}
	return raw;
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
