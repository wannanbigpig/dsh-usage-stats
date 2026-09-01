import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = resolve(repositoryRoot, "site");
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(resolve(repositoryRoot, "docs"), outputRoot, { recursive: true });
process.env.SITE_ROOT = "site";
await import("./check-site.mjs");
console.log(`site built: ${outputRoot}`);
