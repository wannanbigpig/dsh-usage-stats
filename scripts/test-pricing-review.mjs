import assert from "node:assert/strict";
import { normalizePricing } from "../lib/pricing.js";
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
console.log("pricing review regressions passed");
