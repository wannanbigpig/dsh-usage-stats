/**
 * 一次性恢复工具：把会话日志（事件时间 = 完成时间口径，单次计费）折叠进
 * legacy 快照，恢复"账本切换过渡期"被清洗掉的历史用量（如某天 0 点至账本
 * 生效前的请求）。只在缓存缺失该日期时补充，不覆盖已有 legacy 数据。
 *
 * 用法（必须先停止 dsh web，避免运行实例用内存缓存覆盖本脚本写入的文件）：
 *   node scripts/rebuild-today-legacy.mjs
 *
 * 安全：写入前备份原缓存为 usage-stats-cache.json.bak-<时间戳>；损坏时可用
 * 备份恢复。不读取任何凭据。
 */
import { execSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { foldUsage } from "../lib/usage.js";

const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
const cachePath = join(home, "storages", "usage-stats-cache.json");
const sessionsRoot = join(home, "sessions");

if (!existsSync(cachePath)) {
  console.error("缓存不存在:", cachePath);
  process.exit(1);
}

// 1) 折叠所有会话日志（事件时间 = 完成时间口径）
const byDay = new Map();
const logFiles = [];
for (const proj of readdirSync(sessionsRoot)) {
  const pdir = join(sessionsRoot, proj);
  if (!existsSync(pdir)) continue;
  for (const d of readdirSync(pdir)) {
    const f = join(pdir, d, "session.jsonl.zstd");
    if (existsSync(f)) logFiles.push(f);
  }
}
console.log("会话日志:", logFiles.length, "个");
let events = 0;
for (const f of logFiles) {
  const raw = execSync("zstd -d -c " + JSON.stringify(f), { maxBuffer: 1 << 28 }).toString("utf8");
  const sessionEvents = [];
  for (const line of raw.split("\n")) {
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    if (typeof ev?.time === "number") { sessionEvents.push(ev); events++; }
  }
  // 每个会话独立折叠（foldUsage 的替换语义是会话内的）
  const sessionDays = foldUsage(sessionEvents);
  for (const [date, entry] of sessionDays) {
    const target = byDay.get(date) ?? { totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, models: new Map(), hours: new Map() };
    target.totals.inputTokens += entry.totals.inputTokens;
    target.totals.outputTokens += entry.totals.outputTokens;
    target.totals.cacheReadTokens += entry.totals.cacheReadTokens;
    target.totals.cacheWriteTokens += entry.totals.cacheWriteTokens;
    for (const [model, b] of entry.models) {
      const t = target.models.get(model) ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      t.inputTokens += b.inputTokens; t.outputTokens += b.outputTokens; t.cacheReadTokens += b.cacheReadTokens; t.cacheWriteTokens += b.cacheWriteTokens;
      target.models.set(model, t);
    }
    for (const [hour, hourModels] of entry.hours) {
      const tHour = target.hours.get(hour) ?? new Map();
      for (const [model, b] of hourModels) {
        const t = tHour.get(model) ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
        t.inputTokens += b.inputTokens; t.outputTokens += b.outputTokens; t.cacheReadTokens += b.cacheReadTokens; t.cacheWriteTokens += b.cacheWriteTokens;
        tHour.set(model, t);
      }
      target.hours.set(hour, tHour);
    }
    byDay.set(date, target);
  }
}
console.log("读取事件:", events, "条; 折叠日期:", [...byDay.keys()].join(", "));

// 2) 合并进缓存 legacy（只补缺失日期）
const cache = JSON.parse(readFileSync(cachePath, "utf8"));
if (cache.version !== 2) {
  console.error("缓存不是 v2（账本格式），脚本只支持 v2:", cache.version);
  process.exit(1);
}
const legacyDays = cache.legacy?.days ?? {};
const missing = [...byDay.keys()].filter((date) => legacyDays[date] === void 0);
if (missing.length === 0) {
  console.log("legacy 已覆盖全部日志日期，无需恢复。");
  process.exit(0);
}
for (const date of missing) {
  const entry = byDay.get(date);
  const models = {};
  for (const [model, b] of entry.models) models[model] = { ...b };
  const hours = {};
  for (const [hour, hourModels] of entry.hours) {
    const byModel = {};
    for (const [model, b] of hourModels) byModel[model] = { ...b };
    hours[hour] = byModel;
  }
  legacyDays[date] = { totals: { ...entry.totals }, models, hours };
  console.log("补入 legacy:", date, "input=" + entry.totals.inputTokens, "output=" + entry.totals.outputTokens, "cacheRead=" + entry.totals.cacheReadTokens);
}

// 3) 备份 + 写入
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = cachePath + ".bak-" + stamp;
writeFileSync(backup, readFileSync(cachePath));
console.log("已备份:", backup);
cache.legacy = { ...cache.legacy, days: legacyDays };
mkdirSync(dirname(cachePath), { recursive: true });
const tmp = cachePath + ".tmp";
writeFileSync(tmp, JSON.stringify(cache));
renameSync(tmp, cachePath);
console.log("已写入:", cachePath);
console.log("\n下一步：启动 dsh web 后，缺失日期的用量将出现在统计中。");
