import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const patch = await readFile(new URL("../cordis.patch.yml", import.meta.url), "utf8");

const insertedName = patch.match(/^\s+name:\s+(["'])(.+)\1\s*$/m)?.[2];
assert.equal(insertedName, packageJson.name, "cordis.patch.yml must mount the installed package name");
assert.match(patch, /^\s+name:\s+["']@[^"']+["']\s*$/m, "scoped package names must be quoted in YAML");
assert.match(patch, /^\s+- id:\s+usage-stats\s*$/m, "cordis.patch.yml must keep the stable plugin id");

console.log("package install contract passed");
