import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const siteDirectory = process.env.SITE_ROOT ?? "docs";
const siteRoot = resolve(repositoryRoot, siteDirectory);
const screenshots = ["usage-overview-all.png", "usage-overview-deepseek.png", "usage-overview-zai.png", "usage-details.png", "settings-providers.png"];
const html = await readFile(resolve(siteRoot, "index.html"), "utf8");

assert.match(html, /<title>DSH Usage Stats<\/title>/, "site must expose its product title");
assert.match(html, /dsh plugin --profile web add/, "site must contain an installation command");
assert.match(html, /github\.com\/wannanbigpig\/dsh-usage-stats/, "site must link to the repository");
assert.match(html, /<main/, "site must contain a main landmark");
await access(resolve(siteRoot, "styles.css"));
for (const screenshot of screenshots) {
  assert.match(html, new RegExp(`assets/screenshots/${screenshot.replaceAll(".", "\\.")}`), `site must reference ${screenshot}`);
  await access(resolve(siteRoot, "assets", "screenshots", screenshot));
}
console.log(`site contract passed: ${siteDirectory}`);
