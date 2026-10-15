import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
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
const settingsShellSource = readFileSync(join(harnessRoot, 'packages/client/ui-settings-general/src/client/index.ts'), 'utf8');
assert.ok(settingsShellSource.includes("name: 'sidebar.settings'") && settingsShellSource.includes('store: shellStore'),
	'current host must expose its root settings store through the sidebar.settings slot');
const { createSettingsShellStore } = await fromHost('packages/client/ui-settings-general/src/client/shell-store.ts');
const settingsStore = createSettingsShellStore().create();
settingsStore.actions.openSection('usage-stats');
assert.deepEqual(settingsStore.store.getSnapshot(), { open: true, activeId: 'usage-stats' },
	'current host settings store must open the plugin section directly');
const hostIcons = await fromHost('packages/client/ui-primitives/src/icons/index.tsx');
for (const name of usedPrimitives.filter(name => name.startsWith('Icon'))) {
	assert.equal(typeof hostIcons[name], 'function', `current host icon ${name} is not a component`);
}
console.log(`Current host UI primitives: ${usedPrimitives.length} client imports exported`);
const [{ Context }, jsonlModule, { SESSION_FORMAT_VERSION }, { AssistantStreamAccumulator }, { loadOverlayPatches, composeEntries }] = await Promise.all([
	fromHost('vendor/cordis/src/index.ts'),
	fromHost('packages/session/session-persistence-jsonl/src/index.ts'),
	fromHost('packages/core/session/src/index.ts'),
	fromHost('packages/llm/llm/src/assistant-stream.ts'),
	fromHost('packages/boot/app-boot/src/index.ts')
]);
const Jsonl = jsonlModule.default ?? jsonlModule;
const { rebuildEstimatedFromPersistence } = await import('../lib/rebuild.js');
const { openUsageStatsStorage, usageStatsDomainSpec } = await import('../lib/storage.js');
const { DomainImpl } = await fromHost('packages/storage/storage-domain/src/domain.ts');
const [{ default: PluginManager }, { viewProfilePackage }, { registryPlan }] = await Promise.all([
 fromHost('packages/boot/plugin-manager/src/index.ts'),
 fromHost('packages/boot/plugin-manager/src/operations.ts'),
 fromHost('packages/boot/plugin-manager/src/registry.ts')
]);
const { createUpgradeOperations, readLatestRelease, upgradeRegistryPlan, UPGRADE_PACKAGE } = await import('../lib/upgrade.js');

async function testCurrentHostUpgradeContract() {
 const dir = await mkdtemp(join(tmpdir(), 'usage-host-upgrade-'));
 const registered = { registry: null, resolved: 'https://registry.npmjs.org/', fallbackRegistries: [] };
 const bundle = { name: UPGRADE_PACKAGE, version: '0.5.4', source: UPGRADE_PACKAGE + '@0.5.4', installed: true, availability: 'profile', enabled: true };
 const manifest = version => ({ name: UPGRADE_PACKAGE, version, dsh: { bundle: { patch: './cordis.patch.yml' } } });
 let hmr = true, pnpmCalls = 0, lastResult;
 const progress = [];
 const profile = { name: 'test', dir, installAnchor: join(dir, 'installation.json'), startedBundles: [UPGRADE_PACKAGE] };
 try {
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'review-profile', dependencies: { [UPGRADE_PACKAGE]: '0.5.4' }, dsh: { profile: { bundles: [UPGRADE_PACKAGE] } } }));
  await writeFile(profile.installAnchor, JSON.stringify({ name: 'installation', dependencies: {} }));
  const packageDir = join(dir, 'node_modules', UPGRADE_PACKAGE);
  await mkdir(packageDir, { recursive: true });
  await writeFile(join(packageDir, 'package.json'), JSON.stringify(manifest('0.5.4')));
  await writeFile(join(packageDir, 'cordis.patch.yml'), '[]');
  const actual = {
   profile, abort: new AbortController(), ownerContext: { get: name => name === 'hmr' && hmr ? {} : undefined, emit: (event, value) => { if (event === 'plugin-manager/install-state') progress.push(value); } }, packageOperations: new Set(), installedFrom: new Map(), installs: new Map(),
   registries: async () => registered, readRestoredFiles: async () => [], restoreFiles: async () => {}, configure: async fn => fn(), selectBundle: async () => {},
   async runPnpm() { pnpmCalls++; await writeFile(join(packageDir, 'package.json'), JSON.stringify(manifest('0.5.5'))); await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'review-profile', dependencies: { [UPGRADE_PACKAGE]: '0.5.5' }, dsh: { profile: { bundles: [UPGRADE_PACKAGE] } } })); return { exitCode: 0, output: '', logPath: '/fixture.log', truncated: false }; },
   async change(operation, request) { const result = { ...request, changed: false, application: hmr ? 'applied' : 'restart-required', ...hmr ? {} : { restartReason: 'no-hmr' } }; try { await operation(result); } catch (error) { result.application = 'failed'; result.error = { code: error.code ?? 'operation-error', diagnostic: error.message }; } return result; }
  };
  const manager = { listBundles: async () => [bundle], installBundle: async (...args) => (lastResult = await PluginManager.prototype.installBundle.apply(actual, args)) };
  const refused = await manager.installBundle(UPGRADE_PACKAGE + '@0.5.5', { saveExact: true });
  assert.equal(refused.error.code, 'already-installed'); assert.equal(pnpmCalls, 0);
  const upgrade = createUpgradeOperations({ getManager: () => manager, getHotReload: () => hmr, currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
  assert.equal((await upgrade['upgrade/check']()).canInstall, false);
  await assert.rejects(() => upgrade['upgrade/start']({ body: { confirm: true, version: '0.5.5' } }), /HMR/);
  assert.equal(pnpmCalls, 0);
  hmr = false;
  await upgrade['upgrade/start']({ body: { confirm: true, version: '0.5.5' } });
  for (let count = 0; count < 100 && (await upgrade['upgrade/get']()).state === 'running'; count++) await new Promise(resolve => setTimeout(resolve, 10));
  const installed = await upgrade['upgrade/get']();
  assert.equal(installed.state, 'restart-required', JSON.stringify(lastResult ?? installed));
  assert.equal(installed.restartReason, 'no-hmr'); assert.equal(pnpmCalls, 1);
  assert.deepEqual(progress.map(item => item.phase), ['installing', 'applying']);
  assert.ok(progress.every(item => item.requestId === installed.requestId));
  for (const configuration of [registered, { ...registered, resolved: null }, { ...registered, resolved: 'https://private.example/' }, { registry: 'https://registry.npmjs.org', resolved: 'https://registry.npmjs.org/', fallbackRegistries: ['https://mirror.example', 'https://mirror.example/'] }]) assert.deepEqual(upgradeRegistryPlan(configuration), registryPlan(undefined, configuration));
  console.log('Current Host upgrade contract: HMR refusal routed safely; startup-only installation and registry plans passed');
 } finally { await rm(dir, { recursive: true, force: true }); }
}

async function testCurrentHostAuthenticatedLookup() {
 const dir = await mkdtemp(join(tmpdir(), 'usage-host-registry-'));
 const manifest = { name: UPGRADE_PACKAGE, version: '0.5.5', dsh: { bundle: { patch: './cordis.patch.yml' } } };
 let authenticated = 0, unauthenticated = 0;
 const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.headers.authorization !== 'Bearer fixture-only') { unauthenticated++; response.writeHead(401); response.end('{}'); return; }
  authenticated++;
  response.end(JSON.stringify({ name: UPGRADE_PACKAGE, 'dist-tags': { latest: '0.5.5' }, versions: { '0.5.5': manifest } }));
 });
 try {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(), registry = `http://127.0.0.1:${address.port}/`;
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'lookup-fixture', private: true }));
  await writeFile(join(dir, '.npmrc'), `registry=${registry}\n//127.0.0.1:${address.port}/:_authToken=fixture-only\n`);
  const profile = { name: 'test', dir, packageManager: {
   command: process.env.DSH_TEST_PNPM_JS ? process.execPath : 'pnpm',
   args: [...process.env.DSH_TEST_PNPM_JS ? [process.env.DSH_TEST_PNPM_JS] : [], '--config.manage-package-manager-versions=false', `--config.cache-dir=${join(dir, 'cache')}`, `--config.store-dir=${join(dir, 'store')}`],
   env: { NPM_CONFIG_USERCONFIG: join(dir, '.npmrc'), COREPACK_ENABLE_PROJECT_SPEC: '0', COREPACK_ENABLE_AUTO_PIN: '0', XDG_CACHE_HOME: join(dir, 'cache') }
  } };
  const manager = { registries: async () => ({ registry: null, resolved: registry, fallbackRegistries: ['https://unreachable-public.example/'] }) };
  assert.equal(await readLatestRelease(manager, { profile, viewPackage: viewProfilePackage }, 10000), '0.5.5');
  assert.equal(await readLatestRelease(manager, { profile }, 10000), '0.5.5', 'the optional public Host operation resolves through the running Host');
  assert.ok(authenticated >= 1); assert.equal(unauthenticated, 0);
  console.log('Current Host profile lookup: real pnpm reads isolated .npmrc authentication; no install or public fallback');
 } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
}

await testCurrentHostUpgradeContract();
await testCurrentHostAuthenticatedLookup();

async function testCurrentHostAccountBalanceContract() {
	const [{ DeepSeekAccount }, { APP_IDENTITY }, { createProviderService, validateConfig }] = await Promise.all([
		fromHost('packages/credentials/deepseek-account/src/index.ts'),
		fromHost('packages/llm/llm/src/attribution.ts'),
		import('../lib/index.js')
	]);
	const context = new Context();
	let signedIn = true;
	let reads = 0;
	class HostAccount extends DeepSeekAccount {
		getState() { return Promise.resolve({ status: signedIn ? 'credential-stored' : 'signed-out', links: { usageUrl: 'https://example.test/usage', topUpUrl: 'https://example.test/top_up' }, attempt: null }); }
		getBalance(client) {
			assert.equal(client.version, APP_IDENTITY.version);
			reads++;
			return Promise.resolve({ status: 'ready', value: [{ currency: 'CNY', balance: '12.50' }, { currency: 'USD', balance: '100' }], bonusWallets: [{ currency: 'CNY', balance: '0.50' }] });
		}
	}
	try {
		await context.plugin(HostAccount);
		const bridge = {
			get(name) { return name === 'llm' ? { listProviders: () => [{ id: 'deepseek-account' }] } : context.get(name); },
			on: (...args) => context.on(...args),
			effect: (...args) => context.effect(...args)
		};
		const providers = createProviderService({ ctx: bridge, config: validateConfig({}), credentials: {}, deps: { accountClientMetadata: () => ({ version: APP_IDENTITY.version, locale: 'zh-CN', timezoneOffsetSeconds: 28800 }) } });
		const account = await providers.get('deepseek-account');
		assert.equal(account.status, 'ok');
		assert.deepEqual(account.balance, { currency: 'CNY', total: 13, granted: 0.5, toppedUp: 12.5 });
		assert.equal(reads, 1);
		signedIn = false;
		context.emit('deepseek-account/signed-out');
		assert.equal(await providers.cached('deepseek-account'), null);
		assert.equal((await providers.get('deepseek-account')).status, 'not-configured');
		assert.equal(reads, 1, 'signed-out reads never query a previous account');
		console.log('Current Host account balance: public service projection, independent currency totals, and logout invalidation passed');
	} finally { await context.fiber.dispose(); }
}
await testCurrentHostAccountBalanceContract();

async function testCurrentHostPricingCatalog() {
	const [{ default: LlmRuntime, LlmAdapter }, { configuredProviders, pricingModelsOf, validateConfig }] = await Promise.all([
		fromHost('packages/llm/llm/src/index.ts'),
		import('../lib/index.js')
	]);
	const catalogContext = new Context();
	const calls = [];
	class PricingCatalogAdapter extends LlmAdapter {
		async * stream() {}
		providerInfo(provider) { return { id: provider, name: provider === 'custom-api' ? 'Custom API' : provider }; }
		async listModels(provider) { calls.push(provider); return [{ provider, id: 'vendor/model-v2', name: 'Model v2', description: 'Configured model' }]; }
	}
	try {
		await catalogContext.plugin(LlmRuntime);
		catalogContext.llm.registerAdapter(['custom-api', 'unused-api', 'zai', 'deepseek-account'], new PricingCatalogAdapter());
		catalogContext.llm.registerConfigurableProviders(['custom-api', 'unused-api', 'zai', 'deepseek-account'].map(provider => ({
			provider, displayName: provider === 'custom-api' ? 'Custom API' : provider, settingsNs: 'catalog-fixture', settingsPath: ['providers', provider]
		})));
		const profile = { providers: {
			'custom-api': { apiKeyEnv: 'CUSTOM_API_KEY', baseURL: 'https://gateway.example/v1', headers: { authorization: 'fixture-secret' } },
			zai: { apiKeyEnv: 'ZAI_API_KEY' },
			'deepseek-account': { account: 'fixture-secret' }
		} };
		const bridge = {
			llm: catalogContext.llm,
			settings: { get: ns => ns === 'catalog-fixture' ? profile : undefined },
			credentials: { resolve: async () => ({ value: 'fixture-secret' }) },
			get(name) { return this[name]; }
		};
		const providers = await configuredProviders(bridge, validateConfig({}));
		const directory = await pricingModelsOf(bridge, providers);
		assert.deepEqual(directory.providers, [{ id: 'deepseek-official', label: 'DeepSeek' }, { id: 'custom-api', label: 'Custom API' }]);
		assert.deepEqual(calls, [], 'directory reads must not fetch every provider catalog');
		const selected = await pricingModelsOf(bridge, providers, 'custom-api');
		assert.deepEqual(calls, ['custom-api']);
		assert.deepEqual(selected.models, [{ id: 'vendor/model-v2', name: 'Model v2' }]);
		assert.equal(JSON.stringify(selected).includes('fixture-secret'), false);
		assert.equal(JSON.stringify(selected).includes('apiKeyEnv'), false);
		assert.equal(profile.providers['custom-api'].apiKeyEnv, 'CUSTOM_API_KEY', 'pricing discovery never edits Host model settings');
		console.log('Current Host pricing catalog: configured direct routes, selected-only model lookup, and credential-free metadata passed');
	} finally { await catalogContext.fiber.dispose(); }
}

await testCurrentHostPricingCatalog();


const patches = ['packages/bundle/base/cordis.patch.yml', 'packages/bundle/web-app/cordis.patch.yml']
	.map(path => loadOverlayPatches('usage-stats-test', join(harnessRoot, path)));
patches.push(loadOverlayPatches('usage-stats-test', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))));
const entries = composeEntries(patches);
const connection = entries.find(entry => entry.id === 'connection');
assert.equal(connection?.name, '@deepseek-ai/dsh-client-connection');
assert.ok(connection.inject?.includes('webStartup'));
assert.ok(connection.inject?.includes('webServer'));
const trustedHosts = connection.config?.trustedHosts;
assert.ok(trustedHosts, 'the plugin patch preserves the host Connection configuration');
const trustedHostsExpr = typeof trustedHosts === 'string' ? trustedHosts : trustedHosts?.__jsExpr ?? '';
assert.match(trustedHostsExpr, /webRuntime/, 'trustedHosts keeps the legacy bind/trust service readable');
assert.match(trustedHostsExpr, /webStartup/, 'trustedHosts falls back to the current bind/trust service');
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
