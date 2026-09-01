import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const patch = await readFile(new URL("../cordis.patch.yml", import.meta.url), "utf8");
const client = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");

const insertedName = patch.match(/^\s+name:\s+(["'])(.+)\1\s*$/m)?.[2];
assert.equal(insertedName, packageJson.name, "cordis.patch.yml must mount the installed package name");
assert.match(patch, /^\s+name:\s+["']@[^"']+["']\s*$/m, "scoped package names must be quoted in YAML");
assert.match(patch, /^\s+- id:\s+usage-stats\s*$/m, "cordis.patch.yml must keep the stable plugin id");

const loaderId = client.match(/window\.__ModuleLoader__\.load\(\{\s*id:\s*["']([^"']+)["']/)?.[1];
assert.equal(loaderId, packageJson.name, "client loader must register the installed package name");
assert.equal(packageJson.version, "0.4.0", "storage v4 and host alpha.3 adaptations release as the 0.4.0 line");
assert.ok(packageJson.dsh.client.inject.includes("@deepseek-ai/dsh-client-connection"), "client manifest injects the official Connection service");
for (const dependency of ["@deepseek-ai/dsh-storage-domain", "@deepseek-ai/dsh-settings", "@deepseek-ai/dsh-client-connection", "@deepseek-ai/dsh-session-persistence"]) {
	assert.ok(packageJson.peerDependencies?.[dependency], `package declares the required Harness peer ${dependency}`);
}

const settings = await readFile(new URL("../lib/settings.js", import.meta.url), "utf8");
assert.ok(!settings.includes("settingsNamespace"), "settings namespace must stay a plain string; Harness >= 0.1.2-alpha.2 removed the settingsNamespace runtime brand");

console.log("package install contract passed");
