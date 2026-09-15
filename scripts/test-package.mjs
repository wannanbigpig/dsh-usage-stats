import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const patch = await readFile(new URL("../cordis.patch.yml", import.meta.url), "utf8");
const client = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");

const insertedName = patch.match(/^\s+name:\s+(["'])(.+)\1\s*$/m)?.[2];
assert.equal(insertedName, packageJson.name, "cordis.patch.yml must mount the installed package name");
assert.match(patch, /^\s+name:\s+["']@[^"']+["']\s*$/m, "scoped package names must be quoted in YAML");
assert.match(patch, /^\s+- id:\s+usage-stats\s*$/m, "cordis.patch.yml must keep the stable plugin id");
assert.match(patch, /^\s*- id:\s+connection\s*\n\s+inject:\s*\[[^\]]*webRuntime[^\]]*webServer[^\]]*\]\s*$/m, "the web profile must inject webServer into the Connection owner fiber used by dedicated RPC channels");

const loaderId = client.match(/window\.__ModuleLoader__\.load\(\{\s*id:\s*["']([^"']+)["']/)?.[1];
assert.equal(loaderId, packageJson.name, "client loader must register the installed package name");
assert.equal(packageJson.version, "0.5.2", "host compatibility and interaction fixes release as the 0.5.2 line");
assert.equal(packageJson.dsh.manifestVersion, 1, "package uses the current public DSH manifest format");
assert.equal(packageJson.engines?.dsh, ">=0.1.5-rc.1 <0.1.6-0 || 0.1.6-alpha.1", "package declares the tested DSH compatibility line");
assert.ok(packageJson.dsh.client.inject.includes("@deepseek-ai/dsh-client-connection"), "client manifest injects the official Connection service");
assert.ok(packageJson.dsh.client.inject.includes("@deepseek-ai/dsh-client-ui-layout"), "client manifest injects the global panel layout service");
for (const dependency of ["@deepseek-ai/dsh-storage-domain", "@deepseek-ai/dsh-session-persistence"]) {
	assert.ok(packageJson.peerDependencies?.[dependency], `package declares the required Harness peer ${dependency}`);
}
assert.equal(packageJson.devDependencies?.["@deepseek-ai/cordis"], packageJson.peerDependencies?.["@deepseek-ai/cordis"], "Cordis uses matching peer and development ranges");
for (const dependency of ["@deepseek-ai/dsh-client-connection", "@deepseek-ai/dsh-client-ui-layout", "@deepseek-ai/dsh-client-ui-primitives", "@deepseek-ai/dsh-host-webserver", "@deepseek-ai/dsh-settings"]) {
	assert.equal(packageJson.devDependencies?.[dependency], "0.1.5-rc.2", `development keeps the earlier Harness regression package ${dependency}`);
	assert.ok(!packageJson.peerDependencies?.[dependency], `${dependency} is a Client or service-injection relationship, not an installation peer`);
}
for (const dependency of ["@deepseek-ai/dsh-session-persistence", "@deepseek-ai/dsh-storage-domain"]) {
	assert.equal(packageJson.devDependencies?.[dependency], "0.1.5-rc.2", `development keeps the earlier Harness regression package ${dependency}`);
}
assert.ok(client.includes('ctx.inject(["sidebarRight", "sidebarRightTabs"]'), "client registers its optional native right-Sidebar integration through host service injection");
assert.ok(client.includes('ctx.inject(["layout"]'), "client registers its native global main panel through host service injection");

const server = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");
assert.match(server, /const inject = \[[^\]]*"connection"[^\]]*"webServer"/, "dedicated Connection RPC consumers inject the sibling webServer provider");

const settings = await readFile(new URL("../lib/settings.js", import.meta.url), "utf8");
assert.ok(!settings.includes("settingsNamespace"), "settings namespace must stay a plain string; Harness >= 0.1.2-alpha.2 removed the settingsNamespace runtime brand");

console.log("package install contract passed");
