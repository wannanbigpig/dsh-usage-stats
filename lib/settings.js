/** Official settings namespace and the small owner-facing adapter. */

import z from "@deepseek-ai/schemastery";
import { validatePricingInput } from "./pricing.js";

// Hosts >= 0.1.2-alpha.2 removed the runtime namespace brand function; both
// generations accept the plain string (alpha.1 uses it as-is, alpha.2 parses
// and validates it inside register/mutate).
export const USAGE_STATS_SETTINGS_NAMESPACE = "usage-stats";

const quotaThresholds = () => z.object({
	warningRemainingPercent: z.number().min(0).max(100).default(30),
	criticalRemainingPercent: z.number().min(0).max(100).default(10)
});

const defaultLimitRule = {
	enabled: false,
	dailyCostLimit: null,
	monthlyCostLimit: null,
	minBalance: null,
	lowBalanceWarning: null,
	alertPercent: 80,
	criticalPercent: 90,
	period: "daily",
	stopOnExceed: false,
	notificationCooldownMs: 30 * 60 * 1000
};

const nullableNumber = (schema = z.number()) => z.union([schema, z.const(null)]);

const limitRuleSchema = z.object({
	enabled: z.boolean().default(false),
	dailyCostLimit: nullableNumber(z.number().min(0)).default(null),
	monthlyCostLimit: nullableNumber(z.number().min(0)).default(null),
	minBalance: nullableNumber(z.number().min(0)).default(null),
	lowBalanceWarning: nullableNumber(z.number().min(0)).default(null),
	alertPercent: z.number().min(1).max(100).default(80),
	criticalPercent: z.number().min(1).max(100).default(90),
	period: z.union(["daily", "monthly"]).default("daily"),
	stopOnExceed: z.boolean().default(false),
	notificationCooldownMs: z.number().min(0).default(30 * 60 * 1000)
});

export const USAGE_STATS_SETTINGS_SCHEMA = z.object({
	version: z.const(3).default(3),
	defaultProviderId: z.string().min(1).default("deepseek-official"),
	visibleProviderIds: z.array(z.string().min(1)).max(3).default([]),
	refreshMs: nullableNumber(z.number().min(5000)).default(null),
	display: z.object({
		balance: z.boolean().default(true),
		todayCost: z.boolean().default(true),
		statusDot: z.boolean().default(true)
	}).default({}),
	pricing: z.any().default(null),
	maxLedgerEntries: nullableNumber(z.number().step(1).min(100).max(5000)).default(null),
	limits: z.object({
		version: z.const(2).default(2),
		global: limitRuleSchema.default(defaultLimitRule),
		keys: z.dict(limitRuleSchema).default({})
	}).default({}),
	notifications: z.object({
		channels: z.object({
			sidebar: z.boolean().default(true),
			toast: z.boolean().default(false)
		}).default({}),
		events: z.object({
			warning: z.boolean().default(true),
			exceeded: z.boolean().default(true),
			lowBalance: z.boolean().default(true),
			recovery: z.boolean().default(true)
		}).default({}),
		planQuota: z.object({
			warningRemainingPercent: z.number().min(0).max(100).default(30),
			criticalRemainingPercent: z.number().min(0).max(100).default(10),
			windows: z.object({
				five_hour: quotaThresholds().default({}),
				weekly: quotaThresholds().default({})
			}).default({})
		}).default({}),
		cooldownMs: z.number().min(0).max(7 * 86400000).default(30 * 60 * 1000)
	}).default({}),
	migration: z.object({
		legacySettingsImported: z.boolean().default(false),
		legacySettingsSha256: z.string().default(""),
		legacyLimitsSha256: z.string().default("")
	}).default({})
});

/** Fields retired from the schema that may linger in persisted settings. */
export const RETIRED_SETTINGS_FIELDS = ["conversation"];

/** Return retired fields still present in a resolved settings value. */
export function retiredSettingsFieldsOf(value) {
	return RETIRED_SETTINGS_FIELDS.filter((field) => Object.hasOwn(value ?? {}, field));
}

const SETTINGS_BASE_FIELDS = [
	"defaultProviderId",
	"visibleProviderIds",
	"refreshMs",
	"display",
	"pricing",
	"maxLedgerEntries",
	"limits",
	"notifications"
];

/** Project plugin composition config onto fields owned by user settings. */
export function settingsBaseFromConfig(config = {}) {
	const base = {};
	for (const key of SETTINGS_BASE_FIELDS) {
		if (config[key] !== void 0) base[key] = structuredClone(config[key]);
	}
	return base;
}

/** Cross-field constraints that schemastery's presentation schema cannot express. */
export function validateUsageStatsSettings(value) {
	if (new Set(value.visibleProviderIds).size !== value.visibleProviderIds.length) {
		throw new TypeError("visibleProviderIds must not contain duplicates");
	}
	const validateLimit = (rule, label) => {
		if (rule.criticalPercent < rule.alertPercent) {
			throw new TypeError(`${label}.criticalPercent must be greater than or equal to alertPercent`);
		}
	};
	validateLimit(value.limits.global, "limits.global");
	for (const [key, rule] of Object.entries(value.limits.keys)) validateLimit(rule, `limits.keys.${key}`);
	const validateQuota = (quota, label) => {
		if (quota.criticalRemainingPercent > quota.warningRemainingPercent) {
			throw new TypeError(`${label}.criticalRemainingPercent must not exceed warningRemainingPercent`);
		}
	};
	validateQuota(value.notifications.planQuota, "notifications.planQuota");
	validateQuota(value.notifications.planQuota.windows.five_hour, "notifications.planQuota.windows.five_hour");
	validateQuota(value.notifications.planQuota.windows.weekly, "notifications.planQuota.windows.weekly");
	if (value.pricing !== void 0 && (value.pricing === null || typeof value.pricing !== "object" || Array.isArray(value.pricing))) {
		throw new TypeError("pricing must be an object when configured");
	}
	if (value.pricing !== void 0 && value.pricing !== null) validatePricingInput(value.pricing);
}

/** Register the namespace and expose official update/mutate operations. */
export function createUsageStatsSettings(ctx, base = {}) {
	if (ctx?.settings?.register === void 0 || ctx?.settings?.mutate === void 0) {
		throw new TypeError("ctx.settings register/mutate services are required");
	}
	const resolvedBase = settingsBaseFromConfig(base);
	const scope = ctx.settings.register(
		USAGE_STATS_SETTINGS_NAMESPACE,
		USAGE_STATS_SETTINGS_SCHEMA,
		{ base: resolvedBase, applies: "live", validate: validateUsageStatsSettings }
	);
	return {
		scope,
		get: () => scope.get(),
		watch: (callback) => scope.watch(callback),
		update: (patch) => scope.update(patch),
		replace: (section) => scope.replace(section),
		replaceLimits: (limits) => ctx.settings.mutate(USAGE_STATS_SETTINGS_NAMESPACE, [
			{ op: "set", path: ["limits"], value: structuredClone(limits) }
		]),
		resetPricing: () => ctx.settings.mutate(USAGE_STATS_SETTINGS_NAMESPACE, [
			{ op: "unset", path: ["pricing"] }
		]),
		/** Prune retired fields (e.g. legacy conversation) left in persisted user settings. */
		retireStaleFields: async () => {
			const retired = retiredSettingsFieldsOf(scope.get());
			if (retired.length === 0) return;
			await ctx.settings.mutate(USAGE_STATS_SETTINGS_NAMESPACE, retired.map((field) => ({ op: "unset", path: [field] })));
		},
		mutate: (operations) => ctx.settings.mutate(USAGE_STATS_SETTINGS_NAMESPACE, operations)
	};
}
