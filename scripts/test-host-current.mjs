import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run the sibling checkout through its own source resolver; no host build or writes.
const harnessRoot = process.env.DSH_HARNESS_ROOT ?? fileURLToPath(new URL('../../deepseek-harness/', import.meta.url));
if (!process.argv.includes('--source')) {
	const requireHost = createRequire(join(harnessRoot, 'package.json'));
	const child = spawnSync(process.execPath, ['--import', requireHost.resolve('tsx/esm'), fileURLToPath(import.meta.url), '--source'], {
		stdio: 'inherit', env: { ...process.env, TSX_TSCONFIG_PATH: join(harnessRoot, 'tsconfig.base.json') }
	});
	if (child.error) throw child.error;
	process.exit(child.status ?? 1);
}
const fromHost = path => import(pathToFileURL(join(harnessRoot, path)).href);
const [{ Context }, { default: Jsonl }, { SESSION_FORMAT_VERSION }, { AssistantStreamAccumulator }] = await Promise.all([
	fromHost('vendor/cordis/src/index.ts'),
	fromHost('packages/session/session-persistence-jsonl/src/index.ts'),
	fromHost('packages/core/session/src/index.ts'),
	fromHost('packages/llm/llm/src/assistant-stream.ts')
]);
const { rebuildEstimatedFromPersistence } = await import('../lib/rebuild.js');
const { openUsageStatsStorage, usageStatsDomainSpec } = await import('../lib/storage.js');
const { DomainImpl } = await fromHost('packages/storage/storage-domain/src/domain.ts');

// Use the host's real shutdown/write queue with an in-memory backend. Closing
// during the first row write must preserve the remaining rows and global slot.
async function testRepositoryDrainOnCurrentHost() {
	let releaseWrite;
	let announceWrite;
	const blocked = new Promise(resolve => { releaseWrite = resolve; });
	const entered = new Promise(resolve => { announceWrite = resolve; });
	const writes = [];
	let closeCalls = 0;
	const domain = new DomainImpl({ emit() {}, logger: { warn() {} } }, usageStatsDomainSpec, {
		async putRecord(table, key, value) {
			if (writes.length === 0) { announceWrite(); await blocked; }
			writes.push({ table, key, value });
		},
		async setGlobal(value) { writes.push({ table: 'global', value }); },
		async close() { closeCalls += 1; }
	}, new Map([['ledger', new Map()], ['frozen', new Map()]]), {
		...structuredClone(usageStatsDomainSpec.global.initial), installedAt: 1
	}, () => {});
	const repository = await openUsageStatsStorage({ storageDomain: { open: async () => domain } });
	const first = repository.update(state => ({
		...state,
		ledger: [1, 2].map(day => ({
			occurredAt: Date.parse(`2026-09-0${day}T01:00:00Z`),
			provider: 'test-provider', model: 'test-model', costState: 'unpriced',
			usage: { inputTokens: day, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
		})),
		migration: { first: true }
	}));
	const second = repository.update(state => ({ ...state, migration: { ...state.migration, second: true } }));
	await entered;
	const stopped = repository.close();
	assert.equal(repository.close(), stopped);
	await assert.rejects(repository.update(state => state), /closed/i);
	assert.equal(closeCalls, 0, 'the backend stays open while an accepted row write is pending');
	releaseWrite();
	await Promise.all([first, second, stopped]);
	assert.deepEqual(writes.map(write => write.table), ['ledger', 'ledger', 'global', 'global']);
	assert.deepEqual(writes.at(-1).value.migration, { first: true, second: true });
	assert.equal(closeCalls, 1);
	console.log('Current host storage-domain: pending row writes, queued updates, and idempotent close passed');
}

await testRepositoryDrainOnCurrentHost();
const root = await mkdtemp(join(tmpdir(), 'usage-current-host-'));
const ctx = new Context();
const time = Date.parse('2026-09-05T01:00:00Z');
const header = seq => ({ seq, time, type: 'request/header', data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } }, reason: 'initial' } });
const attempt = (seq, inputTokens) => {
	const stream = new AssistantStreamAccumulator();
	stream.push({ time, chunk: { type: 'usage', usage: { inputTokens, outputTokens: 0 } } });
	return { seq, time, type: 'assistant/attempt', data: { turn: 1, step: 1, stream: stream.snapshot() } };
};
try {
	await ctx.plugin(Jsonl, { root, compression: 'none' });
	const parent = [header(0), attempt(1, 10)];
	const child = [...parent, { seq: 2, time, type: "session/end-seed", data: { inherited: true } }, header(3), attempt(4, 7)];
	for (const [id, events, inheritedEventCount] of [['parent', parent, 0], ['child', child, 2]]) {
		const handle = await ctx.sessionPersistence.create({ id, version: SESSION_FORMAT_VERSION, createdAt: time, cwd: root, isSeeded: inheritedEventCount > 0 }, { inheritedEventCount });
		await handle.append(events);
		await handle.close();
	}
	const cache = new Map();
	const result = await rebuildEstimatedFromPersistence(ctx.sessionPersistence, {}, { cache });
	assert.equal(result.days['2026-09-05'].totals.inputTokens, 17);
	assert.equal(result.eventCount, 5);
	const second = await rebuildEstimatedFromPersistence(ctx.sessionPersistence, {}, { cache });
	assert.deepEqual(second.days, result.days);
	console.log('Current host source JSONL v' + SESSION_FORMAT_VERSION + ': fork exclusion, embedded usage, cached rebuild passed');
} finally {
	await ctx.fiber.dispose();
	await rm(root, { recursive: true, force: true });
}
