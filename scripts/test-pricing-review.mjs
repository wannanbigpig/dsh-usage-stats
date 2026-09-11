import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { defaultPricingPolicy, fetchOfficialPricing, normalizePricing, parseOfficialPricingHtml, validatePricingInput, validatePricingPolicy } from "../lib/pricing.js";
import { validateConfig } from "../lib/index.js";

const model = "deepseek-v4-flash";
const legacy = normalizePricing({ pricing: { [model]: { output: 100 } }, peakMultiplier: 3 });
assert.equal(legacy.models[model].peak.output, 300, "legacy output overrides must use the configured peak multiplier");
assert.equal(legacy.models[model].peak.inputMiss, 3, "an omitted legacy rate must retain the existing peak rate");
assert.equal(legacy.models[model].peak.inputHit, 0.1);

const configured = validateConfig({ pricing: { pricing: { [model]: { output: 100 } }, peakMultiplier: 3 } });
assert.equal(configured.pricing.models[model].peak.output, 300, "composition config must preserve legacy override precedence");

const explicitPeak = normalizePricing({ pricing: { [model]: { output: 100, peak: { output: 250 } } }, peakMultiplier: 3 });
assert.equal(explicitPeak.models[model].peak.output, 250, "an explicit legacy peak rate must win over the multiplier");
assert.equal(normalizePricing({ pricing: { [model]: { output: 0 } } }).models[model].peak.output, 0, "zero is an explicit legacy rate");
assert.equal(normalizePricing({ pricing: { [model]: { output: 100 } } }).models[model].peak.output, 200, "omitted multiplier must match the canonical default");
const custom = normalizePricing({ pricing: { "custom-model": { inputHit: 1, inputMiss: 2, output: 3 } } });
assert.deepEqual(custom.models["custom-model"].peak, { inputHit: 2, inputMiss: 4, output: 6 });

const versioned = normalizePricing({ models: { [model]: {
	offPeak: { inputHit: 2, inputMiss: 4, output: 6 },
	peak: { inputHit: 7, inputMiss: 11, output: 13 }
} }, peakMultiplier: 3 });
assert.deepEqual(versioned.models[model].peak, { inputHit: 7, inputMiss: 11, output: 13 });
assert.deepEqual(normalizePricing(versioned).models, versioned.models, "generated legacy mirrors must not overwrite explicit versioned peak rates on reload");
const mixed = normalizePricing({ ...versioned, pricing: { [model]: { output: 100 } } });
assert.equal(mixed.models[model].peak.output, 300, "a real legacy override must beat a versioned default");
assert.equal(mixed.models[model].peak.inputMiss, 11, "an omitted legacy field must keep its versioned peak rate");

// Config validation is run by both the host schema and apply().
const explicitConfig = validateConfig({ pricing: { pricing: { 'deepseek-v4-flash': { output: 100, peak: { output: 250 } } }, peakMultiplier: 3 } });
assert.equal(explicitConfig.pricing.models['deepseek-v4-flash'].peak.output, 250);
assert.deepEqual(validateConfig(explicitConfig).pricing, explicitConfig.pricing);
assert.equal(validateConfig({ pricing: { peakMultiplier: 3 } }).pricing.models['deepseek-v4-flash'].peak.output, 13.5);

const currentOfficialHtml = `
<table>
  <tr><th>模型</th><th>deepseek-flash<sup>(1)</sup></th><th>deepseek-v4-pro<sup>(2)</sup></th></tr>
  <tr><th>模型版本</th><td>DeepSeek-V4.1-Flash</td><td>DeepSeek-V4-Pro-0813</td></tr>
  <tr><th rowspan="2">百万 tokens 输入（缓存命中）</th><td>空闲时段</td><td>0.02元</td><td>0.15元</td></tr>
  <tr><td>高峰时段</td><td>0.04元</td><td>0.30元</td></tr>
  <tr><th rowspan="2">百万 tokens 输入（缓存未命中）</th><td>空闲时段</td><td>1元</td><td>4.5元</td></tr>
  <tr><td>高峰时段</td><td>2元</td><td>9元</td></tr>
  <tr><th rowspan="2">百万 tokens 输出</th><td>空闲时段</td><td>4元</td><td>13.5元</td></tr>
  <tr><td>高峰时段</td><td>8元</td><td>27元</td></tr>
</table>`;
const parsedCurrent = parseOfficialPricingHtml(currentOfficialHtml, { checkedAt: "2026-09-10T00:00:00.000Z" });
assert.deepEqual(Object.keys(parsedCurrent.models), ["deepseek-flash", "deepseek-v4-pro"], "official parser must use API model ids instead of version labels");
assert.equal(parsedCurrent.models["deepseek-flash"].offPeak.inputMiss, 1);

const routed = normalizePricing({
	routes: [
		{ model: "deepseek-v4-flash", priceModel: "deepseek-flash", effectiveFrom: "2026-09-10T00:00:00+08:00" },
		{ model: "deepseek-v4-pro", priceModel: "deepseek-flash", effectiveFrom: "2026-09-14T12:00:00+08:00" }
	]
});
assert.equal(routed.routes.length, 2, "normalized pricing must retain declarative model routes");
assert.throws(() => validatePricingInput({ routes: [{ model: "deepseek-v4-pro", priceModel: "deepseek-flash", effectiveFrom: "not-a-time" }] }), /effectiveFrom/);
const bundledPolicy = validatePricingPolicy(JSON.parse(await readFile(new URL("../lib/pricing-policy.json", import.meta.url), "utf8")));
assert.deepEqual(bundledPolicy, validatePricingPolicy(defaultPricingPolicy()), "bundled remote-policy seed and code fallback must not drift");
assert.throws(() => validatePricingPolicy({ ...bundledPolicy, sourceUrl: "https://example.com/policy" }), /sourceUrl/);
const remotePolicy = { ...bundledPolicy, id: "remote-test", routes: [{ model: "deepseek-v4-pro", priceModel: "deepseek-flash", effectiveFrom: "2026-09-15T00:00:00+08:00" }] };
const remotelyComposed = await fetchOfficialPricing({
	fetchImpl: async () => ({ ok: true, text: async () => currentOfficialHtml }),
	policyFetchImpl: async () => ({ ok: true, text: async () => JSON.stringify(remotePolicy) }),
	now: () => Date.parse("2026-09-11T00:00:00Z")
});
assert.equal(remotelyComposed.policyVersion, "remote-test");
assert.deepEqual(remotelyComposed.routes, remotePolicy.routes, "validated remote routes must replace the built-in fallback without executing code");
assert.equal(remotelyComposed.models["deepseek-flash"].peak.output, 8, "official HTML prices must win over policy fallback prices");
assert.throws(() => validatePricingPolicy({ ...bundledPolicy, routes: [{ model: "deepseek-v4-pro", priceModel: "deepseek-missing", effectiveFrom: "2026-09-15T00:00:00+08:00" }] }), /no price row/);
await assert.rejects(fetchOfficialPricing({ fetchPolicy: false, fetchImpl: async () => ({ ok: true, text: async () => "<html>no pricing table</html>" }) }), /pricing table was not found/, "a failed official fetch must not be reported as fresh when only the built-in fallback is available");
console.log("pricing review regressions passed");
