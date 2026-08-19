/** One-shot, fail-loud bridge from the plugin's legacy JSON files. */

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createLedgerState, recordLedgerState } from "./ledger.js";
import { normalizePricing, validatePricingInput } from "./pricing.js";
import { isOfficialBillingProvider } from "./usage.js";
import { StateSchema } from "./storage.js";

export const LEGACY_BACKUP_SUFFIX = ".pre-v3.bak";

/** Resolve the three retired plugin files without leaking path logic to Host wiring. */
export function legacyUsageStatsPaths(home = process.env.DSH_HOME ?? join(homedir(), ".dsh")) {
	const storageRoot = join(home, "storages");
	return {
		settings: join(storageRoot, "usage-settings.json"),
		limits: join(storageRoot, "usage-limits.json"),
		cache: join(storageRoot, "usage-stats-cache.json")
	};
}

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

function isMissing(error) {
	return error !== null && typeof error === "object" && error.code === "ENOENT";
}

function objectOf(value, label) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
	return value;
}

function assertKnownFields(value, label, fields) {
	for (const field of Object.keys(value)) if (!fields.includes(field)) throw new Error(`${label} contains unknown field: ${field}`);
}

function validateLegacyNotifications(value, strict) {
	const notifications = objectOf(value, "legacy settings notifications");
	if (strict) assertKnownFields(notifications, "legacy settings notifications", ["channels", "events", "planQuota", "cooldownMs"]);
	if (notifications.channels !== void 0) {
		const channels = objectOf(notifications.channels, "legacy settings notifications.channels");
		if (strict) assertKnownFields(channels, "legacy settings notifications.channels", ["sidebar", "toast"]);
	}
	if (notifications.events !== void 0) {
		const events = objectOf(notifications.events, "legacy settings notifications.events");
		if (strict) assertKnownFields(events, "legacy settings notifications.events", ["warning", "exceeded", "lowBalance", "recovery"]);
	}
	if (notifications.planQuota !== void 0) {
		const quota = objectOf(notifications.planQuota, "legacy settings notifications.planQuota");
		if (strict) assertKnownFields(quota, "legacy settings notifications.planQuota", ["warningRemainingPercent", "criticalRemainingPercent", "windows"]);
		if (quota.windows !== void 0) {
			const windows = objectOf(quota.windows, "legacy settings notifications.planQuota.windows");
			if (strict) assertKnownFields(windows, "legacy settings notifications.planQuota.windows", ["five_hour", "weekly"]);
			for (const key of ["five_hour", "weekly"]) if (windows[key] !== void 0) {
				const window = objectOf(windows[key], `legacy settings notifications.planQuota.windows.${key}`);
				if (strict) assertKnownFields(window, `legacy settings notifications.planQuota.windows.${key}`, ["warningRemainingPercent", "criticalRemainingPercent"]);
			}
		}
	}
	return structuredClone(notifications);
}

function tokenBuckets(raw, label = "token buckets") {
	objectOf(raw, label);
	const number = (value, field) => {
		if (value === void 0) return 0;
		if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label}.${field} must be a non-negative safe integer`);
		return value;
	};
	return {
		inputTokens: number(raw.inputTokens, "inputTokens"),
		outputTokens: number(raw.outputTokens, "outputTokens"),
		cacheReadTokens: number(raw.cacheReadTokens, "cacheReadTokens"),
		cacheWriteTokens: number(raw.cacheWriteTokens, "cacheWriteTokens")
	};
}

function addBuckets(target, source) {
	for (const key of ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"]) target[key] += Number(source?.[key]) || 0;
}

function mergeLegacyDays(target, rawDays) {
	objectOf(rawDays, "legacy days");
	for (const [date, rawDay] of Object.entries(rawDays)) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`legacy day key is invalid: ${date}`);
		objectOf(rawDay, `legacy day ${date}`);
		let day = target[date];
		if (day === void 0) {
			day = { totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, models: {}, hours: {} };
			target[date] = day;
		}
		addBuckets(day.totals, tokenBuckets(rawDay.totals, `legacy day ${date}.totals`));
		for (const [model, rawBuckets] of Object.entries(objectOf(rawDay.models, `legacy day ${date}.models`))) {
			if (model === "") throw new Error(`legacy day ${date} has an empty model key`);
			day.models[model] ??= { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
			addBuckets(day.models[model], tokenBuckets(rawBuckets, `legacy day ${date}.models.${model}`));
		}
		for (const [hour, rawHour] of Object.entries(objectOf(rawDay.hours, `legacy day ${date}.hours`))) {
			if (!/^(?:[0-9]|1\d|2[0-3])$/.test(String(hour))) throw new Error(`legacy hour key is invalid: ${date}/${hour}`);
			day.hours[hour] ??= {};
			const rawModels = rawHour?.models ?? rawHour;
			for (const [model, rawBuckets] of Object.entries(objectOf(rawModels, `legacy day ${date}.hours.${hour}`))) {
				if (model === "") throw new Error(`legacy hour ${date}/${hour} has an empty model key`);
				day.hours[hour][model] ??= { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
				addBuckets(day.hours[hour][model], tokenBuckets(rawBuckets, `legacy day ${date}.hours.${hour}.${model}`));
			}
		}
	}
	return target;
}

function legacyCnyToNanos(value) {
	if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new Error("legacy ledger costCny must be null or a non-negative finite number");
	return BigInt(Math.round(Number(value) * 1e9)).toString();
}

function normalizedLegacyEntry(raw) {
	objectOf(raw, "legacy ledger entry");
	if (!Number.isFinite(raw.occurredAt) || raw.occurredAt < 0) throw new Error("legacy ledger occurredAt must be a non-negative finite number");
	if (typeof raw.provider !== "string" || raw.provider === "") throw new Error("legacy ledger provider must be a non-empty string");
	if (typeof raw.model !== "string" || raw.model === "") throw new Error("legacy ledger model must be a non-empty string");
	if (raw.completedAt !== void 0 && (!Number.isFinite(raw.completedAt) || raw.completedAt <= 0)) throw new Error("legacy ledger completedAt must be a positive finite number");
	for (const field of ["turn", "step"]) if (raw[field] !== void 0 && (!Number.isInteger(raw[field]) || raw[field] < 0)) throw new Error(`legacy ledger ${field} must be a non-negative integer`);
	for (const field of ["id", "sampleKey", "pricingVersion"]) if (raw[field] !== void 0 && (typeof raw[field] !== "string" || raw[field] === "")) throw new Error(`legacy ledger ${field} must be a non-empty string`);
	return {
		...(typeof raw.id === "string" && raw.id !== "" ? { id: raw.id } : {}),
		occurredAt: raw.occurredAt,
		...(raw.completedAt === void 0 ? {} : { completedAt: raw.completedAt }),
		provider: raw.provider,
		model: raw.model,
		...(Number.isInteger(raw.turn) && raw.turn >= 0 ? { turn: raw.turn } : {}),
		...(Number.isInteger(raw.step) && raw.step >= 0 ? { step: raw.step } : {}),
		...(typeof raw.sampleKey === "string" && raw.sampleKey !== "" ? { sampleKey: raw.sampleKey } : {}),
		usage: tokenBuckets(raw.usage, "legacy ledger usage"),
		...(typeof raw.pricingVersion === "string" && raw.pricingVersion !== "" ? { pricingVersion: raw.pricingVersion } : {})
	};
}

/** Convert a v1/v2 cache document into a fully validated v3 state. */
export function migrateLegacyCacheToV3(raw, options = {}) {
	objectOf(raw, "legacy cache");
	const version = Number(raw.version);
	if (version !== 1 && version !== 2) throw new Error(`unsupported legacy cache version: ${String(raw.version)}`);
	let state = createLedgerState({
		migration: {
			legacyCacheImported: true,
			legacyCacheSha256: typeof options.sourceSha256 === "string" ? options.sourceSha256 : "",
			migratedAt: Number.isFinite(Number(options.migratedAt)) ? Number(options.migratedAt) : Date.now()
		}
	});
	if (version === 1) {
		const days = {};
		for (const [sessionId, session] of Object.entries(objectOf(raw.sessions, "legacy cache sessions"))) {
			objectOf(session, `legacy cache session ${sessionId}`);
			mergeLegacyDays(days, objectOf(session.days, `legacy cache session ${sessionId}.days`));
		}
		state.archive.estimated.importedLegacy = { days };
		return StateSchema.parse(state);
	}

	if (raw.legacy !== null && raw.legacy !== void 0) {
		const legacy = objectOf(raw.legacy, "legacy cache legacy");
		const days = mergeLegacyDays({}, objectOf(legacy.days ?? {}, "legacy cache legacy.days"));
		if (legacy.updatedAt !== void 0 && (!Number.isFinite(legacy.updatedAt) || legacy.updatedAt < 0)) throw new Error("legacy cache legacy.updatedAt must be a non-negative finite number");
		if (legacy.foldedCount !== void 0 && (!Number.isSafeInteger(legacy.foldedCount) || legacy.foldedCount < 0)) throw new Error("legacy cache legacy.foldedCount must be a non-negative safe integer");
		state.archive.estimated.importedLegacy = {
			days,
			...(legacy.updatedAt === void 0 ? {} : { updatedAt: legacy.updatedAt }),
			...(legacy.foldedCount === void 0 ? {} : { foldedCount: legacy.foldedCount })
		};
	}
	if (!Array.isArray(raw.ledger)) throw new Error("legacy cache ledger must be an array");
	const estimated = [];
	for (const rawEntry of raw.ledger) {
		const entry = normalizedLegacyEntry(rawEntry);
		if (!isOfficialBillingProvider(entry.provider)) {
			entry.costState = "not-billable";
		} else if (Object.hasOwn(rawEntry, "costCny")) {
			if (rawEntry.costCny === null) entry.costState = "unpriced";
			else {
				entry.costState = "priced";
				entry.costNanosCny = legacyCnyToNanos(rawEntry.costCny);
			}
		} else {
			estimated.push(entry);
			continue;
		}
		state = recordLedgerState(state, entry, {
			maxLedgerEntries: options.maxLedgerEntries ?? 5000,
			recentSampleKeyCapacity: options.recentSampleKeyCapacity
		});
	}
	state.archive.estimated.unfrozenLedger = estimated.length > 0 ? estimated : null;
	return StateSchema.parse(state);
}

const LIMIT_RULE_FIELDS = new Set([
	"enabled", "period", "dailyCostLimit", "monthlyCostLimit", "lowBalanceWarning",
	"minBalance", "alertPercent", "criticalPercent", "stopOnExceed", "notificationCooldownMs"
]);

function normalizedLimitRule(raw, legacy, label = "legacy limit rule") {
	objectOf(raw, label);
	if (!legacy) for (const field of Object.keys(raw)) {
		if (!LIMIT_RULE_FIELDS.has(field)) throw new Error(`${label} contains unknown field: ${field}`);
	}
	const boolean = (field, fallback) => {
		if (raw[field] === void 0) return fallback;
		if (typeof raw[field] !== "boolean") throw new Error(`${label}.${field} must be a boolean`);
		return raw[field];
	};
	const numberOrNull = (field, fallback = null, minimum = 0) => {
		const value = raw[field];
		if (value === void 0) return fallback;
		if (value === null) return null;
		if (!Number.isFinite(value) || value < minimum) throw new Error(`${label}.${field} must be null or a finite number >= ${minimum}`);
		return value;
	};
	const alertPercent = Math.round(numberOrNull("alertPercent", 80, 1));
	const criticalPercent = Math.round(numberOrNull("criticalPercent", 90, 1));
	const minBalance = numberOrNull("minBalance");
	const stopOnExceed = boolean("stopOnExceed", false);
	if (!legacy && raw.period !== void 0 && raw.period !== "daily" && raw.period !== "monthly") throw new Error(`${label}.period must be daily or monthly`);
	return {
		enabled: boolean("enabled", false),
		dailyCostLimit: numberOrNull("dailyCostLimit"),
		monthlyCostLimit: numberOrNull("monthlyCostLimit"),
		minBalance: legacy ? null : minBalance,
		lowBalanceWarning: numberOrNull("lowBalanceWarning"),
		alertPercent: Math.min(100, alertPercent),
		criticalPercent: Math.max(Math.min(100, criticalPercent), Math.min(100, alertPercent)),
		period: raw.period === "monthly" ? "monthly" : "daily",
		stopOnExceed: legacy ? false : stopOnExceed,
		notificationCooldownMs: Math.min(7 * 86400000, numberOrNull("notificationCooldownMs", 30 * 60 * 1000))
	};
}

/** Convert the two retired settings files into one official namespace patch. */
export function migrateLegacySettingsToV3(rawSettings, rawLimits, options = {}) {
	const settings = rawSettings === null || rawSettings === void 0 ? {} : objectOf(rawSettings, "legacy settings");
	const settingsVersion = settings.version === void 0 ? 1 : Number(settings.version);
	if (settingsVersion !== 1 && settingsVersion !== 2) throw new Error(`unsupported legacy settings version: ${String(settings.version)}`);
	const limitsSource = rawLimits === null || rawLimits === void 0 ? {} : objectOf(rawLimits, "legacy limits");
	const limitsVersion = limitsSource.version === void 0 ? 1 : Number(limitsSource.version);
	if (limitsVersion !== 1 && limitsVersion !== 2) throw new Error(`unsupported legacy limits version: ${String(limitsSource.version)}`);
	if (settingsVersion === 2) {
		const fields = new Set(["version", "defaultProviderId", "visibleProviderIds", "refreshMs", "display", "conversation", "pricing", "maxLedgerEntries", "notifications"]);
		for (const field of Object.keys(settings)) if (!fields.has(field)) throw new Error(`legacy settings contains unknown field: ${field}`);
	}
	if (limitsVersion === 2) for (const field of Object.keys(limitsSource)) {
		if (!["version", "global", "keys"].includes(field)) throw new Error(`legacy limits contains unknown field: ${field}`);
	}
	const patch = {};
	if (settings.defaultProviderId !== void 0) {
		if (typeof settings.defaultProviderId !== "string" || settings.defaultProviderId.trim() === "") throw new Error("legacy settings defaultProviderId must be a non-empty string");
		patch.defaultProviderId = settings.defaultProviderId.trim();
	}
	if (settings.visibleProviderIds !== void 0) {
		if (!Array.isArray(settings.visibleProviderIds) || settings.visibleProviderIds.length > 3
			|| settings.visibleProviderIds.some((value) => typeof value !== "string" || value.trim() === "")) {
			throw new Error("legacy settings visibleProviderIds must contain at most three non-empty strings");
		}
		patch.visibleProviderIds = settings.visibleProviderIds.map((value) => value.trim());
		if (new Set(patch.visibleProviderIds).size !== patch.visibleProviderIds.length) throw new Error("legacy settings visibleProviderIds must not contain duplicates");
	}
	if (settings.refreshMs !== void 0) {
		if (settings.refreshMs !== null && (!Number.isFinite(settings.refreshMs) || settings.refreshMs < 5000)) throw new Error("legacy settings refreshMs must be null or a finite number >= 5000");
		patch.refreshMs = settings.refreshMs;
	}
	const validateBooleanFields = (value, label, fields) => {
		objectOf(value, label);
		if (settingsVersion === 2) assertKnownFields(value, label, fields);
		for (const field of fields) if (value[field] !== void 0 && typeof value[field] !== "boolean") throw new Error(`${label}.${field} must be a boolean`);
	};
	if (settings.display !== void 0) {
		validateBooleanFields(settings.display, "legacy settings display", ["balance", "todayCost", "statusDot"]);
		patch.display = { balance: settings.display.balance !== false, todayCost: settings.display.todayCost !== false, statusDot: settings.display.statusDot !== false };
	}
	if (settings.conversation !== void 0) {
		validateBooleanFields(settings.conversation, "legacy settings conversation", ["enabled", "showTokenUsage", "showSessionTokenUsage"]);
		patch.conversation = {
			enabled: settings.conversation.enabled !== false,
			showTokenUsage: settings.conversation.showTokenUsage === true,
			showSessionTokenUsage: settings.conversation.showSessionTokenUsage === true
		};
	}
	if (settings.pricing !== null && settings.pricing !== void 0) {
		objectOf(settings.pricing, "legacy settings pricing");
		validatePricingInput(settings.pricing);
		patch.pricing = normalizePricing(settings.pricing);
	}
	if (settings.maxLedgerEntries !== void 0 && settings.maxLedgerEntries !== null) {
		if (!Number.isSafeInteger(settings.maxLedgerEntries) || settings.maxLedgerEntries < 100 || settings.maxLedgerEntries > 5000) throw new Error("legacy settings maxLedgerEntries must be an integer from 100 to 5000");
		patch.maxLedgerEntries = settings.maxLedgerEntries;
	}
	if (settings.notifications !== void 0) patch.notifications = validateLegacyNotifications(settings.notifications, settingsVersion === 2);
	const legacyLimits = limitsVersion !== 2;
	const keys = {};
	for (const [key, rule] of Object.entries(objectOf(limitsSource.keys ?? {}, "legacy limits keys"))) {
		if (key.trim() === "") throw new Error("legacy limits key must be non-empty");
		if (Object.hasOwn(keys, key.trim())) throw new Error(`legacy limits contains duplicate normalized key: ${key.trim()}`);
		keys[key.trim()] = normalizedLimitRule(rule, legacyLimits, `legacy limits keys.${key}`);
	}
	return {
		settingsPatch: patch,
		limits: { version: 2, global: normalizedLimitRule(limitsSource.global ?? {}, legacyLimits, "legacy limits global"), keys },
		migration: {
			legacySettingsImported: true,
			legacySettingsSha256: typeof options.settingsSha256 === "string" ? options.settingsSha256 : "",
			legacyLimitsSha256: typeof options.limitsSha256 === "string" ? options.limitsSha256 : ""
		}
	};
}

/**
 * Create the fixed legacy backup once. An existing backup is accepted only
 * while it is byte-for-byte the same as the source, preventing a later file
 * from being silently imported under an earlier migration identity.
 */
export async function backupLegacyFile(sourcePath) {
	const backupPath = `${sourcePath}${LEGACY_BACKUP_SUFFIX}`;
	let source;
	try {
		source = await readFile(sourcePath);
	} catch (error) {
		if (!isMissing(error)) throw error;
		try {
			const backup = await readFile(backupPath);
			return { sourcePath, backupPath, sha256: sha256(backup), bytes: backup.byteLength };
		} catch (backupError) {
			if (isMissing(backupError)) return null;
			throw backupError;
		}
	}
	try {
		await copyFile(sourcePath, backupPath, constants.COPYFILE_EXCL);
	} catch (error) {
		if (error?.code !== "EEXIST") throw error;
	}
	const [currentSource, backup] = await Promise.all([readFile(sourcePath), readFile(backupPath)]);
	const sourceHash = sha256(currentSource);
	const backupHash = sha256(backup);
	if (sourceHash !== backupHash) {
		throw new Error(`legacy backup conflict for ${sourcePath}: source sha256 ${sourceHash} != backup sha256 ${backupHash}`);
	}
	// The first read detects an in-flight source replacement that happened
	// before copyFile but after discovery. Treat it as a conflict as well.
	if (sha256(source) !== sourceHash) {
		throw new Error(`legacy backup conflict for ${sourcePath}: source changed while backup was created`);
	}
	return { sourcePath, backupPath, sha256: backupHash, bytes: backup.byteLength };
}

/** Back up and parse one legacy JSON object. Missing files are not errors. */
export async function prepareLegacyJson(sourcePath) {
	const backup = await backupLegacyFile(sourcePath);
	if (backup === null) return null;
	const raw = await readFile(backup.backupPath, "utf8");
	let value;
	try {
		value = JSON.parse(raw);
	} catch (error) {
		throw new Error(`invalid legacy JSON in ${backup.backupPath}: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`invalid legacy JSON in ${backup.backupPath}: root must be an object`);
	}
	return { ...backup, value };
}

async function phaseComplete(phase, label) {
	if (phase === null || typeof phase !== "object" || typeof phase.isComplete !== "function" || typeof phase.commit !== "function") {
		throw new TypeError(`${label} migration requires isComplete and commit callbacks`);
	}
	return Boolean(await phase.isComplete());
}

/**
 * Prepare legacy inputs and hand each group to one caller-owned atomic commit.
 * Idempotency is anchored in official settings/storage markers queried by
 * `isComplete`; the corresponding `commit` must save imported values and its
 * marker in the same official write.
 */
export async function initializeLegacyMigrations(options) {
	const paths = options?.paths ?? {};
	const result = { settings: "skipped", storage: "skipped" };
	if (!await phaseComplete(options?.settings, "settings")) {
		const [settings, limits] = await Promise.all([
			prepareLegacyJson(paths.settings),
			prepareLegacyJson(paths.limits)
		]);
		await options.settings.commit({ settings, limits });
		result.settings = "migrated";
	}
	if (!await phaseComplete(options?.storage, "storage")) {
		const cache = await prepareLegacyJson(paths.cache);
		await options.storage.commit({ cache });
		result.storage = "migrated";
	}
	return result;
}
