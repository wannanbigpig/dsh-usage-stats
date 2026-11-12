import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.env.DSH_BENCH_LIB_ROOT ?? fileURLToPath(new URL("../lib/", import.meta.url));
const { createLedgerState, foldFrozenLedgerEntries, recordLedgerState } = await import(pathToFileURL(resolve(root, "ledger.js")));
const { openUsageStatsStorage, usageStatsDomainSpec } = await import(pathToFileURL(resolve(root, "storage.js")));
const start = Date.parse("2025-01-01T10:00:00+08:00");
const call = (id, occurredAt, model = "model") => ({ id, occurredAt, completedAt: occurredAt, provider: "fixture", model, usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 }, costState: "not-billable" });
for (const days of [90, 365]) {
 const entries = [];
 for (let day = 0; day < days; day++) for (let model = 0; model < 8; model++) for (let hour = 0; hour < 9; hour++) entries.push(call(`a-${day}-${model}-${hour}`, start + day * 86400000 + hour * 3600000, `model-${model}`));
 const archive = foldFrozenLedgerEntries(entries);
 const ledger = Array.from({ length: 5000 }, (_, i) => call(`l-${i}`, start + 400 * 86400000 + i));
 const state = createLedgerState({ ledger, archive: { frozen: archive } });
 const append = call("next", start + 500 * 86400000);
 for (let i = 0; i < 3; i++) recordLedgerState(state, append);
 const times = [];
 for (let i = 0; i < 12; i++) {
  const before = performance.now();
  recordLedgerState(state, append);
  times.push(performance.now() - before);
 }
 times.sort((a, b) => a - b);
 const tables = new Map(['ledger', 'frozen'].map(name => [name, new Map()]));
 let global = structuredClone(usageStatsDomainSpec.global.initial);
 const domain = {
  global: { get: () => global, set: async value => { global = value; } },
  table: name => {
   const rows = tables.get(name);
   return { get: key => rows.get(key), entries: () => rows.entries(), keys: () => rows.keys(), get size() { return rows.size; }, put: async (key, value) => { rows.set(key, value); }, delete: async key => rows.delete(key) };
  },
  close: async () => {}
 };
 const repository = await openUsageStatsStorage({ storageDomain: { open: async spec => spec.version === 1 ? { table: () => ({ get: () => undefined }), close: async () => {} } : domain } }, { initialState: state });
 const repositoryTimes = [];
 for (let i = 0; i < 15; i++) {
  const entry = { ...append, id: `repository-${i}` };
  const before = performance.now();
  if (repository.record) await repository.record(entry);
  else await repository.update(current => recordLedgerState(current, entry));
  if (i >= 3) repositoryTimes.push(performance.now() - before);
 }
 repositoryTimes.sort((a, b) => a - b);
 console.log(JSON.stringify({ days, archiveBytes: Buffer.byteLength(JSON.stringify(archive)), medianAppendMs: +times[6].toFixed(3), medianMemoryRepositoryMs: +repositoryTimes[6].toFixed(3) }));
 await repository.close();
}
