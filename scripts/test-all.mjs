/**
* Run the behavior test suites in order.
*
* npm test runs the syntax guard first; this runner keeps the previous suite
* order and reports every failing script, while test:host-current stays a
* separate, host-checkout-dependent entry and is not part of the chain.
*/
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const tests = [
	"scripts/test-upgrade.mjs",
	"scripts/test-query-design.mjs",
	"scripts/test-package.mjs",
	"scripts/test-usage.mjs",
	"scripts/test-tokenizer.mjs",
	"scripts/test-providers.mjs",
	"scripts/test-server.mjs",
	"scripts/test-rpc.mjs",
	"scripts/test-official-state.mjs",
	"scripts/test-storage-json-integration.mjs",
	"scripts/test-rebuild-legacy.mjs",
	"scripts/smoke-client.mjs",
	"scripts/test-pricing-review.mjs",
	"scripts/test-review-services.mjs",
	"scripts/test-settings-interaction.mjs",
];

const failures = [];
for (let index = 0; index < tests.length; index += 1) {
	const script = tests[index];
	console.log("[test-all] " + (index + 1) + "/" + tests.length + " " + script);
	const result = spawnSync(process.execPath, [script], { cwd: repositoryRoot, stdio: "inherit", env: process.env });
	if (result.status !== 0) {
		failures.push(script + " (" + (result.status === null ? result.signal : "exit " + result.status) + ")");
	}
}
if (failures.length > 0) {
	console.error("[test-all] failed: " + failures.join(", "));
	process.exit(1);
}
console.log("[test-all] passed " + tests.length + "/" + tests.length);
