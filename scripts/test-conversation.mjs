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
	["progress", { key: "progress", kind: "assistant-step", location, data: { status: "settled", blocks: [{ kind: "text", text: "Checking the remaining fix" }], usage: { inputTokens: 5, outputTokens: 1 } } }],
	["reasoning", { key: "reasoning", kind: "assistant-step", location, data: { status: "settled", blocks: [{ kind: "reasoning", text: "plan" }] } }],
	["tool", { key: "tool", kind: "tool-call", location, data: { root: { kind: "tool-result", isError: false, subCalls: [] } } }],
	["final", { key: "final", kind: "assistant-step", location, data: { status: "settled", finalNode: { seq: 4 }, blocks: [{ kind: "reasoning", text: "last check" }, { kind: "text", text: "Final answer" }], usage: { inputTokens: 100, cacheReadTokens: 5, outputTokens: 6 } } }]
]);
turn.data.get = (key) => key === "turn-tail" ? { closing: { finalNode: { seq: 4 } } } : undefined;
const snapshot = { chat: { order: [...nodes.keys()], nodes, timeline: { turnOrder: [1], turns: new Map([[1, turn]]) } } };
const usage = { uncachedInputTokens: 5, cacheReadTokens: 90, cacheWriteTokens: 10, outputTokens: 7 };

const flow = document.querySelector("[data-chat-flow]");
flow.innerHTML = [
	'<div data-chat-flow-key="progress"><div data-assistant-commentary>Checking the remaining fix</div></div>',
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
				.replace("conversation.process.status.done", "Processed")
				.replace("conversation.process.status.error", "Processing error")
				.replace("conversation.process.status.terminated", "Terminated")
				.replace("conversation.metric.thought", "Thoughts")
				.replace("conversation.metric.tool", "Tools")
				.replace("conversation.metric.failure", "failures")
				.replace("conversation.duration.minute", "m")
				.replace("conversation.duration.second", "s")
				.replace("conversation.duration", `Duration ${params.value ?? ""}`)
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
				.replace("conversation.process.status.done", "已处理")
				.replace("conversation.process.status.error", "处理错误")
				.replace("conversation.process.status.terminated", "已终止")
				.replace("conversation.metric.thought", "思考")
				.replace("conversation.metric.tool", "工具")
				.replace("conversation.metric.failure", "失败")
				.replace("conversation.duration.minute", "分钟")
				.replace("conversation.duration.second", "秒")
				.replace("conversation.duration", `耗时 ${params.value ?? ""}`)
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
let processMarker = flow.querySelector("details[data-usc-process]");
assert(processMarker !== null, "one turn must produce one outer process group");
assert(flow.querySelectorAll("details[data-usc-process]").length === 1, "one turn must produce one outer process group");
for (const [key, parent] of originalParents) {
	assert(flow.querySelector(`[data-chat-flow-key="${key}"]`)?.parentElement === parent, `${key} row must not be reparented`);
}
assert(flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "reasoning row must be collapsed");
assert(flow.querySelector('[data-chat-flow-key="tool"]').classList.contains("usc-fold-child"), "tool row must be collapsed");
assert(flow.querySelector('[data-chat-flow-key="progress"]').classList.contains("usc-process-child"), "process commentary must be hidden by the outer fold");
assert(flow.querySelector("details[data-usc-fold]").classList.contains("usc-process-child"), "inner activity fold must be hidden by the outer fold");
assert(!flow.querySelector('[data-chat-flow-key="final"]').classList.contains("usc-fold-child"), "final answer row must remain visible");
assert(flow.querySelector('[data-chat-flow-key="final"] [data-variant="think"]').classList.contains("usc-fold-reasoning-child"), "mixed final row must collapse only its Think block");
assert(flow.querySelector("[data-final-answer]").textContent === "Final answer", "final answer content must stay visible");
assert(flow.querySelector("[data-native-think]").open && flow.querySelector("[data-native-tool]").open, "native Think/Tool disclosure state must be preserved");
assert(!marker.textContent.includes("3s"), `small activity fold must omit overall duration, got ${marker.textContent}`);
assert(!marker.textContent.includes("输入") && !marker.textContent.includes("输出"), `small activity fold must omit session token usage, got ${marker.textContent}`);
assert(processMarker.textContent.includes("已处理3 秒"), `outer process fold must show Codex-style handled duration, got ${processMarker.textContent}`);
assert(processMarker.textContent.includes("输入 110") && processMarker.textContent.includes("输出 7"), `outer process fold must use current turn token usage, got ${processMarker.textContent}`);
assert(processMarker.querySelectorAll("svg.usc-process-icon").length === 2, "outer process fold must use icons for thought/tool metrics");
assert(!processMarker.textContent.includes("思考") && !processMarker.textContent.includes("工具"), "outer process fold must not spell out thought/tool metric labels");
assert(flow.querySelectorAll(".usc-fold-chevron").length === 0, "fold summaries must not render leading arrows");
assert(processMarker.querySelector("svg.usc-process-arrow") === processMarker.querySelector("summary")?.firstElementChild, "outer process must place its expand arrow first");
assert(marker.querySelector("svg.usc-fold-arrow") === marker.querySelector("summary")?.firstElementChild, "inner activity fold must place its expand arrow first");
assert(!processMarker.textContent.includes("999") && !processMarker.textContent.includes("77"), "outer summary must not use daily usage totals");

// If the host has not published turn-tail yet, the final assistant row must
// remain visible instead of being hidden by a best-effort outer fold.
const closingReader = turn.data.get;
turn.data.get = () => undefined;
snapshot.chat = { ...snapshot.chat, nodes: new Map(nodes), order: [...nodes.keys()] };
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 0.5
	}));
	await flush();
});
assert(!flow.querySelector('[data-chat-flow-key="final"]').classList.contains("usc-process-child"), "final answer must fail open while turn-tail is unavailable");
turn.data.get = closingReader;
snapshot.chat = { ...snapshot.chat, nodes: new Map(nodes), order: [...nodes.keys()] };
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 0.6
	}));
	await flush();
});
processMarker = flow.querySelector("details[data-usc-process]");

await act(async () => {
	processMarker.open = true;
	processMarker.dispatchEvent(new Event("toggle"));
});
assert(!flow.querySelector('[data-chat-flow-key="progress"]').classList.contains("usc-process-child"), "opening outer process must reveal process commentary");
assert(!flow.querySelector("details[data-usc-fold]").classList.contains("usc-process-child"), "opening outer process must reveal inner activity fold");
assert(flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "opening outer process must preserve inner activity collapse");
assert(processMarker.open && processMarker.querySelector("svg.usc-process-arrow") !== null, "outer process arrow must remain the state indicator when open");

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
processMarker = flow.querySelector("details[data-usc-process]");
assert(processMarker.dataset.running === "true" && processMarker.open, "running process must auto-expand");
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
processMarker = flow.querySelector("details[data-usc-process]");
assert(processMarker.dataset.running === "false" && !processMarker.open, "settled process must auto-collapse after running");
assert(flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "settled reasoning must be collapsed");
assert(processMarker.textContent.includes("已处理4 秒"), `settled outer duration must use Codex-style updated turn duration, got ${processMarker.textContent}`);

await act(async () => {
	window.dispatchEvent(new CustomEvent("usage-stats:conversation-settings", { detail: { enabled: false, showTokenUsage: true } }));
	await flush();
});
assert(flow.querySelector("details[data-usc-fold]") === null, "disabling setting must remove activity marker immediately");
assert(flow.querySelector("details[data-usc-process]") === null, "disabling setting must remove outer process marker immediately");
assert(!flow.querySelector('[data-chat-flow-key="reasoning"]').classList.contains("usc-fold-child"), "disabling setting must restore hidden rows");

// Re-enable folding with token display disabled, then exercise two turns and a hard user boundary.
await act(async () => {
	window.dispatchEvent(new CustomEvent("usage-stats:conversation-settings", { detail: { enabled: true, showTokenUsage: false } }));
	await flush();
});

const turnA = { turn: 11, status: "closed", start: { time: 1_000 }, end: { time: 120_000 }, steps: [], data: { get: () => undefined } };
const turnB = { turn: 12, status: "interrupted", start: { time: 20_000 }, end: { time: 24_250 }, steps: [], data: { get: () => undefined } };
const locationOf = (target, step = 1) => ({ kind: "step", turn: target, step: { turn: target.turn, step, status: target.status, data: { get: () => undefined } } });
const locationA = locationOf(turnA);
const locationB = locationOf(turnB);
const multiNodes = new Map([
	["a-context", { key: "a-context", kind: "context", location: locationA, data: { blocks: [{ kind: "text", text: "startup context" }] } }],
	["a-prompt", { key: "a-prompt", kind: "user", location: locationA, data: { blocks: [{ kind: "text", text: "first request" }] } }],
	["a-post-context", { key: "a-post-context", kind: "context", location: locationA, data: { blocks: [{ kind: "text", text: "system context" }] } }],
	["a-think", { key: "a-think", kind: "assistant-step", location: locationA, data: { status: "settled", blocks: [{ kind: "reasoning", text: "first plan" }], usage: { inputTokens: 0, outputTokens: 0 } } }],
	["a-tool", { key: "a-tool", kind: "tool-call", location: locationA, data: { root: { kind: "tool-result", isError: false, subCalls: [{ kind: "tool-result", isError: false, subCalls: [] }] } } }],
	["a-final", { key: "a-final", kind: "assistant-step", location: locationA, data: { status: "settled", finalNode: { seq: 103 }, blocks: [{ kind: "reasoning", text: "first wrap-up" }, { kind: "text", text: "First final" }], usage: { inputTokens: 100, cacheReadTokens: 5, outputTokens: 8 } } }],
	["user-boundary", { key: "user-boundary", kind: "user-message", location: locationA, data: { blocks: [{ kind: "text", text: "continue" }] } }],
	["b-think", { key: "b-think", kind: "assistant-step", location: locationB, data: { status: "interrupted", blocks: [{ kind: "reasoning", text: "second plan" }], usage: { inputTokens: 25, outputTokens: 1 } } }],
	["b-tool", { key: "b-tool", kind: "tool-call", location: locationB, data: { root: { kind: "tool-result", isError: true, subCalls: [{ kind: "tool-result", isError: true, subCalls: [] }] } } }],
	["b-final", { key: "b-final", kind: "assistant-step", location: locationB, data: { status: "settled", finalNode: { seq: 203 }, blocks: [{ kind: "text", text: "Second final" }], usage: { inputTokens: 50, outputTokens: 4 } } }]
]);
turnA.data.get = (key) => key === "turn-tail" ? { closing: { finalNode: { seq: 103 } } } : undefined;
turnB.data.get = (key) => key === "turn-tail" ? { closing: { finalNode: { seq: 203 } } } : undefined;
snapshot.chat = {
	order: [...multiNodes.keys()],
	nodes: multiNodes,
	timeline: { turnOrder: [11, 12], turns: new Map([[11, turnA], [12, turnB]]) }
};
flow.innerHTML = [
	'<div data-chat-flow-key="a-context"><div data-context-injection>startup context</div></div>',
	'<div data-chat-flow-key="a-prompt"><div data-user-message>first request</div></div>',
	'<div data-chat-flow-key="a-post-context"><div data-context-injection>system context</div></div>',
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
let processMarkers = [...flow.querySelectorAll("details[data-usc-process]")];
assert(processMarkers.length === 2, `two turns must produce two outer process groups, got ${processMarkers.length}`);
assert(processMarkers[0].dataset.uscProcess === "a-post-context" && processMarkers[1].dataset.uscProcess === "b-think", "the outer process group must start after the direct user prompt");
assert(processMarkers[0].previousElementSibling === flow.querySelector('[data-chat-flow-key="a-prompt"]'), "the outer process marker must stay below the direct user prompt");
assert(!flow.querySelector('[data-chat-flow-key="a-context"]').classList.contains("usc-process-child"), "startup context before the direct user prompt must stay outside the process fold");
assert(flow.querySelector('[data-chat-flow-key="a-post-context"]').classList.contains("usc-process-child"), "system context after the direct user prompt must stay inside the process fold");
assert(processMarkers[0].textContent.includes("已处理1 分钟 59 秒"), `outer process duration must use Codex-style minute/second units, got ${processMarkers[0].textContent}`);
assert(markers[0].dataset.uscFold === "a-think" && markers[1].dataset.uscFold === "b-think", "groups must start at each turn's first activity row");
assert(markers[0].textContent.includes("2 次工具"), `nested tool calls must be counted, got ${markers[0].textContent}`);
assert(!markers[1].textContent.includes("执行错误") && markers[1].textContent.includes("次失败"), `local tool failures must be counted without marking the whole activity as an execution error, got ${markers[1].textContent}`);
assert(processMarkers[1].textContent.includes("已处理") && !processMarkers[1].textContent.includes("处理错误"), `outer process with a returned result must be marked done, got ${processMarkers[1].textContent}`);
assert(!markers[0].textContent.includes("输入") && !markers[1].textContent.includes("输出"), "token usage must be omitted when disabled");
assert(!flow.querySelector('[data-chat-flow-key="a-final"]').classList.contains("usc-fold-child"), "first final reply must stay visible");
assert(!flow.querySelector('[data-chat-flow-key="b-final"]').classList.contains("usc-fold-child"), "second final reply must stay visible");
assert(!flow.querySelector('[data-chat-flow-key="a-final"]').classList.contains("usc-process-child"), "first final reply must stay outside the outer process fold");
assert(!flow.querySelector('[data-chat-flow-key="b-final"]').classList.contains("usc-process-child"), "second final reply must stay outside the outer process fold");
assert(!flow.querySelector('[data-chat-flow-key="a-prompt"]').classList.contains("usc-process-child"), "the user prompt must remain visible between startup context and process rows");
assert(!flow.querySelector('[data-chat-flow-key="user-boundary"]').classList.contains("usc-fold-child"), "user boundary must stay outside activity groups");
assert(flow.querySelector('[data-chat-flow-key="a-final"] [data-final-answer]').textContent === "First final", "first final text must not be swallowed");
assert(flow.querySelector('[data-chat-flow-key="b-final"] [data-final-answer]').textContent === "Second final", "second final text must not be swallowed");
assert(flow.querySelectorAll("[data-native-think]")[0].open && flow.querySelectorAll("[data-native-think]")[1].open, "native Think disclosure state must survive multi-turn folding");

await act(async () => {
	window.dispatchEvent(new CustomEvent("usage-stats:conversation-settings", { detail: { enabled: true, showTokenUsage: true } }));
	await flush();
});
markers = [...flow.querySelectorAll("details[data-usc-fold]")];
processMarkers = [...flow.querySelectorAll("details[data-usc-process]")];
assert(!markers[0].textContent.includes("输入") && !markers[1].textContent.includes("输出"), "inner activity folds must omit session token usage");
assert(processMarkers[0].textContent.includes("输入 105") && processMarkers[0].textContent.includes("输出 8"), "outer process fold must show only the first turn token usage");
assert(!processMarkers[1].textContent.includes("输入 105") && processMarkers[1].textContent.includes("输入 75") && processMarkers[1].textContent.includes("输出 5"), "outer process fold must show the second turn token usage instead of session cumulative usage");

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
assert(markers[1].textContent.includes("Done") && markers[1].textContent.includes("3 failures"), `English locale must keep local failure count without error status, got ${markers[1].textContent}`);
processMarkers = [...flow.querySelectorAll("details[data-usc-process]")];
assert(processMarkers[0].textContent.includes("Processed"), `English locale must update outer process status, got ${processMarkers[0].textContent}`);
assert(processMarkers[1].textContent.includes("Processed") && !processMarkers[1].textContent.includes("Processing error"), `English outer process with a returned result must be marked done, got ${processMarkers[1].textContent}`);

multiNodes.get("a-final").data.usage = { inputTokens: 1_200_000, outputTokens: 120_000 };
snapshot.chat = { ...snapshot.chat, nodes: new Map(multiNodes), order: [...multiNodes.keys()] };
t = createTranslator("zh");
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 5.5
	}));
	await flush();
});
processMarkers = [...flow.querySelectorAll("details[data-usc-process]")];
assert(processMarkers[0].textContent.includes("输入 1.2 M") && processMarkers[0].textContent.includes("输出 120 K"), `token metrics must use spaced Codex units, got ${processMarkers[0].textContent}`);

// A user stop is distinct from a crash-recovery interruption: it must not be
// presented as an execution error when no final answer was produced.
const abortedTurn = {
	turn: 13,
	status: "closed",
	start: { time: 30_000 },
	end: { time: 32_000, data: { reason: { kind: "aborted", reason: { kind: "user" } } } },
	steps: [],
	data: { get: () => undefined }
};
const abortedLocation = locationOf(abortedTurn);
const abortedNodes = new Map([
	["c-think", { key: "c-think", kind: "assistant-step", location: abortedLocation, data: { status: "settled", blocks: [{ kind: "reasoning", text: "stopped plan" }] } }],
	["c-tool", { key: "c-tool", kind: "tool-call", location: abortedLocation, data: { root: {} } }]
]);
snapshot.chat = {
	order: [...abortedNodes.keys()],
	nodes: abortedNodes,
	timeline: { turnOrder: [13], turns: new Map([[13, abortedTurn]]) }
};
flow.innerHTML = [
	'<div data-chat-flow-key="c-think"><details data-native-think open><summary>Think C</summary><div data-variant="think">stopped plan</div></details></div>',
	'<div data-chat-flow-key="c-tool"><div data-tool data-state="stopped"><details data-native-tool open><summary>Tool C</summary></details></div></div>'
].join("");
t = createTranslator("zh");
await act(async () => {
	root.render(react.createElement(exports_.CompactConversationController, {
		sessionId: "session-1",
		useSession: (selector) => selector(snapshot),
		useProjection: (key) => key === "tokenUsage" ? usage : undefined,
		t,
		revision: 6
	}));
	await flush();
});
processMarkers = [...flow.querySelectorAll("details[data-usc-process]")];
assert(processMarkers.length === 1, `user-aborted turn must produce one outer process group, got ${processMarkers.length}`);
assert(processMarkers[0].textContent.includes("已终止") && !processMarkers[0].textContent.includes("处理错误"), `user-aborted turn must be marked terminated rather than error, got ${processMarkers[0].textContent}`);

await act(async () => { root.unmount(); });
assert(flow.querySelector("details[data-usc-fold]") === null, "unmount must remove all activity markers");
assert(flow.querySelector("details[data-usc-process]") === null, "unmount must remove all outer process markers");
for (const row of flow.querySelectorAll("[data-chat-flow-key]")) {
	assert(!row.classList.contains("usc-fold-child"), `${row.dataset.chatFlowKey} must be restored during cleanup`);
	assert(row.querySelector("." + "usc-fold-reasoning-child") === null, `${row.dataset.chatFlowKey} reasoning must be restored during cleanup`);
}

console.log("conversation DOM behavior ok");
