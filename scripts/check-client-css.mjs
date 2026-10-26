// Validate the hand-written client bundle's stylesheet contract before a host
// ever loads it. The bundle keeps one `S` class map and one CSS string, and a
// typo or a stale mapping only shows up as an unstyled control in the browser.
//
// Checks:
// 1. every `S` mapping key is unique (a duplicate silently drops the first class)
// 2. every class an `S` value names exists in the CSS block
// 3. report `S` keys no component references (dead mappings)
// 4. report CSS classes nothing in the bundle references (dead rules), without
//    failing on selector fragments that only live inside the stylesheet
// 5. hover media queries must contain a block around their selectors
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../lib/client.js", import.meta.url)), "utf8");
const lines = source.split("\n");

/** Index of the line owning the CSS region's opening marker. */
const cssStart = lines.findIndex((line) => line.includes("//#region css"));
/** Index of the line owning the `const S = {` declaration. */
const classMapStart = lines.findIndex((line) => line.includes("const S = {"));
/** Index of the line closing the class map (a tab-indented `};`). */
const classMapEnd = lines.findIndex((line, index) => index > classMapStart && /^\t\t\};/.test(line));
if (cssStart < 0 || classMapStart < 0 || classMapEnd < 0) {
	console.error("check-client-css: could not locate the CSS region or the S class map in lib/client.js");
	process.exit(1);
}

const cssText = lines.slice(cssStart, classMapStart).join("\n");
const classMapLines = lines.slice(classMapStart, classMapEnd + 1);
const classMapText = classMapLines.join("\n");
/** Everything a component may reference: the file outside the stylesheet and class map. */
const referenceText = lines.slice(0, cssStart).join("\n") + "\n" + lines.slice(classMapEnd + 1).join("\n");

const entries = [];
for (const line of classMapLines) {
	const match = line.match(/^\s*([A-Za-z0-9_]+):\s*"([^"]+)"/);
	if (match !== null) entries.push({ key: match[1], value: match[2] });
}

const cssClasses = new Set([...cssText.matchAll(/\.(usg_[A-Za-z0-9_]+)/g)].map((match) => match[1]));
const mappedValues = new Set(entries.map((entry) => entry.value));

const failures = [];
const warnings = [];

// A selector immediately after the hover condition becomes part of the media
// query, leaving no style rules inside it. Class-name checks cannot catch this.
for (const match of cssText.matchAll(/@media\s*\(\s*hover\s*:\s*hover\s*\)(?!\s*\{)/g)) {
	const line = cssStart + cssText.slice(0, match.index).split("\n").length;
	failures.push("hover media query must wrap selectors in a block (lib/client.js:" + line + ")");
}

// 1. Unique keys: a repeated key keeps only the last value at runtime.
const seenKeys = new Set();
const duplicateKeys = new Set();
for (const entry of entries) {
	if (seenKeys.has(entry.key)) duplicateKeys.add(entry.key);
	else seenKeys.add(entry.key);
}
for (const key of duplicateKeys) failures.push("duplicate S key: " + key);

// 2. Every mapped class must exist in the stylesheet.
const missingClasses = entries.filter((entry) => !cssClasses.has(entry.value));
for (const entry of missingClasses) failures.push("S." + entry.key + " maps to ." + entry.value + " with no CSS rule");

// 3. Dead mappings: an S key nothing references.
const referencesKey = (key) => new RegExp("\\bS\\." + key + "\\b").test(referenceText)
	|| referenceText.includes('S["' + key + '"]')
	|| referenceText.includes("S['" + key + "']");
const deadKeys = entries.filter((entry) => !referencesKey(entry.key)).map((entry) => entry.key);
for (const key of deadKeys) warnings.push("unreferenced S mapping: S." + key);

// 4. Dead rules: a class named in neither the S map nor the component code.
// A class composed at run time (`usg_day_${key}`) is referenced through its
// literal prefix, so a trailing-underscore prefix also counts as a reference.
const classReferenceText = referenceText + "\n" + classMapText;
const referencesClass = (className) => {
	if (classReferenceText.includes(className)) return true;
	for (let index = className.indexOf("_", 4); index > 0; index = className.indexOf("_", index + 1)) {
		if (classReferenceText.includes(className.slice(0, index + 1))) return true;
	}
	return false;
};
const deadCss = [...cssClasses].filter((className) => !referencesClass(className));
if (deadCss.length > 0) warnings.push("unreferenced CSS classes (" + deadCss.length + "): " + deadCss.map((className) => "." + className).join(", "));

for (const warning of warnings) console.warn("check-client-css: warning: " + warning);
if (failures.length > 0) {
	for (const failure of failures) console.error("check-client-css: " + failure);
	console.error("client CSS contract failed: " + failures.length + " problem(s)");
	process.exit(1);
}
console.log(
	"client CSS contract passed: " + entries.length + " S mappings, " + cssClasses.size + " CSS classes"
	+ (warnings.length > 0 ? ", " + warnings.length + " warning(s)" : "")
);
