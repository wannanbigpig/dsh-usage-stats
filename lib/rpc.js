/** Official DeepSeek Harness Connection RPC adapter for usage-stats. */

export const USAGE_RPC_CHANNEL = "/usage-stats";

export const USAGE_RPC_ENDPOINTS = Object.freeze([
	"usage/get",
	"keys/list",
	"providers/list",
	"balance/get",
	"limits/get",
	"limits/update",
	"accounts/get",
	"accounts/update",
	"pricing/get",
	"pricing/update",
	"alerts/get",
	"alerts/update",
	"data/get",
	"data/trim",
	"data/clear",
	"data/rebuild-estimated"
]);

/** Explicit marker for request-shape/value failures at the RPC boundary. */
export class UsageRpcBadRequestError extends Error {
	constructor(message, issues = [{ path: [], message }]) {
		super(message);
		this.name = "UsageRpcBadRequestError";
		this.issues = issues;
	}
}

function badRequest(message, issues = [{ path: [], message }]) {
	return {
		ok: false,
		error: {
			code: "bad-request",
			message,
			details: { issues }
		}
	};
}

function cancelled(message = "request cancelled") {
	return { ok: false, error: { code: "cancelled", message, details: {} } };
}

function internal(error) {
	return {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error),
			details: {}
		}
	};
}

/** Build one total RPC dispatcher whose handlers return the current UI payloads. */
export function createUsageRpcDispatcher(operations, logger = console) {
	const table = operations !== null && typeof operations === "object" ? operations : {};
	return async function dispatch(endpoint, payload, signal) {
		const operation = table[endpoint];
		if (typeof operation !== "function") return badRequest(`unknown usage-stats endpoint: ${String(endpoint)}`);
		try {
			signal?.throwIfAborted?.();
			return { ok: true, value: await operation(payload ?? {}, signal) };
		} catch (error) {
			if (signal?.aborted === true || error?.name === "AbortError") {
				return cancelled(error instanceof Error ? error.message : void 0);
			}
			if (error instanceof UsageRpcBadRequestError) return badRequest(error.message, error.issues);
			logger?.warn?.(`usage-stats: RPC ${String(endpoint)} failed: ${String(error)}`);
			return internal(error);
		}
	};
}

/** Register on the official independent Connection channel. */
export function registerUsageRpc(ctx, dispatcher) {
	return ctx.connection.rpc.handle(USAGE_RPC_CHANNEL, dispatcher, { authority: "loopback" });
}
