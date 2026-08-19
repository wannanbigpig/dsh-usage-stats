/**
 * Offline DeepSeek tokenizer support.
 *
 * This module loads the official Hugging Face `tokenizer.json` and
 * `tokenizer_config.json` supplied by the user. It is intentionally separate
 * from billing aggregation: local encoding can estimate visible text, while
 * provider-reported `usage` remains the source of truth for actual requests.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Tokenizer } from "@huggingface/tokenizers";

async function readTokenizerJson(path, fileName) {
	const file = resolve(path, fileName);
	let source;
	try {
		source = await readFile(file, "utf8");
	} catch (error) {
		throw new Error(`cannot read ${fileName} at ${file}: ${error instanceof Error ? error.message : String(error)}`);
	}
	try {
		return JSON.parse(source);
	} catch (error) {
		throw new Error(`invalid ${fileName} at ${file}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/** Load a tokenizer directory exported by DeepSeek/Hugging Face. */
export async function loadDeepSeekTokenizer(tokenizerDir) {
	if (typeof tokenizerDir !== "string" || tokenizerDir.trim() === "") {
		throw new Error("tokenizerDir must point to a directory containing tokenizer.json and tokenizer_config.json");
	}
	const dir = resolve(tokenizerDir);
	// Read in a stable order so a missing directory always reports the primary
	// tokenizer file first instead of whichever parallel read rejects first.
	const tokenizerJson = await readTokenizerJson(dir, "tokenizer.json");
	const tokenizerConfig = await readTokenizerJson(dir, "tokenizer_config.json");
	return new Tokenizer(tokenizerJson, tokenizerConfig);
}

/**
 * Encode visible text with the official tokenizer files. Special tokens
 * (BOS/EOS) added by the tokenizer's post-processor are excluded by default
 * so only the visible text is measured; pass `includeSpecialTokens: true`
 * to include them.
 */
export async function countTextTokens(text, options = {}) {
	if (typeof text !== "string") throw new Error("text must be a string");
	const tokenizer = options.tokenizer ?? await loadDeepSeekTokenizer(options.tokenizerDir);
	const encoded = tokenizer.encode(text, { add_special_tokens: options.includeSpecialTokens === true });
	return {
		count: encoded.ids.length,
		...(options.includeIds === true ? { ids: [...encoded.ids] } : {})
	};
}
