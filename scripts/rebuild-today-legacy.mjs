/**
 * Thin CLI for the host-owned estimated-history rebuild.
 *
 * Business logic runs inside the plugin through ctx.sessionPersistence and
 * ctx.storageDomain. This process only speaks the official Connection RPC
 * envelope because Harness exposes no public standalone Node RPC client.
 *
 * Usage:
 *   node scripts/rebuild-today-legacy.mjs --base-url http://127.0.0.1:2026
 *   node scripts/rebuild-today-legacy.mjs --base-url http://127.0.0.1:2026 --apply
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function parseArguments(argv = []) {
	let baseUrl = null;
	let apply = false;
	let timeoutMs = 15000;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--apply") { apply = true; continue; }
		if (arg === "--base-url" || arg === "--timeout-ms") {
			const value = argv[++index];
			if (typeof value !== "string" || value === "" || value.startsWith("--")) throw new TypeError(`${arg} requires a value`);
			if (arg === "--base-url") baseUrl = value;
			else {
				timeoutMs = Number(value);
				if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("--timeout-ms must be a positive integer");
			}
			continue;
		}
		throw new TypeError(`unknown argument: ${arg}`);
	}
	if (baseUrl === null) throw new TypeError("--base-url is required");
	try { const parsed = new URL(baseUrl); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(); } catch { throw new TypeError("--base-url must be an HTTP(S) URL"); }
	return { baseUrl, apply, timeoutMs };
}

export async function callRebuildRpc({ baseUrl, apply = false, timeoutMs = 15000, fetchImpl = fetch }) {
	if (typeof baseUrl !== "string" || baseUrl.trim() === "") throw new TypeError("--base-url is required");
	if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("timeoutMs must be a positive integer");
	const controller = new AbortController();
	let timer;
	const timeout = new Promise((_, reject) => {
		timer = setTimeout(() => { controller.abort(); const error = new Error("rebuild RPC timed out"); error.name = "TimeoutError"; reject(error); }, timeoutMs);
	});
	const rpcId = randomUUID();
	const endpoint = "data/rebuild-estimated";
	try {
		const response = await Promise.race([fetchImpl(new URL(`/usage-stats/${endpoint}`, baseUrl), {
		method: "POST",
		headers: { accept: "application/json", "content-type": "application/json" },
		body: JSON.stringify({
			type: "client-request",
			rpcId,
			method: endpoint,
			payload: { query: {}, body: { dryRun: !apply } }
		}),
		signal: controller.signal
		}), timeout]);
		if (!response.ok) {
			// Keep the response body: Connection RPC errors carry the actionable
			// message (bad-request issues, channel denied, ...) a bare status hides.
			const detail = await Promise.race([response.text().catch(() => ""), timeout]);
			const trimmed = detail.trim().slice(0, 400);
			throw new Error(`HTTP ${response.status}${trimmed === "" ? "" : `: ${trimmed}`}`);
		}
		const envelope = await Promise.race([response.json(), timeout]);
		if (envelope?.rpcId !== rpcId || envelope?.type !== "server-response") throw new Error("invalid Connection RPC response");
		if (envelope.result?.ok !== true) throw new Error(envelope.result?.error?.message ?? "rebuild failed");
		return envelope.result.value;
	} finally {
		clearTimeout(timer);
	}
}

async function main(argv = process.argv.slice(2)) {
	const options = parseArguments(argv);
	const result = await callRebuildRpc(options);
	console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] !== void 0 && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) await main();
