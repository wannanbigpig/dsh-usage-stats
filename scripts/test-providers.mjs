// Offline behavioral tests for lib/providers.js.
//
// Contract exercised here:
//   queryProvider(providerId, { apiKey, baseURL, fetchImpl, timeoutMs })
//
// queryProvider must normalize provider-specific responses into an object with
// `status` (ok/error/timeout/unauthorized/not-supported), `providerId`, and
// optional `balance` / `windows` fields.  The test intentionally only uses a
// supplied fetch implementation; a mock that is not configured for a URL
// throws, so this file can never silently access the real network.
import assert from "node:assert/strict";
import { listBuiltInProviders, queryProvider } from "../lib/providers.js";

let checks = 0;

function check(condition, message) {
	checks += 1;
	assert.ok(condition, message);
}

function jsonResponse(status, body) {
	const text = typeof body === "string" ? body : JSON.stringify(body);
	return {
		status,
		ok: status >= 200 && status < 300,
		headers: new Map([["content-type", "application/json"]]),
		json: async () => (typeof body === "string" ? JSON.parse(body) : body),
		text: async () => text
	};
}

function mockFetch(routes) {
	const calls = [];
	const fetchImpl = async (input, init = {}) => {
		const url = String(input);
		calls.push({ url, init });
		const route = routes.find((candidate) => candidate.match(url, init));
		if (!route) throw new Error(`unexpected mocked request: ${init.method ?? "GET"} ${url}`);
		if (route.error) throw route.error;
		return typeof route.response === "function"
			? route.response(url, init)
			: route.response;
	};
	return { fetchImpl, calls };
}

function providerResult(result) {
	check(result && typeof result === "object", "provider query returns an object");
	return result;
}

function statusOf(result) {
	return String(result?.status ?? (result?.ok === true ? "ok" : ""));
}

function windowsOf(result) {
	return result?.windows ?? result?.plan?.windows ?? result?.quotas ?? result?.tiers ?? [];
}

function balanceOf(result) {
	return result?.balance ?? result?.account?.balance ?? null;
}

function windowOf(result, names) {
	const wanted = new Set(names);
	return windowsOf(result).find((item) => wanted.has(item?.kind) || wanted.has(item?.name) || wanted.has(item?.window));
}

function authHeader(init) {
	return init?.headers?.Authorization ?? init?.headers?.authorization;
}

async function query(providerId, fetchImpl, extra = {}) {
	return providerResult(await queryProvider(providerId, {
		apiKey: "test-api-key",
		baseURL: extra.baseURL,
		fetchImpl,
		timeoutMs: extra.timeoutMs ?? 250
	}));
}

// Provider metadata is part of the UI contract even when no safe remote
// query adapter exists yet. Xiaomi MiMo remains selectable as a configured
// model route, but must be rendered as unsupported instead of being queried.
{
	const builtins = listBuiltInProviders();
	const xiaomi = builtins.find((provider) => provider.id === "xiaomi-token-plan-cn");
	const zai = builtins.find((provider) => provider.id === "zai-coding-cn");
	check(xiaomi?.queryable === false && xiaomi?.kind === "plan", "Xiaomi Token Plan metadata is present but not remotely queryable");
	check(xiaomi?.capabilities?.includes("plan_quota") && Array.isArray(xiaomi?.planQuota?.windows), "Xiaomi advertises plan-quota capability metadata");
	check(JSON.stringify(zai?.planQuota?.windows) === JSON.stringify(["five_hour", "weekly"]), "Z.ai metadata declares its five-hour and weekly quota windows");
	let called = false;
	const result = await queryProvider("xiaomi-token-plan-cn", {
		apiKey: "test-api-key",
		fetchImpl: async () => { called = true; throw new Error("must not query Xiaomi"); }
	});
	check(statusOf(result) === "unsupported" && called === false, "Xiaomi returns unsupported without making a network request");
}

// DeepSeek official balance.
{
	const { fetchImpl, calls } = mockFetch([{
		match: (url) => url === "https://api.deepseek.com/user/balance",
		response: jsonResponse(200, {
			is_available: true,
			balance_infos: [{ currency: "CNY", total_balance: "22.89", granted_balance: "0", topped_up_balance: "22.89" }]
		})
	}]);
	const result = await query("deepseek-official", fetchImpl, { baseURL: "https://api.deepseek.com" });
	check(statusOf(result) === "ok", "DeepSeek balance succeeds");
	check(result.providerId === "deepseek-official" || result.provider === "deepseek-official", "DeepSeek provider identity is preserved");
	check(Number(balanceOf(result)?.amount ?? balanceOf(result)?.total ?? balanceOf(result)?.totalBalance) === 22.89, "DeepSeek balance is normalized");
	check(calls.length === 1 && authHeader(calls[0].init) === "Bearer test-api-key", "DeepSeek uses Bearer authentication");
}

// A response without the optional availability flag is still usable; this
// must match the server-side balance service's fail-open interpretation.
{
	const { fetchImpl } = mockFetch([{
		match: (url) => url === "https://api.deepseek.com/user/balance",
		response: jsonResponse(200, { balance_infos: [{ currency: "CNY", total_balance: "3.00" }] })
	}]);
	const result = await query("deepseek-official", fetchImpl, { baseURL: "https://api.deepseek.com" });
	check(balanceOf(result)?.available === true, "DeepSeek missing is_available remains available");
}

// OpenRouter must tolerate one source failing as long as /key or /credits
// succeeds.  Here /key is rejected while /credits supplies the result.
{
	const { fetchImpl, calls } = mockFetch([
		{ match: (url) => url === "https://openrouter.ai/api/v1/key", response: jsonResponse(403, { error: { message: "management key required" } }) },
		{ match: (url) => url === "https://openrouter.ai/api/v1/credits", response: jsonResponse(200, { data: { total_credits: "100", total_usage: "12.5" } }) }
	]);
	const result = await query("openrouter", fetchImpl, { baseURL: "https://openrouter.ai/api/v1" });
	check(statusOf(result) === "ok", "OpenRouter succeeds when credits succeeds and key fails");
	check(calls.some((call) => call.url.endsWith("/api/v1/key")) && calls.some((call) => call.url.endsWith("/api/v1/credits")), "OpenRouter probes both key and credits");
	check(Number(balanceOf(result)?.amount ?? balanceOf(result)?.remaining ?? balanceOf(result)?.total) === 87.5, "OpenRouter credits are normalized to remaining balance");
}

// Kimi Coding Token Plan: a 5-hour detail window and a weekly usage window.
{
	const { fetchImpl, calls } = mockFetch([{
		match: (url) => url === "https://api.kimi.com/coding/v1/usages",
		response: jsonResponse(200, {
			usage: { limit: "100000", remaining: "75000", resetTime: "2026-08-28T00:00:00Z" },
			limits: [{ detail: { limit: "1000", remaining: "700", resetTime: "2026-08-21T15:00:00Z" } }]
		})
	}]);
	const result = await query("kimi-coding", fetchImpl, { baseURL: "https://api.kimi.com/coding" });
	check(statusOf(result) === "ok", "Kimi Token Plan succeeds");
	check(Boolean(windowOf(result, ["five_hour", "5h"])), "Kimi exposes a five-hour window");
	check(Boolean(windowOf(result, ["weekly", "weekly_limit"])), "Kimi exposes a weekly window");
	check(calls.length === 1 && authHeader(calls[0].init) === "Bearer test-api-key", "Kimi uses Bearer authentication");
}

const minimaxBody = {
	data: {
		model_remains: [{
			model_name: "general",
			current_interval_remaining_percent: "80",
			current_weekly_remaining_percent: "60",
			end_time: 1787324400000,
			weekly_end_time: 1787932800000
		}]
	}
};

// MiniMax prefers the current Token Plan endpoint.
{
	const { fetchImpl, calls } = mockFetch([{
		match: (url) => url === "https://api.minimax.io/v1/token_plan/remains",
		response: jsonResponse(200, minimaxBody)
	}]);
	const result = await query("minimax", fetchImpl, { baseURL: "https://api.minimax.io/anthropic" });
	check(statusOf(result) === "ok", "MiniMax new Token Plan endpoint succeeds");
	check(calls.length === 1 && calls[0].url.endsWith("/v1/token_plan/remains"), "MiniMax tries the new endpoint first");
	check(Boolean(windowOf(result, ["session", "five_hour", "5h"])), "MiniMax exposes a five-hour window");
}

// If the new endpoint is unavailable, MiniMax falls back to the legacy
// coding_plan endpoint for the same region.
{
	const { fetchImpl, calls } = mockFetch([
		{ match: (url) => url === "https://api.minimax.io/v1/token_plan/remains", response: jsonResponse(404, { error: "not found" }) },
		{ match: (url) => url === "https://api.minimax.io/v1/api/openplatform/coding_plan/remains", response: jsonResponse(200, minimaxBody) }
	]);
	const result = await query("minimax", fetchImpl, { baseURL: "https://api.minimax.io/anthropic" });
	check(statusOf(result) === "ok", "MiniMax legacy fallback succeeds");
	check(calls.length === 2 && calls[0].url.endsWith("/v1/token_plan/remains") && calls[1].url.endsWith("/v1/api/openplatform/coding_plan/remains"), "MiniMax fallback order is new then legacy");
}

// A configured host must match a complete MiniMax DNS suffix; attacker-like
// suffixes must fall back to the provider's documented origin.
{
	const { fetchImpl, calls } = mockFetch([
		{ match: (url) => url.startsWith("https://api.minimaxi.com/"), response: jsonResponse(404, { error: "not found" }) }
	]);
	await query("minimax-cn", fetchImpl, { baseURL: "https://minimaxi.com.evil.example/anthropic" });
	check(calls.length === 2 && calls.every((call) => call.url.startsWith("https://api.minimaxi.com/")), "MiniMax rejects attacker-like configured hostnames");
}

// Z.ai quota response uses explicit unit values to classify the windows.
{
	const { fetchImpl, calls } = mockFetch([{
		match: (url) => url === "https://api.z.ai/api/monitor/usage/quota/limit",
		response: jsonResponse(200, {
			data: {
				limits: [
					{ type: "TOKENS_LIMIT", unit: 3, percentage: 20, nextResetTime: 1787324400000 },
					{ type: "TOKENS_LIMIT", unit: 6, percentage: 40, nextResetTime: 1787932800000 }
				]
			}
		})
	}]);
	const result = await query("zai", fetchImpl, { baseURL: "https://api.z.ai/api/coding/paas/v4" });
	check(statusOf(result) === "ok", "Z.ai quota succeeds");
	check(Boolean(windowOf(result, ["five_hour", "5h"])) && Boolean(windowOf(result, ["weekly", "weekly_limit"])), "Z.ai exposes both five-hour and weekly windows");
	check(calls.length === 1 && authHeader(calls[0].init) === "test-api-key", "Z.ai uses its API-key authorization scheme");
}

// Some regional responses use snake_case/At reset fields; both windows must
// retain their independent reset timestamps instead of dropping the 5-hour one.
{
	const { fetchImpl } = mockFetch([{
		match: (url) => url === "https://api.z.ai/api/monitor/usage/quota/limit",
		response: jsonResponse(200, {
			data: { limits: [
				{ type: "TOKENS_LIMIT", unit: 3, percentage: 0, next_reset_at: "2026-08-27T09:27:00Z" },
				{ type: "TOKENS_LIMIT", unit: 6, percentage: 30, resetAt: "2026-08-27T17:27:00Z" }
			] }
		})
	}]);
	const result = await query("zai", fetchImpl, { baseURL: "https://api.z.ai/api/coding/paas/v4" });
check(Boolean(windowOf(result, ["five_hour"])?.resetsAt) && Boolean(windowOf(result, ["weekly"])?.resetsAt), "Z.ai preserves reset timestamps for both windows across field variants");
}

// Z.ai omits nextResetTime for an unused five-hour bucket (0% used). Keep the
// bucket classified as five-hour so the UI can explain that no timer started.
{
	const { fetchImpl } = mockFetch([{
		match: (url) => url === "https://api.z.ai/api/monitor/usage/quota/limit",
		response: jsonResponse(200, {
			data: { limits: [
				{ type: "TOKENS_LIMIT", unit: 3, percentage: 0, nextResetTime: 0 },
				{ type: "TOKENS_LIMIT", unit: 6, percentage: 24, nextResetTime: "2026-08-27T17:27:00Z" }
			] }
		})
	}]);
	const result = await query("zai", fetchImpl, { baseURL: "https://api.z.ai/api/coding/paas/v4" });
	check(windowOf(result, ["five_hour"])?.remainingPercent === 100 && !windowOf(result, ["five_hour"])?.resetsAt, "Z.ai keeps an unused five-hour bucket without inventing a reset timestamp");
}

// Z.ai may return usage/remaining/currentValue instead of percentage. The
// same unit=3/6 markers must still render the 5-hour and weekly windows.
{
	const { fetchImpl } = mockFetch([{
		match: (url) => url === "https://api.z.ai/api/monitor/usage/quota/limit",
		response: jsonResponse(200, {
			data: {
				limits: [
					{ type: "TOKENS_LIMIT", unit: 3, number: 5, usage: "100000", remaining: "70000", currentValue: "25000", nextResetTime: 1787324400000 },
					{ type: "TOKENS_LIMIT", unit: 6, number: 1, usage: "1000000", remaining: "600000", currentValue: "200000", nextResetTime: 1787932800000 }
				]
			}
		})
	}]);
	const result = await query("zai", fetchImpl, { baseURL: "https://api.z.ai/api/coding/paas/v4" });
	check(statusOf(result) === "ok", "Z.ai usage/remaining quota response succeeds");
	check(windowOf(result, ["five_hour"])?.usedPercent === 30 && windowOf(result, ["weekly"])?.usedPercent === 40, "Z.ai derives used percentage from usage and remaining");
}

// Deterministic upstream errors are represented in the normalized result and
// do not escape as an uncaught promise rejection.
{
	const { fetchImpl } = mockFetch([{
		match: (url) => url === "https://api.deepseek.com/user/balance",
		response: jsonResponse(401, { error: "invalid key" })
	}]);
	const result = await query("deepseek-official", fetchImpl, { baseURL: "https://api.deepseek.com" });
	check(["unauthorized", "error"].includes(statusOf(result)), "HTTP authentication errors have an explicit status");
	check(result.error || result.message, "HTTP authentication errors carry a message");
}

// A timeout must remain distinguishable from an invalid response.
{
	const timeoutError = new Error("request timed out");
	timeoutError.name = "TimeoutError";
	const { fetchImpl } = mockFetch([{
		match: (url) => url === "https://api.kimi.com/coding/v1/usages",
		error: timeoutError
	}]);
	const result = await query("kimi-coding", fetchImpl, { baseURL: "https://api.kimi.com/coding", timeoutMs: 1 });
	check(statusOf(result) === "timeout", "timeouts have a distinct status");
	check(result.error || result.message, "timeouts carry a message");
}

console.log(`provider tests: ${checks} checks passed`);
