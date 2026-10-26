import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUpgradeOperations, newerRelease, readLatestRelease, installSourceType, manualUpgradeCommand, UPGRADE_PACKAGE } from '../lib/upgrade.js';

const desktopRuntime = { platform: 'darwin' };
const desktopProfile = { name: 'desktop', home: '/test home', dir: '/test home/profiles/desktop' };
assert.equal(manualUpgradeCommand(desktopProfile, '0.6.4', desktopRuntime),
 "dsh plugin --profile desktop add --save-exact @wannanbigpig/dsh-usage-stats@0.6.4");
const quotedCommand = manualUpgradeCommand({ ...desktopProfile, home: "/test owner's home", name: "team's work" }, '0.6.4', desktopRuntime);
assert.ok(quotedCommand.includes("--profile 'team'\\''s work'"));
assert.equal(manualUpgradeCommand(desktopProfile, '0.6.4; echo bad', desktopRuntime), null);
assert.equal(manualUpgradeCommand(null, '0.6.4', desktopRuntime), null);
assert.equal(manualUpgradeCommand(desktopProfile, '0.6.4', { platform: 'win32' }), null, 'POSIX shell quoting must not be shown on Windows');
assert.equal(manualUpgradeCommand({ name: 'web' }, '0.6.4', { platform: 'linux' }),
 "dsh plugin --profile web add --save-exact @wannanbigpig/dsh-usage-stats@0.6.4");

assert.equal(newerRelease('0.6.0', '0.5.4'), true);
assert.equal(newerRelease('0.5.4', '0.5.4'), false);
assert.equal(newerRelease('0.5.3', '0.5.4'), false);
assert.equal(newerRelease('0.6.0-beta.1', '0.5.4'), false);
const profile = { name: 'test', dir: '/profile', packageManager: { command: '/runtime/pnpm', args: ['--managed'], env: { HTTPS_PROXY: 'http://proxy.example' } } };
const manifest = { name: UPGRADE_PACKAGE, version: '0.5.5' };
const answer = value => ({ exitCode: 0, stdout: JSON.stringify(value), stderr: '', timedOut: false });
const configured = { registry: 'https://registry.npmjs.org/', resolved: 'https://registry.npmjs.org/', fallbackRegistries: ['https://mirror.example/', 'https://mirror.example'] };
const registryManager = { registries: async () => configured };
let lookedUp;
assert.equal(await readLatestRelease(registryManager, { profile, viewPackage: async (...args) => { lookedUp = args; return answer(manifest); } }), '0.5.5');
assert.equal(lookedUp[0], profile.dir);
assert.equal(lookedUp[1], UPGRADE_PACKAGE + '@latest');
assert.equal(lookedUp[2].command, profile.packageManager.command);
assert.deepEqual(lookedUp[2].env, profile.packageManager.env, 'queries use the profile package-manager environment');
assert.deepEqual(lookedUp[2].fields, ['name', 'version', 'description', 'dsh'], 'the Host profile lookup names the printed fields');
await assert.rejects(() => readLatestRelease(registryManager, { viewPackage: async () => answer(manifest) }), /profile/i);
for (const metadata of [{ name: 'other-package', version: '0.5.5' }, { name: UPGRADE_PACKAGE, version: '0.5.5; shell' }]) {
 await assert.rejects(() => readLatestRelease(registryManager, { profile, viewPackage: async () => answer(metadata) }), /Invalid/);
}
for (const [manager, viewPackage] of [
 [{ registries: () => new Promise(() => {}) }, async () => { throw new Error('must not query'); }],
 [registryManager, () => new Promise(() => {})]
]) await assert.rejects(() => readLatestRelease(manager, { profile, viewPackage }, 20), /timed out/);
for (const [source, expected] of [
 ['^0.5.4', 'registry'], ['link:../plugin', 'local'], ['file:../plugin.tgz', 'archive'],
 [`${UPGRADE_PACKAGE}@0.5.x`, 'registry'], [`${UPGRADE_PACKAGE}@>=0.5.0 <1.0.0`, 'registry'],
 [`${UPGRADE_PACKAGE}@*`, 'registry'], [`${UPGRADE_PACKAGE}@next`, 'registry'],
 [`${UPGRADE_PACKAGE}@npm:other-package@1.0.0`, 'unknown'], ['git://example.com/plugin', 'git'],
 ['https://github.com/example/plugin', 'git'], ['https://github.com/example/plugin/archive/v1.tar.gz', 'archive']
]) assert.equal(installSourceType(source), expected);
const requests = [];
assert.equal(await readLatestRelease(registryManager, { profile, viewPackage: async (_dir, _spec, options) => {
 requests.push(options.registry);
 return requests.length === 1 ? { exitCode: 1, stderr: 'ERR_PNPM_META_FETCH_FAIL ECONNRESET', stdout: '' } : answer(manifest);
} }), '0.5.5');
assert.equal(requests.length, 2, 'transport failures use one unique fallback');
const slowRequests = [];
assert.equal(await readLatestRelease(registryManager, { profile, viewPackage: async (_dir, _spec, options) => {
 slowRequests.push(options.registry); return slowRequests.length === 1 ? new Promise(() => {}) : answer(manifest);
} }, 200), '0.5.5', 'a hung primary leaves budget for a mirror');
for (const code of ['ERR_PNPM_FETCH_401', 'ERR_PNPM_FETCH_403']) {
 let attempts = 0;
 await assert.rejects(() => readLatestRelease(registryManager, { profile, viewPackage: async () => { attempts++; return { exitCode: 1, stderr: code + ' [fixture diagnostic]', stdout: '' }; } }), /authentication/i);
 assert.equal(attempts, 1);
}
let invalidAttempts = 0;
await assert.rejects(() => readLatestRelease(registryManager, { profile, viewPackage: async () => { invalidAttempts++; return answer({ name: 'other', version: '0.5.5' }); } }), /Invalid/);
assert.equal(invalidAttempts, 1);
for (const resolved of [null, 'https://private.example/']) {
 let attempts = 0;
 const own = { registries: async () => ({ ...configured, registry: null, resolved }) };
 await assert.rejects(() => readLatestRelease(own, { profile, viewPackage: async (_dir, _spec, options) => {
  attempts++; assert.equal(options.registry, null, 'pnpm resolves its own profile registry and scoped auth');
  return { exitCode: 1, stderr: 'ECONNRESET', stdout: '' };
 } }), /lookup/i);
 assert.equal(attempts, 1, 'private or unknown own source cannot become a public source');
}
const bundle = { name: '@wannanbigpig/dsh-usage-stats', version: '0.5.4', source: '@wannanbigpig/dsh-usage-stats@^0.5.4', installed: true, availability: 'profile', enabled: true };
let installs = 0, settle;
const manager = { listBundles: async () => [bundle], installBundle: async (spec, options) => {
  installs++;
  assert.equal(spec, '@wannanbigpig/dsh-usage-stats@0.5.5');
  assert.equal(options.enabled, true);
  assert.equal(options.saveExact, true);
  assert.match(options.requestId, /^[0-9a-f-]{36}$/);
  return new Promise(resolve => { settle = resolve; });
} };
// Desktop 0.2.0-rc.2 owns profile packages without exposing availability/source.
const legacyDir = await mkdtemp(join(tmpdir(), 'usage-legacy-upgrade-'));
try {
 const legacyBundle = { name: UPGRADE_PACKAGE, version: '0.5.4', enabled: true, installed: true, removable: true, rows: [], overrides: [] };
 const legacyManager = metadata => ({ ...manager, listBundles: async () => [metadata] });
 const legacyOps = metadata => createUpgradeOperations({ getManager: () => legacyManager(metadata), getProfile: () => ({ dir: legacyDir }), currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
 const saveSource = source => writeFile(join(legacyDir, 'package.json'), JSON.stringify({ private: true, dependencies: { [UPGRADE_PACKAGE]: source } }));
 await saveSource('^0.5.4');
 const legacyStatus = await legacyOps(legacyBundle)['upgrade/check']();
 assert.equal(legacyStatus.available, true, 'an npm update remains visible with actual old Desktop metadata');
 assert.equal(legacyStatus.sourceType, 'registry');
 for (const source of ['link:/my/plugin', 'file:../plugin', 'github:example/plugin#v1', 'file:../plugin.tgz', 'npm:other-package@1.0.0']) {
  await saveSource(source);
  const status = await legacyOps(legacyBundle)['upgrade/check']();
  assert.equal(status.supported, false, `legacy ${source} keeps its installation source`);
  assert.equal(status.reason, 'source-managed');
  assert.equal(status.sourceType, installSourceType(source));
 }
 await saveSource('^0.5.4');
 const changedSource = legacyOps(legacyBundle);
 assert.equal((await changedSource['upgrade/check']()).available, true);
 const installsBeforeSourceChange = installs;
 await saveSource('github:example/plugin#v1');
 await assert.rejects(() => changedSource['upgrade/start']({ body: { confirm: true, version: '0.5.5' } }), /source/i);
 assert.equal(installs, installsBeforeSourceChange, 'a changed legacy source cannot be overwritten by the earlier npm update');
 await saveSource('^0.5.4');
 for (const metadata of [{ ...legacyBundle, removable: false }, { ...legacyBundle, installed: false }, { ...legacyBundle, readOnlyReason: 'management-required' }, { ...legacyBundle, availability: 'installation' }, { ...legacyBundle, availability: null }, { ...legacyBundle, source: 'github:example/plugin' }, { ...legacyBundle, error: { code: 'not-bundle' } }]) {
  assert.equal((await legacyOps(metadata)['upgrade/check']()).supported, false, 'old Host installation ownership and management protection win');
 }
 for (const contents of [JSON.stringify({ dependencies: {} }), '{bad json', JSON.stringify({ dependencies: { [UPGRADE_PACKAGE]: null } }), JSON.stringify({ dependencies: [] }), JSON.stringify({ dependencies: { [UPGRADE_PACKAGE]: ' ' } })]) {
  await writeFile(join(legacyDir, 'package.json'), contents);
  assert.equal((await legacyOps(legacyBundle)['upgrade/check']()).supported, false, 'missing or unreadable profile specs cannot authorize an upgrade');
 }
 await rm(join(legacyDir, 'package.json'));
 assert.equal((await legacyOps(legacyBundle)['upgrade/check']()).supported, false);
} finally { await rm(legacyDir, { recursive: true, force: true }); }
const ops = createUpgradeOperations({ getManager: () => manager, currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
assert.equal((await ops['upgrade/get']()).supported, true);
assert.equal(installs, 0, 'opening upgrade is read-only');
await assert.rejects(() => ops['upgrade/start']({ body: { confirm: true, version: '0.5.5' } }), /check/i);
assert.equal((await ops['upgrade/check']()).available, true);
await assert.rejects(() => ops['upgrade/start']({ body: { confirm: true, version: 'malicious-spec' } }), /version/i);
await assert.rejects(() => ops['upgrade/start']({ body: { version: '0.5.5' } }), /confirm/i);
assert.equal((await ops['upgrade/start']({ body: { confirm: true, version: '0.5.5' } })).state, 'running');
await ops['upgrade/start']({ body: { confirm: true, version: '0.5.5' } });
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(installs, 1, 'duplicate clicks must share the existing operation');
settle({ changed: true, application: 'restart-required', version: '0.5.5', packageResult: { exitCode: 0 } });
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal((await ops['upgrade/get']()).state, 'restart-required');
assert.equal((await ops['upgrade/get']()).installedVersion, '0.5.5');

for (const source of ['link:/my/plugin', 'file:./plugin', 'github:example/plugin', '/my/plugin', 'https://example.com/plugin.tgz']) {
  const local = createUpgradeOperations({ getManager: () => ({ ...manager, listBundles: async () => [{ ...bundle, source }] }), currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
  assert.equal((await local['upgrade/get']()).supported, false);
  await assert.rejects(() => local['upgrade/start']({ body: { confirm: true, version: '0.5.5' } }), /source/i);
}
assert.equal((await createUpgradeOperations({ getManager: () => null })['upgrade/get']()).reason, 'host-unavailable');
const same = createUpgradeOperations({ getManager: () => manager, currentVersion: '0.5.4', readLatest: async () => '0.5.4' });
assert.equal((await same['upgrade/check']()).available, false);
await assert.rejects(() => same['upgrade/start']({ body: { confirm: true, version: '0.5.4' } }), /check/i);
let lookups = 0;
const cached = createUpgradeOperations({ getManager: () => manager, currentVersion: '0.5.4', readLatest: async () => { lookups++; return '0.5.5'; } });
await Promise.all([cached['upgrade/check'](), cached['upgrade/check']()]);
await cached['upgrade/check']();
assert.equal(lookups, 1, 'mounts and refreshes share the five-minute read-only version cache');
const pendingRestart = createUpgradeOperations({ getManager: () => ({ ...manager, listBundles: async () => [{ ...bundle, version: '0.5.5' }] }), currentVersion: '0.5.4', readLatest: async () => { throw new Error('must not fetch'); } });
assert.equal((await pendingRestart['upgrade/check']()).state, 'restart-required');
assert.equal((await pendingRestart['upgrade/get']()).available, false);
for (const [outcome, state] of [
  [{ changed: false, application: 'failed', error: { code: 'incompatible-version' } }, 'failed'],
  [{ changed: true, application: 'failed' }, 'failed'],
  [{ changed: true, application: 'applied', packageResult: { exitCode: 1 } }, 'failed'],
  [{ changed: true, application: 'applied', version: '0.5.5' }, 'complete']
]) {
  const failing = createUpgradeOperations({ getManager: () => ({ ...manager, installBundle: async () => outcome }), currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
  await failing['upgrade/check']();
  await failing['upgrade/start']({ body: { confirm: true, version: '0.5.5' } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await failing['upgrade/get']()).state, state);
}
const unknown = createUpgradeOperations({ getManager: () => ({ ...manager, installBundle: async () => { throw new Error('connection lost'); } }), currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
await unknown['upgrade/check']();
await unknown['upgrade/start']({ body: { confirm: true, version: '0.5.5' } });
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal((await unknown['upgrade/get']()).state, 'unknown', 'lost result must not be reported as success or retried');
const network = createUpgradeOperations({ getManager: () => manager, currentVersion: '0.5.4', readLatest: async () => { throw new Error('registry unavailable'); } });
await assert.rejects(() => network['upgrade/check'](), /registry unavailable/);
assert.equal(installs, 1);
console.log('upgrade checks, fixed target, source protection, deduplication and outcomes ok');

const manual = createUpgradeOperations({ getManager: () => manager, getHotReload: () => true, currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
const manualStatus = await manual['upgrade/check']();
assert.equal(manualStatus.available, true, 'new releases remain visible with safe Host instructions');
assert.equal(manualStatus.canInstall, false);
assert.equal(manualStatus.installReason, 'hmr-managed');
assert.equal(manualStatus.manualCommand, null, 'missing profile metadata must not produce a guessed command');
for (const name of ['desktop', 'web']) {
 const environment = createUpgradeOperations({ getManager: () => manager, getProfile: () => ({ name }), getHotReload: () => true, currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
 const status = await environment['upgrade/check']();
 assert.equal(status.manualCommand, `dsh plugin --profile ${name} add --save-exact @wannanbigpig/dsh-usage-stats@0.5.5`, 'the update response uses the active Host profile instead of hard-coding desktop');
}
const beforeManual = installs;
await assert.rejects(() => manual['upgrade/start']({ body: { confirm: true, version: '0.5.5' } }), /HMR|Host/i);
assert.equal(installs, beforeManual, 'HMR mode must not attempt a rejected self-install or uninstall itself');
let progress, releaseInstall, recoveredCalls = 0;
const trackedManager = { ...manager, installBundle: async (_spec, { requestId }) => {
 queueMicrotask(() => progress({ requestId, phase: 'installing', attempt: { index: 2, total: 3 } }));
 return new Promise(resolve => { releaseInstall = resolve; });
} };
const tracked = createUpgradeOperations({ getManager: () => trackedManager, subscribeProgress: callback => { progress = callback; return () => { progress = null; }; }, currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
await tracked['upgrade/check'](); await tracked['upgrade/start']({ body: { confirm: true, version: '0.5.5' } }); await new Promise(resolve => setImmediate(resolve));
assert.equal((await tracked['upgrade/get']()).attempt.index, 2);
releaseInstall({ application: 'failed', error: { code: 'operation-error', diagnostic: 'DO_NOT_EXPOSE_RAW_LOG' }, packageResult: { exitCode: 1, kind: 'build-blocked' }, pendingBuilds: ['native-addon', 'bad name'] });
await new Promise(resolve => setImmediate(resolve));
const diagnostic = await tracked['upgrade/get']();
assert.equal(diagnostic.failureKind, 'build-blocked'); assert.deepEqual(diagnostic.pendingBuilds, ['native-addon']);
assert.equal(JSON.stringify(diagnostic).includes('DO_NOT_EXPOSE_RAW_LOG'), false); assert.equal(progress, null);
const recovering = createUpgradeOperations({ getManager: () => ({ ...manager, installBundle: async () => { throw new Error('reply lost'); }, waitForInstall: async requestId => { recoveredCalls++; assert.match(requestId, /^[0-9a-f-]{36}$/); return { application: 'restart-required', restartReason: 'no-hmr', version: '0.5.5' }; } }), currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
await recovering['upgrade/check'](); await recovering['upgrade/start']({ body: { confirm: true, version: '0.5.5' } }); await new Promise(resolve => setImmediate(resolve));
await recovering['upgrade/get'](); await new Promise(resolve => setImmediate(resolve));
assert.equal((await recovering['upgrade/get']()).state, 'restart-required'); assert.equal((await recovering['upgrade/get']()).restartReason, 'no-hmr'); assert.equal(recoveredCalls, 1);
console.log('HMR routing, profile environment, install progress, safe diagnostics and request recovery ok');

// Hosts after 0.2.1-rc.3 own the registry update flow: listVersions and
// updateBundle replace the plugin's own pnpm/query/install orchestration.
{
 const nativeBundle = { ...bundle, updatable: true };
 let listingCalls = 0, releaseUpdate, sentUpdate;
 const nativeManager = {
  listBundles: async () => [nativeBundle],
  installBundle: async () => { throw new Error('the native update must not fall back to a manual install'); },
  listVersions: async (name, options) => {
   listingCalls++;
   assert.equal(name, UPGRADE_PACKAGE);
   assert.deepEqual(options, {});
   return { status: 'listed', installed: '0.5.4', registry: 'https://registry.npmjs.org/', attempts: [], omitted: 0, versions: [
    { version: '0.5.6', tags: [], prerelease: false, bundle: true, deprecated: 'old' },
    { version: '0.5.7', tags: ['latest'], prerelease: false, bundle: true },
    { version: '0.5.9', tags: [], prerelease: true, bundle: true }
   ] };
  },
  updateBundle: async (name, version, options) => {
   sentUpdate = { name, version, options };
   return new Promise(resolve => { releaseUpdate = resolve; });
  }
 };
 const nativeOps = createUpgradeOperations({ getManager: () => nativeManager, getHotReload: () => true, currentVersion: '0.5.4', readLatest: async () => { throw new Error('native path must not query pnpm'); } });
 const nativeChecked = await nativeOps['upgrade/check']();
 assert.equal(nativeChecked.native, true);
 assert.equal(nativeChecked.latestVersion, '0.5.7', 'newest compatible non-prerelease non-deprecated version wins');
 assert.equal(nativeChecked.available, true);
 assert.equal(nativeChecked.canInstall, true, 'the Host owns the HMR removal and reinstallation');
 assert.equal(listingCalls, 1);
 await nativeOps['upgrade/start']({ body: { confirm: true, version: '0.5.7' } });
 assert.equal(sentUpdate.name, UPGRADE_PACKAGE);
 assert.equal(sentUpdate.version, '0.5.7');
 assert.match(sentUpdate.options.requestId, /^[0-9a-f-]{36}$/);
 assert.equal(sentUpdate.options.registry, 'https://registry.npmjs.org/');
 releaseUpdate({ from: '0.5.4', to: '0.5.7', step: 'install', result: { changed: true, application: 'applied', stage: 'enable', target: UPGRADE_PACKAGE + '@0.5.7' } });
 await new Promise(resolve => setImmediate(resolve));
 const settledNative = await nativeOps['upgrade/get']();
 assert.equal(settledNative.state, 'complete');
 assert.equal(settledNative.installedVersion, '0.5.7');

 const restoreManager = { ...nativeManager, updateBundle: async () => ({ from: '0.5.4', to: '0.5.7', step: 'install', result: { changed: false, application: 'failed', error: { code: 'operation-error' } }, restore: { changed: true, application: 'applied', stage: 'enable' } }) };
 const restoreOps = createUpgradeOperations({ getManager: () => restoreManager, currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
 await restoreOps['upgrade/check']();
 await restoreOps['upgrade/start']({ body: { confirm: true, version: '0.5.7' } });
 await new Promise(resolve => setImmediate(resolve));
 const restored = await restoreOps['upgrade/get']();
 assert.equal(restored.state, 'failed');
 assert.equal(restored.errorCode, 'operation-error', 'the Host failure code is preserved');

 let updated = false, updateCalls = 0;
 const lostManager = {
  ...nativeManager,
  listBundles: async () => [{ ...nativeBundle, version: updated ? '0.5.7' : '0.5.4' }],
  updateBundle: async () => { updateCalls++; updated = true; throw new Error('connection lost'); }
 };
 const lostOps = createUpgradeOperations({ getManager: () => lostManager, currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
 await lostOps['upgrade/check']();
 await lostOps['upgrade/start']({ body: { confirm: true, version: '0.5.7' } });
 await new Promise(resolve => setImmediate(resolve));
 await lostOps['upgrade/get']();
 await new Promise(resolve => setImmediate(resolve));
 const recoveredNative = await lostOps['upgrade/get']();
 assert.equal(updateCalls, 1, 'a lost reply must never trigger a second update');
 assert.equal(recoveredNative.state, 'complete', 'a lost reply is verified against the installed version instead of retrying');

 const ineligible = createUpgradeOperations({ getManager: () => ({ ...nativeManager, listBundles: async () => [{ ...nativeBundle, updatable: false, source: UPGRADE_PACKAGE + '@^0.5.4' }] }), currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
 assert.equal((await ineligible['upgrade/get']()).reason, 'source-managed');
 const refused = createUpgradeOperations({ getManager: () => ({ ...nativeManager, listVersions: async () => ({ status: 'refused', problem: 'network', reason: 'offline', attempts: [] }) }), currentVersion: '0.5.4', readLatest: async () => '0.5.5' });
 await assert.rejects(() => refused['upgrade/check'](), /Version listing failed/);
}
console.log('native registry updater delegation, rollback reporting and lost-reply recovery ok');

// pnpm supply-chain policy can install an older release than the requested
// target; the state machine must report the version that actually landed.
{
 const installedBundle = { name: UPGRADE_PACKAGE, version: '0.5.4', updatable: true, installed: true, availability: 'profile', enabled: true };
 const installedManager = {
  listBundles: async () => [installedBundle],
  installBundle: async () => { throw new Error('the native update must not fall back to a manual install'); },
  listVersions: async () => ({ status: 'listed', installed: '0.5.4', registry: null, attempts: [], omitted: 0, versions: [
   { version: '0.5.7', tags: ['latest'], prerelease: false, bundle: true }
  ] }),
  updateBundle: async () => ({ from: '0.5.4', to: '0.5.7', step: 'install', result: { changed: true, application: 'applied', stage: 'enable', version: '0.5.6' } })
 };
 const installedOps = createUpgradeOperations({ getManager: () => installedManager, currentVersion: '0.5.4', readLatest: async () => '0.5.7' });
 await installedOps['upgrade/check']();
 await installedOps['upgrade/start']({ body: { confirm: true, version: '0.5.7' } });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal((await installedOps['upgrade/get']()).installedVersion, '0.5.6', 'the installed manifest version wins over the requested target');
}
console.log('native installed-version reporting ok');
