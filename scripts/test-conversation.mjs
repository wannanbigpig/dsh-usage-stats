import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const react = require("react");
const jsxRuntime = require("react/jsx-runtime");
const { createRoot } = require("react-dom/client");
const { act } = react;

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

const dom = new JSDOM("<!doctype html><html><head></head><body><div data-chat-flow></div><div id=controller></div></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLDetailsElement = dom.window.HTMLDetailsElement;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let captured = null;
window.__ModuleLoader__ = { load: (entry) => { captured = entry; } };
const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "client.js"), "utf8");
new Function(source)();
assert(captured !== null, "client bundle registration missing");

const Stub = () => null;
const primitives = new Proxy({}, { get: () => Stub });
const exports_ = captured.factory((spec) => {
	if (spec === "react") return react;
	if (spec === "react/jsx-runtime") return jsxRuntime;
	if (spec === "react-dom") return { createPortal: (node) => node };
	if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
	throw new Error(`unexpected require: ${spec}`);
});

const turn = {
	turn: 1,
	status: "closed",
	start: { time: 1_000 },
	end: { time: 4_000 },
	steps: [],
	data: { get: () => undefined }
};
const location = { kind: "step", turn, step: { turn: 1, step: 1, status: "closed", data: { get: () => undefined } } };
const nodes = new Map([
	["reasoning", { key: "reasoning", kind: "assistant-step", location, data: { status: "settled", blocks: [{ kind: "reasoning", text: "plan" }] } }],
	["tool", { key: "tool", kind: "tool-call", location, data: { root: { kind: "tool-result", isError: false, subCalls: [] } } }],
	["final", { key: "final", kind: "assistant-step", location, data: { status: "settled", blocks: [{ kind: "reasoning", text: "last check" }, { kind: "text", text: "Final answer" }] } }]
]);
const snapshot = { chat: { order: [...nodes.keys()], nodes, timeline: { turnOrder: [1], turns: new Map([[1, turn]]) } } };
const usage = { uncachedInputTokens: 5, cacheReadTokens: 90, cacheWriteTokens: 10, outputTokens: 7 };

const flow = document.querySelector("[data-chat-flow]");
flow.innerHTML = [
	'<div data-chat-flow-key="reasoning"><details data-native-think open><summary>Think</summary><div data-variant="think">plan</div></details></div>',
	'<div data-chat-flow-key="tool"><div data-tool data-state="ok"><details data-native-tool open><summary data-disclosure-row>Tool</summary></details></div></div>',
	'<div data-chat-flow-key="final"><div data-variant="think">last check</div><div data-final-answer>Final answer</div></div>'
].join("");
const originalParents = new Map([...flow.querySelectorAll("[data-chat-flow-key]")].map((row) => [row.dataset.chatFlowKey, row.parentElement]));

globalThis.fetch = async (path) => ({
	ok: true,
	status: 200,
	json: async () => path === "/api/usage-stats/accounts"
		? { ok: true, settings: { conversation: { enabled: true, showTokenUsage: true } } }
		: { ok: true, today: "2026-08-20", days: [{ date: "2026-08-20", tokens: 999, outputTokens: 77 }] }
});

function createTranslator(language) {
	return (key, params = {}) => {
		if (language === "en") {
			return key.replace("conversation.status.done", "Done")
				.replace("conversation.status.running", "Running")
				.replace("conversation.status.error", "Error")
				.replace("conversation.count.thoughts", `${params.count ?? ""} thoughts`)
				.replace("conversation.count.thought", `${params.count ?? ""} thought`)
				.replace("conversation.count.toolCalls", `${params.count ?? ""} tools`)
				.replace("conversation.count.toolCall", `${params.count ?? ""} tool`)
				.replace("conversation.count.failure", `${params.count ?? ""} failure`)
				.replace("conversation.count.failures", `${params.count ?? ""} failures`)
				.replace("conversation.tokens.input", "In")
				.replace("conversation.tokens.output", "Out");
		}
		return key.replace("conversation.status.done", "已完成")
			.replace("conversation.status.running", "进行中")
			.replace("conversation.status.error", "执行错误")
			.replace("conversation.count.thoughts", `×${params.count ?? ""} 次思考`)
			.replace("conversation.count.thought", `×${params.count ?? ""} 次思考`)
			.replace("conversation.count.toolCalls", `×${params.count ?? ""} 次工具`)
			.replace("conversation.count.toolCall", `×${params.count ?? ""} 次工具`)
			.replace("conversation.count.failure", `×${params.count ?? ""} 次失败`)
			.replace("conversation.count.failures", `×${params.count ?? ""} 次失败`)
			.replace("conversation.tokens.input", "输入")
			.replace("conversation.tokens.output", "输出");
	};
}

let t = createTranslator("zh");

async function flush() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

const root = createRoot(document.querySelector("#controller"));
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t
	}));
	await flush();
});

let marker = flow.querySelector("details[data-usc-fold]");
assert(marker !== null, "activity group marker missing");
assert(flow.querySelectorAll("details[data-usc-fold]").length === 1, "one turn must produce one activity group");
for (const [key, parent] of originalParents) {
	assert(flow.querySelector(`[data-chat-flow-key="${key}"]`)?.parentElement === parent, `${key} row must not be reparented`);
}
assert(flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "reasoning row must be collapsed");
assert(flow.querySelector('[data-chat-flow-key="tool"]').classList.contains("usc-fold-child"), "tool row must be collapsed");
assert(!flow.querySelector('[data-chat-flow-key="final"]').classList.contains("usc-fold-child"), "final answer row must remain visible");
assert(flow.querySelector('[data-chat-flow-key="final"] [data-variant="think"]').classList.contains("usc-fold-reasoning-child"), "mixed final row must collapse only its Think block");
assert(flow.querySelector("[data-final-answer]").textContent === "Final answer", "final answer content must stay visible");
assert(flow.querySelector("[data-native-think]").open && flow.querySelector("[data-native-tool]").open, "native Think/Tool disclosure state must be preserved");
assert(marker.textContent.includes("3s"), `summary must show execution duration, got ${marker.textContent}`);
assert(marker.textContent.includes("输入 105") && marker.textContent.includes("输出 7"), `summary must use current session token projection, got ${marker.textContent}`);
assert(!marker.textContent.includes("999") && !marker.textContent.includes("77"), "summary must not use daily usage totals");

await act(async () => {
	marker.open = true;
	marker.dispatchEvent(new Event("toggle"));
});
assert(!flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "opening group must reveal reasoning row");
assert(!flow.querySelector('[data-chat-flow-key="final"] [data-variant="think"]').classList.contains("usc-fold-reasoning-child"), "opening group must reveal mixed-row Think block");

// A normal snapshot refresh must not override a user's manual expansion.
usage.outputTokens = 8;
snapshot.chat = { ...snapshot.chat, nodes: new Map(nodes), order: [...nodes.keys()] };
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 1
	}));
	await flush();
});
assert(flow.querySelector("details[data-usc-fold]").open, "ordinary snapshot refresh must preserve manual expansion");
assert(!flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "manual expansion must remain visible after refresh");

// A newly running turn opens automatically, then a settled turn closes automatically.
marker.open = false;
marker.dispatchEvent(new Event("toggle"));
Object.assign(turn, { status: "open", end: undefined });
nodes.get("reasoning").data.status = "running";
nodes.get("tool").data.root = {};
snapshot.chat = { ...snapshot.chat, nodes: new Map(nodes), order: [...nodes.keys()] };
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 2
	}));
	await flush();
});
marker = flow.querySelector("details[data-usc-fold]");
assert(marker.dataset.running === "true" && marker.open, "running activity must auto-expand");
assert(!flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "running reasoning must remain visible");
assert(!flow.querySelector('[data-chat-flow-key="tool"]').classList.contains("usc-fold-child"), "running tool must remain visible");

Object.assign(turn, { status: "closed", end: { time: 5_000 } });
nodes.get("reasoning").data.status = "settled";
nodes.get("tool").data.root = { kind: "tool-result", isError: false, subCalls: [] };
snapshot.chat = { ...snapshot.chat, nodes: new Map(nodes), order: [...nodes.keys()] };
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 3
	}));
	await flush();
});
marker = flow.querySelector("details[data-usc-fold]");
assert(marker.dataset.running === "false" && !marker.open, "settled activity must auto-collapse after running");
assert(flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "settled reasoning must be collapsed");
assert(marker.textContent.includes("4s"), `settled duration must use updated turn end time, got ${marker.textContent}`);

await act(async () => {
	window.dispatchEvent(new CustomEvent("usage-stats:conversation-settings", { detail: { enabled: false, showTokenUsage: true } }));
	await flush();
});
assert(flow.querySelector("details[data-usc-fold]") === null, "disabling setting must remove activity marker immediately");
assert(!flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "disabling setting must restore hidden rows");

// Re-enable folding with token display disabled, then exercise two turns and a hard user boundary.
await act(async () => {
	window.dispatchEvent(new CustomEvent("usage-stats:conversation-settings", { detail: { enabled: true, showTokenUsage: false } }));
	await flush();
});

const turnA = { turn: 11, status: "closed", start: { time: 10_000 }, end: { time: 13_500 }, steps: [], data: { get: () => undefined } };
const turnB = { turn: 12, status: "interrupted", start: { time: 20_000 }, end: { time: 24_250 }, steps: [], data: { get: () => undefined } };
const locationOf = (target, step = 1) => ({ kind: "step", turn: target, step: { turn: target.turn, step, status: target.status, data: { get: () => undefined } } });
const locationA = locationOf(turnA);
const locationB = locationOf(turnB);
const multiNodes = new Map([
	["a-think", { key: "a-think", kind: "assistant-step", location: locationA, data: { status: "settled", blocks: [{ kind: "reasoning", text: "first plan" }] } }],
	["a-tool", { key: "a-tool", kind: "tool-call", location: locationA, data: { root: { kind: "tool-result", isError: false, subCalls: [{ kind: "tool-result", isError: false, subCalls: [] }] } } }],
	["a-final", { key: "a-final", kind: "assistant-step", location: locationA, data: { status: "settled", blocks: [{ kind: "reasoning", text: "first wrap-up" }, { kind: "text", text: "First final" }] } }],
	["user-boundary", { key: "user-boundary", kind: "user-message", location: locationA, data: { blocks: [{ kind: "text", text: "continue" }] } }],
	["b-think", { key: "b-think", kind: "assistant-step", location: locationB, data: { status: "interrupted", blocks: [{ kind: "reasoning", text: "second plan" }] } }],
	["b-tool", { key: "b-tool", kind: "tool-call", location: locationB, data: { root: { kind: "tool-result", isError: true, subCalls: [{ kind: "tool-result", isError: true, subCalls: [] }] } } }],
	["b-final", { key: "b-final", kind: "assistant-step", location: locationB, data: { status: "settled", blocks: [{ kind: "text", text: "Second final" }] } }]
]);
snapshot.chat = {
	order: [...multiNodes.keys()],
	nodes: multiNodes,
	timeline: { turnOrder: [11, 12], turns: new Map([[11, turnA], [12, turnB]]) }
};
flow.innerHTML = [
	'<div data-chat-flow-key="a-think"><details data-native-think open><summary>Think A</summary><div data-variant="think">first plan</div></details></div>',
	'<div data-chat-flow-key="a-tool"><details data-native-tool open><summary>Tool A</summary></details></div>',
	'<div data-chat-flow-key="a-final"><div data-variant="think">first wrap-up</div><div data-final-answer>First final</div></div>',
	'<div data-chat-flow-key="user-boundary"><div data-user-message>continue</div></div>',
	'<div data-chat-flow-key="b-think"><details data-native-think open><summary>Think B</summary><div data-variant="think">second plan</div></details></div>',
	'<div data-chat-flow-key="b-tool"><div data-tool data-state="stopped"><details data-native-tool open><summary>Tool B</summary></details></div></div>',
	'<div data-chat-flow-key="b-final"><div data-final-answer>Second final</div></div>'
].join("");
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 4
	}));
	await flush();
});
let markers = [...flow.querySelectorAll("details[data-usc-fold]")];
assert(markers.length === 2, `two turns must produce two activity groups, got ${markers.length}`);
assert(markers[0].dataset.uscFold === "a-think" && markers[1].dataset.uscFold === "b-think", "groups must start at each turn's first activity row");
assert(markers[0].textContent.includes("2 次工具"), `nested tool calls must be counted, got ${markers[0].textContent}`);
assert(markers[1].textContent.includes("执行错误"), `interrupted/error activity must expose error status, got ${markers[1].textContent}`);
assert(!markers[0].textContent.includes("输入") && !markers[1].textContent.includes("输出"), "token usage must be omitted when disabled");
assert(!flow.querySelector('[data-chat-flow-key="a-final"]').classList.contains("usc-fold-child"), "first final reply must stay visible");
assert(!flow.querySelector('[data-chat-flow-key="b-final"]').classList.contains("usc-fold-child"), "second final reply must stay visible");
assert(!flow.querySelector('[data-chat-flow-key="user-boundary"]').classList.contains("usc-fold-child"), "user boundary must stay outside activity groups");
assert(flow.querySelector('[data-chat-flow-key="a-final"] [data-final-answer]').textContent === "First final", "first final text must not be swallowed");
assert(flow.querySelector('[data-chat-flow-key="b-final"] [data-final-answer]').textContent === "Second final", "second final text must not be swallowed");
assert(flow.querySelectorAll("[data-native-think]")[0].open && flow.querySelectorAll("[data-native-think]")[1].open, "native Think disclosure state must survive multi-turn folding");

await act(async () => {
	window.dispatchEvent(new CustomEvent("usage-stats:conversation-settings", { detail: { enabled: true, showTokenUsage: true } }));
	await flush();
});
markers = [...flow.querySelectorAll("details[data-usc-fold]")];
assert(markers[0].textContent.includes("输入 105") && markers[0].textContent.includes("输出 8"), "enabling token usage must update all summaries from session projection");

// Changing locale must update already-mounted summaries, and unmount must remove all injected state.
t = createTranslator("en");
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 5
	}));
	await flush();
});
markers = [...flow.querySelectorAll("details[data-usc-fold]")];
assert(markers[0].textContent.includes("Done"), `English locale must update summary status, got ${markers[0].textContent}`);
assert(markers[1].textContent.includes("Error"), `English locale must update error status, got ${markers[1].textContent}`);

await act(async () => { root.unmount(); });
assert(flow.querySelector("details[data-usc-fold]") === null, "unmount must remove all activity markers");
for (const row of flow.querySelectorAll("[data-chat-flow-key]")) {
	assert(!row.classList.contains("usc-fold-child"), `${row.dataset.chatFlowKey} must be restored during cleanup`);
	assert(row.querySelector("." + "usc-fold-reasoning-child") === null, `${row.dataset.chatFlowKey} reasoning must be restored during cleanup`);
}

console.log("conversation DOM behavior ok");
