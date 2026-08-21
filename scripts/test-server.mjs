import {
	apply,
	validateConfig,
	createBalanceService,
	configuredKeys,
	defaultLimitRule,
	defaultLimits,
	validateLimitRule,
	validateLimits,
	evaluateKeyQuota,
	resolveLimitRule,
	createAlertTracker,
	createLimitsService,
	keyForProvider,
	todayCostPerKey,
	todayCostFor,
	USAGE_PATH,
	KEYS_PATH,
	PROVIDERS_PATH,
	BALANCE_PATH,
	LIMITS_PATH,
	ACCOUNTS_PATH,
	PRICING_PATH,
	ALERTS_PATH,
	DATA_PATH,
	migrateCacheV1,
	renderCombinedUsage,
	createSettingsService,
	runtimePricingOf,
	maxLedgerEntriesOf,
	refreshCadenceOf,
	readJsonBody,
	trimCache,
	dataInfoOf,
	providerTodaySummaries,
	isDataClearConfirmation,
	validateSettings
} from "../lib/index.js";
import { dayKey, defaultPricing } from "../lib/usage.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

let failures = 0;
function assert(condition, message) {
	if (!condition) {
		failures += 1;
		console.error(`FAIL: ${message}`);
	}
}

//#region config validation
{
	const defaults = validateConfig({});
	assert(defaults.keys.length === 1 && defaults.keys[0] === "DEEPSEEK_API_KEY", `default keys ${JSON.stringify(defaults.keys)}`);
	assert(defaults.baseURL === "https://api.deepseek.com", "default baseURL");
	assert(defaults.pricing.pricing["deepseek-v4-flash"].inputMiss === 1.5, "default pricing");
	assert(defaults.pricing.currency === "CNY", "default pricing currency");
	assert(defaults.pricing.peakMultiplier === 2 && JSON.stringify(defaults.pricing.peakHours) === "[[9,12],[14,18]]", "official Beijing peak windows");
	assert(defaults.refreshMs === 300000, "default refreshMs");

	const withKeys = validateConfig({ keys: ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY_2"] });
	assert(withKeys.keys.length === 2 && withKeys.keys[1] === "DEEPSEEK_API_KEY_2", `extra keys ${JSON.stringify(withKeys.keys)}`);

	const dedup = validateConfig({ keys: ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY"] });
	assert(dedup.keys.length === 1, `dedup keys ${dedup.keys.length}`);

	const custom = validateConfig({
		baseURL: "https://api.deepseek.com",
		defaultKeyRef: "MY_KEY",
		keys: ["MY_KEY"],
		refreshMs: 60000,
		pricing: {
			pricing: { "deepseek-v4-flash": { inputMiss: 0.5, inputHit: 0.01, output: 1.5 } },
			peakMultiplier: 1.5,
			peakHours: [[0, 8]],
			currency: "CNY"
		}
	});
	assert(custom.pricing.pricing["deepseek-v4-flash"].inputMiss === 0.5, "custom pricing");
	assert(custom.pricing.peakMultiplier === 1.5, "custom peak multiplier");
	assert(JSON.stringify(custom.pricing.peakHours) === "[[0,8]]", "custom peak hours");
	assert(custom.pricing.currency === "CNY", "custom currency");

	const partialPricing = validateConfig({ pricing: { pricing: { "deepseek-v4-flash": { inputMiss: 9 } } } });
	assert(partialPricing.pricing.pricing["deepseek-v4-flash"].inputMiss === 9, "partial pricing override input miss");
	assert(partialPricing.pricing.pricing["deepseek-v4-flash"].inputHit === 0.05, "partial pricing preserves input hit");
	assert(partialPricing.pricing.pricing["deepseek-v4-flash"].output === 4.5, "partial pricing preserves output");

	let threw = null;
	try { validateConfig({ refreshMs: 100 }); } catch (error) { threw = error; }
	assert(threw !== null && /refreshMs/.test(threw.message), "rejects too-small refreshMs");
	try { validateConfig({ baseURL: "http://insecure.example.com" }); } catch (error) { threw = error; }
	assert(threw !== null && /HTTPS/.test(threw.message), "rejects insecure baseURL");
	try { validateConfig({ keys: [""] }); } catch (error) { threw = error; }
	assert(threw !== null, "rejects empty key refs");
	try { validateConfig({ pricing: { peakHours: [[5, 2]] } }); } catch (error) { threw = error; }
	assert(threw !== null && /peakHours/.test(threw.message), "rejects inverted peak hours");
	console.log("config validation ok");
}

//#region JSON body size cap
{
	let threw = null;
	try { await readJsonBody({ body: "x".repeat(17) }, 16); } catch (error) { threw = error; }
	assert(threw !== null && /payload too large/.test(threw.message), "body string honors the size cap");
	const request = new EventEmitter();
	request.destroyed = false;
	request.setEncoding = () => {};
	request.destroy = () => { request.destroyed = true; };
	const pending = readJsonBody(request, 4);
	request.emit("data", "12345");
	await pending.then(() => { threw = null; }, (error) => { threw = error; });
	assert(threw !== null && /payload too large/.test(threw.message) && request.destroyed === true, "stream body stops and destroys oversized requests");
	console.log("JSON body size cap ok");
}

//#region provider-local today summaries
{
	const summaries = providerTodaySummaries({ days: [{
		date: "2026-08-21",
		models: [
			{ model: "deepseek-official/deepseek-chat", inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 1, tokens: 18, cost: 0.02 },
			{ model: "zai-coding-cn/glm-4.5", inputTokens: 20, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 0, tokens: 24, cost: null },
			{ model: "vision-toolkit-zai-coding-cn/glm-4.5", inputTokens: 99, outputTokens: 99, tokens: 198, cost: null }
		]
	}] }, "2026-08-21");
	assert(summaries["deepseek-official"]?.tokens === 18 && summaries["deepseek-official"]?.cost === 0.02, "DeepSeek today summary keeps local tokens and cost");
	assert(summaries["zai-coding-cn"]?.tokens === 24 && summaries["zai-coding-cn"]?.cost === null, "custom provider today summary remains token-only");
	assert(summaries["vision-toolkit-zai-coding-cn"] === void 0, "today summaries exclude facade routes");
	console.log("provider-local today summaries ok");
}

//#region apply + routes & interceptors
{
	const registrations = [];
	const listeners = new Map();
	const ctx = {
		logger: { warn: () => {} },
		get: (name) => name === "llm" ? {
			listProviders: () => [
				{ id: "deepseek-official", name: "DeepSeek" },
				{ id: "openrouter", name: "OpenRouter" },
				{ id: "zai", name: "Z.ai" },
				{ id: "zai-coding-cn", name: "zai-coding-cn" },
				{ id: "xiaomi-token-plan-cn", name: "xiaomi-token-plan-cn" },
				{ id: "vision-toolkit-zai-coding-cn", name: "vision-toolkit-zai-coding-cn" }
			],
			listConfigurableProviders: () => [
				{ provider: "zai-coding-cn", displayName: "zai-coding-cn", declared: true, settingsNs: "llm-pi-ai", settingsPath: ["providers", "zai-coding-cn"] },
				{ provider: "xiaomi-token-plan-cn", displayName: "xiaomi-token-plan-cn", declared: true, settingsNs: "llm-pi-ai", settingsPath: ["providers", "xiaomi-token-plan-cn"] },
				{ provider: "openrouter", displayName: "OpenRouter", declared: false, settingsNs: "llm-pi-ai", settingsPath: ["providers", "openrouter"] },
				{ provider: "zai", displayName: "Z.ai", declared: false, settingsNs: "llm-pi-ai", settingsPath: ["providers", "zai"] }
			]
		} : name === "settings" ? {
			get: (namespace) => namespace === "llm-deepseek"
				? {}
				: namespace === "llm-pi-ai"
					? { providers: { "zai-coding-cn": { apiKeyEnv: "ZAI_CODING_CN_API_KEY" }, "xiaomi-token-plan-cn": { apiKeyEnv: "XIAOMI_TOKEN_PLAN_CN_API_KEY" } } }
					: null
		} : void 0,
		effect: (fn) => { fn(); },
		on: (event, handler) => {
			listeners.set(event, handler);
			return () => listeners.delete(event);
		},
		webServer: { register: (route) => { registrations.push(route); } }
	};
	apply(ctx, {}, {
		disableBackgroundRefresh: true,
		balanceService: { refreshAll: async () => [], get: async () => ({}) },
		limitsService: { check: async () => ({ exceeded: false, stopOnExceed: true, message: "" }) },
		settingsService: {
			load: async () => validateSettings({}),
			update: async (patch) => validateSettings({ ...validateSettings({}), ...patch }),
			snapshot: () => validateSettings({})
		}
	});
	const routes = registrations.filter((entry) => entry !== null && typeof entry === "object" && entry.kind === "exact");
	assert(routes.length === 9, `expected 9 routes, got ${routes.length}`);
	const paths = routes.map((route) => route.path).sort();
	assert(
		paths[0] === ACCOUNTS_PATH && paths[1] === ALERTS_PATH && paths[2] === BALANCE_PATH && paths[3] === DATA_PATH
		&& paths[4] === KEYS_PATH && paths[5] === LIMITS_PATH && paths[6] === PRICING_PATH && paths[7] === PROVIDERS_PATH && paths[8] === USAGE_PATH,
		`routes ${JSON.stringify(paths)}`
	);
	const dataRoute = routes.find((route) => route.path === DATA_PATH);
	const providersRoute = routes.find((route) => route.path === PROVIDERS_PATH);
	const pricingRoute = routes.find((route) => route.path === PRICING_PATH);
	function routeResponse() {
		return {
			status: null,
			headers: null,
			body: "",
			writeHead(status, headers) { this.status = status; this.headers = headers; },
			end(body) { this.body = body ?? ""; }
		};
	}
	const invalidPricingResponse = routeResponse();
	const providersResponse = routeResponse();
	await providersRoute.handler({ method: "GET", headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } }, providersResponse);
	const providersPayload = JSON.parse(providersResponse.body);
	assert(providersResponse.status === 200 && providersPayload.ok === true && Array.isArray(providersPayload.providers), "providers route returns provider directory");
	assert(providersPayload.defaultProviderId === "deepseek-official", "providers route defaults to official DeepSeek");
	assert(JSON.stringify(providersPayload.providers.map((entry) => entry.id)) === JSON.stringify(["deepseek-official", "xiaomi-token-plan-cn", "zai-coding-cn"]), "providers route only exposes model-page configured routes");
	assert(!providersPayload.providers.some((entry) => entry.id.startsWith("vision-toolkit-") || entry.id === "openrouter" || entry.id === "zai"), "provider directory hides facade and unconfigured catalog routes");
	assert(providersPayload.providers.find((entry) => entry.id === "zai-coding-cn")?.label === "zai-coding-cn", "configured route keeps its model-page display name verbatim");
	const xiaomiProvider = providersPayload.providers.find((entry) => entry.id === "xiaomi-token-plan-cn");
	assert(xiaomiProvider?.queryable === false && xiaomiProvider?.status === "unsupported" && xiaomiProvider?.capabilities?.includes("plan_quota"), "Xiaomi route remains visible with explicit unsupported quota status");
	const defaultProviderResponse = routeResponse();
	await routes.find((route) => route.path === ACCOUNTS_PATH).handler({ method: "POST", body: { defaultProviderId: "zai-coding-cn" }, headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } }, defaultProviderResponse);
	const defaultProviderPayload = JSON.parse(defaultProviderResponse.body);
	assert(defaultProviderResponse.status === 200 && defaultProviderPayload.settings?.defaultProviderId === "zai-coding-cn", "accounts route persists default provider");
	const invalidProviderResponse = routeResponse();
	await routes.find((route) => route.path === ACCOUNTS_PATH).handler({ method: "POST", body: { defaultProviderId: "not-a-provider" }, headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } }, invalidProviderResponse);
	assert(invalidProviderResponse.status === 400, "accounts route rejects unknown default provider");
	await pricingRoute.handler({ method: "POST", body: { mode: "custom", pricing: { peakHours: [[25, 30]] } }, headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } }, invalidPricingResponse);
	const invalidPricingPayload = JSON.parse(invalidPricingResponse.body);
	assert(invalidPricingResponse.status === 400 && invalidPricingPayload.error === "invalid-payload" && /peakHours/.test(invalidPricingPayload.message), "pricing route rejects invalid peak hours");
	const validPricingResponse = routeResponse();
	await pricingRoute.handler({ method: "POST", body: { mode: "custom", pricing: { peakHours: [[0, 8], [14, 18]] } }, headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } }, validPricingResponse);
	const validPricingPayload = JSON.parse(validPricingResponse.body);
	assert(validPricingResponse.status === 200 && validPricingPayload.ok === true && JSON.stringify(validPricingPayload.current.peakHours) === "[[0,8],[14,18]]", "pricing route accepts valid peak hours");
	const invalidModelPricingResponse = routeResponse();
	await pricingRoute.handler({ method: "POST", body: { mode: "custom", pricing: { models: { "deepseek-v4-flash": { offPeak: { inputMiss: "not-a-number" } } } } }, headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } }, invalidModelPricingResponse);
	const invalidModelPricingPayload = JSON.parse(invalidModelPricingResponse.body);
	assert(invalidModelPricingResponse.status === 400 && invalidModelPricingPayload.error === "invalid-payload" && /inputMiss/.test(invalidModelPricingPayload.message), "pricing route rejects non-numeric model prices");
	const negativeModelPricingResponse = routeResponse();
	await pricingRoute.handler({ method: "POST", body: { mode: "custom", pricing: { models: { "deepseek-v4-flash": { offPeak: { output: -1 } } } } }, headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } }, negativeModelPricingResponse);
	const negativeModelPricingPayload = JSON.parse(negativeModelPricingResponse.body);
	assert(negativeModelPricingResponse.status === 400 && negativeModelPricingPayload.error === "invalid-payload" && /output/.test(negativeModelPricingPayload.message), "pricing route rejects negative model prices");
	const invalidClearResponse = {
		status: null,
		headers: null,
		body: "",
		writeHead(status, headers) { this.status = status; this.headers = headers; },
		end(body) { this.body = body ?? ""; }
	};
	await dataRoute.handler({ method: "POST", body: { action: "clear" }, headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } }, invalidClearResponse);
	const invalidClearPayload = JSON.parse(invalidClearResponse.body);
	assert(invalidClearResponse.status === 400 && invalidClearPayload.error === "invalid-payload", "data clear route rejects missing confirmation before touching storage");
	assert(listeners.has("agent/request"), "agent/request listener registered");
	assert(listeners.has("llm/stream"), "llm/stream listener registered");

	// Verify llm/stream handler passes the downstream stream through unchanged.
	// The listener must return an async iterable immediately so Cordis can pass
	// it through an llm/stream waterfall without awaiting a Promise first.
	const streamHandler = listeners.get("llm/stream");
	async function* downstream() {
		yield "chunk-1";
		yield "chunk-2";
	}
	const stream = streamHandler({}, () => downstream());
	assert(stream !== null && typeof stream[Symbol.asyncIterator] === "function", "llm/stream handler must immediately return an async iterable");
	async function* cordisConsumer() {
		yield* stream;
	}
	const chunks = [];
	for await (const chunk of cordisConsumer()) {
		chunks.push(chunk);
	}
	assert(chunks.length === 2 && chunks[0] === "chunk-1" && chunks[1] === "chunk-2", "llm/stream passes downstream chunks");

	// agent/request handler passes through the resolved request.
	const requestHandler = listeners.get("agent/request");
	const resolved = await requestHandler({}, async () => ({ provider: "deepseek-official", model: "deepseek-v4-flash" }));
	assert(resolved?.provider === "deepseek-official", "agent/request passes through next()");

	console.log("apply route registration & interceptor passthrough ok");
}

//#region advisory quota semantics (via a stub limitsService + apply)
{
	const registrations = [];
	const listeners = new Map();
	let pendingCheck = { exceeded: false, stopOnExceed: true, message: "" };
	let checkCalls = 0;
	const ctx = {
		logger: { warn: () => {} },
		get: () => void 0,
		effect: (fn) => { fn(); },
		on: (event, handler) => {
			listeners.set(event, handler);
			return () => listeners.delete(event);
		},
		webServer: { register: (route) => { registrations.push(route); } }
	};
	apply(ctx, {}, {
		disableBackgroundRefresh: true,
		balanceService: { refreshAll: async () => [], get: async () => ({}) },
		limitsService: {
			check: async () => {
				checkCalls += 1;
				if (pendingCheck instanceof Error) throw pendingCheck;
				return pendingCheck;
			}
		}
	});
	async function* downstream() {
		yield "chunk-1";
		yield "chunk-2";
	}
	const streamHandler = listeners.get("llm/stream");
	const requestHandler = listeners.get("agent/request");
	// Provider identity is unavailable in agent/request payloads and must be
	// enforced only once the final llm/stream route is known.
	pendingCheck = { status: "blocked", blocked: true, reason: "daily_cost", message: "今日消费已超限" };
	checkCalls = 0;
	const lateBoundRequest = await requestHandler({}, () => ({ provider: "deepseek-official", model: "deepseek-v4-flash" }));
	assert(lateBoundRequest?.provider === "deepseek-official", "agent/request must not enforce a quota before the resolved provider is available");
	assert(checkCalls === 0, "agent/request must not call quota checks without a resolved provider route");

	// Non-official providers are token-only for now: an official quota must
	// neither evaluate nor block their calls.
	checkCalls = 0;
	let externalPassed = false;
	for await (const chunk of streamHandler({ provider: "external-relay", model: "deepseek-v4-flash" }, () => downstream())) externalPassed ||= chunk === "chunk-1";
	assert(externalPassed, "non-official llm/stream must remain pass-through when the official quota is blocked");
	assert(checkCalls === 0, "non-official llm/stream must not evaluate DeepSeek quota or balance");

	// Historical stopOnExceed responses must not block calls anymore.
	pendingCheck = { exceeded: true, stopOnExceed: true, message: "今日消费已超限" };
	let passed = false;
	for await (const chunk of streamHandler({ provider: "deepseek-official", model: "deepseek-v4-flash" }, () => downstream())) passed ||= chunk === "chunk-1";
	assert(passed, "llm/stream must remain pass-through when historical stopOnExceed is true");
	const requestResult = await requestHandler({}, () => ({ ok: true }));
	assert(requestResult?.ok === true, "agent/request must remain pass-through when historical stopOnExceed is true");

	// Only the unified v2 blocked state may stop a call.
	pendingCheck = { status: "blocked", blocked: true, reason: "daily_cost", message: "今日消费已超限" };
	let streamBlocked = false;
	try {
		for await (const _ of streamHandler({ provider: "deepseek-official", model: "deepseek-v4-flash" }, () => downstream())) { /* no-op */ }
	} catch (error) {
		streamBlocked = error?.code === "USAGE_LIMIT_EXCEEDED";
	}
	assert(streamBlocked, "llm/stream blocks an explicit unified blocked state");
	const requestPassThrough = await requestHandler({}, () => ({ provider: "deepseek-official", model: "deepseek-v4-flash" }));
	assert(requestPassThrough?.provider === "deepseek-official", "agent/request leaves provider-specific blocking to llm/stream");

	// exceeded but stopOnExceed=false → passes through
	pendingCheck = { exceeded: true, stopOnExceed: false, message: "" };
	const passThrough = streamHandler({ provider: "deepseek-official", model: "deepseek-v4-flash" }, () => downstream());
	passed = false;
	for await (const _ of passThrough) { passed = true; break; }
	assert(passed, "llm/stream must pass through when stopOnExceed=false");

	// quota-check failure → fail-open (call allowed)
	pendingCheck = new Error("quota storage unavailable");
	let failOpenOk = false;
	try {
		const result = streamHandler({ provider: "deepseek-official", model: "deepseek-v4-flash" }, () => downstream());
		for await (const chunk of result) {
			failOpenOk = chunk === "chunk-1";
			break;
		}
	} catch {
		failOpenOk = false;
	}
	assert(failOpenOk, "llm/stream must fail open when the quota check itself errors");
	console.log("interceptor blocking semantics ok");
}

//#region balance service (stubbed upstream)
{
	const credentials = {
		resolve: async (ref) => {
			if (ref === "DEEPSEEK_API_KEY") return { value: "sk-test-123" };
			return { value: "" };
		}
	};
	const config = validateConfig({ keys: ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY_2"] });
	const calls = [];
	const service = createBalanceService({
		credentials,
		config,
		deps: {
			queryBalance: async (baseURL, apiKey, timeoutMs, fetchImpl) => {
				calls.push(apiKey);
				return { isAvailable: true, currency: "CNY", total: "36.44", granted: "10.00", toppedUp: "26.44" };
			}
		}
	});
	const first = await service.get("DEEPSEEK_API_KEY");
	assert(first.status === "ok", `status ${first.status}`);
	assert(first.balance.total === 36.44, `total ${first.balance.total}`);
	assert(first.balance.currency === "CNY", `currency ${first.balance.currency}`);
	assert(first.balance.granted === 10 && first.balance.toppedUp === 26.44, "breakdown");
	assert(calls.length === 1, `upstream calls ${calls.length}`);
	// Cached: second read must not re-query.
	await service.get("DEEPSEEK_API_KEY");
	assert(calls.length === 1, "cached read must not re-query upstream");
	// Force refresh re-queries.
	await service.get("DEEPSEEK_API_KEY", { force: true });
	assert(calls.length === 2, "force refresh re-queries");
	// Unconfigured key.
	const missing = await service.get("DEEPSEEK_API_KEY_2");
	assert(missing.status === "not-configured", `missing status ${missing.status}`);
	// Upstream error surfaces as a categorized status.
	const failing = createBalanceService({
		credentials: { resolve: async () => ({ value: "sk-x" }) },
		config: validateConfig({}),
		deps: { queryBalance: async () => { const error = new Error("401"); error.providerStatus = "unauthorized"; throw error; } }
	});
	const failed = await failing.get("DEEPSEEK_API_KEY");
	assert(failed.status === "unauthorized", `failed status ${failed.status}`);
	const malformed = createBalanceService({
		credentials: { resolve: async () => ({ value: "sk-x" }) },
		config: validateConfig({}),
		deps: { queryBalance: async () => ({ isAvailable: true, currency: "CNY", total: "not-a-number" }) }
	});
	const malformedAccount = await malformed.get("DEEPSEEK_API_KEY");
	assert(malformedAccount.status === "invalid-response" && malformedAccount.balance === void 0, "non-numeric balance total must not be cached as an ok account");
	console.log("balance service ok");
}

//#region balance force single-flight (concurrent force shares one upstream call)
{
	const credentials = { resolve: async () => ({ value: "sk-x" }) };
	const config = validateConfig({});
	let calls = 0;
	const service = createBalanceService({
		credentials,
		config,
		deps: {
			queryBalance: async () => {
				calls += 1;
				await new Promise((resolve) => setTimeout(resolve, 20));
				return { isAvailable: true, currency: "CNY", total: "1.00" };
			}
		}
	});
	const [a, b] = await Promise.all([
		service.get("DEEPSEEK_API_KEY", { force: true }),
		service.get("DEEPSEEK_API_KEY", { force: true })
	]);
	assert(calls === 1, `concurrent force calls must share one upstream request: ${calls}`);
	assert(a.status === "ok" && b.status === "ok" && a.balance.total === 1 && b.balance.total === 1, "both force callers receive the fetched account");
	console.log("balance force single-flight ok");
}

//#region balance.js transport errors classify as unavailable
{
	const { queryDeepSeekBalance } = await import("../lib/balance.js");
	let threw = null;
	try {
		await queryDeepSeekBalance("https://api.deepseek.com", "sk-x", 1000, async () => { throw new TypeError("fetch failed"); });
	} catch (error) {
		threw = error;
	}
	assert(threw !== null && threw.providerStatus === "unavailable", `transport errors must carry providerStatus=unavailable, got ${threw?.providerStatus ?? "no error"}`);
	let malformedPayloadError = null;
	try {
		await queryDeepSeekBalance("https://api.deepseek.com", "sk-x", 1000, async () => ({
			ok: true,
			json: async () => ({ is_available: true, balance_infos: [{ currency: "CNY", total_balance: "not-a-number" }] })
		}));
	} catch (error) {
		malformedPayloadError = error;
	}
	assert(malformedPayloadError?.providerStatus === "invalid-response", "balance parser rejects a non-numeric total amount");
	// Via createBalanceService the same failure must surface as unavailable,
	// never invalid-response (regression for the fetchBalance catch branch).
	const failingService = createBalanceService({
		credentials: { resolve: async () => ({ value: "sk-x" }) },
		config: validateConfig({}),
		deps: { queryBalance: queryDeepSeekBalance, fetch: async () => { throw new TypeError("fetch failed"); } }
	});
	const account = await failingService.get("DEEPSEEK_API_KEY");
	assert(account.status === "unavailable", `service classifies transport failure as unavailable, got ${account.status}`);
	console.log("balance transport error classification ok");
}

//#region configuredKeys (names only, never values)
{
	const credentials = {
		resolve: async (ref) => ref === "DEEPSEEK_API_KEY" ? { value: "sk-secret" } : { value: "" }
	};
	const config = validateConfig({ keys: ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY_2"] });
	const ctx = { get: () => credentials };
	const keys = await configuredKeys(ctx, config);
	assert(keys.length === 2, `keys ${keys.length}`);
	const serialized = JSON.stringify(keys);
	assert(!serialized.includes("sk-secret"), "keys endpoint must never leak values");
	assert(keys[0].configured === true && keys[1].configured === false, "configured flags");
	assert(keys[0].default === true, "default flag");
	console.log("configuredKeys ok");
}

//#region limits validation & quota evaluation
{
	const defRule = defaultLimitRule();
	assert(defRule.enabled === false && defRule.alertPercent === 80 && defRule.criticalPercent === 90 && defRule.stopOnExceed === false && defRule.minBalance === null, "defaultLimitRule defaults to daily alerts");

	const defLimits = defaultLimits();
	assert(defLimits.version === 2 && defLimits.global.enabled === false, "defaultLimits defaults to the current schema");

	const validRule = validateLimitRule({ enabled: true, dailyCostLimit: "15.5", minBalance: "2.0", alertPercent: "90", stopOnExceed: false });
	assert(validRule.enabled === true, "validRule enabled");
	assert(validRule.dailyCostLimit === 15.5, "validRule dailyCostLimit");
	assert(validRule.minBalance === null, "legacy minBalance is ignored");
	assert(validRule.alertPercent === 90, "validRule alertPercent");
	assert(validRule.stopOnExceed === false, "validRule stopOnExceed");

	const customLimits = validateLimits({
		global: { enabled: true, dailyCostLimit: 10, alertPercent: 80, stopOnExceed: true },
		keys: {
			"DEEPSEEK_KEY_VIP": { enabled: true, dailyCostLimit: 100, minBalance: 5, alertPercent: 80, stopOnExceed: true }
		}
	});
	assert(customLimits.global.dailyCostLimit === 10, "customLimits global limit");
	assert(customLimits.keys.DEEPSEEK_KEY_VIP.dailyCostLimit === 100, "customLimits VIP key limit");

	// evaluateKeyQuota: disabled
	const disabledEval = evaluateKeyQuota({ keyRef: "TEST", limits: defaultLimits(), todayCost: 50, balance: { total: 100 } });
	assert(disabledEval.status === "normal" && disabledEval.exceeded === false, "disabled rule eval normal");

	// evaluateKeyQuota: normal usage (todayCost 5, limit 10)
	const normalEval = evaluateKeyQuota({ keyRef: "TEST", limits: customLimits, todayCost: 5, balance: { total: 50 } });
	assert(normalEval.status === "normal" && normalEval.exceeded === false && normalEval.warning === false, "normal eval ok");

	// evaluateKeyQuota: warning threshold (todayCost 8.5, limit 10, alertPercent 80%)
	const warnEval = evaluateKeyQuota({ keyRef: "TEST", limits: customLimits, todayCost: 8.5, balance: { total: 50 } });
	assert(warnEval.status === "warning" && warnEval.warning === true && warnEval.exceeded === false, "warning eval ok");

	// evaluateKeyQuota: daily limit exceeded (todayCost 12, limit 10)
	const exceedEval = evaluateKeyQuota({ keyRef: "TEST", limits: customLimits, todayCost: 12, balance: { total: 50 } });
	assert(exceedEval.status === "exceeded" && exceedEval.exceeded === true && exceedEval.stopOnExceed === false, "daily exceed eval ok");

	// Configured alert fields expose independent tones for the balance and
	// today's spend indicators. No configured field must remain muted.
	const indicatorLimits = validateLimits({
		global: { enabled: true, dailyCostLimit: 100, lowBalanceWarning: 20, alertPercent: 23 }
	});
	const greenIndicators = evaluateKeyQuota({ keyRef: "TEST", limits: indicatorLimits, todayCost: 22, balance: { total: 21 } });
	assert(greenIndicators.spendStatus === "normal" && greenIndicators.balanceAlertStatus === "ok", "configured indicators green below their warning boundaries");
	const yellowIndicators = evaluateKeyQuota({ keyRef: "TEST", limits: indicatorLimits, todayCost: 23, balance: { total: 20 } });
	assert(yellowIndicators.spendStatus === "warning" && yellowIndicators.balanceAlertStatus === "warning", "configured indicators yellow at their warning boundaries");
	const redIndicators = evaluateKeyQuota({ keyRef: "TEST", limits: indicatorLimits, todayCost: 100, balance: { total: 0 } });
	assert(redIndicators.spendStatus === "exceeded" && redIndicators.balanceAlertStatus === "exceeded", "configured indicators red at zero balance or full spend");
	const lowBalanceOnly = evaluateKeyQuota({ keyRef: "TEST", limits: indicatorLimits, todayCost: 0, balance: { total: 5 } });
	assert(lowBalanceOnly.status === "warning" && lowBalanceOnly.reason === "low_balance" && lowBalanceOnly.spendStatus === "normal", "low-balance warning must not change the today-spend indicator");
	assert(disabledEval.spendStatus === "muted" && disabledEval.balanceAlertStatus === "muted", "unconfigured indicators stay hidden");

	// Legacy minBalance is ignored; the VIP daily limit remains the only rule.
	const vipMinBalEval = evaluateKeyQuota({ keyRef: "DEEPSEEK_KEY_VIP", limits: customLimits, todayCost: 10, balance: { total: 3.0 } });
	assert(vipMinBalEval.status === "normal" && vipMinBalEval.exceeded === false && vipMinBalEval.reason === null, "legacy min balance must not affect status");
	const staleBalanceEval = evaluateKeyQuota({ keyRef: "DEEPSEEK_KEY_VIP", limits: customLimits, todayCost: 0, balance: { total: 3.0 }, balanceStatus: "stale" });
	assert(staleBalanceEval.status === "normal" && staleBalanceEval.exceeded === false, "legacy stale balance must not trigger a minimum-balance stop");
	const unavailableBalanceEval = evaluateKeyQuota({ keyRef: "DEEPSEEK_KEY_VIP", limits: customLimits, todayCost: 0, balance: { total: 3.0 }, balanceStatus: "unavailable" });
	assert(unavailableBalanceEval.status === "normal" && unavailableBalanceEval.exceeded === false, "legacy unavailable balance must fail open");

	console.log("limits validation & quota evaluation ok");
}
//#region regression: key rule without numbers must not shadow the global rule
{
	const mixed = validateLimits({
		global: { enabled: true, dailyCostLimit: 1, minBalance: 60, alertPercent: 90, stopOnExceed: true },
		keys: { DEEPSEEK_API_KEY: { enabled: true, dailyCostLimit: null, minBalance: null, alertPercent: 80, stopOnExceed: true } }
	});
	const emptyShell = evaluateKeyQuota({ keyRef: "DEEPSEEK_API_KEY", limits: mixed, todayCost: 11.08, balance: { total: 60.91 } });
	assert(emptyShell.status === "exceeded" && emptyShell.exceeded === true && emptyShell.reason === "daily_cost", "empty-shell key rule must fall back to global: " + emptyShell.status);
	assert(emptyShell.dailyCostLimit === 1, "empty-shell key rule must inherit the global daily limit: " + emptyShell.dailyCostLimit);

	// A key rule WITH numbers overrides the global (strictly).
	const strictKey = validateLimits({
		global: { enabled: true, dailyCostLimit: 10, minBalance: 5, alertPercent: 80, stopOnExceed: true },
		keys: { DEEPSEEK_API_KEY: { enabled: true, dailyCostLimit: 3, minBalance: null, alertPercent: 80, stopOnExceed: true } }
	});
	const strictEval = evaluateKeyQuota({ keyRef: "DEEPSEEK_API_KEY", limits: strictKey, todayCost: 5, balance: { total: 100 } });
	assert(strictEval.status === "exceeded" && strictEval.dailyCostLimit === 3, "key rule with numbers wins: " + strictEval.status + "/" + strictEval.dailyCostLimit);
	assert(strictEval.minBalance === null, "legacy minBalance is not inherited: " + strictEval.minBalance);

	// No key rule at all → global rule applies.
	const globalOnly = validateLimits({
		global: { enabled: true, dailyCostLimit: 2, minBalance: null, alertPercent: 80, stopOnExceed: true },
		keys: {}
	});
	const globalEval = evaluateKeyQuota({ keyRef: "DEEPSEEK_API_KEY", limits: globalOnly, todayCost: 3, balance: null });
	assert(globalEval.status === "exceeded", "global-only rule applies: " + globalEval.status);

	// Global disabled + empty-shell key rule → not evaluated.
	const globalDisabled = validateLimits({
		global: { enabled: false, dailyCostLimit: 1, minBalance: 60, alertPercent: 90, stopOnExceed: true },
		keys: { DEEPSEEK_API_KEY: { enabled: true, dailyCostLimit: null, minBalance: null, alertPercent: 80, stopOnExceed: true } }
	});
	const disabledEval = evaluateKeyQuota({ keyRef: "DEEPSEEK_API_KEY", limits: globalDisabled, todayCost: 11, balance: { total: 5 } });
	assert(disabledEval.status === "normal" && disabledEval.exceeded === false, "global disabled keeps empty-shell keys normal: " + disabledEval.status);

	// resolveLimitRule returns the effective rule object.
	const resolved = resolveLimitRule(mixed, "DEEPSEEK_API_KEY");
	assert(resolved.dailyCostLimit === 1 && resolved.minBalance === null && resolved.stopOnExceed === false, "resolveLimitRule merge: " + JSON.stringify(resolved));
	console.log("regression: key rule fallback to global ok");
}

//#region v1 → v2 settings migration + unified status contract
{
	const migrated = validateLimits({
		version: 1,
		global: { enabled: true, dailyCostLimit: 10, minBalance: 5, alertPercent: 80, stopOnExceed: true },
		keys: {}
	});
	assert(migrated.version === 2, "legacy limits migrate to schema v2");
	assert(migrated.global.stopOnExceed === false && migrated.global.minBalance === null, "legacy hard-stop fields migrate fail-open");

	const current = validateLimits({
		version: 2,
		global: { enabled: true, dailyCostLimit: 10, minBalance: 5, alertPercent: 80, stopOnExceed: true },
		keys: {}
	});
	const blocked = evaluateKeyQuota({ keyRef: "DEEPSEEK_API_KEY", limits: current, todayCost: 12, balance: { total: 20 }, balanceStatus: "ok", balanceFetchedAt: 1000, now: 1000, balanceMaxAgeMs: 100 });
	assert(blocked.status === "blocked" && blocked.reason === "daily_cost" && blocked.scope?.id === "DEEPSEEK_API_KEY", "v2 explicit hard stop produces the unified blocked state");
	assert(blocked.currentValue === 12 && blocked.threshold === 10 && blocked.currency === "CNY", "unified status exposes explainable values");
	const criticalWarning = evaluateKeyQuota({ keyRef: "DEEPSEEK_API_KEY", limits: current, todayCost: 9, balance: { total: 20 }, balanceStatus: "ok", balanceFetchedAt: 1000, now: 1000, balanceMaxAgeMs: 100 });
	assert(criticalWarning.status === "exceeded" && criticalWarning.blocked === false, "critical warning below 100% must not block requests");

	const stale = evaluateKeyQuota({ keyRef: "DEEPSEEK_API_KEY", limits: current, todayCost: 0, balance: { total: 20 }, balanceStatus: "ok", balanceFetchedAt: 100, now: 1000, balanceMaxAgeMs: 100 });
	assert(stale.status === "stale" && stale.reason === "data_stale" && stale.sourceUpdatedAt === 100 && stale.exceeded === false, "stale balance is explicit and fail-open");
	const unavailable = evaluateKeyQuota({ keyRef: "DEEPSEEK_API_KEY", limits: current, todayCost: 0, balance: null, balanceStatus: "unavailable", now: 1000, balanceMaxAgeMs: 100 });
	assert(unavailable.status === "unavailable" && unavailable.reason === "query_failed" && unavailable.exceeded === false, "unavailable balance is explicit and fail-open");

	let rejectedUnknown = false;
	try {
		validateLimits({ version: 2, global: { enabled: true, dailyCostLimit: 1, surprise: true }, keys: {} });
	} catch (error) {
		rejectedUnknown = /unknown limit rule field/.test(String(error));
	}
	assert(rejectedUnknown, "v2 settings schema rejects unknown fields");
	console.log("limits schema migration + unified state ok");
}

//#region alert crossing, cooldown and recovery
{
	let now = 1000;
	const tracker = createAlertTracker({ now: () => now });
	const normal = { status: "normal", reason: null, scope: { type: "key", id: "K" }, threshold: 10, notificationCooldownMs: 100 };
	const warning = { ...normal, status: "warning", reason: "daily_cost" };
	const firstNormal = tracker.observe(normal);
	assert(firstNormal.shouldNotify === false, "initial normal state stays quiet");
	const firstWarning = tracker.observe(warning);
	assert(firstWarning.shouldNotify === true && firstWarning.type === "alert", "warning threshold crossing notifies once");
	now = 1050;
	assert(tracker.observe(warning).shouldNotify === false, "same warning is deduplicated before cooldown");
	now = 1100;
	assert(tracker.observe(warning).shouldNotify === true, "same warning may notify after cooldown");
	now = 1110;
	const recovery = tracker.observe(normal);
	assert(recovery.shouldNotify === true && recovery.type === "recovery", "return to normal emits one recovery");
	assert(tracker.observe(normal).shouldNotify === false, "stable normal state does not repeat recovery");
	console.log("alert crossing + cooldown + recovery ok");
}

//#region limitsService & model call interception
{
	let savedData = null;
	const dummyLimits = {
		version: 1,
		global: { enabled: true, dailyCostLimit: 5, minBalance: 1, alertPercent: 80, stopOnExceed: true },
		keys: {}
	};
	const service = createLimitsService({
		ctx: { logger: { warn: () => {} } },
		config: validateConfig({ keys: ["DEEPSEEK_API_KEY"] }),
		balanceService: {
			cached: () => ({ balance: { total: 20 } }),
			get: async () => ({ balance: { total: 20 } })
		},
		deps: {
			loadLimits: async () => dummyLimits,
			saveLimits: async (ctx, limits) => { savedData = limits; },
			collectUsage: async () => ({
				days: [{ date: "2026-08-18", cost: 10 }] // exceeded 5
			}),
			todayKey: () => "2026-08-18"
		}
	});

	const checkRes = await service.check({ provider: "deepseek-official", keyRef: "DEEPSEEK_API_KEY" });
	assert(checkRes.exceeded === true && checkRes.status === "exceeded", "service check exceeded");

	// Update limits to raise the daily limit and persist the balance alert.
	await service.updateLimits({
		global: { enabled: true, dailyCostLimit: 20, lowBalanceWarning: 12.5, minBalance: 1, alertPercent: 80, stopOnExceed: true }
	});
	assert(savedData !== null && savedData.global.dailyCostLimit === 20 && savedData.global.lowBalanceWarning === 12.5, "updateLimits saved daily and balance alerts");

	const checkAfterUpdate = await service.check({ provider: "deepseek-official", keyRef: "DEEPSEEK_API_KEY" });
	assert(checkAfterUpdate.exceeded === false && checkAfterUpdate.status === "normal", "service check normal after limit increase");

	console.log("limitsService & check ok");
}

//#region per-key cost attribution (keyProviders)
{
	// keyProviders validation
	const mapped = validateConfig({
		keys: ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY_2"],
		keyProviders: {
			"DEEPSEEK_API_KEY": ["deepseek-official", "vision-toolkit-deepseek-official"],
			"DEEPSEEK_API_KEY_2": ["relay-a"]
		}
	});
	assert(mapped.keyProviders["DEEPSEEK_API_KEY"].length === 2, "keyProviders mapping");
	let threw = null;
	try { validateConfig({ keyProviders: { "K": "not-an-array" } }); } catch (error) { threw = error; }
	assert(threw !== null, "keyProviders rejects non-array values");
	try { validateConfig({ keyProviders: { "": ["a"] } }); } catch (error) { threw = error; }
	assert(threw !== null, "keyProviders rejects empty key refs");

	// keyForProvider
	assert(keyForProvider("deepseek-official", mapped) === "DEEPSEEK_API_KEY", "provider→key A");
	assert(keyForProvider("relay-a", mapped) === "DEEPSEEK_API_KEY_2", "provider→key B");
	assert(keyForProvider("unmapped-provider", mapped) === null, "unmapped provider → null");

	// Only DeepSeek's official provider contributes to the DeepSeek balance and
	// quota amount. Other provider routes retain Token rows but are token-only.
	const usageDays = [
		{
			date: "2026-08-18",
			cost: 1,
			models: [
				{ model: "deepseek-official/deepseek-v4-flash", cost: 1 },
				{ model: "vision-toolkit-deepseek-official/deepseek-v4-flash", cost: 0.5 },
				{ model: "relay-a/deepseek-v4-flash", cost: 1.5 }
			]
		},
		{ date: "2026-08-17", cost: 9, models: [{ model: "deepseek-official/deepseek-v4-flash", cost: 9 }] }
	];
	const { perKey, mapped: isMapped } = todayCostPerKey(usageDays, "2026-08-18", mapped);
	assert(isMapped === true, "mapped flag");
	assert(perKey.get("DEEPSEEK_API_KEY") === 1, `key A today cost ${perKey.get("DEEPSEEK_API_KEY")}`);
	assert(!perKey.has("DEEPSEEK_API_KEY_2"), "token-only providers must not create a DeepSeek cost bucket");
	assert(todayCostFor("DEEPSEEK_API_KEY", perKey, 1, mapped) === 1, "todayCostFor key A");
	assert(todayCostFor("DEEPSEEK_API_KEY_2", perKey, 1, mapped) === 0, "todayCostFor token-only provider key");
	assert(todayCostFor("OTHER_KEY", perKey, 1, mapped) === 0, "unmapped key gets 0 when mapping configured");

	// Without mapping: every key sees the global today cost (per-key daily
	// limits still work on the shared total).
	const noMap = validateConfig({ keys: ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY_2"] });
	const { perKey: globalPerKey } = todayCostPerKey(usageDays, "2026-08-18", noMap);
	assert(globalPerKey.get("DEEPSEEK_API_KEY") === 1, "no-mapping: default key carries official cost only");
	assert(todayCostFor("DEEPSEEK_API_KEY_2", globalPerKey, 1, noMap) === 1, "no-mapping: other keys share official global cost");

	// Per-key quota evaluation uses the key's own cost.
	const service = createLimitsService({
		ctx: { logger: { warn: () => {} } },
		config: mapped,
		balanceService: { cached: () => ({ balance: { total: 100 } }), get: async () => ({ balance: { total: 100 } }) },
		deps: {
			loadLimits: async () => ({
				version: 1,
				global: { enabled: true, dailyCostLimit: 2, minBalance: null, alertPercent: 80, stopOnExceed: true },
				keys: {}
			}),
			saveLimits: async () => {},
			collectUsage: async () => ({ days: usageDays }),
			todayKey: () => "2026-08-18"
		}
	});
	// Key A spends the official ¥1; key B is associated only with a Token-only
	// provider, so its DeepSeek quota amount is ¥0.
	const statusA = await service.evaluateStatus("DEEPSEEK_API_KEY");
	const statusB = await service.evaluateStatus("DEEPSEEK_API_KEY_2");
	assert(statusA.status === "normal" && statusA.todayCost === 1, `key A status ${statusA.status} cost ${statusA.todayCost}`);
	assert(statusB.status === "normal" && statusB.todayCost === 0, `key B status ${statusB.status} cost ${statusB.todayCost}`);
	const tokenOnlyCheck = await service.check({ config: { provider: "relay-a" } });
	assert(tokenOnlyCheck.status === "not_applicable" && tokenOnlyCheck.blocked === false, "token-only providers bypass DeepSeek quota checks");
	console.log("per-key cost attribution ok");
}



//#region llm/stream ledger capture
{
	const registrations = [];
	const listeners = new Map();
	const captured = [];
	const ctx = {
		logger: { warn: () => {} },
		get: () => void 0,
		effect: (fn) => { fn(); },
		on: (event, handler) => {
			listeners.set(event, handler);
			return () => listeners.delete(event);
		},
		webServer: { register: () => {} }
	};
	apply(ctx, {}, {
		disableBackgroundRefresh: true,
		balanceService: { refreshAll: async () => [], get: async () => ({}) },
		limitsService: { check: async () => ({ exceeded: false, stopOnExceed: true, message: "" }) },
		recordLedger: async (entry) => { captured.push(entry); }
	});
	const streamHandler = listeners.get("llm/stream");
	async function* downstreamWithUsage() {
		yield { type: "text", text: "hello" };
		yield { type: "usage", usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30 } };
		yield { type: "finish", reason: { kind: "completed" } };
	}
	const stream = streamHandler({ provider: "deepseek-official", model: "deepseek-v4-flash" }, () => downstreamWithUsage());
	const chunks = [];
	for await (const chunk of stream) chunks.push(chunk);
	assert(chunks.length === 3, "downstream chunks must be preserved untouched: " + chunks.length);
	assert(captured.length === 1, "usage chunk must produce one ledger entry: " + captured.length);
	const entry = captured[0];
	assert(entry.provider === "deepseek-official" && entry.model === "deepseek-v4-flash", "ledger entry provider/model");
	assert(typeof entry.id === "string" && entry.id !== "", "ledger entry carries a stable call id");
	assert(Number.isFinite(entry.costCny) && typeof entry.pricingVersion === "string", "ledger entry freezes cost and pricing version");
	assert(Number.isFinite(entry.occurredAt) && entry.occurredAt > 0, "ledger entry carries a request start timestamp");
	assert(Number.isFinite(entry.completedAt) && entry.completedAt >= entry.occurredAt, "ledger entry carries the completion (attribution) timestamp");
	assert(entry.usage.inputTokens === 100 && entry.usage.outputTokens === 20 && entry.usage.cacheReadTokens === 30, "ledger entry carries the usage chunk");
	const sessionEventHandler = listeners.get("session/event");
	assert(typeof sessionEventHandler === "function", "session/event listener registered for finalized usage");
	await sessionEventHandler({ id: "s1" }, {
		time: Date.now(), type: "assistant/message", data: {
			turn: 1, step: 1,
			message: { source: { provider: "deepseek-official", model: "deepseek-v4-flash" } },
			usage: { inputTokens: 120, outputTokens: 25, cacheReadTokens: 40 }
		}
	});
	assert(captured.length === 2 && captured[1].usage.inputTokens === 120, "final assistant/message usage is captured");

	// 无 usage chunk 的流不写账本
	captured.length = 0;
	async function* noUsage() { yield { type: "text", text: "x" }; yield { type: "finish", reason: { kind: "completed" } }; }
	const s2 = streamHandler({ provider: "p", model: "m" }, () => noUsage());
	for await (const _ of s2) {}
	assert(captured.length === 0, "stream without usage chunk must not write the ledger");

	// 外观(facade) provider 不得写账本：它委托给上游 provider 发出真实 API
	// 请求（官方只计费一次）；两个都记会双倍计费（vision-toolkit 回归）。
	const facadeStream = streamHandler({ provider: "vision-toolkit-deepseek-official", model: "deepseek-v4-flash" }, () => downstreamWithUsage());
	for await (const _ of facadeStream) {}
	assert(captured.length === 0, "facade provider (vision-toolkit-*) must not write the ledger: " + captured.length);
	// 真实上游 provider 正常记录
	const realStream = streamHandler({ provider: "deepseek-official", model: "deepseek-v4-flash" }, () => downstreamWithUsage());
	for await (const _ of realStream) {}
	assert(captured.length === 1 && captured[0].provider === "deepseek-official", "upstream provider records the ledger");
	console.log("llm/stream ledger capture ok");
}

//#region ledger writes are durable before the next usage read
{
	const previousDshHome = process.env.DSH_HOME;
	const testHome = await mkdtemp(join(tmpdir(), "dsh-usage-ledger-"));
	process.env.DSH_HOME = testHome;
	try {
		const { recordLedgerEntry } = await import("../lib/index.js");
		await recordLedgerEntry({ logger: { warn: () => {} } }, {
			id: "durable-call",
			occurredAt: Date.now(),
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: { inputTokens: 1, outputTokens: 2 },
			costCny: 0.01,
			pricingVersion: "test-price"
		});
		const persisted = JSON.parse(await readFile(join(testHome, "storages", "usage-stats-cache.json"), "utf8"));
		assert(persisted.ledger?.[0]?.id === "durable-call", "ledger entry must be persisted immediately");
	} finally {
		if (previousDshHome === void 0) delete process.env.DSH_HOME;
		else process.env.DSH_HOME = previousDshHome;
		await rm(testHome, { recursive: true, force: true });
	}
	console.log("ledger immediate persistence ok");
}

//#region ledger compaction folds overflow into the legacy snapshot
{
	const previousDshHome = process.env.DSH_HOME;
	const testHome = await mkdtemp(join(tmpdir(), "dsh-usage-compact-"));
	process.env.DSH_HOME = testHome;
	try {
		const { recordLedgerEntry } = await import("../lib/index.js");
		const ctx = { logger: { warn: () => {} } };
		const entry = (id, atUtc, input, output) => ({
			id,
			occurredAt: atUtc,
			completedAt: atUtc,
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: { inputTokens: input, outputTokens: output }
		});
		// Test dates sit ~45 days in the past so they never collide with the
		// real "today" day of the durable-persistence test above (which runs in
		// the same process and shares the in-memory cache).
		const dayA = dayKey(Date.now() - 45 * 86400000);
		const dayB = dayKey(Date.now() - 44 * 86400000);
		const atBeijing = (dateKey, hour) => {
			const [y, m, d] = dateKey.split("-").map(Number);
			return Date.UTC(y, m - 1, d, hour - 8, 30, 0);
		};
		// 5 entries with maxLedgerEntries=3. c1 lands on Beijing dayA, c2..c5
		// on Beijing dayB — the oldest two (c1, c2) are folded into legacy.days
		// by their Beijing day (completedAt/occurredAt).
		await recordLedgerEntry(ctx, entry("c1", atBeijing(dayA, 17), 100, 10), { maxLedgerEntries: 3 });
		await recordLedgerEntry(ctx, entry("c2", atBeijing(dayB, 1), 200, 20), { maxLedgerEntries: 3 });
		await recordLedgerEntry(ctx, entry("c3", atBeijing(dayB, 2), 300, 30), { maxLedgerEntries: 3 });
		await recordLedgerEntry(ctx, entry("c4", atBeijing(dayB, 3), 400, 40), { maxLedgerEntries: 3 });
		await recordLedgerEntry(ctx, entry("c5", atBeijing(dayB, 4), 500, 50), { maxLedgerEntries: 3 });
		const persisted = JSON.parse(await readFile(join(testHome, "storages", "usage-stats-cache.json"), "utf8"));
		assert(persisted.ledger.length === 3, `ledger truncated to maxLedgerEntries: ${persisted.ledger.length}`);
		assert(persisted.ledger.map((e) => e.id).join(",") === "c3,c4,c5", `newest entries kept: ${persisted.ledger.map((e) => e.id)}`);
		assert(persisted.legacy?.days?.[dayA]?.totals?.inputTokens === 100, "folded c1 tokens appear in legacy.days (Beijing dayA)");
		assert(persisted.legacy?.days?.[dayB]?.totals?.inputTokens === 200, "folded c2 tokens appear in legacy.days (Beijing dayB)");
		assert(persisted.legacy?.days?.[dayA]?.totals?.outputTokens === 10 && persisted.legacy.days[dayB].totals.outputTokens === 20, "folded output tokens preserved");
		assert(Number.isFinite(persisted.legacy?.updatedAt) && persisted.legacy.updatedAt > 0, "legacy updatedAt stamped after compaction");
		assert(persisted.legacy?.foldedCount >= 2, `legacy foldedCount stamped: ${persisted.legacy?.foldedCount}`);
		assert(Number.isFinite(persisted.legacy?.foldedAt) && persisted.legacy.foldedAt > 0, "legacy foldedAt stamped after compaction");

		// 压缩后继续追加不误去重：被折叠进 legacy 的 id 可再次记录。
		await recordLedgerEntry(ctx, entry("c1", atBeijing(dayA, 18), 7, 0), { maxLedgerEntries: 3 });
		const afterReplay = JSON.parse(await readFile(join(testHome, "storages", "usage-stats-cache.json"), "utf8"));
		assert(afterReplay.ledger.some((e) => e.id === "c1"), "re-recorded folded id must not be dropped as a duplicate");
		// 当前保留窗口内的重复 id 仍去重。
		await recordLedgerEntry(ctx, entry("c4", atBeijing(dayB, 3), 999, 0), { maxLedgerEntries: 3 });
		const afterDup = JSON.parse(await readFile(join(testHome, "storages", "usage-stats-cache.json"), "utf8"));
		assert(afterDup.ledger.filter((e) => e.id === "c4").length === 1, "duplicate id inside the retained window is still deduplicated");
	} finally {
		if (previousDshHome === void 0) delete process.env.DSH_HOME;
		else process.env.DSH_HOME = previousDshHome;
		await rm(testHome, { recursive: true, force: true });
	}
	console.log("ledger compaction ok");
}

//#region collectUsage is read-only (the 60s usage poll never writes the cache)
{
	const previousDshHome = process.env.DSH_HOME;
	const testHome = await mkdtemp(join(tmpdir(), "dsh-usage-readonly-"));
	process.env.DSH_HOME = testHome;
	try {
		const { collectUsage } = await import("../lib/index.js");
		const result = await collectUsage({ logger: { warn: () => {} } });
		assert(result !== null && typeof result === "object" && Array.isArray(result.days), "collectUsage still returns the rendered usage shape");
		let written = true;
		try {
			await readFile(join(testHome, "storages", "usage-stats-cache.json"), "utf8");
		} catch {
			written = false;
		}
		assert(written === false, "collectUsage must not write the cache file");
	} finally {
		if (previousDshHome === void 0) delete process.env.DSH_HOME;
		else process.env.DSH_HOME = previousDshHome;
		await rm(testHome, { recursive: true, force: true });
	}
	console.log("collectUsage read-only ok");
}

//#region v1 → v2 migration + combined render
{
	const migrated = migrateCacheV1({
		sessions: {
			"session-1": {
				kind: "persisted",
				consumed: 2,
				days: {
					"2026-08-18": {
						totals: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
						models: { "deepseek-official/deepseek-v4-flash": { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 } },
						hours: { "10": { "deepseek-official/deepseek-v4-flash": { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 } } }
					}
				},
				lastSample: null,
				currentModel: null
			}
		}
	});
	assert(migrated.legacy !== null && migrated.legacy.days !== null && typeof migrated.legacy.days === "object", "migration must produce a legacy snapshot");
	assert(migrated.ledger !== null && migrated.ledger.length === 0, "migration must start with an empty ledger");
	assert(migrated.legacy.days["2026-08-18"].totals.inputTokens === 100, "legacy snapshot keeps v1 totals");
	assert(migrated.legacy.days["2026-08-18"].hours["10"]["deepseek-official/deepseek-v4-flash"].outputTokens === 20, "legacy snapshot keeps hourly buckets");

	const rendered = renderCombinedUsage(migrated, 0, defaultPricing());
	assert(rendered.days.length === 1 && rendered.days[0].tokens === 120, "legacy-only combined render: " + (rendered.days[0] && rendered.days[0].tokens));

	// 合并：legacy（10 点高峰 100 input）+ ledger（18 点空闲 50 input）→ 同日两小时分桶
	const beijing18 = Date.UTC(2026, 7, 18, 10, 1, 0); // 北京 18:01
	const merged = renderCombinedUsage({
		legacy: migrated.legacy,
		ledger: [
			{ occurredAt: beijing18, provider: "deepseek-official", model: "deepseek-v4-flash", usage: { inputTokens: 50, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } }
		]
	}, 0, defaultPricing());
	const day = merged.days[0];
	assert(day.inputTokens === 150, "combined day input: " + day.inputTokens);
	assert(day.hours[10].inputTokens === 100 && day.hours[18].inputTokens === 50, "legacy and ledger hours must be separate buckets");
	console.log("v1 → v2 migration + combined render ok");
}

//#region parseLedger preserves completedAt (ledger survives restarts)
{
	const { parseLedger } = await import("../lib/index.js");
	const parsed = parseLedger([{
		id: "restart-safe",
		occurredAt: 1000,
		completedAt: 2000,
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 1, outputTokens: 2 },
		costCny: 0.01,
		pricingVersion: "p"
	}]);
	assert(parsed[0]?.completedAt === 2000, `parseLedger must preserve completedAt across restarts, got ${parsed[0]?.completedAt}`);
	const fallback = parseLedger([{
		id: "legacy-fallback",
		occurredAt: 3000,
		provider: "deepseek-official",
		model: "deepseek-v4-flash",
		usage: { inputTokens: 1 }
	}]);
	assert(fallback[0]?.completedAt === 3000, "parseLedger falls back to occurredAt when completedAt is absent");
	console.log("ledger restart survival ok");
}

//#region concurrent ledger writes must both persist
{
	const previousDshHome = process.env.DSH_HOME;
	const testHome = await mkdtemp(join(tmpdir(), "dsh-usage-concurrent-"));
	process.env.DSH_HOME = testHome;
	try {
		const { recordLedgerEntry } = await import("../lib/index.js");
		const ctx = { logger: { warn: () => {} } };
		const mk = (id, at) => ({ id, occurredAt: at, completedAt: at, provider: "deepseek-official", model: "deepseek-v4-flash", usage: { inputTokens: 1, outputTokens: 1 } });
		await Promise.all([
			recordLedgerEntry(ctx, mk("race-a", Date.now() - 1000)),
			recordLedgerEntry(ctx, mk("race-b", Date.now()))
		]);
		const persisted = JSON.parse(await readFile(join(testHome, "storages", "usage-stats-cache.json"), "utf8"));
		const ids = (persisted.ledger ?? []).map((e) => e.id).sort();
		assert(ids.includes("race-a") && ids.includes("race-b"), `concurrent ledger writes must both persist, got ${ids.join(",")}`);
	} finally {
		if (previousDshHome === void 0) delete process.env.DSH_HOME;
		else process.env.DSH_HOME = previousDshHome;
		await rm(testHome, { recursive: true, force: true });
	}
	console.log("concurrent ledger writes ok");
}

//#region collectUsage stays a usage payload while a ledger write is in flight
{
	const previousDshHome = process.env.DSH_HOME;
	const testHome = await mkdtemp(join(tmpdir(), "dsh-usage-lock-"));
	process.env.DSH_HOME = testHome;
	try {
		const { recordLedgerEntry, collectUsage } = await import("../lib/index.js");
		const ctx = { logger: { warn: () => {} } };
		const writePromise = recordLedgerEntry(ctx, {
			id: "in-flight",
			occurredAt: Date.now(),
			completedAt: Date.now(),
			provider: "deepseek-official",
			model: "deepseek-v4-flash",
			usage: { inputTokens: 1 }
		});
		const usage = await collectUsage(ctx);
		const entry = await writePromise;
		assert(usage !== null && typeof usage === "object" && Array.isArray(usage.days), "collectUsage must return a usage payload while a ledger write is in flight");
		assert(entry?.id === "in-flight", "ledger write still completes");
	} finally {
		if (previousDshHome === void 0) delete process.env.DSH_HOME;
		else process.env.DSH_HOME = previousDshHome;
		await rm(testHome, { recursive: true, force: true });
	}
	console.log("usage/write lock separation ok");
}

//#region unpriced models make today's cost unreliable (never silently zero)
{
	const { createLimitsService, validateConfig } = await import("../lib/index.js");
	const ctx = { logger: { warn: () => {} } };
	const config = validateConfig({});
	const limits = { version: 2, global: { enabled: true, dailyCostLimit: 20, stopOnExceed: true, alertPercent: 80, criticalPercent: 90 }, keys: {} };
	const fakeBalance = {
		cached: () => ({ balance: { total: 100 }, status: "ok", fetchedAt: Date.now() }),
		get: async () => ({ balance: { total: 100 }, status: "ok", fetchedAt: Date.now() })
	};
	const mkService = (collectUsage) => createLimitsService({ ctx, config, balanceService: fakeBalance, deps: {
		loadLimits: async () => limits,
		collectUsage,
		todayKey: () => "2026-08-19"
	} });
	const unpriced = await mkService(async () => ({
		days: [{ date: "2026-08-19", cost: null, models: [{ model: "deepseek-official/deepseek-v4-flash", cost: null }] }],
		total: { cost: null }
	})).check({ provider: "deepseek-official" });
	assert(unpriced.status === "unpriced", `unpriced models must surface an unpriced state, got ${unpriced.status}`);
	assert(unpriced.blocked === false, "unpriced cost must never hard-block");
	const priced = await mkService(async () => ({
		days: [{ date: "2026-08-19", cost: 25, models: [{ model: "deepseek-official/deepseek-v4-flash", cost: 25 }] }],
		total: { cost: 25 }
	})).check({ provider: "deepseek-official" });
	assert(priced.status === "blocked" && priced.blocked === true, "priced over-limit day still hard-blocks");
	console.log("unpriced cost handling ok");
}

//#region updateLimits must reject empty payloads (no silent wipe)
{
	const { createLimitsService, defaultLimits, validateConfig } = await import("../lib/index.js");
	const ctx = { logger: { warn: () => {} } };
	const service = createLimitsService({ ctx, config: validateConfig({}), balanceService: { cached: () => null, get: async () => null }, deps: {
		loadLimits: async () => defaultLimits(),
		saveLimits: async () => {}
	} });
	for (const bad of [null, {}, { version: 2 }]) {
		let threw = false;
		try { await service.updateLimits(bad); } catch { threw = true; }
		assert(threw, `updateLimits must reject empty payload ${JSON.stringify(bad)}`);
	}
	const saved = await service.updateLimits({ version: 2, global: { enabled: true, dailyCostLimit: 20 }, keys: {} });
	assert(saved.global?.dailyCostLimit === 20, "legitimate limits document still saves");
	console.log("limits empty-payload rejection ok");
}

//#region per-key enabled:false must not disable an enabled global rule
{
	const { resolveLimitRule } = await import("../lib/index.js");
	const merged = resolveLimitRule({
		version: 2,
		global: { enabled: true, dailyCostLimit: 20, alertPercent: 80, criticalPercent: 90 },
		keys: { DEEPSEEK_API_KEY: { enabled: false, dailyCostLimit: 10 } }
	}, "DEEPSEEK_API_KEY");
	assert(merged.enabled === true, "per-key enabled:false must not disable the global rule");
	assert(merged.dailyCostLimit === 10, "per-key daily limit still overrides");
	console.log("per-key enabled global floor ok");
}


//#region hard stop triggers only at 100% (or balance floor) and messages name the real cause
{
	const { evaluateKeyQuota } = await import("../lib/index.js");
	const limits = {
		version: 2,
		global: { enabled: true, dailyCostLimit: 20, stopOnExceed: true, alertPercent: 80, criticalPercent: 90, minBalance: 10 },
		keys: {}
	};
	const base = { keyRef: "DEEPSEEK_API_KEY", limits, balance: { total: 100 }, balanceStatus: "ok", balanceFetchedAt: 1000, now: 1000, balanceMaxAgeMs: 300000 };
	// 90% (18/20)：仅红色预警，绝不拦截。
	const at90 = evaluateKeyQuota({ ...base, todayCost: 18 });
	assert(at90.status === "exceeded" && at90.blocked === false, `90% spend with stopOnExceed must not block, got ${at90.status}`);
	assert(at90.message.includes("严重预警线"), "90% message names the critical warning line");
	// 100%+ (20.5/20)：硬停止，且消息必须点名"达到每日限额"，不能是 90% 预警文案。
	const at100 = evaluateKeyQuota({ ...base, todayCost: 20.5 });
	assert(at100.status === "blocked" && at100.blocked === true, `100%+ spend with stopOnExceed must hard-block, got ${at100.status}`);
	assert(at100.message.includes("已达到每日限额") && !at100.message.includes("严重预警线"), `100% block message must name the daily limit: ${at100.message}`);
	// 余额跌破保障线（余额 5 < minBalance 10）：即使消费只有 90%，也因余额硬停止，消息点名余额。
	const balanceBlocked = evaluateKeyQuota({ ...base, todayCost: 18, balance: { total: 5 } });
	assert(balanceBlocked.status === "blocked" && balanceBlocked.blocked === true, "balance below floor must hard-block");
	assert(balanceBlocked.message.includes("最低余额保障线") && !balanceBlocked.message.includes("严重预警线"), `balance block message must name the balance floor: ${balanceBlocked.message}`);
	console.log("hard-stop trigger + message accuracy ok");
}

//#region runtime settings store: validate, merge, persist
{
	const saved = [];
	const service = createSettingsService({
		ctx: { logger: { warn: () => {} } },
		config: validateConfig({}),
		deps: {
			loadSettings: async () => ({ version: 1, refreshMs: 60000, notifications: { channels: { toast: true } } }),
			saveSettings: async (next) => { saved.push(next); }
		}
	});
	const loaded = await service.load();
	assert(loaded.refreshMs === 60000, "settings refreshMs loaded");
	assert(loaded.display.balance === true && loaded.display.statusDot === true, "display defaults kept");
	assert(loaded.notifications.channels.toast === true && loaded.notifications.channels.sidebar === true, "notification channels merged");
	assert(loaded.notifications.planQuota.warningRemainingPercent === 30 && loaded.notifications.planQuota.criticalRemainingPercent === 10, "plan quota warning thresholds default when absent");
	assert(loaded.notifications.planQuota.windows.five_hour.warningRemainingPercent === 30 && loaded.notifications.planQuota.windows.weekly.criticalRemainingPercent === 10, "plan quota window thresholds default when absent");
	const quotaThresholds = validateSettings({ notifications: { planQuota: { warningRemainingPercent: 25, criticalRemainingPercent: 8, windows: { five_hour: { warningRemainingPercent: 40, criticalRemainingPercent: 15 }, weekly: { warningRemainingPercent: 60, criticalRemainingPercent: 20 } } } } });
	assert(quotaThresholds.notifications.planQuota.warningRemainingPercent === 25 && quotaThresholds.notifications.planQuota.criticalRemainingPercent === 8, "plan quota warning thresholds persist");
	assert(quotaThresholds.notifications.planQuota.windows.five_hour.warningRemainingPercent === 40 && quotaThresholds.notifications.planQuota.windows.weekly.criticalRemainingPercent === 20, "plan quota window thresholds persist");
	const invalidQuotaThresholds = validateSettings({ notifications: { planQuota: { warningRemainingPercent: 5, criticalRemainingPercent: 20, windows: { five_hour: { warningRemainingPercent: 5, criticalRemainingPercent: 20 } } } } });
	assert(invalidQuotaThresholds.notifications.planQuota.warningRemainingPercent === 30 && invalidQuotaThresholds.notifications.planQuota.criticalRemainingPercent === 10, "invalid plan quota threshold order falls back safely");
	assert(invalidQuotaThresholds.notifications.planQuota.windows.five_hour.warningRemainingPercent === 30 && invalidQuotaThresholds.notifications.planQuota.windows.five_hour.criticalRemainingPercent === 10, "invalid plan quota window order falls back safely");
	assert(loaded.conversation.enabled === true && loaded.conversation.showTokenUsage === true, "conversation defaults enabled");
	const explicitConversation = validateSettings({ conversation: { enabled: false, showTokenUsage: false } });
	assert(explicitConversation.conversation.enabled === false && explicitConversation.conversation.showTokenUsage === false, "conversation accepts explicit boolean values");
	const partialConversation = validateSettings({ conversation: { enabled: false } });
	assert(partialConversation.conversation.enabled === false && partialConversation.conversation.showTokenUsage === true, "conversation partial validation restores the omitted default");
	const invalidConversation = validateSettings({ conversation: { enabled: "false", showTokenUsage: 0 } });
	assert(invalidConversation.conversation.enabled === true && invalidConversation.conversation.showTokenUsage === true, "conversation rejects non-boolean values");
	const updated = await service.update({ refreshMs: null, display: { balance: false } });
	assert(updated.refreshMs === null, "refreshMs can be disabled via null");
	assert(updated.display.balance === false && updated.display.todayCost === true, "display patch merged, unset fields default");
	assert(saved.length === 1 && saved[0].refreshMs === null, "update persists via saveSettings");
	const conversationUpdated = await service.update({ conversation: { enabled: false, showTokenUsage: false } });
	assert(conversationUpdated.conversation.enabled === false && conversationUpdated.conversation.showTokenUsage === false, "conversation update persists both switches");
	const conversationPatched = await service.update({ conversation: { enabled: true } });
	assert(conversationPatched.conversation.enabled === true && conversationPatched.conversation.showTokenUsage === false, "conversation partial update preserves the other switch");
	assert(saved.length === 3 && saved[2].conversation.showTokenUsage === false, "conversation updates persist through saveSettings");
	assert(service.snapshot() === conversationPatched, "snapshot reflects latest settings");
	console.log("runtime settings store ok");
}

//#region accounts settings API: conversation response, partial update and payload validation
{
	const registrations = [];
	const ctx = {
		logger: { warn: () => {} },
		get: () => void 0,
		effect: (fn) => { fn(); },
		webServer: { register: (route) => { registrations.push(route); } }
	};
	let saved = null;
	const settingsService = createSettingsService({
		ctx,
		config: validateConfig({}),
		deps: {
			loadSettings: async () => ({ conversation: { enabled: true, showTokenUsage: false } }),
			saveSettings: async (next) => { saved = next; }
		}
	});
	apply(ctx, {}, {
		disableBackgroundRefresh: true,
		balanceService: { refreshAll: async () => [], get: async () => ({}), cached: (ref) => ({ id: ref, status: "ok", fetchedAt: 123, balance: { total: 8 } }) },
		limitsService: { check: async () => ({ exceeded: false, stopOnExceed: true, message: "" }) },
		settingsService
	});
	const accountsRoute = registrations.find((route) => route?.path === ACCOUNTS_PATH);
	assert(accountsRoute?.kind === "exact", "accounts settings route is registered");
	function request(method, body) {
		return { method, body, headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" } };
	}
	function response() {
		return {
			status: null,
			headers: null,
			body: "",
			writeHead(status, headers) { this.status = status; this.headers = headers; },
			end(body) { this.body = body ?? ""; }
		};
	}
	const getResponse = response();
	await accountsRoute.handler(request("GET"), getResponse);
	const getPayload = JSON.parse(getResponse.body);
	assert(getResponse.status === 200 && getPayload.settings?.conversation?.enabled === true && getPayload.settings?.conversation?.showTokenUsage === false, "accounts GET returns conversation settings");
	assert(getPayload.accounts?.["deepseek-official"]?.status === "ok" && getPayload.accounts?.["deepseek-official"]?.id === "DEEPSEEK_API_KEY", "accounts are keyed by provider id while DeepSeek reads the key-ref cache");
	assert(!Object.hasOwn(getPayload.accounts ?? {}, "DEEPSEEK_API_KEY"), "accounts do not expose credential refs as parallel provider rows");

	const postResponse = response();
	await accountsRoute.handler(request("POST", { conversation: { enabled: false, showTokenUsage: true } }), postResponse);
	const postPayload = JSON.parse(postResponse.body);
	assert(postResponse.status === 200 && postPayload.ok === true, "accounts POST accepts conversation settings");
	assert(postPayload.settings?.conversation?.enabled === false && postPayload.settings?.conversation?.showTokenUsage === true, "accounts POST returns updated conversation settings");
	assert(saved?.conversation?.enabled === false && saved?.conversation?.showTokenUsage === true, "accounts POST persists conversation settings");

	const invalidResponse = response();
	await accountsRoute.handler(request("POST", { conversation: { enabled: "false" } }), invalidResponse);
	const invalidPayload = JSON.parse(invalidResponse.body);
	assert(invalidResponse.status === 400 && invalidPayload.error === "invalid-payload", "accounts POST rejects non-boolean conversation values");
	console.log("accounts conversation settings API ok");
}

//#region runtimePricingOf / maxLedgerEntriesOf resolution order
{
	const config = validateConfig({});
	const customPricing = { currency: "CNY", pricing: { "deepseek-v4-flash": { inputMiss: 9, inputHit: 1, output: 27 } } };
	const effective = runtimePricingOf(validateSettings({ pricing: customPricing }), config);
	assert(effective.models?.["deepseek-v4-flash"]?.offPeak?.inputMiss === 9, "custom pricing wins over startup config");
	assert(runtimePricingOf(validateSettings({}), config) === config.pricing, "no custom pricing falls back to startup config");
	assert(maxLedgerEntriesOf(validateSettings({ maxLedgerEntries: 800 }), config) === 800, "settings capacity wins");
	assert(maxLedgerEntriesOf(validateSettings({}), validateConfig({ maxLedgerEntries: 3000 })) === 3000, "config capacity used when settings unset");
	assert(maxLedgerEntriesOf(validateSettings({}), config) === 5000, "default capacity 5000");
	assert(refreshCadenceOf({ refreshMs: null }, config) === 0, "null refresh cadence disables background timer");
	assert(refreshCadenceOf({}, config) === config.refreshMs, "missing refresh cadence falls back to startup config");
	console.log("runtime pricing + ledger capacity resolution ok");
}

//#region data management helpers: info + trim
{
	const cache = {
		legacy: {
			updatedAt: 1000, foldedAt: 900, foldedCount: 7,
			days: { "2026-08-01": { totals: { inputTokens: 1 } }, "2026-08-19": { totals: { inputTokens: 2 } } }
		},
		ledger: [
			{ completedAt: Date.UTC(2026, 7, 19, 2, 0, 0), provider: "deepseek-official", model: "deepseek-v4-flash", usage: { inputTokens: 5 } },
			{ completedAt: Date.UTC(2026, 7, 1, 2, 0, 0), provider: "deepseek-official", model: "deepseek-v4-flash", usage: { inputTokens: 5 } }
		]
	};
	const config = validateConfig({ maxLedgerEntries: 3000 });
	const info = dataInfoOf(cache, config, validateSettings({}));
	assert(info.ledgerEntries === 2, "ledger entry count");
	assert(info.ledgerCapacity === 3000, "capacity from config");
	assert(info.foldedCount === 7, "folded count surfaced");
	assert(info.legacyIsEstimated === true, "legacy marked estimated");
	assert(info.dateRange?.earliest === "2026-08-01" && info.dateRange?.latest === "2026-08-19", "date range computed");

	const now = Date.now();
	const fresh = { completedAt: now, provider: "p", model: "m", usage: {} };
	const old = { completedAt: now - 90 * 86400000, provider: "p", model: "m", usage: {} };
	const trimTarget = {
		legacy: { updatedAt: 1, days: { [dayKey(now)]: { totals: {} }, [dayKey(now - 40 * 86400000)]: { totals: {} } } },
		ledger: [fresh, old]
	};
	trimCache(trimTarget, 30);
	assert(trimTarget.ledger.length === 1 && trimTarget.ledger[0] === fresh, "trim drops ledger older than retention");
	assert(Object.keys(trimTarget.legacy.days).length === 1, "trim drops legacy days older than retention");
	console.log("data management helpers ok");
}

//#region trim retention counts whole Beijing days (N=1 keeps only today)
{
	// 以北京时间今天 00:00 为基准；昨天 23:59 的请求若用「滚动 24 小时窗口」
	// 会被误保留，按自然日口径应当删除。
	const todayStart = Date.parse(`${dayKey(Date.now())}T00:00:00+08:00`);
	const lateYesterday = todayStart - 60000;
	const mkTarget = () => ({
		legacy: { updatedAt: 1, days: { [dayKey(todayStart)]: { totals: {} }, [dayKey(lateYesterday)]: { totals: {} } } },
		ledger: [
			{ completedAt: todayStart, provider: "p", model: "m", usage: {} },
			{ completedAt: lateYesterday, provider: "p", model: "m", usage: {} }
		]
	});
	const one = mkTarget();
	trimCache(one, 1);
	assert(one.ledger.length === 1 && one.ledger[0].completedAt === todayStart, `retention=1 keeps only today (got ${one.ledger.length})`);
	assert(Object.keys(one.legacy.days).length === 1 && Object.keys(one.legacy.days)[0] === dayKey(todayStart), "retention=1 keeps only today's legacy day");
	const two = mkTarget();
	trimCache(two, 2);
	assert(two.ledger.length === 2, `retention=2 keeps today + yesterday (got ${two.ledger.length})`);
	console.log("trim retention calendar-day semantics ok");
}

//#region data clear confirmation contract
{
	assert(isDataClearConfirmation("清除"), "data clear accepts the Chinese UI confirmation word");
	assert(isDataClearConfirmation(" DELETE "), "data clear trims and accepts the English UI confirmation word");
	assert(!isDataClearConfirmation(undefined), "data clear rejects a missing confirmation");
	assert(!isDataClearConfirmation("clear"), "data clear rejects an unrecognized confirmation");
	console.log("data clear confirmation contract ok");
}

//#region alerts history captured by evaluateAll (dedup + fields)
{
	const ctx = { logger: { warn: () => {} } };
	const config = validateConfig({});
	const limits = { version: 2, global: { enabled: true, dailyCostLimit: 10, alertPercent: 80, stopOnExceed: false }, keys: {} };
	const fakeBalance = { cached: () => ({ balance: { total: 100 }, status: "ok", fetchedAt: Date.now() }), get: async () => ({ balance: { total: 100 }, status: "ok", fetchedAt: Date.now() }) };
	let now = 1000;
	const service = createLimitsService({ ctx, config, balanceService: fakeBalance, deps: {
		loadLimits: async () => limits,
		collectUsage: async () => ({ days: [{ date: "2026-08-19", cost: 9, models: [] }], total: { cost: 9 } }),
		todayKey: () => "2026-08-19",
		now: () => now,
		settings: { load: async () => validateSettings({}) }
	} });
	now = 1000;
	let evaluated = await service.evaluateAll();
	assert(evaluated.alerts.length === 1 && evaluated.alerts[0].type === "alert" && evaluated.alerts[0].status === "exceeded", `alert history captures crossing: ${JSON.stringify(evaluated.alerts)}`);
	assert(evaluated.alerts[0].keyRef !== null && evaluated.alerts[0].message !== "", "alert carries keyRef + message");
	evaluated = await service.evaluateAll();
	assert(evaluated.alerts.length === 1, "cooldown dedups repeated evaluations from history");
	console.log("alerts history ok");
}

//#region notification policy wiring (settings cooldown + events filter)
{
	const ctx = { logger: { warn: () => {} } };
	const config = validateConfig({});
	// dailyCostLimit 10, alertPercent 80: cost 8.5 落在 [8, 9) → warning。
	const limits = { version: 2, global: { enabled: true, dailyCostLimit: 10, alertPercent: 80, criticalPercent: 90, stopOnExceed: false }, keys: {} };
	const fakeBalance = { cached: () => ({ balance: { total: 100 }, status: "ok", fetchedAt: Date.now() }), get: async () => ({ balance: { total: 100 }, status: "ok", fetchedAt: Date.now() }) };
	let now = 1000;
	const mkService = (settings) => createLimitsService({ ctx, config, balanceService: fakeBalance, deps: {
		loadLimits: async () => limits,
		collectUsage: async () => ({ days: [{ date: "2026-08-19", cost: 8.5, models: [] }], total: { cost: 8.5 } }),
		todayKey: () => "2026-08-19",
		now: () => now,
		settings: { load: async () => settings }
	} });

	// 冷却时间来自 settings.notifications.cooldownMs（而非限额规则默认 30min）。
	const shortCooldown = validateSettings({ notifications: { channels: { toast: true }, events: { warning: true, exceeded: true, lowBalance: true, recovery: true }, cooldownMs: 50 } });
	const svcShort = mkService(shortCooldown);
	let evaluated = await svcShort.evaluateAll();
	assert(evaluated.alerts.length === 1 && evaluated.alerts[0].event === "warning", `warning crossing carries event category: ${JSON.stringify(evaluated.alerts)}`);
	now = 1060;
	evaluated = await svcShort.evaluateAll();
	assert(evaluated.alerts.length === 2, `settings cooldown re-emits after window (got ${evaluated.alerts.length})`);

	// events.warning=false 时，warning 跨越不进入告警历史。
	const noWarning = validateSettings({ notifications: { events: { warning: false, exceeded: true, lowBalance: true, recovery: true } } });
	const svcNoWarn = mkService(noWarning);
	evaluated = await svcNoWarn.evaluateAll();
	assert(evaluated.alerts.length === 0, `events.warning=false suppresses warning alerts: ${JSON.stringify(evaluated.alerts)}`);
	console.log("notification policy wiring (cooldown + events) ok");
}


if (failures > 0) {
	console.error(`\n${failures} test(s) failed`);
	process.exit(1);
}
console.log("\nserver tests: all passed");
