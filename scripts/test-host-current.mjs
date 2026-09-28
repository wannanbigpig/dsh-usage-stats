import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run the sibling checkout through its own source resolver; no host build or writes.
const harnessRoot = process.env.DSH_HARNESS_ROOT ?? fileURLToPath(new URL('../../deepseek-harness/', import.meta.url));
const clientSource = readFileSync(fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8');
const primitiveIndex = readFileSync(join(harnessRoot, 'packages/client/ui-primitives/src/index.ts'), 'utf8');
const primitiveIcons = readFileSync(join(harnessRoot, 'packages/client/ui-primitives/src/icons/index.tsx'), 'utf8');
const usedPrimitives = [...new Set([...clientSource.matchAll(/primitives\.([A-Za-z]\w*)/g)].map(match => match[1]))];
for (const name of usedPrimitives) {
	const exported = primitiveIndex.includes(`export { ${name}`)
		|| primitiveIndex.includes(`, ${name}`)
		|| primitiveIcons.includes(`export const ${name} =`);
	assert.ok(exported, `current host does not export the client primitive ${name}`);
}
if (!process.argv.includes('--source')) {
	const requireHost = createRequire(join(harnessRoot, 'package.json'));
	const child = spawnSync(process.execPath, ['--import', requireHost.resolve('tsx/esm'), fileURLToPath(import.meta.url), '--source'], {
		stdio: 'inherit', env: { ...process.env, TSX_TSCONFIG_PATH: join(harnessRoot, 'tsconfig.base.json') }
	});
	if (child.error) throw child.error;
	process.exit(child.status ?? 1);
}
const fromHost = path => import(pathToFileURL(join(harnessRoot, path)).href);
const hostIcons = await fromHost('packages/client/ui-primitives/src/icons/index.tsx');
for (const name of usedPrimitives.filter(name => name.startsWith('Icon'))) {
	assert.equal(typeof hostIcons[name], 'function', `current host icon ${name} is not a component`);
}
console.log(`Current host UI primitives: ${usedPrimitives.length} client imports exported`);
const [{ Context }, { default: Jsonl }, { SESSION_FORMAT_VERSION }, { AssistantStreamAccumulator }, { loadOverlayPatches, composeEntries }] = await Promise.all([
	fromHost('vendor/cordis/src/index.ts'),
	fromHost('packages/session/session-persistence-jsonl/src/index.ts'),
	fromHost('packages/core/session/src/index.ts'),
	fromHost('packages/llm/llm/src/assistant-stream.ts'),
	fromHost('packages/boot/app-boot/src/index.ts')
]);
const { rebuildEstimatedFromPersistence } = await import('../lib/rebuild.js');
const { openUsageStatsStorage, usageStatsDomainSpec } = await import('../lib/storage.js');
const { DomainImpl } = await fromHost('packages/storage/storage-domain/src/domain.ts');

const patches = ['packages/bundle/base/cordis.patch.yml', 'packages/bundle/web-app/cordis.patch.yml']
	.map(path => loadOverlayPatches('usage-stats-test', join(harnessRoot, path)));
patches.push(loadOverlayPatches('usage-stats-test', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))));
const entries = composeEntries(patches);
const connection = entries.find(entry => entry.id === 'connection');
assert.equal(connection?.name, '@deepseek-ai/dsh-client-connection');
assert.ok(connection.inject?.includes('webRuntime'));
assert.ok(connection.inject?.includes('webServer'));
assert.ok(connection.config?.trustedHosts, 'the plugin patch preserves the host Connection configuration');
assert.equal(entries.find(entry => entry.id === 'usage-stats')?.name, '@wannanbigpig/dsh-usage-stats');
console.log('Current host Web bundle: usage-stats patch composes with Connection owner and preserves configuration');

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
const attempt = (seq, inputTokens, turnNumber) => {
	const stream = new AssistantStreamAccumulator();
	stream.push({ time, chunk: { type: 'usage', usage: { inputTokens, outputTokens: 0 } } });
	return { seq, time, type: 'assistant/attempt', data: { turn: turnNumber, step: 1, stream: stream.snapshot() } };
};
const turn = (offset, inputTokens, turnNumber) => [
	{ seq: offset, time, type: 'turn/start', data: { turn: turnNumber } },
	{ seq: offset + 1, time, type: 'step/start', data: { turn: turnNumber, step: 1 } },
	header(offset + 2),
	attempt(offset + 3, inputTokens, turnNumber),
	{ seq: offset + 4, time, type: 'step/end', data: { turn: turnNumber, step: 1 } },
	{ seq: offset + 5, time, type: 'turn/end', data: { turn: turnNumber, reason: { kind: 'completed' } } }
];
try {
	await ctx.plugin(Jsonl, { root, compression: 'none' });
	const parent = turn(0, 10, 1);
	const child = [...parent, { seq: parent.length, time, type: 'session/end-seed', data: { inherited: true } }, ...turn(parent.length + 1, 7, 2)];
	for (const [id, events, inheritedEventCount] of [['parent', parent, 0], ['child', child, parent.length]]) {
		const handle = await ctx.sessionPersistence.create({ id, version: SESSION_FORMAT_VERSION, createdAt: time, cwd: root, isSeeded: inheritedEventCount > 0 }, { inheritedEventCount });
		await handle.append(events);
		await handle.close();
	}
	const cache = new Map();
	const result = await rebuildEstimatedFromPersistence(ctx.sessionPersistence, {}, { cache });
	assert.equal(result.days['2026-09-05'].totals.inputTokens, 17);
	assert.equal(result.eventCount, parent.length + 1 + 6);
	const second = await rebuildEstimatedFromPersistence(ctx.sessionPersistence, {}, { cache });
	assert.deepEqual(second.days, result.days);
	console.log('Current host source JSONL v' + SESSION_FORMAT_VERSION + ': fork exclusion, embedded usage, cached rebuild passed');
} finally {
	await ctx.fiber.dispose();
	await rm(root, { recursive: true, force: true });
}
