import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { countTextTokens, loadDeepSeekTokenizer } from "../lib/tokenizer.js";

function runCli(args, input = "") {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, args, { stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => { stdout += chunk; });
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stdout, stderr }));
		child.stdin.end(input);
	});
}

const dir = await mkdtemp(join(tmpdir(), "dsh-tokenizer-test-"));
try {
	const tokenizerJson = {
		version: "1.0",
		truncation: null,
		padding: null,
		added_tokens: [],
		normalizer: null,
		pre_tokenizer: { type: "WhitespaceSplit" },
		post_processor: null,
		decoder: null,
		model: {
			type: "WordLevel",
			vocab: { "[UNK]": 0, Hello: 1, world: 2 },
			unk_token: "[UNK]"
		}
	};
	await writeFile(join(dir, "tokenizer.json"), JSON.stringify(tokenizerJson));
	await writeFile(join(dir, "tokenizer_config.json"), JSON.stringify({ add_bos_token: false, add_eos_token: false }));

	const tokenizer = await loadDeepSeekTokenizer(dir);
	const encoded = tokenizer.encode("Hello world");
	if (encoded.ids.length !== 2) throw new Error(`expected 2 fixture tokens, got ${encoded.ids.length}`);

	const counted = await countTextTokens("Hello world", { tokenizerDir: dir, includeIds: true });
	if (counted.count !== 2) throw new Error(`expected count 2, got ${counted.count}`);
	if (counted.ids.join(",") !== "1,2") throw new Error(`unexpected ids ${counted.ids.join(",")}`);

	const cliPath = fileURLToPath(new URL("./count-tokens.mjs", import.meta.url));
	const piped = await runCli([cliPath, "--tokenizer-dir", dir], "Hello world");
	if (piped.code !== 0 || !piped.stdout.includes("Token count: 2")) throw new Error(`CLI must accept piped text: ${piped.stderr || piped.stdout}`);
	const missingDir = await runCli([cliPath, "--tokenizer-dir", "--ids"], "Hello world");
	if (missingDir.code === 0 || !missingDir.stderr.includes("requires a directory path")) throw new Error(`CLI must reject an option used as --tokenizer-dir value: ${missingDir.stderr || missingDir.stdout}`);

	let missingError = null;
	try {
		await loadDeepSeekTokenizer(join(dir, "missing"));
	} catch (error) {
		missingError = error;
	}
	if (!(missingError instanceof Error) || !missingError.message.includes("tokenizer.json")) {
		throw new Error(`missing tokenizer files must produce a clear error: ${String(missingError)}`);
	}

	console.log("offline tokenizer loading + counting ok");
} finally {
	await rm(dir, { recursive: true, force: true });
}
