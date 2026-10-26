import { strict as assert } from "node:assert";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const patch = await readFile(new URL("../cordis.patch.yml", import.meta.url), "utf8");
const client = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

/** Harness package-metadata limits, mirrored from packages/boot/app-boot/src/package-meta.ts. */
const MAX_ICON_BYTES = 256 * 1024;
const ICON_MEDIA_TYPES = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
/** Locale file names must be language ids; the host reads every JSON file in the directory. */
const LANGUAGE_ID = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;

const insertedName = patch.match(/^\s+name:\s+(["'])(.+)\1\s*$/m)?.[2];
assert.equal(insertedName, packageJson.name, "cordis.patch.yml must mount the installed package name");
assert.match(patch, /^\s+name:\s+["']@[^"']+["']\s*$/m, "scoped package names must be quoted in YAML");
assert.match(patch, /^\s+- id:\s+usage-stats\s*$/m, "cordis.patch.yml must keep the stable plugin id");
assert.match(patch, /^\s*- id:\s+connection\s*\n\s+inject:\s*\[[^\]]*webStartup[^\]]*webServer[^\]]*\]\s*$/m, "the web profile must select webServer on the Connection owner fiber used by dedicated RPC channels");
assert.match(patch, /^\s+trustedHosts:\s*!!js[^\n]*webRuntime[^\n]*webStartup[^\n]*$/m, "the Connection trustedHosts expression reads the bind/trust service of both host generations");

const loaderId = client.match(/window\.__ModuleLoader__\.load\(\{\s*id:\s*["']([^"']+)["']/)?.[1];
assert.equal(loaderId, packageJson.name, "client loader must register the installed package name");

assert.equal(packageJson.type, "module", "the package loads as native ESM");
assert.match(packageJson.version, EXACT_VERSION, "the package declares a concrete release version");
assert.equal(packageJson.dsh?.manifestVersion, 1, "package uses the current public DSH manifest format");
assert.equal(packageJson.dsh?.bundle?.patch, "./cordis.patch.yml", "the profile bundle declares the patch file this test reads");
assert.equal(packageJson.dsh?.client?.platform, "web", "the client half targets the Web platform");
const injected = packageJson.dsh?.client?.inject;
assert.ok(Array.isArray(injected), "the client manifest injects host services");
for (const specifier of injected) {
	assert.ok(typeof specifier === "string" && specifier.startsWith("@deepseek-ai/"), "client inject entries name Harness packages");
}
assert.ok(injected.includes("@deepseek-ai/dsh-client-connection"), "client manifest injects the official Connection service");
assert.ok(injected.includes("@deepseek-ai/dsh-client-ui-layout"), "client manifest injects the global panel layout service");

assert.match(packageJson.homepage, /^https:\/\//u, "the package declares an https homepage");
assert.ok(typeof packageJson.bugs?.url === "string" && packageJson.bugs.url.startsWith("https://"), "the package declares an https issue tracker");
assert.ok(typeof packageJson.author === "string" && packageJson.author.trim() !== "", "the package declares its author");

/** Assert one exports target resolves to a packaged file or a populated pattern directory. */
async function assertExportTarget(subpath, target) {
	assert.equal(typeof target, "string", "export " + subpath + " is a plain path");
	const resource = target.replace(/^\.\//, "");
	assert.ok(!isAbsolute(resource) && !resource.split("/").includes(".."), "export " + subpath + " stays inside the package");
	if (resource.includes("*")) {
		const prefix = resource.slice(0, resource.indexOf("*"));
		const suffix = resource.slice(resource.indexOf("*") + 1);
		const directory = prefix.endsWith("/") ? prefix.slice(0, -1) : dirname(prefix);
		const entries = await readdir(resolve(repositoryRoot, directory));
		assert.ok(entries.some((entry) => entry.endsWith(suffix)), "export " + subpath + " resolves inside " + directory);
		return;
	}
	const info = await stat(resolve(repositoryRoot, resource));
	assert.ok(info.isFile(), "export " + subpath + " resolves to a real file");
}
assert.equal(packageJson.exports?.["."], "./" + packageJson.main, "main and the root export agree");
for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
	await assertExportTarget(subpath, target);
}

const publishedFiles = packageJson.files ?? [];
assert.ok(Array.isArray(publishedFiles) && publishedFiles.length > 0, "the package declares its published file list");
/** Whether one published files entry covers a repository-relative path. */
function coveredByPublishedFiles(file) {
	return publishedFiles.some((entry) => entry.endsWith("/") ? file.startsWith(entry) : file === entry);
}
for (const required of ["lib/", "locale/", "docs/assets/logo.png", "docs/assets/screenshots/", "cordis.patch.yml", "README.md", "LICENSE"]) {
	assert.ok(publishedFiles.includes(required), "published files keep " + required);
}

const icon = packageJson.icon;
assert.ok(typeof icon === "string" && icon.trim() !== "", "the package declares the display icon Harness reads");
assert.ok(!isAbsolute(icon) && !/^[A-Za-z][A-Za-z\d+.-]*:/u.test(icon), "the icon is a relative file path");
const iconPath = resolve(repositoryRoot, icon);
assert.ok(iconPath.startsWith(repositoryRoot + sep), "the icon stays inside the package directory");
const iconInfo = await stat(iconPath);
assert.ok(iconInfo.isFile(), "the icon exists");
assert.ok(ICON_MEDIA_TYPES.has(extname(iconPath).toLowerCase()), "the icon is SVG, PNG, JPEG, or WebP");
assert.ok(iconInfo.size <= MAX_ICON_BYTES, "the icon fits the Harness 256 KiB metadata limit");
assert.ok(coveredByPublishedFiles(icon), "the published files include the icon");
for (const unused of ["docs/assets/favicon.png", "docs/assets/apple-touch-icon.png"]) {
	assert.ok(!coveredByPublishedFiles(unused), unused + " is a site-only asset and stays out of the package");
}
const screenshots = [...new Set([...readme.matchAll(/docs\/assets\/screenshots\/[A-Za-z0-9._-]+\.png/gu)].map((match) => match[0]))];
assert.ok(screenshots.length > 0, "README references the packaged screenshots");
for (const screenshot of screenshots) {
	assert.ok(coveredByPublishedFiles(screenshot), "README-referenced screenshot stays in the package: " + screenshot);
}

const localeDirectory = resolve(repositoryRoot, "locale");
const localeEntries = await readdir(localeDirectory, { withFileTypes: true });
const locales = new Map();
for (const entry of localeEntries) {
	if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
	const language = entry.name.slice(0, -5);
	assert.match(language, LANGUAGE_ID, "locale file " + entry.name + " uses a language id filename");
	const parsed = JSON.parse(await readFile(resolve(localeDirectory, entry.name), "utf8"));
	assert.ok(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed), "locale/" + entry.name + " is a JSON object");
	const meta = parsed.meta;
	assert.ok(typeof meta === "object" && meta !== null && !Array.isArray(meta), "locale/" + entry.name + " declares meta");
	for (const field of ["title", "description"]) {
		assert.ok(typeof meta[field] === "string" && meta[field].trim() !== "", "locale/" + entry.name + " declares a non-empty meta." + field);
	}
	locales.set(language.toLowerCase(), meta);
}
for (const language of ["en", "zh"]) {
	assert.ok(locales.has(language), "locale/" + language + ".json ships Harness display metadata");
}

const HARNESS_DEVELOPMENT_PACKAGES = [
	"@deepseek-ai/dsh-client-connection",
	"@deepseek-ai/dsh-client-ui-layout",
	"@deepseek-ai/dsh-client-ui-primitives",
	"@deepseek-ai/dsh-host-webserver",
	"@deepseek-ai/dsh-session-persistence",
	"@deepseek-ai/dsh-settings",
	"@deepseek-ai/dsh-storage-domain",
];
const SERVICE_INJECTION_PACKAGES = [
	"@deepseek-ai/dsh-client-connection",
	"@deepseek-ai/dsh-client-ui-layout",
	"@deepseek-ai/dsh-client-ui-primitives",
	"@deepseek-ai/dsh-host-webserver",
	"@deepseek-ai/dsh-settings",
];
const harnessDevelopmentVersions = new Set();
for (const name of HARNESS_DEVELOPMENT_PACKAGES) {
	const range = packageJson.devDependencies?.[name];
	assert.ok(typeof range === "string", "development installs " + name);
	assert.match(range, EXACT_VERSION, "development pins " + name + " to an exact release");
	harnessDevelopmentVersions.add(range);
}
assert.equal(harnessDevelopmentVersions.size, 1, "development keeps one Harness release line");
for (const name of SERVICE_INJECTION_PACKAGES) {
	assert.ok(!packageJson.peerDependencies?.[name], name + " is a Client or service-injection relationship, not an installation peer");
}
assert.ok(typeof packageJson.dsh?.client?.inject?.length === "number", "the client manifest keeps its injection list");
assert.ok(packageJson.devDependencies?.["@deepseek-ai/cordis"], "development installs Cordis");
assert.ok(packageJson.peerDependencies?.["@deepseek-ai/cordis"], "the plugin declares its Cordis peer");

for (const dependency of ["@deepseek-ai/dsh-storage-domain", "@deepseek-ai/dsh-session-persistence"]) {
	assert.ok(packageJson.peerDependencies?.[dependency], "package declares the required Harness peer " + dependency);
	assert.ok(semver.satisfies(packageJson.devDependencies[dependency], packageJson.peerDependencies[dependency]),
		"required peer range must accept the tested Host prerelease: " + dependency);
}
assert.ok(packageJson.peerDependencies?.["@deepseek-ai/dsh-plugin-manager"], "profile package query declares its optional runtime peer");
assert.equal(packageJson.peerDependenciesMeta?.["@deepseek-ai/dsh-plugin-manager"]?.optional, true, "Hosts without the manager can still load usage reports");

assert.ok(typeof packageJson.engines?.node === "string" && packageJson.engines.node.trim() !== "", "the package declares its supported Node.js versions");
assert.ok(typeof packageJson.engines?.dsh === "string" && packageJson.engines.dsh.trim() !== "", "the package declares the tested DSH compatibility ranges");

assert.ok(client.includes('ctx.inject(["sidebarRight", "sidebarRightTabs"]'), "client registers its optional native right-Sidebar integration through host service injection");
assert.ok(client.includes('ctx.inject(["layout"]'), "client registers its native global main panel through host service injection");

const server = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");
assert.match(server, /const inject = \[[^\]]*"connection"[^\]]*"webServer"/, "dedicated Connection RPC consumers inject the sibling webServer provider");

const settings = await readFile(new URL("../lib/settings.js", import.meta.url), "utf8");
assert.ok(!settings.includes("settingsNamespace"), "settings namespace must stay a plain string; Harness >= 0.1.2-alpha.2 removed the settingsNamespace runtime brand");

console.log("package install contract passed");
