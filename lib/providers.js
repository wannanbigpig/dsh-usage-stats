/**
 * Built-in remote usage adapters.
 *
 * The adapters deliberately expose a small, provider-neutral contract. They
 * only perform fixed JSON HTTP requests; credentials are supplied by the
 * caller and are never persisted, logged, or returned in an error message.
 *
 * @module dsh-usage-stats/providers
 */

const DEFAULT_TIMEOUT_MS = 15_000;

const PROVIDER_CAPABILITIES = Object.freeze({
	BALANCE: "balance",
	PLAN_QUOTA: "plan_quota"
});

const FIVE_HOUR_WEEKLY_PERCENT_QUOTA = Object.freeze({
	windows: Object.freeze(["five_hour", "weekly"]),
	metric: "percent"
});

const FIVE_HOUR_WEEKLY_TOKEN_QUOTA = Object.freeze({
	windows: Object.freeze(["five_hour", "weekly"]),
	metric: "tokens"
});

function numberValue(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : void 0;
	}
	return void 0;
}

function clampPercent(value) {
	const parsed = numberValue(value);
	return parsed === void 0 ? void 0 : Math.max(0, Math.min(100, parsed));
}

function resetTime(value) {
	const parsed = numberValue(value);
	if (parsed === void 0) return typeof value === "string" && value ? value : void 0;
	if (parsed <= 0) return void 0;
	const milliseconds = parsed < 1e12 ? parsed * 1000 : parsed;
	const date = new Date(milliseconds);
	return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
}

function endpoint(baseURL, fallback, path) {
	const base = new URL(baseURL || fallback);
	if (base.protocol !== "https:" && base.protocol !== "http:") {
		throw new Error("Provider base URL must use HTTP(S)");
	}
	return new URL(path, base).href;
}

function originEndpoint(baseURL, fallback, path) {
	const base = new URL(baseURL || fallback);
	return endpoint(base.origin, fallback, path);
}

function failure(providerId, status, message, capabilities = []) {
	return { status, providerId, capabilities, message };
}

function success(providerId, capabilities, fields = {}) {
	return { status: "ok", providerId, capabilities, ...fields };
}

function requestStatus(status) {
	if (status === 401 || status === 403) return "unauthorized";
	if (status === 429) return "rate-limited";
	if (status >= 500) return "unavailable";
	return "invalid-response";
}

class ProviderRequestError extends Error {
	constructor(status, message, httpStatus) {
		super(message);
		this.name = "ProviderRequestError";
		this.status = status;
		this.httpStatus = httpStatus;
	}
}

async function fetchJSON(url, apiKey, fetchImpl, timeoutMs, headers = {}) {
	const fetcher = fetchImpl || globalThis.fetch;
	if (typeof fetcher !== "function") {
		throw new ProviderRequestError("unavailable", "Fetch is not available");
	}

	const controller = typeof globalThis.AbortController === "function" ? new AbortController() : void 0;
	const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
	const timer = controller ? setTimeout(() => controller.abort(), duration) : void 0;
	let response;
	try {
		response = await fetcher(url, {
			method: "GET",
			headers: { accept: "application/json", ...headers },
			...(controller ? { signal: controller.signal } : {})
		});
	} catch (error) {
		if (error?.name === "AbortError" || error?.name === "TimeoutError") {
			throw new ProviderRequestError("timeout", "Provider request timed out");
		}
		throw new ProviderRequestError("unavailable", "Provider request failed");
	} finally {
		if (timer) clearTimeout(timer);
	}

	const httpStatus = Number(response?.status);
	const isOK = response?.ok === true || (response?.ok !== false && httpStatus >= 200 && httpStatus < 300);
	if (!isOK) {
		throw new ProviderRequestError(requestStatus(httpStatus), "Provider returned an HTTP error", httpStatus);
	}
	if (!response || typeof response.json !== "function") {
		throw new ProviderRequestError("invalid-response", "Provider returned a non-JSON response", httpStatus);
	}
	let body;
	try {
		body = await response.json();
	} catch {
		throw new ProviderRequestError("invalid-response", "Provider returned invalid JSON", httpStatus);
	}
	return body;
}

function bearerHeaders(apiKey) {
	return { authorization: `Bearer ${apiKey}` };
}

function queryDeepSeek({ providerId, apiKey, baseURL, fetchImpl, timeoutMs }) {
	return fetchJSON(endpoint(baseURL, "https://api.deepseek.com", "/user/balance"), apiKey, fetchImpl, timeoutMs, bearerHeaders(apiKey))
		.then((body) => {
			const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
			const info = infos.find((entry) => entry?.currency === "CNY") || infos[0];
			const total = numberValue(info?.total_balance);
			if (!info || total === void 0) return failure(providerId, "invalid-response", "DeepSeek balance is missing a numeric amount", [PROVIDER_CAPABILITIES.BALANCE]);
			return success(providerId, [PROVIDER_CAPABILITIES.BALANCE], {
				balance: {
					currency: info.currency || "CNY",
					total,
					remaining: total,
					granted: numberValue(info.granted_balance),
					toppedUp: numberValue(info.topped_up_balance),
					available: body?.is_available !== false
				}
			});
		});
}

async function queryOpenRouter({ providerId, apiKey, baseURL, fetchImpl, timeoutMs }) {
	const keyURL = endpoint(baseURL, "https://openrouter.ai/api/v1", "/api/v1/key");
	const creditsURL = endpoint(baseURL, "https://openrouter.ai/api/v1", "/api/v1/credits");
	const headers = bearerHeaders(apiKey);
	let keyBody;
	let creditsBody;
	let keyError;
	let creditsError;
	try {
		keyBody = await fetchJSON(keyURL, apiKey, fetchImpl, timeoutMs, headers);
	} catch (error) {
		keyError = error;
	}
	try {
		creditsBody = await fetchJSON(creditsURL, apiKey, fetchImpl, timeoutMs, headers);
	} catch (error) {
		creditsError = error;
	}

	const key = keyBody?.data && typeof keyBody.data === "object" ? keyBody.data : keyBody;
	const credits = creditsBody?.data && typeof creditsBody.data === "object" ? creditsBody.data : creditsBody;
	const totalCredits = numberValue(credits?.total_credits);
	const totalUsage = numberValue(credits?.total_usage);
	const limit = numberValue(key?.limit);
	const keyRemaining = numberValue(key?.limit_remaining);
	const remaining = totalCredits !== void 0 && totalUsage !== void 0 ? totalCredits - totalUsage : keyRemaining;
	const used = totalCredits !== void 0 && totalUsage !== void 0 ? totalUsage : numberValue(key?.usage);
	if (remaining !== void 0 || used !== void 0 || limit !== void 0) {
		return success(providerId, [PROVIDER_CAPABILITIES.BALANCE], {
			balance: { currency: "USD", total: totalCredits ?? limit, remaining, used, limit }
		});
	}

	const error = keyError || creditsError;
	return failure(providerId, error?.status || "invalid-response", "OpenRouter balance data is unavailable", [PROVIDER_CAPABILITIES.BALANCE]);
}

function parseKimiWindows(body) {
	const windows = [];
	const limits = Array.isArray(body?.limits) ? body.limits : [];
	for (const item of limits) {
		const detail = item?.detail;
		const limit = numberValue(detail?.limit);
		const remaining = numberValue(detail?.remaining);
		if (limit === void 0 && remaining === void 0) continue;
		windows.push({
			kind: "five_hour",
			limit,
			remaining,
			used: limit !== void 0 && remaining !== void 0 ? Math.max(0, limit - remaining) : void 0,
			unit: "tokens",
			resetsAt: resetTime(detail?.resetTime)
		});
	}
	const usage = body?.usage;
	const limit = numberValue(usage?.limit);
	const remaining = numberValue(usage?.remaining);
	if (limit !== void 0 || remaining !== void 0) {
		windows.push({
			kind: "weekly",
			limit,
			remaining,
			used: limit !== void 0 && remaining !== void 0 ? Math.max(0, limit - remaining) : void 0,
			unit: "tokens",
			resetsAt: resetTime(usage?.resetTime)
		});
	}
	return windows;
}

async function queryKimi({ providerId, apiKey, baseURL, fetchImpl, timeoutMs }) {
	const body = await fetchJSON(endpoint(baseURL, "https://api.kimi.com/coding", "/coding/v1/usages"), apiKey, fetchImpl, timeoutMs, bearerHeaders(apiKey));
	const windows = parseKimiWindows(body);
	if (!windows.length) return failure(providerId, "invalid-response", "Kimi usage response contains no quota windows", [PROVIDER_CAPABILITIES.PLAN_QUOTA]);
	return success(providerId, [PROVIDER_CAPABILITIES.PLAN_QUOTA], {
		windows,
		planName: body?.planName || body?.plan_name || body?.plan?.name
	});
}

function minimaxHost(providerId, baseURL) {
	if (baseURL) {
		try {
			const url = new URL(baseURL);
			if (/minimaxi\.com|minimax\.io$/i.test(url.hostname)) return url.origin;
		} catch {
			// Let endpoint() report the malformed URL below.
		}
	}
	return providerId === "minimax-cn" ? "https://api.minimaxi.com" : "https://api.minimax.io";
}

function parseMinimaxWindows(body) {
	const rows = Array.isArray(body?.data?.model_remains) ? body.data.model_remains : body?.model_remains;
	if (!Array.isArray(rows)) return [];
	const item = rows.find((entry) => entry?.model_name === "general");
	if (!item) return [];
	const windows = [];
	const intervalRemaining = clampPercent(item.current_interval_remaining_percent);
	if (intervalRemaining !== void 0 && !(numberValue(item.current_interval_status) === 3 && intervalRemaining >= 100)) {
		windows.push({ kind: "five_hour", usedPercent: 100 - intervalRemaining, remainingPercent: intervalRemaining, resetsAt: resetTime(item.end_time) });
	}
	const weeklyRemaining = clampPercent(item.current_weekly_remaining_percent);
	if (weeklyRemaining !== void 0 && !(numberValue(item.current_weekly_status) === 3 && weeklyRemaining >= 100)) {
		windows.push({ kind: "weekly", usedPercent: 100 - weeklyRemaining, remainingPercent: weeklyRemaining, resetsAt: resetTime(item.weekly_end_time) });
	}
	return windows;
}

async function queryMiniMax({ providerId, apiKey, baseURL, fetchImpl, timeoutMs }) {
	const host = minimaxHost(providerId, baseURL);
	const headers = bearerHeaders(apiKey);
	const attempts = ["/v1/token_plan/remains", "/v1/api/openplatform/coding_plan/remains"];
	let lastError;
	for (const path of attempts) {
		let body;
		try {
			body = await fetchJSON(`${host}${path}`, apiKey, fetchImpl, timeoutMs, headers);
		} catch (error) {
			lastError = error;
			continue;
		}
		const windows = parseMinimaxWindows(body);
		if (windows.length) {
			return success(providerId, [PROVIDER_CAPABILITIES.PLAN_QUOTA], {
				windows,
				planName: body?.data?.plan_name || body?.plan_name || body?.plan
			});
		}
	}
	return failure(providerId, lastError?.status || "invalid-response", "MiniMax usage response contains no quota windows", [PROVIDER_CAPABILITIES.PLAN_QUOTA]);
}

function zaiUsedPercent(limit) {
	const total = numberValue(limit?.usage);
	const remaining = numberValue(limit?.remaining);
	const current = numberValue(limit?.currentValue ?? limit?.current_value);
	if (total !== void 0 && total > 0) {
		const fromRemaining = remaining !== void 0 ? total - remaining : void 0;
		const used = current !== void 0 && fromRemaining !== void 0 ? Math.max(current, fromRemaining) : current ?? fromRemaining;
		if (used !== void 0) return clampPercent((used / total) * 100);
	}
	return clampPercent(limit?.percentage ?? limit?.usedPercent ?? limit?.used_percent);
}

function zaiWindowMinutes(unit, number) {
	const u = numberValue(unit);
	const n = numberValue(number);
	if (u === void 0 || n === void 0 || n <= 0) return null;
	if (u === 5) return n;
	if (u === 3) return n * 60;
	if (u === 1) return n * 24 * 60;
	if (u === 6) return n * 7 * 24 * 60;
	return null;
}

function zaiResetValue(item) {
	const reset = item?.reset;
	const nextReset = item?.nextReset ?? item?.next_reset;
	const limit = item?.limit;
	return item?.nextResetTime
		?? item?.next_reset_time
		?? item?.nextResetAt
		?? item?.next_reset_at
		?? item?.resetAt
		?? item?.reset_at
		?? item?.resetTime
		?? item?.reset_time
		?? item?.endTime
		?? item?.end_time
		?? (reset && typeof reset === "object" ? reset.at ?? reset.time : reset)
		?? (nextReset && typeof nextReset === "object" ? nextReset.at ?? nextReset.time : nextReset)
		?? (limit && typeof limit === "object" ? limit.nextResetTime ?? limit.resetTime ?? limit.resetAt : void 0);
}

function parseZaiWindows(body) {
	const limits = Array.isArray(body?.data?.limits) ? body.data.limits : [];
	const candidates = limits.filter((item) => {
		const type = String(item?.type || item?.limit_type || "").toUpperCase();
		return (type === "TOKENS_LIMIT" || type === "CREDIT_LIMIT") && zaiUsedPercent(item) !== void 0;
	}).map((item) => ({
		item,
		usedPercent: zaiUsedPercent(item),
		minutes: zaiWindowMinutes(item.unit, item.number)
	}));
	if (candidates.length === 0) return [];
	const byWindow = [...candidates].sort((left, right) => {
		if (left.minutes !== null && right.minutes !== null) return left.minutes - right.minutes;
		if (left.minutes !== null) return -1;
		if (right.minutes !== null) return 1;
		return (numberValue(zaiResetValue(left.item)) ?? Number.MAX_SAFE_INTEGER) - (numberValue(zaiResetValue(right.item)) ?? Number.MAX_SAFE_INTEGER);
	});
	const toWindow = (entry, kind) => ({
		kind,
		usedPercent: entry.usedPercent,
		remainingPercent: 100 - entry.usedPercent,
		resetsAt: resetTime(zaiResetValue(entry.item)),
		...(entry.minutes === null ? {} : { windowMinutes: entry.minutes })
	});
	let five = candidates.find((entry) => numberValue(entry.item.unit) === 3) ?? null;
	let weekly = candidates.find((entry) => numberValue(entry.item.unit) === 6) ?? null;
	if (!five && !weekly) {
		if (candidates.length >= 2) {
			five = byWindow[0];
			weekly = byWindow[byWindow.length - 1];
		} else if (byWindow[0].minutes !== null && byWindow[0].minutes <= 6 * 60) {
			five = byWindow[0];
		} else {
			weekly = byWindow[0];
		}
	} else {
		const unknown = byWindow.filter((entry) => entry !== five && entry !== weekly);
		if (!five && unknown.length > 0) five = unknown.shift();
		if (!weekly && unknown.length > 0) weekly = unknown.pop();
	}
	const result = [];
	if (five) result.push(toWindow(five, "five_hour"));
	if (weekly && weekly !== five) result.push(toWindow(weekly, "weekly"));
	return result;
}

async function queryZai({ providerId, apiKey, baseURL, fetchImpl, timeoutMs }) {
	const fallback = providerId === "zai-coding-cn" ? "https://open.bigmodel.cn" : "https://api.z.ai";
	const body = await fetchJSON(endpoint(baseURL, fallback, "/api/monitor/usage/quota/limit"), apiKey, fetchImpl, timeoutMs, {
		authorization: apiKey,
		"content-type": "application/json",
		"accept-language": "en-US,en"
	});
	if (body?.success === false) return failure(providerId, "invalid-response", "Z.ai quota request was rejected", [PROVIDER_CAPABILITIES.PLAN_QUOTA]);
	const windows = parseZaiWindows(body);
	if (!body?.data || typeof body.data !== "object") return failure(providerId, "invalid-response", "Z.ai quota response is missing data", [PROVIDER_CAPABILITIES.PLAN_QUOTA]);
	return success(providerId, [PROVIDER_CAPABILITIES.PLAN_QUOTA], {
		windows,
		planName: body.data.level
	});
}

const PROVIDER_ADAPTERS = Object.freeze({
	"deepseek-official": { id: "deepseek-official", displayName: "DeepSeek 官方", official: true, apiKeyEnv: "DEEPSEEK_API_KEY", kind: "balance", defaultBaseURL: "https://api.deepseek.com", capabilities: [PROVIDER_CAPABILITIES.BALANCE], query: queryDeepSeek },
	deepseek: { id: "deepseek", displayName: "DeepSeek", official: true, apiKeyEnv: "DEEPSEEK_API_KEY", kind: "balance", defaultBaseURL: "https://api.deepseek.com", capabilities: [PROVIDER_CAPABILITIES.BALANCE], query: queryDeepSeek },
	openrouter: { id: "openrouter", displayName: "OpenRouter", official: true, apiKeyEnv: "OPENROUTER_API_KEY", kind: "balance", defaultBaseURL: "https://openrouter.ai/api/v1", capabilities: [PROVIDER_CAPABILITIES.BALANCE], query: queryOpenRouter },
	"kimi-coding": { id: "kimi-coding", displayName: "Kimi Coding", official: true, apiKeyEnv: "KIMI_API_KEY", kind: "plan", defaultBaseURL: "https://api.kimi.com/coding", capabilities: [PROVIDER_CAPABILITIES.PLAN_QUOTA], planQuota: FIVE_HOUR_WEEKLY_TOKEN_QUOTA, query: queryKimi },
	minimax: { id: "minimax", displayName: "MiniMax", official: true, apiKeyEnv: "MINIMAX_API_KEY", kind: "plan", defaultBaseURL: "https://api.minimax.io/anthropic", capabilities: [PROVIDER_CAPABILITIES.PLAN_QUOTA], planQuota: FIVE_HOUR_WEEKLY_PERCENT_QUOTA, query: queryMiniMax },
	"minimax-cn": { id: "minimax-cn", displayName: "MiniMax 中国", official: true, apiKeyEnv: "MINIMAX_CN_API_KEY", kind: "plan", defaultBaseURL: "https://api.minimaxi.com/anthropic", capabilities: [PROVIDER_CAPABILITIES.PLAN_QUOTA], planQuota: FIVE_HOUR_WEEKLY_PERCENT_QUOTA, query: queryMiniMax },
	zai: { id: "zai", displayName: "Z.ai", official: true, apiKeyEnv: "ZAI_API_KEY", kind: "plan", defaultBaseURL: "https://api.z.ai/api/coding/paas/v4", capabilities: [PROVIDER_CAPABILITIES.PLAN_QUOTA], planQuota: FIVE_HOUR_WEEKLY_PERCENT_QUOTA, query: queryZai },
	// `zai-coding-cn` is a user-defined regional alias, not an official route.
	"zai-coding-cn": { id: "zai-coding-cn", displayName: "zai-coding-cn", official: false, apiKeyEnv: "ZAI_CODING_CN_API_KEY", kind: "plan", defaultBaseURL: "https://open.bigmodel.cn/api/coding/paas/v4", capabilities: [PROVIDER_CAPABILITIES.PLAN_QUOTA], planQuota: FIVE_HOUR_WEEKLY_PERCENT_QUOTA, query: queryZai },
	// No documented API-key quota endpoint is available for this route. Keep
	// the provider metadata so configured model routes remain visible, while
	// explicitly preventing speculative network requests.
	"xiaomi-token-plan-cn": {
		id: "xiaomi-token-plan-cn",
		displayName: "xiaomi-token-plan-cn",
		official: false,
		apiKeyEnv: "XIAOMI_TOKEN_PLAN_CN_API_KEY",
		kind: "plan",
		defaultBaseURL: "https://token-plan-cn.xiaomimimo.com/v1",
		capabilities: [PROVIDER_CAPABILITIES.PLAN_QUOTA],
		planQuota: Object.freeze({ windows: Object.freeze([]), metric: "credits" }),
		queryable: false,
		status: "unsupported"
	}
});

/** Return metadata only; adapter functions are intentionally omitted. */
export function listBuiltInProviders() {
	return Object.values(PROVIDER_ADAPTERS).map(({ query, ...provider }) => ({
		...provider,
		queryable: provider.queryable ?? typeof query === "function",
		capabilities: [...provider.capabilities],
		...(provider.planQuota ? { planQuota: { ...provider.planQuota, windows: [...provider.planQuota.windows] } } : {})
	}));
}

/**
 * Query one configured provider account.
 *
 * Missing credentials and provider/network/response errors are represented in
 * the returned status rather than thrown, so callers can render a partial
 * provider list without coupling UI code to transport exceptions.
 */
export async function queryProviderUsage({ providerId, apiKey, baseURL, fetchImpl, timeoutMs } = {}) {
	const adapter = PROVIDER_ADAPTERS[providerId];
	if (!adapter) return failure(providerId, "unsupported", "No built-in usage adapter for this provider", []);
	if (adapter.queryable === false || typeof adapter.query !== "function") {
		return failure(providerId, "unsupported", "No supported usage query is available for this provider", adapter.capabilities);
	}
	if (typeof apiKey !== "string" || apiKey.trim() === "") return failure(providerId, "not-configured", "Provider API key is not configured", adapter.capabilities);
	try {
		return await adapter.query({ providerId, apiKey, baseURL: baseURL || adapter.defaultBaseURL, fetchImpl, timeoutMs });
	} catch (error) {
		return failure(providerId, error?.status || "invalid-response", error?.message || "Provider usage query failed", adapter.capabilities);
	}
}

// Short positional alias retained for small integrations and offline contract tests.
export async function queryProvider(providerId, options = {}) {
	return queryProviderUsage({ providerId, ...options });
}

export { PROVIDER_ADAPTERS };
