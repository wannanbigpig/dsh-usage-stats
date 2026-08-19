import assert from "node:assert/strict";
import { createUsageRpcDispatcher, registerUsageRpc, UsageRpcBadRequestError, USAGE_RPC_CHANNEL } from "../lib/rpc.js";

const calls = [];
const operations = {
	"usage/get": async (payload, signal) => {
		calls.push({ payload, signal });
		return { ok: true, days: [], providerId: payload.providerId ?? null };
	},
	"limits/update": async () => { throw new UsageRpcBadRequestError("limits payload is invalid"); },
	"data/clear": async () => { throw new Error("disk unavailable"); },
	"data/trim": async () => { throw new TypeError("official storage programmer error"); },
	"data/rebuild-estimated": async (_payload, signal) => {
		const error = new Error("aborted");
		error.name = signal.aborted ? "AbortError" : "Error";
		throw error;
	}
};

const dispatcher = createUsageRpcDispatcher(operations, { warn: () => {} });
const signal = new AbortController().signal;
const usage = await dispatcher("usage/get", { providerId: "deepseek-official" }, signal);
assert.deepEqual(usage, { ok: true, value: { ok: true, days: [], providerId: "deepseek-official" } });
assert.equal(calls[0].signal, signal, "dispatcher forwards the official AbortSignal");

const unknown = await dispatcher("unknown/read", {}, signal);
assert.equal(unknown.ok, false);
assert.equal(unknown.error.code, "bad-request");
assert.ok(Array.isArray(unknown.error.details.issues) && unknown.error.details.issues.length === 1);

const invalid = await dispatcher("limits/update", {}, signal);
assert.equal(invalid.ok, false);
assert.equal(invalid.error.code, "bad-request");
assert.match(invalid.error.message, /invalid/);

const internal = await dispatcher("data/clear", {}, signal);
assert.equal(internal.ok, false);
assert.equal(internal.error.code, "internal");
assert.deepEqual(internal.error.details, {});

const internalTypeError = await dispatcher("data/trim", {}, signal);
assert.equal(internalTypeError.ok, false);
assert.equal(internalTypeError.error.code, "internal", "unmarked TypeError must not be misreported as a client error");

const aborted = new AbortController();
aborted.abort();
const cancelled = await dispatcher("data/rebuild-estimated", {}, aborted.signal);
assert.equal(cancelled.ok, false);
assert.equal(cancelled.error.code, "cancelled");

const registrations = [];
const disposer = async () => {};
const ctx = {
	connection: {
		rpc: {
			handle(channel, handler, options) {
				registrations.push({ channel, handler, options });
				return disposer;
			}
		}
	}
};
assert.equal(registerUsageRpc(ctx, dispatcher), disposer);
assert.equal(registrations.length, 1);
assert.equal(registrations[0].channel, USAGE_RPC_CHANNEL);
assert.deepEqual(registrations[0].options, { authority: "loopback" });

console.log("official connection rpc contract ok");
