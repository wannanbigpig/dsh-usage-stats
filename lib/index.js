/**
 * dsh-usage-stats — server half.
 *
 * Registers nine loopback-only endpoints on the web server:
 *   GET  /api/usage-stats/usage     — per-day/per-hour/per-model token usage + estimated cost
 *   GET  /api/usage-stats/keys      — configured DeepSeek API-key credential references
 *   GET  /api/usage-stats/providers  — Harness provider directory and default provider
 *   GET  /api/usage-stats/balance   — DeepSeek official balance for one key (?key=<ref>&refresh=1)
 *   GET/POST /api/usage-stats/limits   — per-key limit rules + unified status (POST writes)
 *   GET/POST /api/usage-stats/accounts — account snapshots + refresh cadence/sidebar toggles (POST writes)
 *   GET/POST /api/usage-stats/pricing  — current/official price scheme (POST saves custom/restore)
 *   GET/POST /api/usage-stats/alerts   — alert history + notification policy (POST writes)
 *   GET/POST /api/usage-stats/data     — data metadata (GET), rebuild/clear/trim (POST)
 *
 * Credentials are resolved through the harness `credentials` seam at request
 * time — this plugin never stores or logs API keys. The official DeepSeek
 * route is queried at the account's configured base URL (default
 * https://api.deepseek.com) using each configured credential reference.
 *
 * Usage aggregation is INCREMENTAL: per-session fold state (day/hour/model
 * buckets plus the last usage sample) is cached in memory and persisted to
 * `<DSH_HOME>/storages/usage-stats-cache.json`. On each request only the
 * events added since the last fold are processed — live sessions fold their
 * in-memory tail, while persisted sessions use the storage backend's opaque
 * revision when available. Steady-state cost stays O(new events) no matter
 * how large the logs grow.
 *
 * The endpoints live under the `/api` prefix as exact routes, so they win
 * over the connection plugin's `/api` prefix handler; each handler applies
 * its own peer-socket loopback fence (the exact routes bypass the RPC trust
 * fence); Host is checked only as an additional defense.
 *
 * @module dsh-usage-stats
 */

import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createUsageState, dayKey, defaultPricing, isOfficialBillingProvider, mergeInto, providerOf, renderUsage, roundCost, zeroBuckets } from "./usage.js";
import { appendLedger, compactLedger, foldLedger, freezeLedgerEntry, renderLedger } from "./ledger.js";
import { queryDeepSeekBalance, responseStatus } from "./balance.js";
import { listBuiltInProviders, queryProviderUsage } from "./providers.js";
import { defaultPricingVersion, normalizePricing, validatePricingInput } from "./pricing.js";

/** Stable Cordis plugin name. */
const name = "usage-stats";

/** Services required before this plugin activates. */
const inject = ["webServer", "credentials"];

const USAGE_PATH = "/api/usage-stats/usage";
const KEYS_PATH = "/api/usage-stats/keys";
const PROVIDERS_PATH = "/api/usage-stats/providers";
const BALANCE_PATH = "/api/usage-stats/balance";
const LIMITS_PATH = "/api/usage-stats/limits";
const ACCOUNTS_PATH = "/api/usage-stats/accounts";
const PRICING_PATH = "/api/usage-stats/pricing";
const ALERTS_PATH = "/api/usage-stats/alerts";
const DATA_PATH = "/api/usage-stats/data";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_KEY_REF = "DEEPSEEK_API_KEY";
const UPSTREAM_TIMEOUT_MS = 15000;
const DEFAULT_REFRESH_MS = 300000;
const CACHE_VERSION = 2;
const LIMITS_VERSION = 2;
const SETTINGS_VERSION = 2;
/** Cap on in-memory alert history served to the settings UI. */
const MAX_ALERT_HISTORY = 200;

/**
 * Confirmation words accepted by the destructive data-clear endpoint.
 *
 * The UI is localized, so the protocol accepts the words currently exposed by
 * the built-in Chinese and English locales. This is deliberately checked on
 * the server as well as in the UI: a loopback client must still opt into the
 * destructive action explicitly instead of being able to send `{ action:
 * "clear" }` by accident.
 */
const DATA_CLEAR_CONFIRMATION_WORDS = new Set(["清除", "DELETE"]);

export function isDataClearConfirmation(value) {
	return typeof value === "string" && DATA_CLEAR_CONFIRMATION_WORDS.has(value.trim());
}

/** Write a JSON response. */
function json(res, status, value) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-cache"
	});
	res.end(body);
}

/**
 * Loopback fence, primary on the PEER SOCKET address (not the
 * client-controllable Host header): the request must come from a loopback
 * interface. IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is normalized. The Host
 * header is kept as an additional check, never as the deciding one.
 */
function isLoopbackAddress(address) {
	if (typeof address !== "string") return false;
	const a = address.toLowerCase();
	if (a === "::1") return true;
	const ipv4 = a.startsWith("::ffff:") ? a.slice(7) : a;
	const octets = ipv4.split(".");
	return octets.length === 4 && octets[0] === "127" && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/** Parse a Host header without breaking bracketed or bare IPv6 literals. */
function hostNameOf(value) {
	if (typeof value !== "string") return null;
	const host = value.trim().toLowerCase();
	if (host.startsWith("[")) {
		const close = host.indexOf("]");
		if (close <= 1) return null;
		const suffix = host.slice(close + 1);
		if (suffix !== "" && !/^:\d+$/.test(suffix)) return null;
		return host.slice(1, close);
	}
	const firstColon = host.indexOf(":");
	const lastColon = host.lastIndexOf(":");
	if (firstColon !== lastColon) return host;
	if (lastColon === -1) return host.replace(/\.$/, "");
	if (!/^\d+$/.test(host.slice(lastColon + 1))) return null;
	return host.slice(0, lastColon).replace(/\.$/, "");
}

function isLoopbackHostHeader(req) {
	const hostName = hostNameOf(req.headers.host);
	return hostName === "localhost" || isLoopbackAddress(hostName);
}

/** Refuse non-loopback callers and unauthorized HTTP methods before any work. */
function rejectForeignCaller(req, res, allowedMethods = ["GET"]) {
	if (!allowedMethods.includes(req.method)) {
		res.writeHead(405, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify({ ok: false, error: "method-not-allowed" }));
		return true;
	}
	const peer = req.socket?.remoteAddress;
	if (isLoopbackAddress(peer) && isLoopbackHostHeader(req)) return false;
	json(res, 403, { ok: false, error: "forbidden" });
	return true;
}

/** Read JSON request body with a safety size cap. */
export async function readJsonBody(req, limit = 65536) {
	if (req.body !== void 0 && req.body !== null) {
		if (typeof req.body === "object") return req.body;
		if (typeof req.body === "string") {
			if (Buffer.byteLength(req.body, "utf8") > limit) throw new Error("payload too large");
			try {
				return JSON.parse(req.body);
			} catch {
				throw new Error("invalid JSON body");
			}
		}
	}
	if (req.readableEnded === true) {
		return {};
	}
	return new Promise((resolve, reject) => {
		let body = "";
		let settled = false;
		req.setEncoding("utf8");
		const cleanup = () => {
			req.removeListener?.("data", onData);
			req.removeListener?.("end", onEnd);
			req.removeListener?.("error", onError);
		};
		const fail = (error, destroy = false) => {
			if (settled) return;
			settled = true;
			cleanup();
			if (destroy) req.destroy?.();
			reject(error);
		};
		const onData = (chunk) => {
			if (settled) return;
			body += chunk;
			if (Buffer.byteLength(body, "utf8") > limit) fail(new Error("payload too large"), true);
		};
		const onEnd = () => {
			if (settled) return;
			try {
				const parsed = JSON.parse(body || "{}");
				settled = true;
				cleanup();
				resolve(parsed);
			} catch {
				fail(new Error("invalid JSON body"));
			}
		};
		const onError = (error) => fail(error);
		req.on("data", onData);
		req.on("end", onEnd);
		req.on("error", onError);
	});
}

//#region config
function nonEmptyString(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function finiteNumber(value, label) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	throw new Error(`${label} must be a finite number`);
}

function numberOrNull(value) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

/**
 * Validate and normalize the plugin configuration. Credential references are
 * names only — values always come from the harness credentials seam.
 */
export function validateConfig(raw = {}) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("config must be an object");
	const baseURL = nonEmptyString(raw.baseURL) ?? DEFAULT_BASE_URL;
	let url;
	try {
		url = new URL(baseURL);
	} catch {
		throw new Error("config.baseURL must be a valid URL");
	}
	if (url.protocol !== "https:" && raw.allowInsecure !== true) throw new Error("config.baseURL must use HTTPS unless allowInsecure is true");
	const rawKeys = raw.keys === void 0 ? [] : raw.keys;
	if (!Array.isArray(rawKeys)) throw new Error("config.keys must be an array of credential references");
	const keys = [];
	for (const key of rawKeys) {
		const ref = nonEmptyString(key);
		if (ref === null) throw new Error("config.keys entries must be non-empty strings");
		if (!keys.includes(ref)) keys.push(ref);
	}
	const defaultKeyRef = nonEmptyString(raw.defaultKeyRef) ?? DEFAULT_KEY_REF;
	if (!keys.includes(defaultKeyRef)) keys.unshift(defaultKeyRef);
	const refreshMs = raw.refreshMs === void 0 ? DEFAULT_REFRESH_MS : finiteNumber(raw.refreshMs, "config.refreshMs");
	if (refreshMs < 5000) throw new Error("config.refreshMs must be at least 5000");
	// Pricing overrides are merged over the DeepSeek defaults; only the
	// documented shape is accepted.
	let pricing = null;
	if (raw.pricing !== void 0) {
		if (raw.pricing === null || typeof raw.pricing !== "object" || Array.isArray(raw.pricing)) throw new Error("config.pricing must be an object");
		// Start from the canonical default so user overrides never need to
		// reconstruct the full object; pricing.js is the single price source.
		const merged = normalizePricing(defaultPricingVersion());
		if (raw.pricing.pricing !== void 0) {
			if (raw.pricing.pricing === null || typeof raw.pricing.pricing !== "object" || Array.isArray(raw.pricing.pricing)) throw new Error("config.pricing.pricing must be an object keyed by model id");
			for (const [model, row] of Object.entries(raw.pricing.pricing)) {
				if (row === null || typeof row !== "object" || Array.isArray(row)) throw new Error(`config.pricing.pricing.${model} must be an object`);
				const current = merged.pricing[model] ?? {};
				merged.pricing[model] = {
					inputMiss: numberOrNull(row.inputMiss) ?? current.inputMiss ?? 0,
					inputHit: numberOrNull(row.inputHit) ?? current.inputHit ?? 0,
					output: numberOrNull(row.output) ?? current.output ?? 0,
					...(row.peak && typeof row.peak === "object" ? { peak: {
						inputMiss: numberOrNull(row.peak.inputMiss) ?? current.peak?.inputMiss ?? (numberOrNull(row.inputMiss) ?? current.inputMiss ?? 0),
						inputHit: numberOrNull(row.peak.inputHit) ?? current.peak?.inputHit ?? (numberOrNull(row.inputHit) ?? current.inputHit ?? 0),
						output: numberOrNull(row.peak.output) ?? current.peak?.output ?? (numberOrNull(row.output) ?? current.output ?? 0)
					} } : {})
				};
			}
		}
		if (raw.pricing.peakMultiplier !== void 0) merged.peakMultiplier = finiteNumber(raw.pricing.peakMultiplier, "config.pricing.peakMultiplier");
		if (raw.pricing.peakHours !== void 0) {
			if (!Array.isArray(raw.pricing.peakHours)) throw new Error("config.pricing.peakHours must be an array of [start, end) Beijing-time hour pairs");
			merged.peakHours = raw.pricing.peakHours.map((pair) => {
				if (!Array.isArray(pair) || pair.length !== 2) throw new Error("config.pricing.peakHours entries must be [start, end) pairs");
				const start = finiteNumber(pair[0], "config.pricing.peakHours start");
				const end = finiteNumber(pair[1], "config.pricing.peakHours end");
				if (start < 0 || start > 23 || end < 0 || end > 24 || end <= start) throw new Error("config.pricing.peakHours must satisfy 0 <= start < end <= 24");
				return [start, end];
			});
		}
		if (raw.pricing.currency !== void 0) {
			const currency = nonEmptyString(raw.pricing.currency);
			if (currency === null) throw new Error("config.pricing.currency must be a non-empty string");
			merged.currency = currency;
		}
		pricing = normalizePricing(merged);
	}
	// Per-key provider mapping: keyRef → provider ids. Lets the plugin
	// attribute today's cost (and the quota check) to the exact API key the
	// provider route uses. Providers not listed fall back to defaultKeyRef.
	const keyProviders = {};
	if (raw.keyProviders !== void 0) {
		if (raw.keyProviders === null || typeof raw.keyProviders !== "object" || Array.isArray(raw.keyProviders)) throw new Error("config.keyProviders must be an object keyed by credential reference");
		for (const [ref, providers] of Object.entries(raw.keyProviders)) {
			const keyRef = nonEmptyString(ref);
			if (keyRef === null) throw new Error("config.keyProviders keys must be non-empty strings");
			if (!Array.isArray(providers)) throw new Error(`config.keyProviders.${keyRef} must be an array of provider ids`);
			const list = [];
			for (const provider of providers) {
				const id = nonEmptyString(provider);
				if (id === null) throw new Error(`config.keyProviders.${keyRef} entries must be non-empty strings`);
				if (!list.includes(id)) list.push(id);
			}
			if (list.length > 0) keyProviders[keyRef] = list;
		}
	}
	const maxLedgerEntries = raw.maxLedgerEntries === void 0
		? DEFAULT_MAX_LEDGER_ENTRIES
		: finiteNumber(raw.maxLedgerEntries, "config.maxLedgerEntries");
	if (maxLedgerEntries < 100) throw new Error("config.maxLedgerEntries must be at least 100");
	return { keys, defaultKeyRef, baseURL, refreshMs, pricing: pricing ?? defaultPricing(), keyProviders, maxLedgerEntries, allowInsecure: raw.allowInsecure === true };
}
//#endregion

//#region incremental cache
/** Cache file location under the dsh home. */
function cachePath() {
	const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
	return join(home, "storages", "usage-stats-cache.json");
}

let loadedCache = null;
let loadPromise = null;
let inflight = null;

/** Parse one serialized day entry back into fold-state shape (lenient). */
function parseDayEntry(entry) {
	const target = { totals: zeroBuckets(), models: new Map(), hours: new Map() };
	const totals = entry.totals;
	if (totals !== null && typeof totals === "object") {
		target.totals.inputTokens = Number.isFinite(totals.inputTokens) ? totals.inputTokens : 0;
		target.totals.outputTokens = Number.isFinite(totals.outputTokens) ? totals.outputTokens : 0;
		target.totals.cacheReadTokens = Number.isFinite(totals.cacheReadTokens) ? totals.cacheReadTokens : 0;
		target.totals.cacheWriteTokens = Number.isFinite(totals.cacheWriteTokens) ? totals.cacheWriteTokens : 0;
	}
	if (entry.models !== null && typeof entry.models === "object") {
		for (const [model, buckets] of Object.entries(entry.models)) {
			if (buckets === null || typeof buckets !== "object") continue;
			target.models.set(model, {
				inputTokens: Number.isFinite(buckets.inputTokens) ? buckets.inputTokens : 0,
				outputTokens: Number.isFinite(buckets.outputTokens) ? buckets.outputTokens : 0,
				cacheReadTokens: Number.isFinite(buckets.cacheReadTokens) ? buckets.cacheReadTokens : 0,
				cacheWriteTokens: Number.isFinite(buckets.cacheWriteTokens) ? buckets.cacheWriteTokens : 0
			});
		}
	}
	if (entry.hours !== null && typeof entry.hours === "object") {
		for (const [hour, byModel] of Object.entries(entry.hours)) {
			const hourIndex = Number(hour);
			if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex > 23) continue;
			if (byModel === null || typeof byModel !== "object") continue;
			const hourModels = new Map();
			for (const [model, buckets] of Object.entries(byModel)) {
				if (buckets === null || typeof buckets !== "object") continue;
				hourModels.set(model, {
					inputTokens: Number.isFinite(buckets.inputTokens) ? buckets.inputTokens : 0,
					outputTokens: Number.isFinite(buckets.outputTokens) ? buckets.outputTokens : 0,
					cacheReadTokens: Number.isFinite(buckets.cacheReadTokens) ? buckets.cacheReadTokens : 0,
					cacheWriteTokens: Number.isFinite(buckets.cacheWriteTokens) ? buckets.cacheWriteTokens : 0
				});
			}
			if (hourModels.size > 0) target.hours.set(hourIndex, hourModels);
		}
	}
	return target;
}

/** Parse a serialized global day map (legacy snapshot) back into fold state. */
function parseDayMap(rawDays) {
	const byDay = new Map();
	if (rawDays === null || typeof rawDays !== "object") return byDay;
	for (const [date, entry] of Object.entries(rawDays)) {
		if (entry === null || typeof entry !== "object") continue;
		byDay.set(date, parseDayEntry(entry));
	}
	return byDay;
}

/** Serialize a global day map (date → totals/models/hours). */
function serializeDays(byDay) {
	const days = {};
	for (const [date, entry] of byDay) {
		const models = {};
		for (const [model, buckets] of entry.models) models[model] = { ...buckets };
		const hours = {};
		for (const [hour, hourModels] of entry.hours) {
			const byModel = {};
			for (const [model, buckets] of hourModels) byModel[model] = { ...buckets };
			hours[hour] = byModel;
		}
		days[date] = { totals: { ...entry.totals }, models, hours };
	}
	return days;
}

/**
 * Provider routes that are WIRE-ONLY FACADES over an upstream route: their
 * adapter delegates to llm.stream({ provider: upstream }), and the upstream
 * call issues the real API request (and is recorded on its own). Recording
 * both would double-count one provider bill. Skipping the facade keeps the
 * upstream entry — matching what the provider bills.
 * (vision-toolkit registers facade routes as 'vision-toolkit-<upstream>'.)
 */
const FACADE_PROVIDER_PREFIXES = ["vision-toolkit-"];
function isFacadeProvider(provider) {
	return typeof provider === "string" && FACADE_PROVIDER_PREFIXES.some((prefix) => provider.startsWith(prefix));
}

/** Parse a persisted ledger array (lenient, normalized). */
function parseLedger(raw) {
	const ledger = [];
	if (!Array.isArray(raw)) return ledger;
	for (const entry of raw) {
		if (entry === null || typeof entry !== "object") continue;
		appendLedger(ledger, {
			id: entry.id,
			occurredAt: entry.occurredAt,
			// completedAt 是账本按完成时间归小时/判峰谷的基准；缺省回退发起时间
			// （与 ledger.js 的 attribution 契约一致），否则 loadCache 按 completedAt
			// 过滤会把账本在每次重启后整体清空。
			completedAt: entry.completedAt ?? entry.occurredAt,
			provider: entry.provider,
			model: entry.model,
			turn: entry.turn,
			step: entry.step,
			sampleKey: entry.sampleKey,
			usage: entry.usage,
			...(Object.hasOwn(entry, "costCny") ? { costCny: entry.costCny } : {}),
			pricingVersion: entry.pricingVersion
		});
	}
	return ledger;
}

/**
 * Migrate a version-1 cache (session fold states) into the version-2 shape:
 * the v1 folds are frozen as a LEGACY snapshot (event-time attribution, no
 * request start times available) and the new call-level ledger starts empty.
 * Statistics switch to the ledger (request-start attribution) going forward.
 */
function migrateCacheV1(v1) {
	const byDay = new Map();
	const sessions = v1?.sessions ?? {};
	if (sessions !== null && typeof sessions === "object") {
		for (const [id, entry] of Object.entries(sessions)) {
			if (typeof id !== "string" || id === "" || entry === null || typeof entry !== "object") continue;
			const state = parseSession(entry);
			mergeInto(byDay, state.days);
		}
	}
	return {
		legacy: { updatedAt: Date.now(), days: serializeDays(byDay) },
		ledger: []
	};
}

/** Merge the legacy snapshot and the call-level ledger into one render. */
function renderCombinedUsage(cache, updatedAt, pricing = defaultPricing()) {
	const byDay = new Map();
	const legacyDays = parseDayMap(cache?.legacy?.days ?? null);
	mergeInto(byDay, legacyDays);
	mergeInto(byDay, foldLedger(cache?.ledger ?? []));
	const rendered = renderUsage(byDay, updatedAt, pricing);
	const legacy = renderUsage(legacyDays, updatedAt, pricing);
	const ledger = renderLedger(cache?.ledger ?? [], updatedAt, pricing);
	const mergeCost = (left, right) => {
		if (left === void 0) return right === void 0 ? null : right;
		if (right === void 0) return left;
		if (left === null || right === null) return null;
		return roundCost(Number(left) + Number(right));
	};
	for (const day of rendered.days) {
		const legacyDay = legacy.days.find((entry) => entry.date === day.date);
		const ledgerDay = ledger.days.find((entry) => entry.date === day.date);
		for (const model of day.models) {
			model.cost = mergeCost(legacyDay?.models?.find((entry) => entry.model === model.model)?.cost, ledgerDay?.models?.find((entry) => entry.model === model.model)?.cost);
		}
		for (const hour of day.hours) {
			const legacyHour = legacyDay?.hours?.[hour.hour];
			const ledgerHour = ledgerDay?.hours?.[hour.hour];
			for (const model of hour.models) {
				model.cost = mergeCost(legacyHour?.models?.find((entry) => entry.model === model.model)?.cost, ledgerHour?.models?.find((entry) => entry.model === model.model)?.cost);
			}
			// Non-official providers are token-only. Their model rows retain a
			// null cost, but must not make an otherwise priced official hour
			// unpriced.
			const billedHourModels = hour.models.filter((model) => isOfficialBillingProvider(providerOf(model.model)));
			hour.cost = billedHourModels.some((model) => model.cost === null)
				? null
				: roundCost(billedHourModels.reduce((sum, model) => sum + (model.cost ?? 0), 0));
		}
		const billedDayModels = day.models.filter((model) => isOfficialBillingProvider(providerOf(model.model)));
		day.cost = billedDayModels.some((model) => model.cost === null)
			? null
			: roundCost(billedDayModels.reduce((sum, model) => sum + (model.cost ?? 0), 0));
	}
	rendered.total.cost = rendered.days.some((day) => day.cost === null)
		? null
		: roundCost(rendered.days.reduce((sum, day) => sum + (day.cost ?? 0), 0));
	rendered.costBasis = {
		legacy: legacy.days.length > 0 ? "legacy-estimated" : null,
		ledger: ledger.days.length > 0 ? "frozen" : null
	};
	return rendered;
}

/** Parse a serialized session entry back into fold state (lenient). */
function parseSession(raw) {
	const state = createUsageState();
	if (raw === null || typeof raw !== "object") return state;
	state.kind = typeof raw.kind === "string" ? raw.kind : "persisted";
	state.consumed = Number.isSafeInteger(raw.consumed) ? raw.consumed : 0;
	if (typeof raw.revision === "string") state.revision = raw.revision;
	if (raw.days !== null && typeof raw.days === "object") {
		for (const [date, entry] of Object.entries(raw.days)) {
			if (entry === null || typeof entry !== "object") continue;
			state.days.set(date, parseDayEntry(entry));
		}
	}
	if (raw.lastSample !== null && raw.lastSample !== void 0 && typeof raw.lastSample === "object" && typeof raw.lastSample.key === "string" && typeof raw.lastSample.day === "string") {
		const buckets = raw.lastSample.buckets ?? {};
		state.lastSample = {
			key: raw.lastSample.key,
			day: raw.lastSample.day,
			hour: Number.isInteger(raw.lastSample.hour) && raw.lastSample.hour >= 0 && raw.lastSample.hour <= 23 ? raw.lastSample.hour : 0,
			model: typeof raw.lastSample.model === "string" ? raw.lastSample.model : "unknown",
			buckets: {
				inputTokens: Number.isFinite(buckets.inputTokens) ? buckets.inputTokens : 0,
				outputTokens: Number.isFinite(buckets.outputTokens) ? buckets.outputTokens : 0,
				cacheReadTokens: Number.isFinite(buckets.cacheReadTokens) ? buckets.cacheReadTokens : 0,
				cacheWriteTokens: Number.isFinite(buckets.cacheWriteTokens) ? buckets.cacheWriteTokens : 0
			}
		};
	}
	if (typeof raw.currentModel === "string") state.currentModel = raw.currentModel;
	return state;
}

/** Load the cache once per process; any corruption degrades to a fresh cache. */
async function loadCache() {
	if (loadedCache !== null) return loadedCache;
	loadPromise ??= (async () => {
		const fresh = { version: CACHE_VERSION, legacy: null, ledger: [] };
		try {
			const raw = await readFile(cachePath(), "utf8");
			const parsed = JSON.parse(raw);
			if (parsed !== null && typeof parsed === "object") {
				if (parsed.version === CACHE_VERSION) {
					const legacy = parsed.legacy;
					return {
						version: CACHE_VERSION,
						legacy: legacy === null || typeof legacy !== "object" ? null
							: {
								updatedAt: Number(legacy.updatedAt) || 0,
								...(Number(legacy.foldedAt) > 0 ? { foldedAt: Number(legacy.foldedAt) } : {}),
								...(Number(legacy.foldedCount) > 0 ? { foldedCount: Number(legacy.foldedCount) } : {}),
								days: legacy.days
							},
						ledger: parseLedger(parsed.ledger)
							.filter((entry) => !isFacadeProvider(entry.provider))
							.filter((entry) => Number.isFinite(entry.completedAt) && entry.completedAt > 0)
					};
				}
				if (parsed.version === 1 && parsed.sessions !== null && typeof parsed.sessions === "object") {
					// v1 → v2: freeze the event-time folds as a legacy snapshot
					// (request start times were never captured) and hand the
					// statistics over to the call-level ledger.
					return { version: CACHE_VERSION, ...migrateCacheV1(parsed) };
				}
			}
		} catch {
			/* first run or corrupt cache */
		}
		return fresh;
	})();
	loadedCache = await loadPromise;
	return loadedCache;
}

/** Persist the cache atomically (temp + rename); failures are logged, never fatal. */
async function saveCache(ctx, cache) {
	try {
		const path = cachePath();
		await mkdir(dirname(path), { recursive: true });
		const serialized = {
			version: CACHE_VERSION,
			legacy: cache.legacy,
			ledger: cache.ledger ?? []
		};
		const tmp = `${path}.tmp`;
		await writeFile(tmp, JSON.stringify(serialized), "utf8");
		await rename(tmp, path);
	} catch (error) {
		ctx.logger.warn(`usage-stats: saving usage cache failed: ${String(error)}`);
	}
}

/** Single-flight guard for READ-side aggregation: concurrent renders share one run. */
function withLock(run) {
	if (inflight !== null) return inflight;
	inflight = run().finally(() => {
		inflight = null;
	});
	return inflight;
}

/**
 * Serialized WRITE queue for ledger persistence: every call executes in
 * order and none is dropped. A single-flight guard would silently discard
 * the second concurrent completion (parallel tool calls are common) and
 * undercount billing; sharing the read lock also made collectUsage return
 * a ledger entry instead of the usage payload.
 */
let writeChain = Promise.resolve();
function serializeWrite(run) {
	const result = writeChain.then(run);
	writeChain = result.then(() => void 0, () => void 0);
	return result;
}
//#endregion

/**
 * Collect per-day/hour/model usage. Version-2 statistics are driven by the
 * call-level LEDGER (captured in the llm/stream interceptor with each
 * request's START time), merged with the frozen v1 legacy snapshot (event
 * time attribution, kept only for history that predates the ledger). Session
 * event folding is retired: request start times are not recoverable from the
 * event log, so only the ledger can match the provider's billing basis.
 */
export async function collectUsage(ctx, pricing = defaultPricing()) {
	return withLock(async () => {
		const cache = await loadCache();
		const rendered = renderCombinedUsage(cache, Date.now(), pricing);
		// Read-only aggregation: the cache file is written ONLY inside
		// recordLedgerEntry's single-flight section (atomic temp+rename), so a
		// 60s usage poll never rewrites the cache. The lock above still shares
		// one aggregation run across concurrent renders.
		return rendered;
	});
}
async function handleUsage(ctx, config, settingsService, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		const settings = await settingsService.load();
		const pricing = runtimePricingOf(settings, config);
		const result = await collectUsage(ctx, pricing);
		json(res, 200, {
			ok: true,
			...result,
			// Beijing YYYY-MM-DD for "today" (matches the client's day buckets).
			today: dayKey(Date.now()),
			pricing: {
				currency: pricing.currency,
				peakHours: pricing.peakHours,
				peakMultiplier: pricing.peakMultiplier
			}
		});
	} catch (error) {
		ctx.logger.warn(`usage-stats: usage aggregation failed: ${String(error)}`);
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

/** Resolve one credential reference to its value (empty string when absent). */
async function resolveCredential(credentials, ref) {
	if (typeof ref !== "string" || ref === "" || credentials === null || credentials === void 0 || typeof credentials.resolve !== "function") return "";
	try {
		const hit = await credentials.resolve(ref);
		return typeof hit?.value === "string" && hit.value.trim() !== "" ? hit.value : "";
	} catch {
		return "";
	}
}

function serviceOf(ctx, name) {
	return ctx?.get?.(name) ?? ctx?.[name] ?? null;
}

function valueAtPath(value, path) {
	let current = value;
	for (const segment of Array.isArray(path) ? path : []) {
		if (current === null || typeof current !== "object") return null;
		current = current[segment];
	}
	return current;
}

function builtInProviderMap() {
	const listed = typeof listBuiltInProviders === "function" ? listBuiltInProviders() : [];
	const entries = Array.isArray(listed) ? listed : Object.values(listed ?? {});
	return new Map(entries
		.filter((entry) => entry !== null && typeof entry === "object" && typeof entry.id === "string")
		.map((entry) => [entry.id, entry]));
}

/** Resolve the provider routes actually configured on Harness' model page. */
export async function configuredProviders(ctx, config, settingsSnapshot = null) {
	const credentials = serviceOf(ctx, "credentials");
	const llm = serviceOf(ctx, "llm");
	const settings = serviceOf(ctx, "settings");
	const builtins = builtInProviderMap();
	const entries = new Map();
	let activeProviderIds = null;
	let configurableEntries = [];
	const add = (entry) => {
		if (entry === null || typeof entry !== "object") return;
		const id = typeof entry.provider === "string" ? entry.provider : entry.id;
		if (typeof id !== "string" || id.trim() === "") return;
		const previous = entries.get(id);
		entries.set(id, {
			id,
			displayName: entry.displayName ?? entry.name ?? previous?.displayName ?? id,
			settingsNs: entry.settingsNs ?? previous?.settingsNs ?? null,
			settingsPath: Array.isArray(entry.settingsPath) ? entry.settingsPath : previous?.settingsPath ?? [],
			declared: entry.declared ?? previous?.declared
		});
	};
	try {
		if (typeof llm?.listProviders === "function") {
			const active = llm.listProviders();
			if (Array.isArray(active)) activeProviderIds = new Set(active.map((entry) => entry?.id).filter((id) => typeof id === "string" && id !== ""));
		}
		if (typeof llm?.listConfigurableProviders === "function") {
			const listed = llm.listConfigurableProviders();
			configurableEntries = Array.isArray(listed) ? listed : [];
		}
	} catch {
		/* A partially initialized optional llm service must not disable the panel. */
	}
	const hasSettingsDirectory = typeof settings?.get === "function";
	for (const entry of configurableEntries) {
		const id = entry?.provider;
		if (typeof id !== "string" || isFacadeProvider(id)) continue;
		if (activeProviderIds !== null && !activeProviderIds.has(id)) continue;
		const namespaceValue = entry?.settingsNs ? settings?.get?.(entry.settingsNs) : null;
		const profile = valueAtPath(namespaceValue, entry?.settingsPath);
		const existsInSettings = profile !== null && profile !== void 0 && typeof profile === "object" && !Array.isArray(profile);
		// `listConfigurableProviders()` can be a full catalog. When the settings
		// service exists, the profile is the authoritative model-page selection.
		if (!hasSettingsDirectory || !entry?.settingsNs || existsInSettings) add(entry);
	}
	const deepseekSettings = settings?.get?.("llm-deepseek");
	const deepseekConfigured = deepseekSettings !== null && deepseekSettings !== void 0 && typeof deepseekSettings === "object" && !Array.isArray(deepseekSettings);
	if ((activeProviderIds === null || activeProviderIds.has("deepseek-official")) && (!hasSettingsDirectory || deepseekConfigured)) {
		add({ provider: "deepseek-official", displayName: "DeepSeek", settingsNs: "llm-deepseek", settingsPath: [] });
	}
	const snapshot = settingsSnapshot ?? (settings?.get?.("usage-stats") ?? null);
	const defaultProviderId = typeof snapshot?.defaultProviderId === "string" && snapshot.defaultProviderId.trim() !== ""
		? snapshot.defaultProviderId.trim()
		: "deepseek-official";
	const result = [];
	for (const entry of entries.values()) {
		const meta = builtins.get(entry.id) ?? {};
		const namespaceValue = entry.settingsNs !== null ? settings?.get?.(entry.settingsNs) : null;
		const profile = valueAtPath(namespaceValue, entry.settingsPath);
		const keyRef = typeof profile?.apiKeyEnv === "string" && profile.apiKeyEnv.trim() !== ""
			? profile.apiKeyEnv.trim()
			: entry.id === "deepseek-official" ? config.defaultKeyRef : meta.apiKeyEnv ?? null;
		const baseURL = typeof profile?.baseURL === "string" && profile.baseURL.trim() !== ""
			? profile.baseURL.trim()
			: meta.defaultBaseURL ?? (entry.id === "deepseek-official" ? config.baseURL : null);
		const configured = keyRef !== null && (await resolveCredential(credentials, keyRef)) !== "";
		const capabilities = Array.isArray(meta.capabilities) && meta.capabilities.length > 0
			? [...meta.capabilities]
			: ["local_usage"];
		const queryable = meta.queryable === true;
		result.push({
			id: entry.id,
			label: entry.displayName,
			displayName: entry.displayName,
			configured,
			default: entry.id === defaultProviderId,
			keyRef,
			baseURL,
			kind: meta.kind ?? "local",
			capabilities,
			queryable,
			...(meta.planQuota ? { planQuota: { ...meta.planQuota, windows: [...meta.planQuota.windows] } } : {}),
			...(!queryable ? { status: "unsupported" } : {}),
			settingsNs: entry.settingsNs,
			settingsPath: entry.settingsPath
		});
	}
	if (!result.some((entry) => entry.id === defaultProviderId)) {
		const fallback = result.find((entry) => entry.id === "deepseek-official") ?? result.find((entry) => entry.configured) ?? result[0];
		for (const entry of result) entry.default = entry === fallback;
	}
	return result.sort((left, right) => (left.id === "deepseek-official" ? -1 : right.id === "deepseek-official" ? 1 : left.label.localeCompare(right.label)));
}

/** Provider-scoped remote query cache. Secrets never enter the returned data. */
export function createProviderService({ ctx, config, settingsService, credentials, deps = {} }) {
	const cache = new Map();
	const inflight = new Map();
	const now = deps.now ?? Date.now;
	const getProviders = () => configuredProviders(ctx, config, settingsService?.snapshot?.() ?? null);
	const get = async (providerId, accountId = null, force = false) => {
		const providers = await getProviders();
		const provider = providers.find((entry) => entry.id === providerId) ?? null;
		if (provider === null) return { id: accountId ?? providerId, providerId, status: "unsupported", fetchedAt: now(), message: "provider is not configured" };
		const ref = accountId || provider.keyRef || provider.id;
		if (!provider.queryable) {
			return { id: ref, providerId: provider.id, status: "unsupported", fetchedAt: now(), capabilities: provider.capabilities };
		}
		const key = `${provider.id}:${ref}`;
		const hit = cache.get(key);
		const age = now() - (hit?.fetchedAt ?? 0);
		if (!force && hit !== undefined && age >= 0 && age < (settingsService?.snapshot?.().refreshMs ?? config.refreshMs)) return hit;
		if (inflight.has(key)) return inflight.get(key);
		const promise = (async () => {
			if (provider.keyRef === null || (await resolveCredential(credentials, provider.keyRef)) === "") {
				return { id: ref, providerId: provider.id, status: "not-configured", fetchedAt: now(), capabilities: provider.capabilities };
			}
			try {
				const raw = await queryProviderUsage({
					providerId: provider.id,
					apiKey: await resolveCredential(credentials, provider.keyRef),
					baseURL: provider.baseURL,
					fetchImpl: deps.fetch,
					timeoutMs: deps.timeoutMs ?? UPSTREAM_TIMEOUT_MS
				});
				const account = { id: ref, providerId: provider.id, fetchedAt: now(), ...raw };
				cache.set(key, account);
				return account;
			} catch (error) {
				const account = { id: ref, providerId: provider.id, status: error?.providerStatus ?? responseStatus(error?.httpStatus ?? 0) ?? "unavailable", fetchedAt: now(), message: error instanceof Error ? error.message : String(error), capabilities: provider.capabilities };
				cache.set(key, account);
				return account;
			}
		})().finally(() => inflight.delete(key));
		inflight.set(key, promise);
		return promise;
	};
	return {
		get,
		cached: (providerId, accountId = null) => cache.get(`${providerId}:${accountId ?? providerId}`) ?? null,
		refreshAll: async () => {
			const providers = await getProviders();
			return Promise.all(providers.filter((entry) => entry.queryable && entry.configured && entry.id !== "deepseek-official").map((entry) => get(entry.id, entry.keyRef, true)));
		},
		providers: getProviders
	};
}

/** List configured API-key credential references (names only, never values). */
export async function configuredKeys(ctx, config) {
	const credentials = ctx.get("credentials") ?? ctx.credentials;
	const entries = [];
	for (const ref of config.keys) {
		const configured = (await resolveCredential(credentials, ref)) !== "";
		entries.push({ id: ref, label: ref, configured, default: ref === config.defaultKeyRef });
	}
	return entries;
}

async function handleKeys(ctx, config, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		json(res, 200, { ok: true, keys: await configuredKeys(ctx, config) });
	} catch (error) {
		ctx.logger.warn(`usage-stats: keys enumeration failed: ${String(error)}`);
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

async function handleProviders(ctx, config, providerService, settingsService, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		await settingsService.load();
		const providers = await providerService.providers();
		const defaultProviderId = providers.find((entry) => entry.default)?.id ?? providers[0]?.id ?? "deepseek-official";
		json(res, 200, { ok: true, providers, defaultProviderId });
	} catch (error) {
		ctx.logger.warn(`usage-stats: providers enumeration failed: ${String(error)}`);
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

/** Per-key balance cache with single-flight and a configurable TTL. */
export function createBalanceService({ credentials, config, deps = {} }) {
	const cache = new Map();
	const inflight = new Map();
	const refreshMs = config.refreshMs;
	const finiteBalanceAmount = (value) => {
		if (typeof value === "string" && value.trim() === "") return null;
		const number = Number(value);
		return Number.isFinite(number) ? number : null;
	};

	async function fetchBalance(ref, force = false) {
		const hit = cache.get(ref);
		const age = (deps.now ?? Date.now)() - (hit?.fetchedAt ?? 0);
		if (!force && hit !== void 0 && age >= 0 && age < refreshMs) return hit;
		// force only bypasses the cache-hit check — it never bypasses the
		// single-flight, so concurrent force callers share one upstream request.
		if (inflight.has(ref)) return inflight.get(ref);
		const promise = (async () => {
			const apiKey = await resolveCredential(credentials, ref);
			if (apiKey === "") {
				return { id: ref, status: "not-configured", fetchedAt: (deps.now ?? Date.now)() };
			}
			try {
				const raw = await (deps.queryBalance ?? queryDeepSeekBalance)(config.baseURL, apiKey, deps.timeoutMs ?? UPSTREAM_TIMEOUT_MS, deps.fetch);
				const total = finiteBalanceAmount(raw?.total);
				if (total === null) {
					const error = new Error("DeepSeek balance response is missing a numeric amount");
					error.providerStatus = "invalid-response";
					throw error;
				}
				const account = {
					id: ref,
					status: raw.isAvailable === false ? "unavailable" : "ok",
					fetchedAt: (deps.now ?? Date.now)(),
					balance: {
						currency: raw.currency ?? "CNY",
						total,
						...(raw.granted === void 0 ? {} : { granted: Number(raw.granted) }),
						...(raw.toppedUp === void 0 ? {} : { toppedUp: Number(raw.toppedUp) })
					}
				};
				cache.set(ref, account);
				return account;
			} catch (error) {
				const account = {
					id: ref,
					status: error?.providerStatus ?? responseStatus(error?.httpStatus ?? 0) ?? "unavailable",
					message: error instanceof Error ? error.message : String(error),
					fetchedAt: (deps.now ?? Date.now)()
				};
				cache.set(ref, account);
				return account;
			}
		})().finally(() => inflight.delete(ref));
		inflight.set(ref, promise);
		return promise;
	}

	return {
		get: fetchBalance,
		refreshAll: () => Promise.all(config.keys.map((ref) => fetchBalance(ref, true))),
		cached: (ref) => cache.get(ref) ?? null
	};
}

async function handleBalance(logger, ctx, config, balanceService, providerService, req, res) {
	if (rejectForeignCaller(req, res)) return;
	try {
		const url = new URL(req.url ?? "/", "http://x");
		const providerId = url.searchParams.get("provider");
		const requested = url.searchParams.get("key");
		if (providerId !== null && providerId !== "" && providerId !== "deepseek-official") {
			const account = await providerService.get(providerId, requested, url.searchParams.get("refresh") === "1");
			json(res, 200, { ok: true, account });
			return;
		}
		const keys = config.keys;
		const ref = requested !== null && requested !== "" && keys.includes(requested) ? requested : config.defaultKeyRef;
		if (ref === null || ref === void 0) {
			json(res, 200, { ok: false, error: "no-keys", message: "no API keys configured" });
			return;
		}
		const account = await balanceService.get(ref, url.searchParams.get("refresh") === "1");
		json(res, 200, { ok: true, account });
	} catch (error) {
		logger.warn(`usage-stats: balance fetch failed: ${String(error)}`);
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

/** Start an immediate refresh and repeat balance + local usage refresh every N ms.
 * The cadence and pricing are read per-tick (`getRefreshMs`/`getPricing`) so the
 * settings「账户」tab can change or disable the cadence without a restart; a
 * non-positive cadence disables the periodic timer while `refreshNow` keeps working. */
export function startBackgroundRefresh(ctx, balanceService, config, deps = {}) {
	let running = false;
	let stopped = false;
	let active = Promise.resolve();
	let timer = null;
	let scheduledMs = null;
	const getRefreshMs = deps.getRefreshMs ?? (() => config.refreshMs);
	const getPricing = deps.getPricing ?? (() => config.pricing);
	const refreshProvider = deps.refreshProvider ?? (() => Promise.resolve());
	const setTimer = deps.setInterval ?? setInterval;
	const clearTimer = deps.clearInterval ?? clearInterval;
	const run = async () => {
		if (running || stopped) return;
		running = true;
		active = (async () => {
			const results = await Promise.allSettled([balanceService.refreshAll(), refreshProvider(), collectUsage(ctx, getPricing())]);
			for (const result of results) if (result.status === "rejected") ctx.logger.warn(`usage-stats: background refresh failed: ${String(result.reason)}`);
		})().finally(() => {
			running = false;
		});
		return active;
	};
	const schedule = () => {
		if (stopped) return;
		const ms = Math.max(0, Math.floor(Number(getRefreshMs()) || 0));
		if (ms <= 0) {
			// Refresh disabled: only the on-demand refreshNow path remains.
			if (timer !== null) { clearTimer(timer); timer = null; }
			return;
		}
		if (timer !== null && scheduledMs === ms) return;
		if (timer !== null) clearTimer(timer);
		scheduledMs = ms;
		timer = setTimer(async () => { await run(); schedule(); }, ms);
		timer?.unref?.();
	};
	void run().finally(() => { if (!stopped) schedule(); });
	const stop = async () => {
		stopped = true;
		if (timer !== null) { clearTimer(timer); timer = null; }
		await active;
	};
	stop.refreshNow = async () => {
		await active;
		return run();
	};
	return stop;
}

/** Resolve the runtime refresh cadence; null is an explicit disable. */
export function refreshCadenceOf(settings, config) {
	const refreshMs = settings?.refreshMs;
	return refreshMs === null ? 0 : refreshMs ?? config?.refreshMs ?? 0;
}

//#region limits
export class UsageLimitExceededError extends Error {
	constructor(status = {}) {
		super(status.message || "Usage limit exceeded");
		this.name = "UsageLimitExceededError";
		this.code = "USAGE_LIMIT_EXCEEDED";
		this.status = status.status ?? "blocked";
		this.reason = status.reason ?? null;
		this.keyRef = status.keyRef ?? null;
		this.currentValue = status.currentValue ?? null;
		this.threshold = status.threshold ?? null;
	}
}

function defaultLimitRule() {
	return {
		enabled: false,
		period: "daily",
		dailyCostLimit: null,
		monthlyCostLimit: null,
		lowBalanceWarning: null,
		minBalance: null,
		alertPercent: 80,
		criticalPercent: 90,
		// Hard stop is opt-in; normal configurations remain advisory.
		stopOnExceed: false,
		notificationCooldownMs: 30 * 60 * 1000
	};
}

function defaultLimits() {
	return {
		version: LIMITS_VERSION,
		global: defaultLimitRule(),
		keys: {}
	};
}

const LIMIT_RULE_FIELDS = new Set([
	"enabled", "period", "dailyCostLimit", "monthlyCostLimit", "lowBalanceWarning",
	"minBalance", "alertPercent", "criticalPercent", "stopOnExceed", "notificationCooldownMs"
]);

function validateLimitRule(raw = {}, { legacy = true, strict = false } = {}) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return defaultLimitRule();
	if (strict) {
		for (const field of Object.keys(raw)) {
			if (!LIMIT_RULE_FIELDS.has(field)) throw new TypeError(`unknown limit rule field: ${field}`);
		}
	}
	const enabled = raw.enabled === true;
	const period = ["daily", "monthly", "custom", "cumulative"].includes(raw.period) ? raw.period : "daily";
	const dailyCostLimit = numberOrNull(raw.dailyCostLimit);
	const monthlyCostLimit = numberOrNull(raw.monthlyCostLimit);
	const lowBalanceWarning = numberOrNull(raw.lowBalanceWarning);
	const minBalance = numberOrNull(raw.minBalance);
	let alertPercent = 80;
	if (raw.alertPercent !== void 0) {
		const parsed = Number(raw.alertPercent);
		if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) alertPercent = Math.round(parsed);
	}
	let criticalPercent = 90;
	if (raw.criticalPercent !== void 0) {
		const parsed = Number(raw.criticalPercent);
		if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) criticalPercent = Math.max(alertPercent, Math.round(parsed));
	}
	return {
		enabled,
		dailyCostLimit: dailyCostLimit !== null && dailyCostLimit > 0 ? dailyCostLimit : null,
		lowBalanceWarning: lowBalanceWarning !== null && lowBalanceWarning > 0 ? lowBalanceWarning : null,
		alertPercent,
		criticalPercent,
		period,
		monthlyCostLimit: monthlyCostLimit !== null && monthlyCostLimit > 0 ? monthlyCostLimit : null,
		// Schema v1 exposed these fields before their safety semantics were
		// stable. Migrate old files fail-open; only an explicit v2 save may
		// enable a balance-based hard stop.
		minBalance: !legacy && minBalance !== null && minBalance > 0 ? minBalance : null,
		stopOnExceed: !legacy && raw.stopOnExceed === true,
		notificationCooldownMs: Number.isFinite(Number(raw.notificationCooldownMs)) && Number(raw.notificationCooldownMs) >= 0 ? Math.min(7 * 86400000, Number(raw.notificationCooldownMs)) : 30 * 60 * 1000
	};
}

function validateLimits(raw = {}) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return defaultLimits();
	const legacy = Number(raw.version) !== LIMITS_VERSION;
	if (!legacy) {
		for (const field of Object.keys(raw)) {
			if (!["version", "global", "keys"].includes(field)) throw new TypeError(`unknown limits field: ${field}`);
		}
	}
	const globalRule = validateLimitRule(raw.global ?? {}, { legacy, strict: !legacy });
	const keys = {};
	if (raw.keys !== null && typeof raw.keys === "object" && !Array.isArray(raw.keys)) {
		for (const [keyRef, rule] of Object.entries(raw.keys)) {
			const ref = nonEmptyString(keyRef);
			if (ref !== null) keys[ref] = validateLimitRule(rule, { legacy, strict: !legacy });
		}
	}
	return {
		version: LIMITS_VERSION,
		global: globalRule,
		keys
	};
}

function limitsPath() {
	const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
	return join(home, "storages", "usage-limits.json");
}

let loadedLimits = null;

async function loadLimits() {
	if (loadedLimits !== null) return loadedLimits;
	try {
		const raw = await readFile(limitsPath(), "utf8");
		const parsed = JSON.parse(raw);
		loadedLimits = validateLimits(parsed);
		return loadedLimits;
	} catch {
		loadedLimits = defaultLimits();
		return loadedLimits;
	}
}

async function saveLimits(ctx, limits) {
	const path = limitsPath();
	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	await writeFile(tmp, JSON.stringify(limits, null, 2), "utf8");
	await rename(tmp, path);
	loadedLimits = limits;
}

/** Map a provider id to its API-key reference via `config.keyProviders`. */
export function keyForProvider(provider, config) {
	for (const [ref, providers] of Object.entries(config.keyProviders ?? {})) {
		if (providers.includes(provider)) return ref;
	}
	return null;
}

/**
 * Today's estimated cost per API key, derived from the per-model cost split.
 * With `keyProviders` configured, each model's cost is attributed to the key
 * owning its provider route (unmapped providers go to the default key).
 * Without a mapping, attribution is impossible, so every key sees the global
 * today cost (per-key daily limits still work, they just share the total).
 * @returns Map<keyRef, cost>.
 */
export function todayCostPerKey(usageDays, today, config) {
	const perKey = new Map();
	const mapped = Object.keys(config.keyProviders ?? {}).length > 0;
	for (const day of usageDays ?? []) {
		if (day.date !== today) continue;
		for (const model of day.models ?? []) {
			if (!isOfficialBillingProvider(providerOf(model.model))) continue;
			const cost = Number(model.cost) || 0;
			if (cost <= 0) continue;
			const ref = keyForProvider(providerOf(model.model), config) ?? config.defaultKeyRef;
			perKey.set(ref, (perKey.get(ref) ?? 0) + cost);
		}
	}
	return { perKey, mapped };
}

/** The today-cost a quota check should use for one key. */
export function todayCostFor(ref, perKey, globalTodayCost, config) {
	const mapped = Object.keys(config.keyProviders ?? {}).length > 0;
	if (!mapped) return globalTodayCost;
	return perKey.get(ref) ?? 0;
}

/** Beijing `YYYY-MM-DD` for today (matches the usage.js day buckets). */
function todayKeyLocal() {
	return dayKey(Date.now());
}

/** Build the per-key status map once, shared by evaluateStatus/evaluateAll. */
async function evaluateStatuses({ ctx, config, balanceService, limits, usage, today, deps }) {
	const dayEntry = (usage.days ?? []).find((d) => d.date === today);
	// 当日任一模型未定价（未知模型 id / 缺 model）→ day.cost 为 null：消费金额
	// 不可靠，绝不能静默当成 0 消费（否则日限额/硬停止整日失效）。
	const costReliable = dayEntry === void 0 || dayEntry.cost !== null;
	const globalTodayCost = dayEntry === void 0 ? 0 : (dayEntry.cost ?? 0);
	const { perKey } = todayCostPerKey(usage.days, today, config);
	const keys = [...new Set([...config.keys, ...Object.keys(limits.keys)])];
	// First pass: collect the refs whose cached balance is stale or missing.
	// They are refreshed concurrently below — balanceService.get single-flights,
	// so parallel callers never duplicate upstream requests.
	const refreshTargets = [];
	for (const ref of keys) {
		const now = (deps.now ?? Date.now)();
		const account = typeof balanceService?.cached === "function" ? balanceService.cached(ref) : null;
		const cachedAt = Number(account?.fetchedAt);
		const cacheFresh = account !== null
			&& Number.isFinite(cachedAt)
			&& cachedAt <= now
			&& now - cachedAt < config.refreshMs;
		if (!cacheFresh && typeof balanceService?.get === "function") refreshTargets.push(ref);
	}
	const refreshed = new Map();
	if (refreshTargets.length > 0) {
		const settled = await Promise.all(refreshTargets.map((ref) =>
			balanceService.get(ref).then((account) => [ref, account]).catch(() => [ref, null])
		));
		for (const [ref, account] of settled) refreshed.set(ref, account);
	}
	const statuses = {};
	for (const ref of keys) {
		const now = (deps.now ?? Date.now)();
		const account = refreshed.has(ref)
			? refreshed.get(ref)
			: (typeof balanceService?.cached === "function" ? balanceService.cached(ref) : null);
		statuses[ref] = evaluateKeyQuota({
			keyRef: ref,
			limits,
			todayCost: todayCostFor(ref, perKey, globalTodayCost, config),
			todayCostReliable: costReliable,
			balance: account?.balance ?? null,
			balanceStatus: account?.status,
			balanceFetchedAt: account?.fetchedAt,
			now,
			balanceMaxAgeMs: config.refreshMs
		});
	}
	return { statuses, globalTodayCost };
}

/**
 * Effective limit rule for one key: the per-key rule when it actually
 * carries a numeric daily cost limit, otherwise the global
 * rule. A per-key record with no numbers (an "empty shell" left behind by a
 * previously enabled key) must NOT shadow the global rule — otherwise the
 * user's global limits silently stop applying to that key.
 */
function resolveLimitRule(allLimits, keyRef) {
	const global = allLimits?.global ?? defaultLimitRule();
	const keyRule = allLimits?.keys?.[keyRef];
	if (keyRule === void 0) return global;
	const hasNumbers = (keyRule.dailyCostLimit !== null && keyRule.dailyCostLimit > 0)
		|| (keyRule.monthlyCostLimit !== null && keyRule.monthlyCostLimit > 0)
		|| (keyRule.lowBalanceWarning !== null && keyRule.lowBalanceWarning > 0)
		|| (keyRule.minBalance !== null && keyRule.minBalance > 0);
	if (!hasNumbers) return global;
	// Numbered per-key rule: override the global for its explicit fields and
	// inherit the global for any field left unset (null), so the global stays
	// the floor and a key can only tighten — never silently opt out.
	return {
		// Key 只能收紧、不能静默退出：全局开启时，Key 的 enabled:false 不得
		// 关掉整个限额（与 stopOnExceed 的 OR 语义一致）。
		enabled: keyRule.enabled === true || global.enabled === true,
		period: keyRule.period ?? global.period ?? "daily",
		dailyCostLimit: keyRule.dailyCostLimit ?? global.dailyCostLimit ?? null,
		monthlyCostLimit: keyRule.monthlyCostLimit ?? global.monthlyCostLimit ?? null,
		lowBalanceWarning: keyRule.lowBalanceWarning ?? global.lowBalanceWarning ?? null,
		alertPercent: keyRule.alertPercent ?? global.alertPercent ?? 80,
		criticalPercent: keyRule.criticalPercent ?? global.criticalPercent ?? 90,
		minBalance: keyRule.minBalance ?? global.minBalance ?? null,
		stopOnExceed: keyRule.stopOnExceed === true || global.stopOnExceed === true,
		notificationCooldownMs: keyRule.notificationCooldownMs ?? global.notificationCooldownMs ?? 30 * 60 * 1000
	};
}

function evaluateKeyQuota({ keyRef, limits, todayCost = 0, todayCostReliable = true, balance = null, balanceStatus, balanceFetchedAt, now = Date.now(), balanceMaxAgeMs = Infinity }) {
	const allLimits = limits ?? defaultLimits();
	const rule = resolveLimitRule(allLimits, keyRef);
	const numericCost = Number(todayCost) || 0;
	const numericBalance = balance !== null && Number.isFinite(Number(balance.total)) ? Number(balance.total) : null;
	const balanceFresh = balanceStatus === void 0
		? true
		: balanceStatus === "ok"
			&& Number.isFinite(Number(balanceFetchedAt))
			&& Number(balanceFetchedAt) <= now
			&& now - Number(balanceFetchedAt) <= balanceMaxAgeMs;
	const balanceAlertStatus = rule.enabled && rule.lowBalanceWarning !== null && numericBalance !== null && balanceFresh
		? (numericBalance <= 0 ? "exceeded" : numericBalance <= rule.lowBalanceWarning ? "warning" : "ok")
		: "muted";
	const balanceExceeded = rule.enabled && rule.minBalance !== null && numericBalance !== null && balanceFresh && numericBalance <= rule.minBalance;
	const balanceRuleEnabled = rule.enabled && (rule.lowBalanceWarning !== null || rule.minBalance !== null);
	const unavailable = balanceRuleEnabled && balanceStatus !== void 0 && balanceStatus !== null && balanceStatus !== "ok" && balanceStatus !== "not-configured";
	const stale = balanceRuleEnabled && balanceStatus === "ok" && numericBalance !== null && !balanceFresh;

	if (!rule.enabled) {
		return {
			keyRef,
			enabled: false,
			status: "normal",
			spendStatus: "muted",
			balanceAlertStatus,
			exceeded: false,
			warning: false,
			reason: null,
			stopOnExceed: rule.stopOnExceed,
			todayCost: numericCost,
			dailyCostLimit: rule.dailyCostLimit,
			lowBalanceWarning: rule.lowBalanceWarning,
			minBalance: rule.minBalance,
			alertPercent: rule.alertPercent,
			currentBalance: numericBalance,
			balanceStatus: balanceStatus ?? null,
			balanceFresh,
			stale: false,
			unavailable: false,
			blocked: false,
			currentValue: numericCost,
			threshold: rule.dailyCostLimit,
			scope: { type: keyRef ? "key" : "global", id: keyRef || null },
			currency: "CNY",
			evaluatedAt: now,
			sourceUpdatedAt: Number.isFinite(Number(balanceFetchedAt)) ? Number(balanceFetchedAt) : null,
			notificationCooldownMs: rule.notificationCooldownMs,
			message: ""
		};
	}

	let exceeded = false;
	let warning = false;
	let spendExceeded = false;
	let spendWarning = false;
	let reason = null;
	let message = "";

	// Check daily cost limit (skipped when today's cost is unreliable: any
	// unpriced model makes the amount unknowable — never treat it as zero).
	if (todayCostReliable !== false && rule.dailyCostLimit !== null && rule.dailyCostLimit > 0) {
		if (numericCost >= rule.dailyCostLimit * (rule.criticalPercent / 100)) {
			exceeded = true;
			spendExceeded = true;
			reason = "daily_cost";
			message = `今日消费 (${numericCost.toFixed(2)}) 已达到严重预警线 (${rule.criticalPercent}%)`;
		} else if (numericCost >= (rule.dailyCostLimit * (rule.alertPercent / 100))) {
			warning = true;
			spendWarning = true;
				reason = "daily_cost";
			message = `今日消费 (${numericCost.toFixed(2)}) 已达到每日限额 (${rule.dailyCostLimit.toFixed(2)}) 的 ${rule.alertPercent}% 预警线`;
		}
	}
	if (balanceExceeded && !exceeded) {
		exceeded = true;
		reason = "min_balance";
		message = `余额 (${numericBalance.toFixed(2)}) 已低于警戒线 (${rule.minBalance.toFixed(2)})`;
	} else if (!exceeded && !warning && balanceAlertStatus === "exceeded") {
		exceeded = true;
		reason = "low_balance";
		message = `余额 (${numericBalance.toFixed(2)}) 已达到余额预警线 (${rule.lowBalanceWarning.toFixed(2)})`;
	} else if (!exceeded && !warning && balanceAlertStatus === "warning") {
		warning = true;
		reason = "low_balance";
		message = `余额 (${numericBalance.toFixed(2)}) 已低于余额预警线 (${rule.lowBalanceWarning.toFixed(2)})`;
	}

	const unpriced = todayCostReliable === false;
	if (unpriced && reason === null) {
		reason = "unpriced";
		message = "今日用量包含未定价模型，消费金额不可靠，日限额暂不参与拦截";
	}
	const spendStatus = rule.dailyCostLimit !== null && rule.dailyCostLimit > 0
		? (spendExceeded ? "exceeded" : (spendWarning ? "warning" : (unpriced ? "muted" : "normal")))
		: "muted";
	const costLimitReached = rule.dailyCostLimit !== null && rule.dailyCostLimit > 0 && numericCost >= rule.dailyCostLimit;
	const hardLimitReached = balanceExceeded || costLimitReached;
	const blocked = exceeded && rule.stopOnExceed && hardLimitReached;
	// 硬停止消息必须点明真实触发原因（达到 100% 限额或余额跌破保障线），
	// 不能沿用 90% 预警文案——否则用户会误以为在 90% 就被拦截。
	if (blocked) {
		if (balanceExceeded) {
			reason = "min_balance";
			message = `余额 (${numericBalance.toFixed(2)}) 已低于最低余额保障线 (${rule.minBalance.toFixed(2)})，已停止新调用`;
		} else if (costLimitReached) {
			reason = "daily_cost";
			message = `今日消费 (${numericCost.toFixed(2)}) 已达到每日限额 (${rule.dailyCostLimit.toFixed(2)})，已停止新调用`;
		}
	}
	const status = blocked ? "blocked"
		: exceeded ? "exceeded"
			: warning ? "warning"
				: unpriced ? "unpriced"
					: stale ? "stale"
					: unavailable ? "unavailable"
						: balanceAlertStatus === "warning" || balanceAlertStatus === "exceeded" ? balanceAlertStatus : "normal";
	if (reason === null && stale) {
		reason = "data_stale";
		message = "余额数据已过期，余额相关限额暂不参与硬停止";
	} else if (reason === null && unavailable) {
		reason = "query_failed";
		message = "余额暂不可用，余额相关限额暂不参与硬停止";
	}
	return {
		keyRef,
		enabled: true,
		status,
		spendStatus,
		balanceAlertStatus,
		exceeded,
		warning,
		reason,
		stopOnExceed: rule.stopOnExceed,
		blocked: status === "blocked",
		todayCost: numericCost,
		dailyCostLimit: rule.dailyCostLimit,
		lowBalanceWarning: rule.lowBalanceWarning,
		minBalance: rule.minBalance,
		alertPercent: rule.alertPercent,
		currentBalance: numericBalance,
		balanceStatus: balanceStatus ?? null,
		balanceFresh,
		stale,
		unavailable,
		currentValue: reason === "min_balance" ? numericBalance : numericCost,
		threshold: reason === "min_balance" ? rule.minBalance : rule.dailyCostLimit,
		scope: { type: keyRef ? "key" : "global", id: keyRef || null },
		currency: "CNY",
		evaluatedAt: now,
		sourceUpdatedAt: Number.isFinite(Number(balanceFetchedAt)) ? Number(balanceFetchedAt) : null,
		notificationCooldownMs: rule.notificationCooldownMs,
		message
	};
}

/** Track alert crossings without emitting on every request or poll. */
function createAlertTracker({ now = Date.now } = {}) {
	const states = new Map();
	const alertStatuses = new Set(["warning", "exceeded", "blocked", "stale", "unavailable"]);
	return {
		observe(status = {}) {
			const scope = status.scope ?? { type: status.keyRef ? "key" : "global", id: status.keyRef ?? null };
			const scopeKey = `${scope.type}:${scope.id ?? ""}`;
			const currentStatus = status.status ?? "normal";
			const alerting = alertStatuses.has(currentStatus);
			const identity = `${currentStatus}|${status.reason ?? ""}|${status.threshold ?? ""}`;
			const previous = states.get(scopeKey);
			const at = Number(now());
			const cooldown = Math.max(0, Number(status.notificationCooldownMs) || 0);
			let shouldNotify = false;
			let type = null;
			if (alerting) {
				const crossed = previous === void 0 || previous.alerting !== true || previous.identity !== identity;
				const cooledDown = previous?.lastNotifiedAt !== null && previous?.lastNotifiedAt !== void 0 && at - previous.lastNotifiedAt >= cooldown;
				shouldNotify = crossed || cooledDown;
				type = shouldNotify ? "alert" : null;
			} else if (currentStatus === "normal" && previous?.alerting === true) {
				shouldNotify = true;
				type = "recovery";
			}
			states.set(scopeKey, {
				alerting,
				identity,
				lastNotifiedAt: shouldNotify ? at : (previous?.lastNotifiedAt ?? null)
			});
			return { shouldNotify, type, at: shouldNotify ? at : null };
		}
	};
}

/**
 * Map a quota status to the notification event category the「通知与提示」
 * settings toggle. `recovery` is handled by the caller from the event type;
 * alerting statuses collapse onto warning / exceeded / lowBalance so the
 * per-event switches actually gate what gets recorded and delivered.
 */
function alertEventCategoryOf(status = {}) {
	if (status?.reason === "min_balance" || status?.reason === "low_balance") return "lowBalance";
	if (status?.status === "blocked" || status?.status === "exceeded") return "exceeded";
	return "warning";
}

/** Default cap on ledger entries before the oldest overflow is folded into legacy. */
const DEFAULT_MAX_LEDGER_ENTRIES = 5000;

/**
 * Append one call-level ledger entry and persist it atomically before return.
 * When the ledger exceeds `deps.maxLedgerEntries` (default 5000), the oldest
 * overflow entries are folded into the legacy snapshot (see compactLedger).
 * NOTE: the folded entries' frozen `costCny` is dropped — that history falls
 * back to the legacy estimation basis (render-time pricing), not the frozen
 * price, and the snapshot is stamped with a new `updatedAt`.
 * @param ctx - plugin context (logger).
 * @param entry - the normalized call-level ledger entry.
 * @param deps - optional { maxLedgerEntries } (number or function); the two-arg call stays valid.
 */
async function recordLedgerEntry(ctx, entry, deps = {}) {
	return serializeWrite(async () => {
		const cache = await loadCache();
		appendLedger(cache.ledger, entry);
		const rawMax = typeof deps?.maxLedgerEntries === "function" ? deps.maxLedgerEntries() : deps?.maxLedgerEntries;
		const maxEntries = Number.isFinite(Number(rawMax)) && Number(rawMax) > 0
			? Number(rawMax)
			: DEFAULT_MAX_LEDGER_ENTRIES;
		if (cache.ledger.length > maxEntries) {
			const removed = compactLedger(cache.ledger, maxEntries);
			if (removed.length > 0) {
				// Fold the oldest entries into the serialized legacy day map
				// (plain object ↔ Map via parseDayMap/serializeDays) and merge
				// with any pre-existing legacy snapshot. The folded markers let
				// the「数据管理」tab tell exact ledger history from estimated legacy.
				const byDay = parseDayMap(cache.legacy?.days ?? null);
				mergeInto(byDay, foldLedger(removed));
				cache.legacy = {
					updatedAt: Date.now(),
					foldedAt: Date.now(),
					foldedCount: Number(cache.legacy?.foldedCount ?? 0) + removed.length,
					days: serializeDays(byDay)
				};
			}
		}
		await saveCache(ctx, cache);
		return entry;
	});
}

function createLimitsService({ ctx, config, balanceService, deps = {} }) {
	let memoryLimits = null;
	const alertTracker = deps.alertTracker ?? createAlertTracker({ now: deps.now ?? Date.now });
	const alertHistory = [];

	async function getLimits() {
		if (memoryLimits !== null) return memoryLimits;
		memoryLimits = validateLimits(await (deps.loadLimits ?? loadLimits)());
		return memoryLimits;
	}

	async function updateLimits(raw) {
		// 空/畸形 body（null、{}、无 global/keys）会把配置静默重置为默认值并
		// 持久化，清空全部限额规则——客户端总是在加载完成后发送完整文档，
		// 因此拒绝这类载荷是安全的。
		const body = raw === null || typeof raw !== "object" || Array.isArray(raw) ? null : raw;
		if (body === null || (typeof body.global !== "object" && typeof body.keys !== "object")) {
			throw new TypeError("limits payload must carry a global rule or a keys map");
		}
		const validated = validateLimits(body);
		await (deps.saveLimits ?? saveLimits)(ctx, validated);
		memoryLimits = validated;
		return validated;
	}

	async function runtimePricing() {
		const settings = typeof deps.settings?.load === "function" ? await deps.settings.load() : { pricing: null };
		return runtimePricingOf(settings, config);
	}

	async function evaluateStatus(keyRef) {
		const limits = await getLimits();
		const ref = keyRef || config.defaultKeyRef;
		const usage = await (deps.collectUsage ?? collectUsage)(ctx, await runtimePricing());
		const today = (deps.todayKey ?? todayKeyLocal)();
		const { statuses } = await evaluateStatuses({ ctx, config, balanceService, limits, usage, today, deps });
		return statuses[ref] ?? evaluateKeyQuota({ keyRef: ref, limits, todayCost: (usage.days ?? []).find((d) => d.date === today)?.cost ?? 0, balance: null });
	}

	async function evaluateAll() {
		const limits = await getLimits();
		const settings = typeof deps.settings?.load === "function" ? await deps.settings.load() : { pricing: null };
		const usage = await (deps.collectUsage ?? collectUsage)(ctx, runtimePricingOf(settings, config));
		const today = (deps.todayKey ?? todayKeyLocal)();
		const { statuses, globalTodayCost } = await evaluateStatuses({ ctx, config, balanceService, limits, usage, today, deps });
		// 通知策略真正生效：冷却时间来自「通知与提示」设置（而不是限额规则里
		// 那个独立的 cooldown），事件开关按状态映射过滤后才会进入环形历史。
		const notifications = settings.notifications ?? defaultSettings().notifications;
		const cooldownMs = Number.isFinite(Number(notifications.cooldownMs)) && Number(notifications.cooldownMs) >= 0
			? Number(notifications.cooldownMs)
			: 30 * 60 * 1000;
		const events = notifications.events ?? defaultSettings().notifications.events;
		for (const status of Object.values(statuses)) {
			status.notificationCooldownMs = cooldownMs;
			status.notification = alertTracker.observe(status);
			if (status.notification?.shouldNotify === true) {
				const event = status.notification.type === "recovery" ? "recovery" : alertEventCategoryOf(status);
				if (events[event] === false) continue;
				alertHistory.push({
					at: status.notification.at,
					type: status.notification.type,
					event,
					keyRef: status.keyRef ?? null,
					status: status.status ?? "normal",
					reason: status.reason ?? null,
					message: status.message ?? "",
					currentValue: status.currentValue ?? null,
					threshold: status.threshold ?? null
				});
				if (alertHistory.length > MAX_ALERT_HISTORY) alertHistory.splice(0, alertHistory.length - MAX_ALERT_HISTORY);
			}
		}
		return { limits, statuses, todayCost: globalTodayCost, alerts: [...alertHistory] };
	}

	async function check(payload = {}) {
		// Resolve the key by the request's provider route first (per-key
		// enforcement), then explicit payload hints, then the default key.
		const provider = payload?.config?.provider ?? payload?.provider;
		if (!isOfficialBillingProvider(provider)) {
			return { status: "not_applicable", blocked: false, reason: "provider_not_billed" };
		}
		const byProvider = typeof provider === "string" && provider !== "" ? keyForProvider(provider, config) : null;
		const targetKey = byProvider
			?? payload?.key ?? payload?.keyRef ?? payload?.apiKeyRef ?? payload?.config?.apiKeyRef
			?? config.defaultKeyRef;
		return evaluateStatus(targetKey);
	}

	return {
		getLimits,
		updateLimits,
		evaluateStatus,
		evaluateAll,
		check
	};
}

async function handleLimits(ctx, config, limitsService, req, res) {
	if (rejectForeignCaller(req, res, ["GET", "POST"])) return;
	try {
		if (req.method === "GET") {
			const evaluated = await limitsService.evaluateAll();
			json(res, 200, { ok: true, limits: evaluated.limits, status: evaluated.statuses, defaultKeyRef: config.defaultKeyRef, todayCost: evaluated.todayCost, alerts: evaluated.alerts });
		} else if (req.method === "POST") {
			const body = await readJsonBody(req);
			const updated = await limitsService.updateLimits(body);
			const evaluated = await limitsService.evaluateAll();
			json(res, 200, { ok: true, limits: updated, status: evaluated.statuses, defaultKeyRef: config.defaultKeyRef, todayCost: evaluated.todayCost, alerts: evaluated.alerts });
		}
	} catch (error) {
		ctx.logger.warn(`usage-stats: limits request failed: ${String(error)}`);
		if (error instanceof TypeError) {
			json(res, 400, { ok: false, error: "invalid-payload", message: error.message });
			return;
		}
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}
//#endregion

//#region settings store
/** Runtime settings storage: refresh cadence, sidebar display toggles, custom
 * pricing, ledger capacity and notification policy. Startup config is the
 * baseline; values written through the settings endpoints persist here and
 * override the startup config for the rest of the process lifetime. */
function settingsPath() {
	const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
	return join(home, "storages", "usage-settings.json");
}

function defaultPlanQuota() {
	const thresholds = { warningRemainingPercent: 30, criticalRemainingPercent: 10 };
	return {
		...thresholds,
		windows: {
			five_hour: { ...thresholds },
			weekly: { ...thresholds }
		}
	};
}

function defaultSettings() {
	return {
		version: SETTINGS_VERSION,
		defaultProviderId: "deepseek-official",
		refreshMs: null,
		display: { balance: true, todayCost: true, statusDot: true },
		pricing: null,
		maxLedgerEntries: null,
		notifications: {
			channels: { sidebar: true, toast: false },
			events: { warning: true, exceeded: true, lowBalance: true, recovery: true },
			planQuota: defaultPlanQuota(),
			cooldownMs: 30 * 60 * 1000
		},
		conversation: {
			enabled: true,
			showTokenUsage: true
		}
	};
}

/** Lenient normalization of persisted runtime settings. */
function validateSettings(raw = {}) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return defaultSettings();
	const out = defaultSettings();
	if (typeof raw.defaultProviderId === "string" && raw.defaultProviderId.trim() !== "") out.defaultProviderId = raw.defaultProviderId.trim();
	if (raw.refreshMs === null || raw.refreshMs === void 0) out.refreshMs = null;
	else {
		const ms = Number(raw.refreshMs);
		out.refreshMs = Number.isFinite(ms) && ms >= 5000 ? ms : null;
	}
	if (raw.display !== null && typeof raw.display === "object") {
		out.display = {
			balance: raw.display.balance !== false,
			todayCost: raw.display.todayCost !== false,
			statusDot: raw.display.statusDot !== false
		};
	}
	if (raw.pricing !== null && typeof raw.pricing === "object" && !Array.isArray(raw.pricing)) {
		out.pricing = normalizePricing(raw.pricing);
	}
	const maxEntries = Number(raw.maxLedgerEntries);
	if (Number.isFinite(maxEntries) && maxEntries > 0) out.maxLedgerEntries = Math.floor(maxEntries);
	if (raw.notifications !== null && typeof raw.notifications === "object") {
		const n = raw.notifications;
		const defaultQuota = defaultPlanQuota();
		const normalizeQuotaThresholds = (candidate, fallback) => {
			const warningRemainingPercent = Number(candidate?.warningRemainingPercent);
			const criticalRemainingPercent = Number(candidate?.criticalRemainingPercent);
			const valid = Number.isFinite(warningRemainingPercent)
				&& Number.isFinite(criticalRemainingPercent)
				&& warningRemainingPercent >= 0
				&& warningRemainingPercent <= 100
				&& criticalRemainingPercent >= 0
				&& criticalRemainingPercent <= warningRemainingPercent;
			return valid
				? { warningRemainingPercent: Math.round(warningRemainingPercent), criticalRemainingPercent: Math.round(criticalRemainingPercent) }
				: { ...fallback };
		};
		const flatPlanQuota = normalizeQuotaThresholds(n.planQuota, {
			warningRemainingPercent: defaultQuota.warningRemainingPercent,
			criticalRemainingPercent: defaultQuota.criticalRemainingPercent
		});
		const windows = n.planQuota?.windows;
		out.notifications = {
			channels: {
				sidebar: n.channels?.sidebar !== false,
				toast: n.channels?.toast === true
			},
			events: {
				warning: n.events?.warning !== false,
				exceeded: n.events?.exceeded !== false,
				lowBalance: n.events?.lowBalance !== false,
				recovery: n.events?.recovery !== false
			},
			planQuota: {
				...flatPlanQuota,
				windows: {
					five_hour: normalizeQuotaThresholds(windows?.five_hour, flatPlanQuota),
					weekly: normalizeQuotaThresholds(windows?.weekly, flatPlanQuota)
				}
			},
			cooldownMs: Number.isFinite(Number(n.cooldownMs)) && Number(n.cooldownMs) >= 0
				? Math.min(7 * 86400000, Number(n.cooldownMs))
				: 30 * 60 * 1000
		};
	}
	if (raw.conversation !== null && typeof raw.conversation === "object" && !Array.isArray(raw.conversation)) {
		out.conversation = {
			enabled: raw.conversation.enabled !== false,
			showTokenUsage: raw.conversation.showTokenUsage !== false
		};
	}
	return out;
}

async function loadSettingsFile() {
	try {
		const raw = await readFile(settingsPath(), "utf8");
		return JSON.parse(raw);
	} catch {
		return defaultSettings();
	}
}

async function saveSettingsFile(ctx, settings) {
	try {
		const path = settingsPath();
		await mkdir(dirname(path), { recursive: true });
		const tmp = `${path}.tmp`;
		await writeFile(tmp, JSON.stringify(settings, null, 2), "utf8");
		await rename(tmp, path);
	} catch (error) {
		ctx.logger?.warn?.(`usage-stats: saving settings failed: ${String(error)}`);
	}
}

/** Load-once + persist runtime settings; `update` merges a patch and saves. */
function createSettingsService({ ctx, config, deps = {} }) {
	let memory = null;
	let loadPromise = null;
	async function load() {
		if (memory !== null) return memory;
		loadPromise ??= (async () => {
			const loaded = typeof deps.loadSettings === "function"
				? await deps.loadSettings()
				: await loadSettingsFile();
			memory = validateSettings(loaded);
			return memory;
		})();
		return loadPromise;
	}
	async function update(patch) {
		const current = await load();
		const merged = { ...current, ...patch };
		if (patch?.conversation !== null && typeof patch?.conversation === "object" && !Array.isArray(patch.conversation)) {
			merged.conversation = { ...current.conversation, ...patch.conversation };
		}
		const next = validateSettings(merged);
		if (typeof deps.saveSettings === "function") await deps.saveSettings(next);
		else await saveSettingsFile(ctx, next);
		memory = next;
		return next;
	}
	function snapshot() {
		return memory ?? defaultSettings();
	}
	return { load, update, snapshot };
}

/** Effective pricing for rendering: runtime custom scheme wins over startup. */
function runtimePricingOf(settings, config) {
	if (settings?.pricing !== null && settings?.pricing !== undefined) return settings.pricing;
	return config.pricing;
}

/** Effective ledger capacity: runtime setting wins over startup config. */
function maxLedgerEntriesOf(settings, config) {
	const fromSettings = Number(settings?.maxLedgerEntries);
	if (Number.isFinite(fromSettings) && fromSettings > 0) return Math.floor(fromSettings);
	const fromConfig = Number(config?.maxLedgerEntries);
	if (Number.isFinite(fromConfig) && fromConfig > 0) return Math.floor(fromConfig);
	return DEFAULT_MAX_LEDGER_ENTRIES;
}

/**
 * Trim legacy days and ledger entries older than `retentionDays` (mutating).
 * Retention counts whole Beijing-calendar days INCLUDING today: N=1 keeps only
 * today, N=2 keeps today + yesterday, and so on. The cutoff anchors to today's
 * 00:00 (+08:00) minus (N-1) days — never a rolling 24h window, which would
 * wrongly keep late-night requests from the previous day.
 */
function trimCache(cache, retentionDays) {
	if (cache === null || typeof cache !== "object") return;
	const days = Number(retentionDays);
	if (!Number.isFinite(days) || days <= 0) return;
	const todayStart = Date.parse(`${dayKey(Date.now())}T00:00:00+08:00`);
	const cutoff = Number.isFinite(todayStart)
		? todayStart - (days - 1) * 86400000
		: Date.now() - days * 86400000;
	if (cache.legacy?.days !== null && typeof cache.legacy?.days === "object") {
		const kept = {};
		for (const [date, entry] of Object.entries(cache.legacy.days)) {
			const at = Date.parse(`${date}T00:00:00+08:00`);
			if (Number.isNaN(at) || at >= cutoff) kept[date] = entry;
		}
		cache.legacy = { ...cache.legacy, days: kept };
	}
	if (Array.isArray(cache.ledger)) {
		cache.ledger = cache.ledger.filter((entry) => {
			const at = Number(entry?.completedAt) || Number(entry?.occurredAt) || 0;
			return at >= cutoff;
		});
	}
}

/** Data-management metadata for the settings「数据管理」tab. */
function dataInfoOf(cache, config, settings) {
	const ledger = Array.isArray(cache?.ledger) ? cache.ledger : [];
	const legacy = cache?.legacy;
	const legacyDates = legacy?.days !== null && typeof legacy?.days === "object"
		? Object.keys(legacy.days).sort()
		: [];
	const ledgerDates = [];
	for (const entry of ledger) {
		const at = Number(entry?.completedAt) || Number(entry?.occurredAt) || 0;
		if (at > 0) {
			const date = dayKey(at);
			if (!ledgerDates.includes(date)) ledgerDates.push(date);
		}
	}
	ledgerDates.sort();
	const allDates = [...legacyDates, ...ledgerDates].sort();
	const maxEntries = maxLedgerEntriesOf(settings, config);
	return {
		ledgerEntries: ledger.length,
		ledgerCapacity: maxEntries,
		foldedCount: Number(legacy?.foldedCount) || 0,
		legacyRange: legacyDates.length > 0 ? { earliest: legacyDates[0], latest: legacyDates[legacyDates.length - 1] } : null,
		dateRange: allDates.length > 0 ? { earliest: allDates[0], latest: allDates[allDates.length - 1] } : null,
		legacyUpdatedAt: Number(legacy?.updatedAt) || null,
		legacyIsEstimated: legacy?.days !== null && typeof legacy?.days === "object" && Object.keys(legacy?.days ?? {}).length > 0,
		maxLedgerEntries: maxEntries
	};
}

/** Build provider-scoped local usage summaries for the current Beijing day. */
export function providerTodaySummaries(usage, today = dayKey(Date.now())) {
	const summaries = {};
	const day = Array.isArray(usage?.days) ? usage.days.find((entry) => entry?.date === today) : null;
	for (const model of Array.isArray(day?.models) ? day.models : []) {
		const providerId = providerOf(model?.model);
		if (providerId === "" || isFacadeProvider(providerId)) continue;
		const summary = summaries[providerId] ?? {
			date: today,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			tokens: 0,
			cost: 0
		};
		for (const field of ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"]) {
			summary[field] += Number(model?.[field]) || 0;
		}
		summary.tokens += Number(model?.tokens) || 0;
		summary.cost = summary.cost === null || model?.cost === null || model?.cost === void 0
			? null
			: roundCost(summary.cost + (Number(model.cost) || 0));
		summaries[providerId] = summary;
	}
	return summaries;
}

async function handleAccounts(ctx, config, balanceService, providerService, settingsService, req, res) {
	if (rejectForeignCaller(req, res, ["GET", "POST"])) return;
	try {
		if (req.method === "GET") {
			const settings = await settingsService.load();
			const keys = await configuredKeys(ctx, config);
			const providers = await providerService.providers();
			const defaultProviderId = providers.find((entry) => entry.default)?.id ?? providers[0]?.id ?? "deepseek-official";
			const usage = await collectUsage(ctx, runtimePricingOf(settings, config));
			const today = dayKey(Date.now());
			const todayByProvider = providerTodaySummaries(usage, today);
			const accounts = {};
			for (const provider of providers) {
				const cached = provider.id === "deepseek-official"
					? (typeof balanceService?.cached === "function" ? balanceService.cached(provider.keyRef) : null)
					: providerService.cached(provider.id, provider.keyRef);
				const fallbackStatus = provider.queryable ? "pending" : "unsupported";
				accounts[provider.id] = {
					...(cached ?? { id: provider.keyRef ?? provider.id, status: fallbackStatus, fetchedAt: null, capabilities: provider.capabilities }),
					providerId: provider.id,
					today: todayByProvider[provider.id] ?? { date: today, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, tokens: 0, cost: provider.id === "deepseek-official" ? 0 : null }
				};
			}
			json(res, 200, {
				ok: true,
				keys,
				defaultKeyRef: config.defaultKeyRef,
				accounts,
				providers,
				defaultProviderId,
				settings: { refreshMs: settings.refreshMs, display: settings.display, conversation: settings.conversation, defaultProviderId }
			});
			return;
		}
		const body = await readJsonBody(req);
		const patch = {};
		if (Object.hasOwn(body, "refreshMs")) {
			if (body.refreshMs === null) patch.refreshMs = null;
			else {
				const ms = Number(body.refreshMs);
				if (!Number.isFinite(ms) || ms < 5000) throw new TypeError("refreshMs must be null or >= 5000");
				patch.refreshMs = ms;
			}
		}
		if (body.display !== void 0) {
			if (body.display === null || typeof body.display !== "object" || Array.isArray(body.display)) throw new TypeError("display must be an object");
			patch.display = body.display;
		}
		if (body.conversation !== void 0) {
			if (body.conversation === null || typeof body.conversation !== "object" || Array.isArray(body.conversation)) throw new TypeError("conversation must be an object");
			for (const field of ["enabled", "showTokenUsage"]) {
				if (body.conversation[field] !== void 0 && typeof body.conversation[field] !== "boolean") throw new TypeError(`conversation.${field} must be a boolean`);
			}
			patch.conversation = body.conversation;
		}
		if (body.defaultProviderId !== void 0) {
			if (typeof body.defaultProviderId !== "string" || body.defaultProviderId.trim() === "") throw new TypeError("defaultProviderId must be a non-empty string");
			const providers = await providerService.providers();
			if (!providers.some((entry) => entry.id === body.defaultProviderId.trim())) throw new TypeError("defaultProviderId is not a configured provider");
			patch.defaultProviderId = body.defaultProviderId.trim();
		}
		const updated = await settingsService.update(patch);
		json(res, 200, { ok: true, defaultProviderId: updated.defaultProviderId, settings: { refreshMs: updated.refreshMs, display: updated.display, conversation: updated.conversation, defaultProviderId: updated.defaultProviderId } });
	} catch (error) {
		ctx.logger.warn(`usage-stats: accounts request failed: ${String(error)}`);
		if (error instanceof TypeError) {
			json(res, 400, { ok: false, error: "invalid-payload", message: error.message });
			return;
		}
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

async function handlePricing(ctx, config, settingsService, req, res) {
	if (rejectForeignCaller(req, res, ["GET", "POST"])) return;
	try {
		if (req.method === "GET") {
			const settings = await settingsService.load();
			const official = defaultPricingVersion();
			json(res, 200, {
				ok: true,
				current: runtimePricingOf(settings, config),
				official,
				usingCustom: settings.pricing !== null && settings.pricing !== undefined,
				checkedAt: settings.pricing?.checkedAt ?? official.checkedAt,
				sourceUrl: official.sourceUrl
			});
			return;
		}
		const body = await readJsonBody(req);
		let updated;
		if (body?.action === "restore") {
			updated = await settingsService.update({ pricing: null });
		} else if (body?.mode === "custom") {
			if (body.pricing === null || typeof body.pricing !== "object" || Array.isArray(body.pricing)) throw new TypeError("pricing payload must carry a pricing object");
			validatePricingInput(body.pricing);
			updated = await settingsService.update({ pricing: normalizePricing({
				...body.pricing,
				mode: "custom",
				checkedAt: new Date().toISOString()
			}) });
		} else {
			throw new TypeError("pricing POST must be { mode: \"custom\", pricing } or { action: \"restore\" }");
		}
		json(res, 200, { ok: true, current: runtimePricingOf(updated, config), usingCustom: updated.pricing !== null && updated.pricing !== undefined });
	} catch (error) {
		ctx.logger.warn(`usage-stats: pricing request failed: ${String(error)}`);
		if (error instanceof TypeError) {
			json(res, 400, { ok: false, error: "invalid-payload", message: error.message });
			return;
		}
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

async function handleAlerts(ctx, config, limitsService, settingsService, req, res) {
	if (rejectForeignCaller(req, res, ["GET", "POST"])) return;
	try {
		if (req.method === "GET") {
			const settings = await settingsService.load();
			const evaluated = await limitsService.evaluateAll();
			json(res, 200, { ok: true, alerts: evaluated.alerts ?? [], notifications: settings.notifications });
			return;
		}
		const body = await readJsonBody(req);
		if (body?.notifications === null || typeof body?.notifications !== "object" || Array.isArray(body.notifications)) throw new TypeError("notifications payload must be an object");
		const updated = await settingsService.update({ notifications: body.notifications });
		json(res, 200, { ok: true, notifications: updated.notifications });
	} catch (error) {
		ctx.logger.warn(`usage-stats: alerts request failed: ${String(error)}`);
		if (error instanceof TypeError) {
			json(res, 400, { ok: false, error: "invalid-payload", message: error.message });
			return;
		}
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}

async function handleData(ctx, config, settingsService, req, res) {
	if (rejectForeignCaller(req, res, ["GET", "POST"])) return;
	try {
		if (req.method === "GET") {
			const cache = await loadCache();
			const settings = await settingsService.load();
			json(res, 200, { ok: true, info: dataInfoOf(cache, config, settings) });
			return;
		}
		const body = await readJsonBody(req);
		const action = body?.action;
		if (!["rebuild", "clear", "trim"].includes(action)) throw new TypeError("data action must be rebuild/clear/trim");
		if (action === "clear") {
			// 危险动作：前端和后端都必须通过二次确认，避免任意 loopback
			// 客户端只发 action=clear 就清空本地账本。
			if (!isDataClearConfirmation(body?.confirmation)) throw new TypeError("clear confirmation must be 清除 or DELETE");
			await serializeWrite(async () => {
				const cache = await loadCache();
				cache.legacy = null;
				cache.ledger = [];
				await saveCache(ctx, cache);
			});
			json(res, 200, { ok: true, cleared: true });
			return;
		}
		if (action === "rebuild") {
			const settings = await settingsService.load();
			await collectUsage(ctx, runtimePricingOf(settings, config));
			json(res, 200, { ok: true, rebuilt: true });
			return;
		}
		const retentionDays = Number(body.retentionDays);
		if (!Number.isFinite(retentionDays) || retentionDays <= 0) throw new TypeError("retentionDays must be a positive number");
		await serializeWrite(async () => {
			const cache = await loadCache();
			trimCache(cache, retentionDays);
			await saveCache(ctx, cache);
		});
		json(res, 200, { ok: true, trimmed: true });
	} catch (error) {
		ctx.logger.warn(`usage-stats: data request failed: ${String(error)}`);
		if (error instanceof TypeError) {
			json(res, 400, { ok: false, error: "invalid-payload", message: error.message });
			return;
		}
		json(res, 500, { ok: false, error: "internal", message: error instanceof Error ? error.message : String(error) });
	}
}
//#endregion
const Config = {
	"~standard": {
		version: 1,
		vendor: "dsh-usage-stats",
		validate(value) {
			try {
				return { value: validateConfig(value ?? {}) };
			} catch (error) {
				return { issues: [{ message: error instanceof Error ? error.message : String(error) }] };
			}
		}
	}
};

/**
 * Plugin body: register routes, start background refresh, and guard model calls.
 * @param ctx - plugin context carrying webServer, credentials, sessions, and sessionPersistence.
 */
function apply(ctx, rawConfig = {}, deps = {}) {
	const config = validateConfig(rawConfig);
	const credentials = serviceOf(ctx, "credentials");
	const balanceService = deps.balanceService ?? createBalanceService({ credentials, config });
	const settingsService = deps.settingsService ?? createSettingsService({ ctx, config });
	const providerService = deps.providerService ?? createProviderService({ ctx, config, credentials, settingsService, deps });
	void settingsService.load();
	const limitsService = deps.limitsService ?? createLimitsService({ ctx, config, balanceService, deps: { settings: settingsService } });
	// A raw llm stream has no durable event id. Keep provisional samples in
	// route order so the later assistant/message can replace the matching one.
	const pendingUsageKeys = new Map();

	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: USAGE_PATH,
		handler: (req, res) => handleUsage(ctx, config, settingsService, req, res)
	}), "usage-stats: usage route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: KEYS_PATH,
		handler: (req, res) => handleKeys(ctx, config, req, res)
	}), "usage-stats: keys route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: PROVIDERS_PATH,
		handler: (req, res) => handleProviders(ctx, config, providerService, settingsService, req, res)
	}), "usage-stats: providers route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: BALANCE_PATH,
		handler: (req, res) => handleBalance(ctx.logger, ctx, config, balanceService, providerService, req, res)
	}), "usage-stats: balance route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: LIMITS_PATH,
		handler: (req, res) => handleLimits(ctx, config, limitsService, req, res)
	}), "usage-stats: limits route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: ACCOUNTS_PATH,
		handler: (req, res) => handleAccounts(ctx, config, balanceService, providerService, settingsService, req, res)
	}), "usage-stats: accounts route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: PRICING_PATH,
		handler: (req, res) => handlePricing(ctx, config, settingsService, req, res)
	}), "usage-stats: pricing route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: ALERTS_PATH,
		handler: (req, res) => handleAlerts(ctx, config, limitsService, settingsService, req, res)
	}), "usage-stats: alerts route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: DATA_PATH,
		handler: (req, res) => handleData(ctx, config, settingsService, req, res)
	}), "usage-stats: data route");

	// Limit checks are fail-open on plugin/storage errors. The final provider
	// route exists only on llm/stream, so provider-specific enforcement belongs
	// there; agent/request can still be rerouted by downstream listeners.
	if (typeof ctx.on === "function") {
		ctx.effect(() => {
			return ctx.on("agent/request", async (_payload, next) => {
				if (typeof next === "function") return next();
			});
		}, "usage-stats: pass-through agent/request interceptor");

		ctx.effect(() => {
			// The llm/stream waterfall must synchronously return an AsyncIterable.
			// Run the asynchronous quota check inside an async generator, then
			// delegate to the downstream stream unchanged when the call is allowed.
			// While streaming, capture the usage chunk and the COMPLETION time
			// (the moment usage is reported) so the call-level ledger attributes
			// cost to the hour the request COMPLETED in (the provider billing
			// basis), not its start hour.
			return ctx.on("llm/stream", async function* (payload, next) {
				const startedAt = Date.now();
				let usage = null;
				let usageTurn = Number.isInteger(payload?.turn) ? payload.turn : null;
				let usageStep = Number.isInteger(payload?.step) ? payload.step : null;
				let sampleKey = null;
				let completedAt = null;
				const provider = payload?.provider ?? payload?.config?.provider;
				if (isOfficialBillingProvider(provider)) {
					try {
						const status = await limitsService.check(payload ?? {});
						if (status?.status === "blocked" || status?.blocked === true) throw new UsageLimitExceededError(status);
					} catch (error) {
						if (error instanceof UsageLimitExceededError) throw error;
						ctx.logger?.warn?.("usage-stats: llm/stream quota check failed; allowing call: " + String(error));
					}
				}
				try {
					if (typeof next === "function") {
						for await (const chunk of next()) {
							if (chunk !== null && typeof chunk === "object" && chunk.type === "usage" && chunk.usage !== void 0 && chunk.usage !== null) {
								usage = chunk.usage;
								if (Number.isInteger(chunk.turn)) usageTurn = chunk.turn;
								if (Number.isInteger(chunk.step)) usageStep = chunk.step;
								// 官方账单按请求完成时间（usage 上报时刻）归小时。
								completedAt = Date.now();
								const provider = payload?.provider ?? payload?.config?.provider ?? "unknown";
								const model = payload?.model ?? payload?.config?.model ?? "unknown";
								sampleKey ??= usageTurn !== null && usageStep !== null
									? `${provider}/${model}:${usageTurn}:${usageStep}`
									: `${provider}/${model}:pending:${startedAt}:${randomUUID()}`;
							}
							yield chunk;
						}
					}
				} finally {
					const ledgerProvider = payload?.provider ?? payload?.config?.provider;
					// Facade routes (vision-toolkit-*) delegate to an upstream
					// provider that issues the real API request; recording both
					// would double-count one provider bill.
					if (usage !== null && usage !== void 0 && !isFacadeProvider(ledgerProvider)) {
						try {
							if (sampleKey !== null) {
								const routeKey = `${ledgerProvider ?? "unknown"}/${payload?.model ?? payload?.config?.model ?? "unknown"}`;
								const pending = pendingUsageKeys.get(routeKey) ?? [];
								pending.push(sampleKey);
								pendingUsageKeys.set(routeKey, pending);
							}
							const entry = freezeLedgerEntry({
								id: typeof deps.createLedgerId === "function" ? deps.createLedgerId() : randomUUID(),
								occurredAt: startedAt,
								completedAt: completedAt ?? startedAt,
								provider: ledgerProvider,
								model: payload?.model ?? payload?.config?.model,
								...(usageTurn !== null ? { turn: usageTurn } : {}),
								...(usageStep !== null ? { step: usageStep } : {}),
								...(sampleKey !== null ? { sampleKey } : {}),
								usage
							}, runtimePricingOf(settingsService.snapshot(), config));
							if (typeof deps.recordLedger === "function") await deps.recordLedger(entry);
							else await recordLedgerEntry(ctx, entry, { maxLedgerEntries: () => maxLedgerEntriesOf(settingsService.snapshot(), config) });
						} catch (error) {
							ctx.logger?.warn?.("usage-stats: ledger record failed: " + String(error));
						}
					}
				}
			});
		}, "usage-stats: quota limit interceptor on llm/stream");

		ctx.effect(() => ctx.on("session/event", async (session, event) => {
			if (event?.type !== "assistant/message" || event.data?.usage === void 0) return;
			const source = event.data?.message?.source;
			const provider = typeof source?.provider === "string" ? source.provider : "unknown";
			const model = typeof source?.model === "string" ? source.model : "unknown";
			if (isFacadeProvider(provider)) return;
			const routeKey = `${provider}/${model}`;
			const pending = pendingUsageKeys.get(routeKey) ?? [];
			const sampleKey = pending.pop() ?? `${routeKey}:${event.data?.turn ?? 0}:${event.data?.step ?? 0}`;
			if (pending.length > 0) pendingUsageKeys.set(routeKey, pending);
			else pendingUsageKeys.delete(routeKey);
			try {
				const occurredAt = Number(event.time) > 0 ? Number(event.time) : Date.now();
				const entry = freezeLedgerEntry({
					id: randomUUID(), occurredAt, completedAt: occurredAt, provider, model,
					turn: event.data?.turn, step: event.data?.step, sampleKey, usage: event.data.usage
								}, runtimePricingOf(settingsService.snapshot(), config));
				if (typeof deps.recordLedger === "function") await deps.recordLedger(entry);
				else await recordLedgerEntry(ctx, entry, { maxLedgerEntries: () => maxLedgerEntriesOf(settingsService.snapshot(), config) });
			} catch (error) {
				ctx.logger?.warn?.("usage-stats: assistant/message ledger record failed: " + String(error));
			}
		}));
	}

	if (deps.disableBackgroundRefresh !== true) ctx.effect(() => startBackgroundRefresh(ctx, balanceService, config, {
		// `null` is an explicit user choice to disable periodic refresh; do not
		// coalesce it back to the startup cadence.
		getRefreshMs: () => refreshCadenceOf(settingsService.snapshot(), config),
		getPricing: () => runtimePricingOf(settingsService.snapshot(), config),
		refreshProvider: () => providerService.refreshAll()
	}), "usage-stats: background refresh");
}

export {
	apply,
	Config,
	inject,
	name,
	USAGE_PATH,
	KEYS_PATH,
	PROVIDERS_PATH,
	BALANCE_PATH,
	LIMITS_PATH,
	ACCOUNTS_PATH,
	PRICING_PATH,
	ALERTS_PATH,
	DATA_PATH,
	roundCost,
	defaultLimitRule,
	defaultLimits,
	parseLedger,
	validateLimitRule,
	validateLimits,
	evaluateKeyQuota,
	resolveLimitRule,
	createLimitsService,
	createAlertTracker,
	alertEventCategoryOf,
	migrateCacheV1,
	renderCombinedUsage,
	recordLedgerEntry,
	validateSettings,
	createSettingsService,
	runtimePricingOf,
	maxLedgerEntriesOf,
	trimCache,
	dataInfoOf
};
