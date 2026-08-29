/**
 * dsh-usage-stats — server half.
 *
 * Registers one loopback-authorized official Connection RPC channel. Runtime
 * state is owned by the official storage-domain and settings services; legacy
 * files are read only by the one-shot migration bridge.
 *
 * Credentials are resolved through the harness `credentials` seam at request
 * time — this plugin never stores or logs API keys. The official DeepSeek
 * route is queried at the account's configured base URL (default
 * https://api.deepseek.com) using each configured credential reference.
 *
 * Each captured call freezes its nano-CNY cost before it enters the atomic
 * ledger/archive transform. Session persistence is used only for an explicit
 * estimated-history rebuild.
 *
 * @module dsh-usage-stats
 */

import { randomUUID } from "node:crypto";
import { dayKey, defaultPricing, isOfficialBillingProvider, providerOf, roundCost, zeroBuckets } from "./usage.js";
import { clearLedgerState, freezeLedgerEntry, pricingVersionOf, recordLedgerState, renderLedgerState, trimLedgerState } from "./ledger.js";
import { queryDeepSeekBalance, responseStatus } from "./balance.js";
import { listBuiltInProviders, queryProviderUsage } from "./providers.js";
import { defaultPricingVersion, fetchOfficialPricing, normalizePricing, validatePricingInput } from "./pricing.js";
import { createUsageStatsSettings } from "./settings.js";
import { createEmptyUsageState, openUsageStatsStorage } from "./storage.js";
import { legacyUsageStatsPaths, migrateLegacyCacheToV3, migrateLegacySettingsToV3, prepareLegacyJson } from "./migration.js";
import { rebuildEstimatedFromPersistence } from "./rebuild.js";
import { registerUsageRpc, createUsageRpcDispatcher, UsageRpcBadRequestError, USAGE_RPC_CHANNEL, USAGE_RPC_ENDPOINTS } from "./rpc.js";

/** Stable Cordis plugin name. */
const name = "usage-stats";

/** Services required before this plugin activates. */
const inject = ["credentials", "settings", "storageDomain", "connection", "sessionPersistence"];

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_KEY_REF = "DEEPSEEK_API_KEY";
const UPSTREAM_TIMEOUT_MS = 15000;
const DEFAULT_REFRESH_MS = 300000;
const LIMITS_VERSION = 2;
const SETTINGS_VERSION = 3;
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

const PRICE_FIELDS = ["inputMiss", "inputHit", "output"];
function hasCompletePriceRow(row) {
	return row !== null && typeof row === "object" && !Array.isArray(row)
		&& PRICE_FIELDS.every((field) => numberOrNull(row[field]) !== null);
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
				if (merged.pricing[model] === void 0 && !hasCompletePriceRow(row)) {
					throw new Error(`config.pricing.pricing.${model} must specify inputMiss, inputHit, and output for a new model`);
				}
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
	if (!Number.isSafeInteger(maxLedgerEntries)) throw new Error("config.maxLedgerEntries must be an integer");
	if (maxLedgerEntries < 100) throw new Error("config.maxLedgerEntries must be at least 100");
	if (maxLedgerEntries > 5000) throw new Error("config.maxLedgerEntries must be at most 5000");
	return { keys, defaultKeyRef, baseURL, refreshMs, pricing: pricing ?? defaultPricing(), keyProviders, maxLedgerEntries, allowInsecure: raw.allowInsecure === true };
}
//#endregion

//#region official usage repository
const repositoryByContext = new WeakMap();
const renderedUsageByRepository = new WeakMap();

function repositoryOf(ctx) {
	const repository = repositoryByContext.get(ctx);
	if (repository === void 0) throw new Error("usage-stats storage is not initialized");
	return repository;
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

/** Sum rendered model rows without losing the explicit unpriced state. */
function sumRenderedRows(rows) {
	const totals = zeroBuckets();
	let cost = 0;
	let priced = true;
	let requestCount = 0;
	let requestCountKnown = true;
	for (const row of rows ?? []) {
		totals.inputTokens += Number(row?.inputTokens) || 0;
		totals.outputTokens += Number(row?.outputTokens) || 0;
		totals.cacheReadTokens += Number(row?.cacheReadTokens) || 0;
		totals.cacheWriteTokens += Number(row?.cacheWriteTokens) || 0;
		if (row?.cost === null) priced = false;
		else if (Number.isFinite(Number(row?.cost))) cost += Number(row.cost);
		const rowRequestCount = row?.requestCount === null || row?.requestCount === void 0 ? null : Number(row.requestCount);
		if (!Number.isSafeInteger(rowRequestCount) || rowRequestCount < 0 || !Number.isSafeInteger(requestCount + rowRequestCount)) requestCountKnown = false;
		else requestCount += rowRequestCount;
	}
	const promptTokens = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
	return {
		...totals,
		tokens: totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens,
		cacheHitRate: promptTokens > 0 ? Math.round(totals.cacheReadTokens / promptTokens * 1000) / 10 : null,
		requestCount: requestCountKnown ? requestCount : null,
		cost: priced ? roundCost(cost) : null
	};
}

/**
 * Project an all-provider wire response onto one provider. Calendar days are
 * retained so the contribution heatmap does not jump when providers change;
 * every day, hour and cumulative total is rebuilt from the retained rows.
 */
function filterRenderedUsageByProvider(usage, providerId) {
	if (usage === null || typeof usage !== "object" || typeof providerId !== "string" || providerId === "" || !Array.isArray(usage.days)) return usage;
	const days = usage.days.map((day) => {
		const models = (day?.models ?? []).filter((model) => providerOf(model.model) === providerId);
		const totals = sumRenderedRows(models);
		const hours = (day?.hours ?? []).map((hour) => {
			const hourModels = (hour?.models ?? []).filter((model) => providerOf(model.model) === providerId);
			return { hour: hour.hour, ...sumRenderedRows(hourModels), models: hourModels };
		});
		return { date: day.date, ...totals, models, hours };
	});
	const total = sumRenderedRows(days);
	return { ...usage, days, total };
}

//#endregion

/**
 * Render the v3 call ledger, frozen archive and explicitly estimated history
 * from the official storage-domain record. No session files are read on the
 * normal query path.
 */
export async function collectUsage(ctx, pricing = defaultPricing()) {
	const repository = repositoryOf(ctx);
	const updatedAt = Date.now();
	if (typeof repository.snapshot !== "function") return renderLedgerState(repository.get(), updatedAt, pricing);
	const snapshot = repository.snapshot();
	const pricingVersion = pricingVersionOf(pricing);
	const cached = renderedUsageByRepository.get(repository);
	if (cached?.revision === snapshot.revision && cached.pricingVersion === pricingVersion) {
		const rendered = structuredClone(cached.rendered);
		rendered.updatedAt = updatedAt;
		return rendered;
	}
	const rendered = renderLedgerState(snapshot.state, updatedAt, pricing);
	// Keep an independent copy: RPC callers receive mutable JSON and must not
	// be able to corrupt the next response from this in-memory cache.
	renderedUsageByRepository.set(repository, { revision: snapshot.revision, pricingVersion, rendered: structuredClone(rendered) });
	return rendered;
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
		const managementKeyRef = typeof meta.managementKeyEnv === "string" && meta.managementKeyEnv.trim() !== ""
			? meta.managementKeyEnv.trim()
			: null;
		const managementConfigured = managementKeyRef !== null && (await resolveCredential(credentials, managementKeyRef)) !== "";
		const extraCredentials = [];
		for (const field of Array.isArray(meta.extraCredentials) ? meta.extraCredentials : []) {
			if (typeof field?.id !== "string" || typeof field?.ref !== "string" || field.id.trim() === "" || field.ref.trim() === "") continue;
			extraCredentials.push({
				id: field.id.trim(),
				ref: field.ref.trim(),
				label: typeof field.label === "string" && field.label.trim() !== "" ? field.label.trim() : field.id.trim(),
				secret: field.secret !== false,
				configured: (await resolveCredential(credentials, field.ref.trim())) !== ""
			});
		}
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
			managementKeyRef,
			managementConfigured,
			extraCredentials,
			baseURL,
			kind: meta.kind ?? "local",
			capabilities,
			queryable,
			...(meta.planQuota ? { planQuota: { ...meta.planQuota, windows: [...meta.planQuota.windows] } } : {}),
			...(typeof meta.accountUrl === "string" && meta.accountUrl !== "" ? { accountUrl: meta.accountUrl } : {}),
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

/** Provider-level failure categories accepted on error objects. */
const PROVIDER_STATUS_VALUES = new Set(["unauthorized", "rate-limited", "unavailable", "invalid-response", "timeout", "not-subscribed", "not-configured"]);

/**
 * Classify one caught error for an account status row. Provider adapters mark
 * their own errors with `.providerStatus`/`.status`; only a REAL HTTP status
 * goes through `responseStatus` — a missing status means the request never
 * reached the provider, which is "unavailable", never "invalid-response".
 */
function providerErrorStatusOf(error) {
	for (const key of ["providerStatus", "status"]) {
		const value = error?.[key];
		if (typeof value === "string" && PROVIDER_STATUS_VALUES.has(value)) return value;
	}
	const httpStatus = Number(error?.httpStatus);
	if (Number.isInteger(httpStatus) && httpStatus >= 100) {
		const mapped = responseStatus(httpStatus);
		if (PROVIDER_STATUS_VALUES.has(mapped)) return mapped;
	}
	return "unavailable";
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
			const apiKey = provider.keyRef === null ? "" : await resolveCredential(credentials, provider.keyRef);
			if (apiKey === "") {
				return { id: ref, providerId: provider.id, status: "not-configured", fetchedAt: now(), capabilities: provider.capabilities };
			}
			try {
				const managementApiKey = provider.managementKeyRef === null ? "" : await resolveCredential(credentials, provider.managementKeyRef);
				const raw = await queryProviderUsage({
					providerId: provider.id,
					apiKey,
					managementApiKey,
					baseURL: provider.baseURL,
					fetchImpl: deps.fetch,
					timeoutMs: deps.timeoutMs ?? UPSTREAM_TIMEOUT_MS
				});
				const account = { id: ref, providerId: provider.id, fetchedAt: now(), ...raw };
				cache.set(key, account);
				return account;
			} catch (error) {
				const account = { id: ref, providerId: provider.id, status: providerErrorStatusOf(error), fetchedAt: now(), message: error instanceof Error ? error.message : String(error), capabilities: provider.capabilities };
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
					status: providerErrorStatusOf(error),
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
		timer = setTimer(() => {
			void run().catch((error) => {
				try { ctx.logger?.warn?.(`usage-stats: background refresh scheduling failed: ${String(error)}`); } catch { /* logging must not reject the timer */ }
			}).finally(() => { schedule(); });
		}, ms);
		timer?.unref?.();
	};
	void run().catch((error) => {
		try { ctx.logger?.warn?.(`usage-stats: initial background refresh failed: ${String(error)}`); } catch { /* logging must not reject startup */ }
	}).finally(() => { if (!stopped) schedule(); });
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

/** Serialize settings-driven refresh restarts and prevent orphan instances on dispose. */
export function createBackgroundRefreshController({ watch, start }) {
	if (typeof watch !== "function" || typeof start !== "function") throw new TypeError("watch and start are required");
	let disposed = false;
	let generation = 0;
	let currentStop = start();
	let stopPromise = null;
	const stopCurrent = () => {
		if (stopPromise === null) stopPromise = Promise.resolve(typeof currentStop === "function" ? currentStop() : void 0);
		return stopPromise;
	};
	const unwatch = watch(async (next, previous) => {
		if (disposed || next?.refreshMs === previous?.refreshMs) return;
		const ticket = ++generation;
		await stopCurrent();
		if (disposed || ticket !== generation) return;
		currentStop = start();
		stopPromise = null;
	});
	return async () => {
		disposed = true;
		generation += 1;
		if (typeof unwatch === "function") unwatch();
		await stopCurrent();
	};
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
	const period = raw.period === "monthly" ? "monthly" : "daily";
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
function costPerKeyForDays(usageDays, includeDay, config) {
	const perKey = new Map();
	const mapped = Object.keys(config.keyProviders ?? {}).length > 0;
	for (const day of usageDays ?? []) {
		if (!includeDay(day.date)) continue;
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

export function todayCostPerKey(usageDays, today, config) {
	return costPerKeyForDays(usageDays, (date) => date === today, config);
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
	const monthPrefix = String(today).slice(0, 7);
	const monthDays = (usage.days ?? []).filter((day) => String(day.date).startsWith(monthPrefix));
	const monthlyCostReliable = monthDays.every((day) => day.cost !== null);
	const globalMonthlyCost = monthDays.reduce((sum, day) => sum + (Number(day.cost) || 0), 0);
	const { perKey: monthlyPerKey } = costPerKeyForDays(usage.days, (date) => String(date).startsWith(monthPrefix), config);
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
			monthlyCost: todayCostFor(ref, monthlyPerKey, globalMonthlyCost, config),
			monthlyCostReliable,
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
	const hasKeySpendLimit = (keyRule.dailyCostLimit !== null && keyRule.dailyCostLimit > 0)
		|| (keyRule.monthlyCostLimit !== null && keyRule.monthlyCostLimit > 0);
	const lowerPositive = (left, right) => {
		const values = [left, right].filter((value) => value !== null && Number.isFinite(Number(value)) && Number(value) > 0).map(Number);
		return values.length === 0 ? null : Math.min(...values);
	};
	const higherPositive = (left, right) => {
		const values = [left, right].filter((value) => value !== null && Number.isFinite(Number(value)) && Number(value) > 0).map(Number);
		return values.length === 0 ? null : Math.max(...values);
	};
	// Numbered per-key rule: override the global for its explicit fields and
	// inherit the global for any field left unset (null), so the global stays
	// the floor and a key can only tighten — never silently opt out.
	return {
		// Key 只能收紧、不能静默退出：全局开启时，Key 的 enabled:false 不得
		// 关掉整个限额（与 stopOnExceed 的 OR 语义一致）。
		enabled: keyRule.enabled === true || global.enabled === true,
		// Settings materializes an omitted key period as "daily". That default
		// must not change a global monthly cap when the key only adds a balance
		// threshold; a key period has effect only alongside a key spend cap.
		period: hasKeySpendLimit ? (keyRule.period ?? "daily") : (global.period ?? "daily"),
		dailyCostLimit: lowerPositive(keyRule.dailyCostLimit, global.dailyCostLimit),
		monthlyCostLimit: lowerPositive(keyRule.monthlyCostLimit, global.monthlyCostLimit),
		lowBalanceWarning: higherPositive(keyRule.lowBalanceWarning, global.lowBalanceWarning),
		alertPercent: lowerPositive(keyRule.alertPercent, global.alertPercent) ?? 80,
		criticalPercent: lowerPositive(keyRule.criticalPercent, global.criticalPercent) ?? 90,
		minBalance: higherPositive(keyRule.minBalance, global.minBalance),
		stopOnExceed: keyRule.stopOnExceed === true || global.stopOnExceed === true,
		notificationCooldownMs: keyRule.notificationCooldownMs ?? global.notificationCooldownMs ?? 30 * 60 * 1000
	};
}

function evaluateKeyQuota({ keyRef, limits, todayCost = 0, todayCostReliable = true, monthlyCost = 0, monthlyCostReliable = true, balance = null, balanceStatus, balanceFetchedAt, now = Date.now(), balanceMaxAgeMs = Infinity }) {
	const allLimits = limits ?? defaultLimits();
	const rule = resolveLimitRule(allLimits, keyRef);
	const numericCost = Number(todayCost) || 0;
	const numericMonthlyCost = Number(monthlyCost) || 0;
	const useMonthlyLimit = rule.period === "monthly" && rule.monthlyCostLimit !== null && rule.monthlyCostLimit > 0;
	const spendCost = useMonthlyLimit ? numericMonthlyCost : numericCost;
	const spendCostReliable = useMonthlyLimit ? monthlyCostReliable !== false : todayCostReliable !== false;
	const spendLimit = useMonthlyLimit ? rule.monthlyCostLimit : rule.dailyCostLimit;
	const spendReason = useMonthlyLimit ? "monthly_cost" : "daily_cost";
	const spendLabel = useMonthlyLimit ? "本月消费" : "今日消费";
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
			threshold: spendLimit,
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
	if (spendCostReliable && spendLimit !== null && spendLimit > 0) {
		if (spendCost >= spendLimit * (rule.criticalPercent / 100)) {
			exceeded = true;
			spendExceeded = true;
			reason = spendReason;
			message = `${spendLabel} (${spendCost.toFixed(2)}) 已达到严重预警线 (${rule.criticalPercent}%)`;
		} else if (spendCost >= (spendLimit * (rule.alertPercent / 100))) {
			warning = true;
			spendWarning = true;
				reason = spendReason;
			message = `${spendLabel} (${spendCost.toFixed(2)}) 已达到限额 (${spendLimit.toFixed(2)}) 的 ${rule.alertPercent}% 预警线`;
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

	const unpriced = spendCostReliable === false;
	if (unpriced && reason === null) {
		reason = "unpriced";
		message = `${useMonthlyLimit ? "本月" : "今日"}用量包含未定价模型，消费金额不可靠，消费限额暂不参与拦截`;
	}
	const spendStatus = spendLimit !== null && spendLimit > 0
		? (spendExceeded ? "exceeded" : (spendWarning ? "warning" : (unpriced ? "muted" : "normal")))
		: "muted";
	const costLimitReached = spendLimit !== null && spendLimit > 0 && spendCost >= spendLimit;
	const hardLimitReached = balanceExceeded || costLimitReached;
	const blocked = exceeded && rule.stopOnExceed && hardLimitReached;
	// 硬停止消息必须点明真实触发原因（达到 100% 限额或余额跌破保障线），
	// 不能沿用 90% 预警文案——否则用户会误以为在 90% 就被拦截。
	if (blocked) {
		if (balanceExceeded) {
			reason = "min_balance";
			message = `余额 (${numericBalance.toFixed(2)}) 已低于最低余额保障线 (${rule.minBalance.toFixed(2)})，已停止新调用`;
		} else if (costLimitReached) {
				reason = spendReason;
				message = `${spendLabel} (${spendCost.toFixed(2)}) 已达到限额 (${spendLimit.toFixed(2)})，已停止新调用`;
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
		monthlyCost: numericMonthlyCost,
		monthlyCostLimit: rule.monthlyCostLimit,
		period: rule.period,
		lowBalanceWarning: rule.lowBalanceWarning,
		minBalance: rule.minBalance,
		alertPercent: rule.alertPercent,
		currentBalance: numericBalance,
		balanceStatus: balanceStatus ?? null,
		balanceFresh,
		stale,
		unavailable,
		currentValue: reason === "min_balance" || reason === "low_balance" ? numericBalance : spendCost,
		threshold: reason === "min_balance" ? rule.minBalance : reason === "low_balance" ? rule.lowBalanceWarning : spendLimit,
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

/**
 * Resolve the provider routes represented by one key-scoped alert. A key may
 * intentionally serve more than one route; when no explicit mapping exists,
 * the existing limits service semantics are the official DeepSeek route.
 */
function alertProviderIdsOf(config, keyRef) {
	const mapped = config?.keyProviders?.[keyRef];
	if (Array.isArray(mapped) && mapped.length > 0) return [...new Set(mapped.filter((provider) => typeof provider === "string" && provider !== ""))];
	return ["deepseek-official"];
}

/** Default cap on ledger entries before the oldest overflow is folded into legacy. */
const DEFAULT_MAX_LEDGER_ENTRIES = 5000;

/**
 * Append one call-level ledger entry and persist it atomically before return.
 * When the ledger exceeds `deps.maxLedgerEntries` (default 5000), the oldest
 * entries are atomically folded into the exact frozen archive. Only imported
 * official entries that never carried a historical price remain estimated.
 * @param ctx - plugin context (logger).
 * @param entry - the normalized call-level ledger entry.
 * @param deps - optional { maxLedgerEntries } (number or function); the two-arg call stays valid.
 */
async function recordLedgerEntry(ctx, entry, deps = {}) {
	const rawMax = typeof deps?.maxLedgerEntries === "function" ? deps.maxLedgerEntries() : deps?.maxLedgerEntries;
	const maxLedgerEntries = Number.isFinite(Number(rawMax)) && Number(rawMax) > 0
		? Math.floor(Number(rawMax))
		: DEFAULT_MAX_LEDGER_ENTRIES;
	await repositoryOf(ctx).update((state) => recordLedgerState(state, entry, {
		maxLedgerEntries,
		pricing: deps.pricing ?? defaultPricing(),
		replaceSampleKey: deps.replaceSampleKey === true
	}));
	return entry;
}

function createLimitsService({ ctx, config, balanceService, deps = {} }) {
	const alertTracker = deps.alertTracker ?? createAlertTracker({ now: deps.now ?? Date.now });
	const alertHistory = [];

	async function getLimits() {
		const settings = typeof deps.settings?.load === "function" ? await deps.settings.load() : deps.settings?.get?.();
		return validateLimits(settings?.limits ?? defaultLimits());
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
		if (typeof deps.settings?.replaceLimits !== "function") throw new Error("official settings limits writer is unavailable");
		await deps.settings.replaceLimits(validated);
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
		const dayEntry = (usage.days ?? []).find((d) => d.date === today);
		return statuses[ref] ?? evaluateKeyQuota({
			keyRef: ref,
			limits,
			todayCost: dayEntry?.cost ?? 0,
			todayCostReliable: dayEntry === void 0 || dayEntry.cost !== null,
			balance: null
		});
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
				const providerIds = alertProviderIdsOf(config, status.keyRef);
				alertHistory.push({
					at: status.notification.at,
					type: status.notification.type,
					event,
					keyRef: status.keyRef ?? null,
					providerId: providerIds.length === 1 ? providerIds[0] : null,
					providerIds,
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

//#endregion

//#region settings store
/** Runtime settings are resolved by the official settings namespace. */

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
		visibleProviderIds: [],
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
	};
}

function createSettingsService({ official }) {
	if (official?.get === void 0 || official?.update === void 0) throw new TypeError("official usage settings scope is required");
	return {
		load: async () => official.get(),
		snapshot: () => official.get(),
		update: async (patch) => {
			await official.update(patch);
			return official.get();
		},
		replaceLimits: official.replaceLimits,
		resetPricing: official.resetPricing,
		watch: official.watch
	};
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

/** Data-management metadata for the settings「数据管理」tab. */
function dataInfoOf(cache, config, settings) {
	const ledger = Array.isArray(cache?.ledger) ? cache.ledger : [];
	const frozen = cache?.archive?.frozen ?? { days: {}, entryCount: 0 };
	const estimated = cache?.archive?.estimated ?? {};
	let estimatedLegacyCount = 0;
	const estimatedDateSet = new Set();
	for (const source of Object.values(estimated)) {
		if (Array.isArray(source)) {
			estimatedLegacyCount += source.length;
			for (const entry of source) {
				const at = Number(entry?.completedAt) || Number(entry?.occurredAt) || 0;
				if (at > 0) estimatedDateSet.add(dayKey(at));
			}
			continue;
		}
		const days = source?.days ?? source;
		if (days === null || typeof days !== "object") continue;
		for (const date of Object.keys(days)) estimatedDateSet.add(date);
		const explicitCount = Number(source?.foldedCount ?? source?.eventCount);
		estimatedLegacyCount += Number.isFinite(explicitCount) && explicitCount >= 0 ? Math.floor(explicitCount) : Object.keys(days).length;
	}
	const estimatedDates = [...estimatedDateSet].sort();
	const exactDates = Object.keys(frozen.days ?? {}).sort();
	const ledgerDates = [];
	for (const entry of ledger) {
		const at = Number(entry?.completedAt) || Number(entry?.occurredAt) || 0;
		if (at > 0) {
			const date = dayKey(at);
			if (!ledgerDates.includes(date)) ledgerDates.push(date);
		}
	}
	ledgerDates.sort();
	const allDates = [...new Set([...estimatedDates, ...exactDates, ...ledgerDates])].sort();
	const maxEntries = maxLedgerEntriesOf(settings, config);
	const hasEstimatedHistory = estimatedDates.length > 0 || (Array.isArray(estimated.unfrozenLedger) && estimated.unfrozenLedger.length > 0);
	return {
		ledgerEntries: ledger.length,
		ledgerCapacity: maxEntries,
		archivedExactCount: Number(frozen.entryCount) || 0,
		estimatedLegacyCount,
		exactArchiveRange: exactDates.length > 0 ? { earliest: exactDates[0], latest: exactDates[exactDates.length - 1] } : null,
		estimatedRange: estimatedDates.length > 0 ? { earliest: estimatedDates[0], latest: estimatedDates[estimatedDates.length - 1] } : null,
		hasEstimatedHistory,
		foldedCount: Number(frozen.entryCount) || 0,
		legacyRange: estimatedDates.length > 0 ? { earliest: estimatedDates[0], latest: estimatedDates[estimatedDates.length - 1] } : null,
		dateRange: allDates.length > 0 ? { earliest: allDates[0], latest: allDates[allDates.length - 1] } : null,
		legacyUpdatedAt: null,
		legacyIsEstimated: hasEstimatedHistory,
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

/** Resolve the compact provider list: configured entries only, default first,
 * and never more than three. Empty legacy settings receive a deterministic
 * default without immediately rewriting the user's settings file. */
export function visibleProviderIdsOf(settings, providers, defaultProviderId) {
	const ids = (Array.isArray(providers) ? providers : [])
		.map((provider) => provider?.id)
		.filter((id) => typeof id === "string" && id !== "");
	const allowed = new Set(ids);
	const selected = [];
	for (const id of Array.isArray(settings?.visibleProviderIds) ? settings.visibleProviderIds : []) {
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

function queryOf(payload) {
	if (payload?.query === void 0) return {};
	if (payload.query === null || typeof payload.query !== "object" || Array.isArray(payload.query)) throw new UsageRpcBadRequestError("request query must be an object");
	return payload.query;
}

function bodyOf(payload) {
	if (payload?.body === null || typeof payload?.body !== "object" || Array.isArray(payload.body)) throw new UsageRpcBadRequestError("request body must be an object");
	return payload.body;
}

function retentionCutoff(retentionDays) {
	const days = Number(retentionDays);
	if (!Number.isFinite(days) || days <= 0) throw new UsageRpcBadRequestError("retentionDays must be a positive number");
	const todayStart = Date.parse(`${dayKey(Date.now())}T00:00:00+08:00`);
	return dayKey(todayStart - (Math.ceil(days) - 1) * 86400000);
}

export function createUsageOperations({ ctx, config, settingsService, repository, balanceService, providerService, limitsService, deps = {} }) {
	const accountPayload = async () => {
		const settings = await settingsService.load();
		const keys = await configuredKeys(ctx, config);
		const providers = await providerService.providers();
		const defaultProviderId = providers.find((entry) => entry.default)?.id ?? providers[0]?.id ?? "deepseek-official";
		const visibleProviderIds = visibleProviderIdsOf(settings, providers, defaultProviderId);
		const usage = await collectUsage(ctx, runtimePricingOf(settings, config));
		const today = dayKey(Date.now());
		const todayByProvider = providerTodaySummaries(usage, today);
		const accounts = {};
		for (const provider of providers) {
			const cached = provider.id === "deepseek-official"
				? balanceService.cached?.(provider.keyRef)
				: providerService.cached?.(provider.id, provider.keyRef);
			accounts[provider.id] = {
				...(cached ?? { id: provider.keyRef ?? provider.id, status: provider.queryable ? "pending" : "unsupported", fetchedAt: null, capabilities: provider.capabilities }),
				providerId: provider.id,
				today: todayByProvider[provider.id] ?? { date: today, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, tokens: 0, cost: provider.id === "deepseek-official" ? 0 : null }
			};
		}
		return { ok: true, keys, defaultKeyRef: config.defaultKeyRef, accounts, providers, defaultProviderId, settings: { refreshMs: settings.refreshMs, display: settings.display, maxLedgerEntries: maxLedgerEntriesOf(settings, config), defaultProviderId: settings.defaultProviderId ?? defaultProviderId, visibleProviderIds } };
	};

	const evaluatedLimits = async () => {
		const evaluated = await limitsService.evaluateAll();
		return { ok: true, limits: evaluated.limits, status: evaluated.statuses, defaultKeyRef: config.defaultKeyRef, todayCost: evaluated.todayCost, alerts: evaluated.alerts };
	};

	return {
		"usage/get": async (payload) => {
			const settings = await settingsService.load();
			const pricing = runtimePricingOf(settings, config);
			const usage = filterRenderedUsageByProvider(await collectUsage(ctx, pricing), String(queryOf(payload).provider ?? "").trim());
			return { ok: true, ...usage, today: dayKey(Date.now()), pricing: { currency: pricing.currency, peakHours: pricing.peakHours, peakMultiplier: pricing.peakMultiplier, weekendOffPeakFrom: pricing.weekendOffPeakFrom } };
		},
		"keys/list": async () => ({ ok: true, keys: await configuredKeys(ctx, config) }),
		"providers/list": async () => {
			const providers = await providerService.providers();
			return { ok: true, providers, defaultProviderId: providers.find((entry) => entry.default)?.id ?? providers[0]?.id ?? "deepseek-official" };
		},
		"balance/get": async (payload) => {
			const query = queryOf(payload);
			const providerId = String(query.provider ?? "");
			const requested = String(query.key ?? "");
			if (providerId !== "" && providerId !== "deepseek-official") return { ok: true, account: await providerService.get(providerId, requested || null, query.refresh === "1") };
			const ref = requested !== "" && config.keys.includes(requested) ? requested : config.defaultKeyRef;
			return { ok: true, account: await balanceService.get(ref, query.refresh === "1") };
		},
		"limits/get": evaluatedLimits,
		"limits/update": async (payload) => {
			let limits;
			try { limits = validateLimits(bodyOf(payload)); }
			catch (error) { throw new UsageRpcBadRequestError(error instanceof Error ? error.message : String(error)); }
			await limitsService.updateLimits(limits);
			return evaluatedLimits();
		},
		"accounts/get": accountPayload,
		"accounts/update": async (payload) => {
			const body = bodyOf(payload);
			const patch = {};
			if (Object.hasOwn(body, "refreshMs")) {
				if (body.refreshMs !== null && (!Number.isFinite(Number(body.refreshMs)) || Number(body.refreshMs) < 5000)) throw new UsageRpcBadRequestError("refreshMs must be null or >= 5000");
				patch.refreshMs = body.refreshMs === null ? null : Number(body.refreshMs);
			}
			if (Object.hasOwn(body, "maxLedgerEntries")) {
				if (!Number.isSafeInteger(body.maxLedgerEntries) || body.maxLedgerEntries < 100 || body.maxLedgerEntries > 5000) throw new UsageRpcBadRequestError("maxLedgerEntries must be an integer from 100 to 5000");
				patch.maxLedgerEntries = body.maxLedgerEntries;
			}
			if (body.display !== void 0) {
				if (body.display === null || typeof body.display !== "object" || Array.isArray(body.display)) throw new UsageRpcBadRequestError("display must be an object");
				patch.display = body.display;
			}
			const providers = await providerService.providers();
			const providerIds = new Set(providers.map((entry) => entry.id));
			if (body.defaultProviderId !== void 0) {
				if (!providerIds.has(body.defaultProviderId)) throw new UsageRpcBadRequestError("defaultProviderId is not a configured provider");
				patch.defaultProviderId = body.defaultProviderId;
			}
			if (body.visibleProviderIds !== void 0) {
				if (!Array.isArray(body.visibleProviderIds) || body.visibleProviderIds.length < 1 || body.visibleProviderIds.length > 3 || new Set(body.visibleProviderIds).size !== body.visibleProviderIds.length || body.visibleProviderIds.some((id) => !providerIds.has(id))) throw new UsageRpcBadRequestError("visibleProviderIds must contain one to three distinct configured provider ids");
				patch.visibleProviderIds = body.visibleProviderIds;
			}
			let credential;
			if (body.credential !== void 0) {
				const provider = providers.find((entry) => entry.id === body.credential?.providerId);
				const field = provider?.extraCredentials?.find((entry) => entry.id === body.credential?.fieldId);
				if (!field || typeof body.credential?.value !== "string" || body.credential.value.trim() === "") throw new UsageRpcBadRequestError("credential field/value is invalid");
				const credentials = serviceOf(ctx, "credentials");
				if (typeof credentials?.set !== "function") throw new TypeError("credential storage is not writable");
				await credentials.set(field.ref, body.credential.value.trim());
				credential = { providerId: provider.id, fieldId: field.id, configured: true };
			}
			if (Object.keys(patch).length > 0) await settingsService.update(patch);
			const updated = await settingsService.load();
			return { ok: true, defaultProviderId: updated.defaultProviderId, ...(credential ? { credential } : {}), settings: { refreshMs: updated.refreshMs, display: updated.display, maxLedgerEntries: maxLedgerEntriesOf(updated, config), defaultProviderId: updated.defaultProviderId, visibleProviderIds: visibleProviderIdsOf(updated, providers, updated.defaultProviderId) } };
		},
		"pricing/get": async () => {
			const settings = await settingsService.load();
			const official = defaultPricingVersion();
			return { ok: true, current: runtimePricingOf(settings, config), official, usingCustom: settingsService.hasUserPricing?.() ?? false, checkedAt: settings.pricing?.checkedAt ?? official.checkedAt, sourceUrl: official.sourceUrl };
		},
		"pricing/update": async (payload) => {
			const body = bodyOf(payload);
			if (body.action === "fetch-official") return { ok: true, candidate: await (deps.fetchOfficialPricing ?? fetchOfficialPricing)() };
			if (body.action === "restore") await settingsService.resetPricing();
			else if (body.mode === "custom") {
				try { validatePricingInput(body.pricing); }
				catch (error) { throw new UsageRpcBadRequestError(error instanceof Error ? error.message : String(error)); }
				await settingsService.update({ pricing: normalizePricing({ ...body.pricing, mode: "custom", checkedAt: new Date().toISOString() }) });
			} else throw new UsageRpcBadRequestError("pricing update must save custom pricing, restore, or fetch-official");
			const settings = await settingsService.load();
			return { ok: true, current: runtimePricingOf(settings, config), usingCustom: settingsService.hasUserPricing?.() ?? body.action !== "restore" };
		},
		"alerts/get": async () => ({ ok: true, alerts: (await limitsService.evaluateAll()).alerts ?? [], notifications: (await settingsService.load()).notifications }),
		"alerts/update": async (payload) => {
			const notifications = bodyOf(payload).notifications;
			if (notifications === null || typeof notifications !== "object" || Array.isArray(notifications)) throw new UsageRpcBadRequestError("notifications payload must be an object");
			const updated = await settingsService.update({ notifications });
			return { ok: true, notifications: updated.notifications };
		},
		"data/get": async () => ({ ok: true, info: dataInfoOf(repository.get(), config, await settingsService.load()) }),
		"data/trim": async (payload) => {
			await repository.update((state) => trimLedgerState(state, retentionCutoff(bodyOf(payload).retentionDays)));
			return { ok: true, trimmed: true };
		},
		"data/clear": async (payload) => {
			if (!isDataClearConfirmation(bodyOf(payload).confirmation)) throw new UsageRpcBadRequestError("clear confirmation must be 清除 or DELETE");
			await repository.update(clearLedgerState);
			return { ok: true, cleared: true };
		},
		"data/rebuild-estimated": async (payload, signal) => {
			const body = bodyOf(payload);
			if (body.dryRun !== void 0 && typeof body.dryRun !== "boolean") throw new UsageRpcBadRequestError("dryRun must be a boolean");
			const baseline = repository.get();
			const baselineFingerprint = JSON.stringify(baseline);
			const rebuilt = await rebuildEstimatedFromPersistence(serviceOf(ctx, "sessionPersistence"), baseline, { signal });
			signal?.throwIfAborted?.();
			if (body.dryRun !== true) await repository.update((state) => {
				signal?.throwIfAborted?.();
				if (JSON.stringify(state) !== baselineFingerprint) throw new Error("usage state changed during estimated-history rebuild; retry the operation");
				return { ...state, archive: { ...state.archive, estimated: { ...state.archive.estimated, sessionRebuild: rebuilt } } };
			});
			return { ok: true, rebuilt: true, dryRun: body.dryRun === true, preview: rebuilt };
		}
	};
}

function registerUsageInterceptors(ctx, config, settingsService, limitsService, deps) {
	if (typeof ctx.on !== "function") return;
	const activeSteps = new Map();
	const capturedStreamSamples = new Set();
	const unscopedStreamSamples = new Map();
	const UNSCOPED_SAMPLE_MAX_AGE_MS = 10 * 60 * 1000;
	const unscopedStreamKeyOf = (sessionId, provider, model) => sessionId === null
		? null
		: `${sessionId}:${provider ?? "unknown"}/${model ?? "unknown"}`;
	const removeUnscopedStream = (key, sample) => {
		if (key === null || sample === null) return;
		const queue = unscopedStreamSamples.get(key);
		if (queue === void 0) return;
		const index = queue.indexOf(sample);
		if (index >= 0) queue.splice(index, 1);
		if (queue.length === 0) unscopedStreamSamples.delete(key);
	};
	const pruneUnscopedStreams = (now = Date.now()) => {
		for (const [key, queue] of unscopedStreamSamples) {
			const fresh = queue.filter((sample) => now - sample.startedAt <= UNSCOPED_SAMPLE_MAX_AGE_MS);
			if (fresh.length === 0) unscopedStreamSamples.delete(key);
			else if (fresh.length !== queue.length) unscopedStreamSamples.set(key, fresh);
		}
	};
	const reserveUnscopedStream = (key, startedAt) => {
		if (key === null) return null;
		pruneUnscopedStreams(startedAt);
		const sample = { sampleKey: `stream:${startedAt}:${randomUUID()}`, startedAt, completed: false, assistantSeen: false };
		const queue = unscopedStreamSamples.get(key) ?? [];
		queue.push(sample);
		unscopedStreamSamples.set(key, queue);
		return sample;
	};
	const findUnscopedStream = (key, now) => {
		if (key === null) return null;
		pruneUnscopedStreams(now);
		return (unscopedStreamSamples.get(key) ?? []).find((sample) => !sample.assistantSeen) ?? null;
	};
	const sampleKeyOf = (sessionId, provider, model, turn, step) => Number.isInteger(turn) && Number.isInteger(step)
		? `${sessionId ?? "<unscoped>"}:${provider ?? "unknown"}/${model ?? "unknown"}:${turn}:${step}`
		: null;
	ctx.effect(() => ctx.on("llm/stream", async function* (payload, next) {
		const startedAt = Date.now();
		let usage = null;
		let completedAt = startedAt;
		const provider = payload?.provider ?? payload?.config?.provider ?? "unknown";
		const model = payload?.model ?? payload?.config?.model ?? "unknown";
		const sessionId = payload?.sessionId ?? payload?.id ?? null;
		// Auxiliary one-shot calls (compaction/title/etc.) may reuse sessionId
		// outside the agent step. Only the ordinary loop call inherits the last
		// official step/start identity.
		const activeStep = sessionId === null || payload?.purpose !== void 0 ? null : activeSteps.get(sessionId);
		let turn = activeStep?.turn ?? null;
		let step = activeStep?.step ?? null;
		let sampleKey = sampleKeyOf(sessionId, provider, model, turn, step);
		let unscopedKey = null;
		let unscopedStream = null;
		if (isOfficialBillingProvider(provider)) {
			try {
				const status = await limitsService.check(payload ?? {});
				if (status?.status === "blocked" || status?.blocked === true) throw new UsageLimitExceededError(status);
			} catch (error) {
				if (error instanceof UsageLimitExceededError) throw error;
				ctx.logger?.warn?.(`usage-stats: quota check failed open: ${String(error)}`);
			}
		}
		unscopedKey = sampleKey === null ? unscopedStreamKeyOf(sessionId, provider, model) : null;
		unscopedStream = reserveUnscopedStream(unscopedKey, startedAt);
		if (unscopedStream !== null) sampleKey = unscopedStream.sampleKey;
		try {
			for await (const chunk of typeof next === "function" ? next() : []) {
				if (chunk?.type === "usage" && chunk.usage !== void 0) {
					usage = chunk.usage;
					completedAt = Date.now();
					if (sampleKey !== null && !isFacadeProvider(provider)) capturedStreamSamples.add(sampleKey);
				}
				yield chunk;
			}
		} finally {
			if (usage !== null && !isFacadeProvider(provider)) {
				sampleKey ??= `${provider}/${model}:stream:${startedAt}:${randomUUID()}`;
				const entry = freezeLedgerEntry({ id: deps.createLedgerId?.() ?? randomUUID(), occurredAt: startedAt, completedAt, provider, model, ...(turn === null ? {} : { turn }), ...(step === null ? {} : { step }), sampleKey, usage }, runtimePricingOf(settingsService.snapshot(), config));
				try {
					if (deps.recordLedger) await deps.recordLedger(entry);
					else await recordLedgerEntry(ctx, entry, { maxLedgerEntries: () => maxLedgerEntriesOf(settingsService.snapshot(), config), pricing: runtimePricingOf(settingsService.snapshot(), config), replaceSampleKey: true });
				} catch (error) { ctx.logger?.warn?.(`usage-stats: ledger record failed: ${String(error)}`); }
			}
			if (unscopedStream !== null) {
				unscopedStream.completed = true;
				if (usage === null || unscopedStream.assistantSeen) removeUnscopedStream(unscopedKey, unscopedStream);
			}
			if (sampleKey !== null) capturedStreamSamples.delete(sampleKey);
		}
	}), "usage-stats: llm/stream");
	ctx.effect(() => ctx.on("session/event", async (session, event) => {
		const sessionId = session?.id ?? session?.sessionId ?? null;
		if (event?.type === "session/end" || event?.type === "session/stop" || event?.type === "session/delete") {
			if (sessionId !== null) activeSteps.delete(sessionId);
			return;
		}
		if (event?.type === "step/start") {
			if (sessionId !== null && Number.isInteger(event.data?.turn) && Number.isInteger(event.data?.step)) {
				activeSteps.set(sessionId, { turn: event.data.turn, step: event.data.step });
				if (activeSteps.size > 10000) activeSteps.delete(activeSteps.keys().next().value);
			}
			return;
		}
		if (event?.type === "step/end") {
			const active = sessionId === null ? null : activeSteps.get(sessionId);
			if (active?.turn === event.data?.turn && active?.step === event.data?.step) activeSteps.delete(sessionId);
			return;
		}
		if (event?.type !== "assistant/message" || event.data?.usage === void 0) return;
		const provider = event.data?.message?.source?.provider ?? "unknown";
		const model = event.data?.message?.source?.model ?? "unknown";
		if (isFacadeProvider(provider)) return;
		const turn = Number.isInteger(event.data?.turn) ? event.data.turn : null;
		const step = Number.isInteger(event.data?.step) ? event.data.step : null;
		const occurredAt = Number(event.time) || Date.now();
		let sampleKey = sampleKeyOf(sessionId, provider, model, turn, step);
		const unscopedKey = sampleKey === null ? unscopedStreamKeyOf(sessionId, provider, model) : null;
		const unscopedStream = findUnscopedStream(unscopedKey, occurredAt);
		if (unscopedStream !== null) {
			unscopedStream.assistantSeen = true;
			sampleKey = unscopedStream.sampleKey;
		}
		sampleKey ??= `${provider}/${model}:event:${occurredAt}:${randomUUID()}`;
		if (capturedStreamSamples.has(sampleKey)) return;
		const entry = freezeLedgerEntry({ id: randomUUID(), occurredAt, completedAt: occurredAt, provider, model, ...(turn === null ? {} : { turn }), ...(step === null ? {} : { step }), sampleKey, usage: event.data.usage }, runtimePricingOf(settingsService.snapshot(), config));
		try {
			if (deps.recordLedger) await deps.recordLedger(entry);
			else await recordLedgerEntry(ctx, entry, { maxLedgerEntries: () => maxLedgerEntriesOf(settingsService.snapshot(), config), pricing: runtimePricingOf(settingsService.snapshot(), config), replaceSampleKey: true });
		} catch (error) { ctx.logger?.warn?.(`usage-stats: fallback ledger record failed: ${String(error)}`); }
		if (unscopedStream?.completed === true) removeUnscopedStream(unscopedKey, unscopedStream);
	}), "usage-stats: assistant/message fallback");
}

/** Initialize official seams before exposing listeners or RPC. */
async function apply(ctx, rawConfig = {}, deps = {}) {
	const config = validateConfig(rawConfig);
	const officialSettings = createUsageStatsSettings(ctx, config);
	try {
		await officialSettings.retireStaleFields();
	} catch (error) {
		// Pruning retired fields is best-effort housekeeping; it must not block startup.
		ctx.logger?.warn?.(`usage-stats: retired settings field cleanup failed: ${String(error)}`);
	}
	if (officialSettings.get().migration?.legacySettingsImported !== true) {
		const paths = legacyUsageStatsPaths(deps.dshHome);
		const [settingsFile, limitsFile] = await Promise.all([prepareLegacyJson(paths.settings), prepareLegacyJson(paths.limits)]);
		const migrated = migrateLegacySettingsToV3(settingsFile?.value ?? null, limitsFile?.value ?? null, { settingsSha256: settingsFile?.sha256, limitsSha256: limitsFile?.sha256 });
		await officialSettings.mutate([
			...Object.entries(migrated.settingsPatch).map(([key, value]) => ({ op: "set", path: [key], value })),
			{ op: "set", path: ["limits"], value: migrated.limits },
			{ op: "set", path: ["migration"], value: migrated.migration }
		]);
	}
	const paths = legacyUsageStatsPaths(deps.dshHome);
	const repository = await openUsageStatsStorage(ctx, { initialState: async () => {
		const cache = await prepareLegacyJson(paths.cache);
		return cache === null
			? createEmptyUsageState({ legacyCacheImported: true, legacyCacheSha256: "", migratedAt: Date.now() })
			: migrateLegacyCacheToV3(cache.value, { sourceSha256: cache.sha256, maxLedgerEntries: maxLedgerEntriesOf(officialSettings.get(), config) });
	} });
	repositoryByContext.set(ctx, repository);
	ctx.effect(() => async () => { repositoryByContext.delete(ctx); await repository.close(); }, "usage-stats: storage domain");
	const credentials = serviceOf(ctx, "credentials");
	const settingsService = createSettingsService({ official: officialSettings });
	settingsService.resetPricing = officialSettings.resetPricing;
	settingsService.hasUserPricing = () => ctx.settings.describe?.().find((entry) => String(entry.ns) === "usage-stats")?.user?.pricing !== void 0;
	const balanceService = deps.balanceService ?? createBalanceService({ credentials, config });
	const providerService = deps.providerService ?? createProviderService({ ctx, config, credentials, settingsService, deps });
	const limitsService = deps.limitsService ?? createLimitsService({ ctx, config, balanceService, deps: { settings: { ...settingsService, replaceLimits: officialSettings.replaceLimits } } });
	const operations = createUsageOperations({ ctx, config, settingsService, repository, balanceService, providerService, limitsService, deps });
	registerUsageRpc(ctx, createUsageRpcDispatcher(operations, ctx.logger));
	registerUsageInterceptors(ctx, config, settingsService, limitsService, deps);
	if (deps.disableBackgroundRefresh !== true) {
		const disposeRefresh = createBackgroundRefreshController({
			watch: (callback) => officialSettings.watch(callback),
			start: () => startBackgroundRefresh(ctx, balanceService, config, { getRefreshMs: () => refreshCadenceOf(settingsService.snapshot(), config), getPricing: () => runtimePricingOf(settingsService.snapshot(), config), refreshProvider: () => providerService.refreshAll() })
		});
		ctx.effect(() => disposeRefresh, "usage-stats: background refresh");
	}
}

export {
	apply,
	Config,
	inject,
	name,
	USAGE_RPC_CHANNEL,
	USAGE_RPC_ENDPOINTS,
	roundCost,
	defaultLimitRule,
	defaultLimits,
	validateLimitRule,
	validateLimits,
	evaluateKeyQuota,
	resolveLimitRule,
	createLimitsService,
	createAlertTracker,
	alertEventCategoryOf,
	filterRenderedUsageByProvider,
	recordLedgerEntry,
	createSettingsService,
	runtimePricingOf,
	maxLedgerEntriesOf,
	dataInfoOf
};
