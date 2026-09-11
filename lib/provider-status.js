/**
 * dsh-usage-stats — provider account status vocabulary and HTTP mapping.
 *
 * Shared by the DeepSeek balance service and the generic provider adapters so
 * one HTTP failure classifies identically everywhere. Pure module (no cordis
 * imports) so it can be unit-tested offline.
 *
 * @module dsh-usage-stats/provider-status
 */

/** Provider-level failure categories accepted on account rows. */
export const PROVIDER_STATUS_VALUES = Object.freeze([
	"unauthorized",
	"rate-limited",
	"unavailable",
	"invalid-response",
	"timeout",
	"not-subscribed",
	"not-configured"
]);

const PROVIDER_STATUS_SET = new Set(PROVIDER_STATUS_VALUES);

/** HTTP status → provider-level failure category. */
export function providerStatusFromHttp(status) {
	if (status === 401 || status === 403) return "unauthorized";
	if (status === 429) return "rate-limited";
	return status >= 500 ? "unavailable" : "invalid-response";
}

/**
 * Classify one caught error for an account status row. Provider adapters mark
 * their own errors with `.providerStatus`/`.status`; only a REAL HTTP status
 * goes through `providerStatusFromHttp` — a missing status means the request
 * never reached the provider, which is "unavailable", never "invalid-response".
 */
export function providerErrorStatusOf(error) {
	for (const key of ["providerStatus", "status"]) {
		const value = error?.[key];
		if (typeof value === "string" && PROVIDER_STATUS_SET.has(value)) return value;
	}
	const httpStatus = Number(error?.httpStatus);
	if (Number.isInteger(httpStatus) && httpStatus >= 100) {
		const mapped = providerStatusFromHttp(httpStatus);
		if (PROVIDER_STATUS_SET.has(mapped)) return mapped;
	}
	return "unavailable";
}
