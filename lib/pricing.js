/** Versioned DeepSeek pricing helpers.  The legacy `pricing`/`peakMultiplier`
 * fields remain supported so existing plugin configuration and cache entries
 * continue to load without a destructive migration. */

import { readFileSync } from "node:fs";

export const OFFICIAL_PRICING_SOURCE = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
export const OFFICIAL_PRICING_POLICY_SOURCE = "https://raw.githubusercontent.com/wannanbigpig/dsh-usage-stats/master/lib/pricing-policy.json";
const RATE_FIELDS = ["inputMiss", "inputHit", "output"];
const DEFAULT_PEAK_MULTIPLIER = 2;
const MAX_OFFICIAL_PRICING_HTML_BYTES = 2 * 1024 * 1024;
const MAX_OFFICIAL_PRICING_POLICY_BYTES = 256 * 1024;
const MODEL_ID_PATTERN = /^deepseek-[a-z0-9][a-z0-9._-]*$/;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

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
		.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
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
		const labeledRows = rows.filter((row) => row.some((cell) => /^(?:模型|model)$/i.test(String(cell ?? "").trim())));
		for (const row of labeledRows.length > 0 ? labeledRows : rows) {
			const start = row.findIndex((cell) => MODEL_ID_PATTERN.test(String(cell ?? "").trim().toLowerCase()));
			if (start < 0) continue;
			const ids = row.slice(start).map((cell) => String(cell ?? "").trim().toLowerCase()).filter((cell) => MODEL_ID_PATTERN.test(cell));
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

function instantOf(value, path) {
	if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
		throw new TypeError(`${path} must be an ISO 8601 instant with an explicit timezone`);
	}
	return value;
}

function normalizedRoutes(raw, path = "pricing.routes") {
	if (!Array.isArray(raw)) throw new TypeError(`${path} must be an array`);
	if (raw.length > 100) throw new TypeError(`${path} must contain at most 100 entries`);
	const boundaries = new Set();
	return raw.map((route, index) => {
		const routePath = `${path}[${index}]`;
		if (route === null || typeof route !== "object" || Array.isArray(route)) throw new TypeError(`${routePath} must be an object`);
		const model = typeof route.model === "string" ? route.model.trim().toLowerCase() : "";
		const priceModel = typeof route.priceModel === "string" ? route.priceModel.trim().toLowerCase() : "";
		if (!MODEL_ID_PATTERN.test(model)) throw new TypeError(`${routePath}.model must be a DeepSeek model id`);
		if (!MODEL_ID_PATTERN.test(priceModel)) throw new TypeError(`${routePath}.priceModel must be a DeepSeek model id`);
		const effectiveFrom = instantOf(route.effectiveFrom, `${routePath}.effectiveFrom`);
		const boundary = `${model}\0${Date.parse(effectiveFrom)}`;
		if (boundaries.has(boundary)) throw new TypeError(`${routePath}.effectiveFrom duplicates another route boundary for ${model}`);
		boundaries.add(boundary);
		const result = { model, priceModel, effectiveFrom };
		if (route.effectiveUntil !== void 0) {
			const effectiveUntil = instantOf(route.effectiveUntil, `${routePath}.effectiveUntil`);
			if (Date.parse(effectiveUntil) <= Date.parse(effectiveFrom)) throw new TypeError(`${routePath}.effectiveUntil must be after effectiveFrom`);
			result.effectiveUntil = effectiveUntil;
		}
		return result;
	});
}

/** Bundled declarative routing-policy seed; the JSON file is the single source. */
const BUNDLED_PRICING_POLICY = JSON.parse(readFileSync(new URL("./pricing-policy.json", import.meta.url), "utf8"));

/**
 * Built-in last-known-good routing policy used when the remote data is
 * unavailable. Read from the bundled `pricing-policy.json` so the packaged
 * seed and this fallback can never drift into two copies.
 */
export function defaultPricingPolicy() {
	return structuredClone(BUNDLED_PRICING_POLICY);
}

/** Validate untrusted declarative policy data before it reaches billing. */
export function validatePricingPolicy(raw) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("pricing policy must be an object");
	if (raw.schemaVersion !== 1) throw new TypeError("pricing policy schemaVersion must be 1");
	if (typeof raw.id !== "string" || raw.id.trim() === "") throw new TypeError("pricing policy id must be a non-empty string");
	instantOf(raw.checkedAt, "pricing policy checkedAt");
	if (typeof raw.sourceUrl !== "string" || !raw.sourceUrl.startsWith("https://api-docs.deepseek.com/")) {
		throw new TypeError("pricing policy sourceUrl must be a DeepSeek API Docs HTTPS URL");
	}
	if (raw.models === null || typeof raw.models !== "object" || Array.isArray(raw.models) || Object.keys(raw.models).length === 0) {
		throw new TypeError("pricing policy models must be a non-empty object keyed by model id");
	}
	if (!Array.isArray(raw.routes)) throw new TypeError("pricing policy routes must be an array");
	validatePricingInput({ models: raw.models, routes: raw.routes });
	for (const model of Object.keys(raw.models)) {
		if (!MODEL_ID_PATTERN.test(model)) throw new TypeError(`pricing policy model ${model} must be a DeepSeek model id`);
	}
	for (const route of normalizedRoutes(raw.routes, "pricing policy routes")) {
		if (!Object.hasOwn(raw.models, route.priceModel)) throw new TypeError(`pricing policy route target ${route.priceModel} has no price row`);
	}
	return {
		schemaVersion: 1,
		id: raw.id.trim(),
		checkedAt: raw.checkedAt,
		sourceUrl: raw.sourceUrl,
		models: structuredClone(raw.models),
		routes: normalizedRoutes(raw.routes, "pricing policy routes")
	};
}

async function fetchText(url, options, maxBytes, accept) {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable in this Node.js runtime");
	const controller = new AbortController();
	const timeoutMs = Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10000;
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchImpl(url, {
			method: "GET",
			headers: { accept, "user-agent": "dsh-usage-stats official-pricing-check" },
			signal: controller.signal,
			redirect: "follow"
		});
		if (!response?.ok) throw new Error(`pricing source request returned HTTP ${response?.status ?? "unknown"}`);
		const body = await response.text();
		if (Buffer.byteLength(body, "utf8") > maxBytes) throw new Error("pricing source response is too large");
		return body;
	} catch (error) {
		if (error?.name === "AbortError") throw new Error("pricing source request timed out");
		throw error;
	} finally {
		clearTimeout(timeout);
	}
}

/** Fetch only the fixed policy URL and reject all non-schema data. */
export async function fetchOfficialPricingPolicy(options = {}) {
	const body = await fetchText(OFFICIAL_PRICING_POLICY_SOURCE, options, MAX_OFFICIAL_PRICING_POLICY_BYTES, "application/json");
	let parsed;
	try { parsed = JSON.parse(body); }
	catch { throw new Error("official pricing policy is not valid JSON"); }
	return validatePricingPolicy(parsed);
}

function mergeOfficialPricingAndPolicy(pricing, policy, options = {}) {
	return {
		...pricing,
		id: policy.id,
		policyVersion: policy.id,
		policySourceUrl: OFFICIAL_PRICING_POLICY_SOURCE,
		policyFallback: options.policyFallback === true,
		models: { ...policy.models, ...pricing.models },
		routes: policy.routes
	};
}

/** Fetch the official price table and combine it with a versioned data-only routing policy. */
export async function fetchOfficialPricing(options = {}) {
	const htmlPromise = fetchText(OFFICIAL_PRICING_SOURCE, options, MAX_OFFICIAL_PRICING_HTML_BYTES, "text/html,application/xhtml+xml")
		.then((html) => ({ html, error: null }), (error) => ({ html: null, error }));
	const policyPromise = options.fetchPolicy === false
		? Promise.resolve({ policy: defaultPricingPolicy(), fallback: true })
		: fetchOfficialPricingPolicy({ fetchImpl: options.policyFetchImpl ?? options.fetchImpl, timeoutMs: options.policyTimeoutMs ?? 3000 })
			.then((policy) => ({ policy, fallback: false }))
			.catch(() => ({ policy: defaultPricingPolicy(), fallback: true }));
	const policyResult = await policyPromise;
	let pricing;
	try {
		const htmlResult = await htmlPromise;
		if (htmlResult.error !== null) throw htmlResult.error;
		const html = htmlResult.html;
		const now = typeof options.now === "function" ? options.now() : Date.now();
		pricing = parseOfficialPricingHtml(html, { checkedAt: new Date(now).toISOString() });
	} catch (error) {
		if (policyResult.fallback || Object.keys(policyResult.policy.models).length === 0) throw error;
		pricing = {
			currency: "CNY",
			sourceUrl: OFFICIAL_PRICING_SOURCE,
			checkedAt: policyResult.policy.checkedAt,
			models: structuredClone(policyResult.policy.models),
			pricingSourceFallback: true
		};
	}
	return mergeOfficialPricingAndPolicy(pricing, policyResult.policy, { policyFallback: policyResult.fallback });
}

function completeRate(row) {
	return row !== null && typeof row === "object" && !Array.isArray(row)
		&& RATE_FIELDS.every((field) => {
			if (!Object.hasOwn(row, field) || row[field] === null || row[field] === "") return false;
			const value = Number(row[field]);
			return Number.isFinite(value) && value >= 0;
		});
}

export function defaultPricingVersion(checkedAt = "2026-09-10T00:00:00+08:00") {
	const policy = defaultPricingPolicy();
	return {
		id: "deepseek-cn-official-2026-09-10",
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
		// Keep the previous V4 rows for pre-transition estimates. Runtime routes
		// select V4.1 Flash prices from their explicit Beijing-time boundaries.
		models: {
			"deepseek-flash": {
				offPeak: { inputHit: 0.02, inputMiss: 1, output: 4 },
				peak: { inputHit: 0.04, inputMiss: 2, output: 8 }
			},
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
		},
		policyVersion: policy.id,
		policySourceUrl: OFFICIAL_PRICING_POLICY_SOURCE,
		routes: policy.routes
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
	// Apply explicit legacy overrides after versioned/default rates; recognize
	// generated mirrors below so normalizing a saved scheme is idempotent.
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
		const multiplier = Number.isFinite(multiplierNumber) && multiplierNumber > 0 ? multiplierNumber : DEFAULT_PEAK_MULTIPLIER;
		const versionedRow = models[model];
		const versionedOff = versionedRow?.offPeak ?? versionedRow?.offpeak ?? versionedRow;
		const peak = {};
		for (const field of RATE_FIELDS) {
			// A normalized versioned scheme also carries a legacy mirror. Preserve
			// its explicit peak prices on reload; only actual legacy overrides
			// derive a replacement peak rate from the configured multiplier.
			const mirrored = versionedOff !== null && typeof versionedOff === "object"
				&& Object.hasOwn(versionedOff, field) && Number(row[field]) === Number(versionedOff[field]);
			const overridden = Object.hasOwn(row, field) && Number.isFinite(Number(row[field])) && !mirrored;
			const fallback = overridden ? offPeak[field] * multiplier : finite(currentPeak[field], offPeak[field] * multiplier);
			peak[field] = finite(row.peak?.[field], fallback);
		}
		base.models[model] = { offPeak, peak };
	}
	if (typeof raw.id === "string" && raw.id.trim()) base.id = raw.id.trim();
	if (typeof raw.name === "string" && raw.name.trim()) base.name = raw.name.trim();
	if (typeof raw.sourceUrl === "string" && raw.sourceUrl.trim()) base.sourceUrl = raw.sourceUrl.trim();
	if (typeof raw.policyVersion === "string" && raw.policyVersion.trim()) base.policyVersion = raw.policyVersion.trim();
	if (typeof raw.policySourceUrl === "string" && raw.policySourceUrl.trim()) base.policySourceUrl = raw.policySourceUrl.trim();
	if (typeof raw.pricingSourceFallback === "boolean") base.pricingSourceFallback = raw.pricingSourceFallback;
	if (typeof raw.policyFallback === "boolean") base.policyFallback = raw.policyFallback;
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
	if (raw.routes !== void 0) base.routes = normalizedRoutes(raw.routes);
	// Legacy wire consumers still read these fields.
	base.pricing = Object.fromEntries(Object.entries(base.models).map(([model, row]) => [model, row.offPeak]));
	const peakHours = Array.isArray(raw.peakHours)
		? raw.peakHours.filter((pair) => Array.isArray(pair) && pair.length === 2 && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1])) && Number(pair[0]) >= 0 && Number(pair[1]) <= 24 && Number(pair[1]) > Number(pair[0])).map((pair) => [Number(pair[0]), Number(pair[1])])
		: [];
	base.peakHours = peakHours.length > 0 ? peakHours : [[9, 12], [14, 18]];
	const peakMultiplier = Number(raw.peakMultiplier);
	base.peakMultiplier = Number.isFinite(peakMultiplier) && peakMultiplier > 0 ? peakMultiplier : DEFAULT_PEAK_MULTIPLIER;
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
	if (raw.routes !== void 0) normalizedRoutes(raw.routes);
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
let defaultPricingCache = null;

export function defaultPricing() {
	// Read-only by contract (see above); build once so hot paths such as ledger
	// rendering, pricing versioning, and default parameters reuse one value.
	return defaultPricingCache ?? (defaultPricingCache = normalizePricing(defaultPricingVersion()));
}

function finite(value, fallback) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}
