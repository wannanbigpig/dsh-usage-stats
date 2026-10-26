/**
* Syntax-check every shipped JavaScript entry in one pass.
*
* The client half is a hand-written bundle with no build step, so a syntax
* error only surfaces as "loaded without registering" in the host. This guard
* rejects the whole tree locally and in CI before that can happen.
*/
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

/** Collect lib/*.js, scripts/*.mjs and the hand-written docs script. */
async function collectFiles() {
	const files = ["docs/interactive.js"];
	for (const [directory, extension] of [["lib", ".js"], ["scripts", ".mjs"]]) {
		const entries = await readdir(new URL("../" + directory + "/", import.meta.url), { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith(extension)) files.push(directory + "/" + entry.name);
		}
	}
	files.sort();
	return files;
}

const files = await collectFiles();
const failures = [];
for (const file of files) {
	const result = spawnSync(process.execPath, ["--check", file], { cwd: repositoryRoot, encoding: "utf8" });
	if (result.status !== 0) {
		failures.push({ file, output: ((result.stdout || "") + (result.stderr || "")).trim() });
	}
}
if (failures.length > 0) {
	for (const failure of failures) console.error("syntax error: " + failure.file + "\n" + failure.output);
	console.error("syntax check failed: " + failures.length + "/" + files.length + " files");
	process.exit(1);
}
console.log("syntax check passed: " + files.length + " files");
