/**
 * dsh-usage-stats — DeepSeek official account balance query.
 *
 * The official balance endpoint is `GET {origin}/user/balance` with
 * `Authorization: Bearer <api-key>`, returning:
 *
 * ```json
 * {
 *   "is_available": true,
 *   "balance_infos": [
 *     { "currency": "CNY", "total_balance": "110.00",
 *       "granted_balance": "10.00", "topped_up_balance": "100.00" }
 *   ]
 * }
 * ```
 *
 * The CNY entry is preferred; the first entry is the fallback. This module is
 * pure (no cordis imports) so it can be unit-tested offline.
 *
 * @module dsh-usage-stats/balance
 */

/** DeepSeek balance scheme: relative path + response parsing. */
const DEEPSEEK_SCHEME = {
	url: (baseURL) => new URL("/user/balance", baseURL).href,
	parse: (json) => {
		const infos = Array.isArray(json?.balance_infos) ? json.balance_infos : [];
		const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
		return {
			// The provider omits this flag in some compatible responses. Keep the
			// balance usable unless it explicitly reports unavailable, matching the
			// provider adapter path in lib/providers.js.
			isAvailable: json?.is_available !== false,
			currency: info?.currency ?? void 0,
			total: info?.total_balance ?? void 0,
			granted: info?.granted_balance ?? void 0,
			toppedUp: info?.topped_up_balance ?? void 0
		};
	}
};

/** HTTP status → provider-level failure category. */
export function responseStatus(status) {
	if (status === 401 || status === 403) return "unauthorized";
	if (status === 429) return "rate-limited";
	return status >= 500 ? "unavailable" : "invalid-response";
}

function providerError(status, message, httpStatus) {
	const error = new Error(message);
	error.providerStatus = status;
	if (httpStatus !== void 0) error.httpStatus = httpStatus;
	return error;
}

/**
 * Query the DeepSeek official balance for one API key.
 * @param baseURL - e.g. `https://api.deepseek.com`.
 * @param apiKey - the API key (never logged).
 * @param timeoutMs - upstream timeout.
 * @param fetchImpl - fetch implementation (defaults to global fetch).
 * @returns normalized `{ isAvailable, currency, total, granted, toppedUp }`.
 * @throws on transport/HTTP errors with a `.providerStatus` marker.
 */
export async function queryDeepSeekBalance(baseURL, apiKey, timeoutMs = 15000, fetchImpl = fetch) {
	let response;
	try {
		response = await fetchImpl(DEEPSEEK_SCHEME.url(baseURL), {
			headers: { authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (error) {
		// Transport-level failures (network down, DNS, timeout) mean the
		// provider is unreachable — NOT a malformed response. Tag the error so
		// index.js classifies it as "unavailable" instead of "invalid-response".
		if (error instanceof Error) error.providerStatus = "unavailable";
		else throw providerError("unavailable", String(error));
		throw error;
	}
	if (!response.ok) throw providerError(responseStatus(response.status), `DeepSeek balance API returned HTTP ${response.status}`, response.status);
	let body;
	try {
		body = await response.json();
	} catch (error) {
		if (error?.name === "AbortError" || error?.name === "TimeoutError") throw providerError("unavailable", "DeepSeek balance API timed out");
		throw providerError("invalid-response", "DeepSeek balance API returned invalid JSON");
	}
	const parsed = DEEPSEEK_SCHEME.parse(body);
	const total = typeof parsed.total === "string" && parsed.total.trim() !== "" ? Number(parsed.total.trim()) : parsed.total;
	if (!Number.isFinite(total)) throw providerError("invalid-response", "DeepSeek balance response is missing a numeric amount");
	return parsed;
}
