#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { countTextTokens } from "../lib/tokenizer.js";

function usage() {
	return [
		"Usage:",
		"  npm run tokens -- --tokenizer-dir /path/to/deepseek_v3_tokenizer 'text'",
		"  printf 'text' | npm run tokens -- --tokenizer-dir /path/to/deepseek_v3_tokenizer",
		"",
		"Options:",
		"  --tokenizer-dir <dir>  Directory containing tokenizer.json and tokenizer_config.json",
		"  --ids                  Also print token ids",
		"  --json                 Print machine-readable JSON",
		"  --help                 Show this help",
		"",
		"DEEPSEEK_TOKENIZER_DIR may be used instead of --tokenizer-dir."
	].join("\n");
}

const args = process.argv.slice(2);
let tokenizerDir = process.env.DEEPSEEK_TOKENIZER_DIR ?? null;
let includeIds = false;
let json = false;
const textParts = [];

for (let index = 0; index < args.length; index += 1) {
	const arg = args[index];
	if (arg === "--help" || arg === "-h") {
		console.log(usage());
		process.exit(0);
	}
	if (arg === "--tokenizer-dir") {
		tokenizerDir = args[index + 1] ?? null;
		index += 1;
		continue;
	}
	if (arg === "--ids") {
		includeIds = true;
		continue;
	}
	if (arg === "--json") {
		json = true;
		continue;
	}
	if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}\n${usage()}`);
	textParts.push(arg);
}

if (tokenizerDir === null || tokenizerDir === "") throw new Error(`missing --tokenizer-dir\n${usage()}`);
let text = textParts.join(" ");
if (textParts.length === 0) text = await readFile(0, "utf8");

const result = await countTextTokens(text, { tokenizerDir, includeIds });
if (json) console.log(JSON.stringify(result));
else {
	console.log(`Token count: ${result.count}`);
	if (includeIds) console.log(`Token ids: ${result.ids.join(", ")}`);
}
