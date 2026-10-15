/** Fixed-package upgrades through the current profile's supported Host APIs. */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { UsageRpcBadRequestError } from './rpc.js';

export const UPGRADE_PACKAGE = '@wannanbigpig/dsh-usage-stats';
const runtimeVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const release = value => typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
  ? value.split('.').map(Number) : null;

export function newerRelease(next, current) {
  const left = release(next), right = release(current);
  if (!left || !right || [...left, ...right].some(value => !Number.isSafeInteger(value))) return false;
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i];
  return false;
}

async function withDeadline(task, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => task(controller.signal)),
      new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(new Error('Version lookup timed out'), { retryable: true }));
      }, Math.max(1, timeoutMs)); })
    ]);
  } finally { clearTimeout(timer); }
}

/** Preserve null: only pnpm can resolve all profile and scoped registry settings. */
export function upgradeRegistryPlan(configured) {
  const normalize = value => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid registry URL');
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  };
  const own = configured.resolved == null ? null : normalize(configured.resolved);
  const first = configured.registry == null ? null : normalize(configured.registry);
  const fallbacks = (configured.fallbackRegistries ?? []).map(normalize);
  const ownIsPublic = own !== null && (own === 'https://registry.npmjs.org/' || fallbacks.includes(own));
  if ((first === null || first === own) && !ownIsPublic) return [first];
  const seen = new Set([first ?? own]);
  return [first, ...fallbacks.filter(url => { if (seen.has(url)) return false; seen.add(url); return true; })];
}

async function hostPackageView() {
  try {
    const host = await import('@deepseek-ai/dsh-plugin-manager/operations');
    if (typeof host.viewProfilePackage === 'function') return host.viewProfilePackage;
  } catch { /* Older Hosts may not publish the read-only package operation. */ }
  throw new Error('Host profile package lookup is unavailable');
}

/** Query through the Host operation so profile auth, proxies and application-owned pnpm apply. */
export async function readLatestRelease(manager, { profile, viewPackage } = {}, timeoutMs = 15000) {
  if (!profile || typeof profile.dir !== 'string' || !profile.dir) throw new Error('Host profile is unavailable');
  const deadline = Date.now() + timeoutMs;
  const query = viewPackage ?? await withDeadline(hostPackageView, timeoutMs);
  const configured = typeof manager.registries === 'function'
    ? await withDeadline(() => manager.registries(), Math.max(1, deadline - Date.now()))
    : { registry: null, resolved: null, fallbackRegistries: [] };
  const registries = upgradeRegistryPlan(configured);
  for (const [index, registry] of registries.entries()) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Version lookup timed out');
    try {
      return await withDeadline(async signal => {
        let result;
        try {
          result = await query(profile.dir, `${UPGRADE_PACKAGE}@latest`, {
            ...profile.packageManager, registry, signal, timeoutMs: Math.max(1, Math.floor(remaining / (registries.length - index)))
          });
        } catch { throw Object.assign(new Error('Version lookup failed'), { retryable: true }); }
        if (result.exitCode !== 0 || result.timedOut || result.cause) {
          // Inspect diagnostics only for classification; raw pnpm output never crosses this RPC boundary.
          const diagnostic = `${result.stderr ?? ''} ${result.stdout ?? ''} ${result.cause?.code ?? ''}`;
          if (/FETCH_(?:401|403)|E401|E403|AUTH|UNAUTHORIZED|FORBIDDEN/i.test(diagnostic)) throw new Error('Version lookup authentication failed');
          const retryable = result.timedOut === true || Boolean(result.cause) || /ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|FETCH_(?:404|408|429|5\d\d)|NO_MATCHING_VERSION/i.test(diagnostic);
          throw Object.assign(new Error(result.timedOut ? 'Version lookup timed out' : 'Version lookup failed'), { retryable });
        }
        const text = String(result.stdout ?? '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        if (text.length > 1024 * 1024) throw new Error('Version response is too large');
        let manifest;
        try { manifest = JSON.parse(text); } catch { throw new Error('Invalid released plugin metadata'); }
        if (manifest?.name !== UPGRADE_PACKAGE || !release(manifest.version)) throw new Error('Invalid released plugin version');
        return manifest.version;
      }, Math.floor(remaining / (registries.length - index)));
    } catch (error) {
      if (!error.retryable || index === registries.length - 1) throw error;
    }
  }
}

function registrySource(source) {
  const spec = (source.startsWith(`${UPGRADE_PACKAGE}@`) ? source.slice(UPGRADE_PACKAGE.length + 1) : source).trim();
  if (/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(spec)) return true;
  const part = String.raw`(?:0|[1-9]\d*|[xX*])`;
  const version = String.raw`[vV]?${part}(?:\.${part}){0,2}(?:-[0-9a-zA-Z.-]+)?(?:\+[0-9a-zA-Z.-]+)?`;
  const versionOnly = new RegExp(`^${version}$`);
  const comparator = new RegExp(`^(?:[<>]=?|[=~^])?${version}$`);
  return spec.split(/\s*\|\|\s*/).every(range => {
    const bounds = range.split(/\s+-\s+/);
    if (bounds.length === 2) return bounds.every(bound => versionOnly.test(bound));
    return range.replace(/([<>]=?|[=~^])\s+/g, '$1').split(/\s+/).every(token => comparator.test(token));
  });
}

export function installSourceType(source) {
  if (typeof source !== 'string') return 'unknown';
  if (source.startsWith(`${UPGRADE_PACKAGE}@`) && registrySource(source)) return 'registry';
  if (/\.(?:tgz|tar\.gz|zip)(?:[?#].*)?$/i.test(source)) return 'archive';
  if (/^(?:github:|gitlab:|bitbucket:|gist:|git[+:]|git@|ssh:)/i.test(source) || /\.git(?:#|$)/i.test(source) || /^https?:\/\/(?:github\.com|gitlab\.com|bitbucket\.org)\//i.test(source)) return 'git';
  if (/^(?:link:|file:|[./]|[a-z]:[\\/])/i.test(source)) return 'local';
  return registrySource(source) ? 'registry' : 'unknown';
}

const packageName = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
const restartReasons = new Set(['no-hmr', 'package-moved', 'host-module', 'unmanaged-plugin', 'module-comparison']);
const failureKinds = new Set(['pnpm-missing', 'timeout', 'not-found', 'no-matching-version', 'network', 'disk-full', 'permission', 'build-blocked', 'integrity', 'unknown']);

export function createUpgradeOperations({ getManager, getProfile = () => null, getHotReload = () => false, subscribeProgress, currentVersion = runtimeVersion, readLatest = readLatestRelease } = {}) {
  let latestVersion = null, checkedAt = null, state = 'idle', installedVersion = null, errorCode = null;
  let requestId = null, phase = null, attempt = null, restartReason = null, failureKind = null, pendingBuilds = [];
  let checking = null, starting = null, recovering = null, lastRecovery = 0, stopProgress = null;
  const target = async () => {
    const manager = getManager?.();
    if (!manager || typeof manager.listBundles !== 'function' || typeof manager.installBundle !== 'function') return { manager: null, supported: false, reason: 'host-unavailable' };
    const bundle = (await manager.listBundles()).find(item => item.name === UPGRADE_PACKAGE);
    if (!bundle?.installed || bundle.availability !== 'profile' || bundle.readOnlyReason) return { manager, supported: false, reason: 'not-managed' };
    const sourceType = installSourceType(bundle.source);
    if (sourceType !== 'registry') return { manager, bundle, sourceType, supported: false, reason: 'source-managed' };
    if (state === 'idle' && newerRelease(bundle.version, currentVersion)) { state = 'restart-required'; installedVersion = bundle.version; }
    return { manager, bundle, sourceType, supported: true, reason: null };
  };
  const view = info => ({ ok: true, package: UPGRADE_PACKAGE, currentVersion, latestVersion, checkedAt, installedVersion, state, errorCode,
    requestId, phase, attempt, restartReason, failureKind, pendingBuilds,
    supported: info.supported, reason: info.reason, sourceType: info.sourceType ?? 'unknown',
    canInstall: info.supported && !getHotReload(), installReason: getHotReload() ? 'hmr-managed' : null,
    available: info.supported && newerRelease(latestVersion, currentVersion) && !['running', 'complete', 'restart-required', 'unknown'].includes(state) });
  const settle = result => {
    stopProgress?.(); stopProgress = null;
    phase = null; attempt = null;
    if (!result || !['applied', 'restart-required', 'failed', 'cancelled', 'overridden'].includes(result.application)) { state = 'unknown'; errorCode = 'unconfirmed'; return; }
    failureKind = failureKinds.has(result.packageResult?.kind) ? result.packageResult.kind : null;
    pendingBuilds = Array.isArray(result.pendingBuilds) ? result.pendingBuilds.filter(name => typeof name === 'string' && name.length <= 214 && packageName.test(name)).slice(0, 50) : [];
    if (result.error || (result.packageResult && result.packageResult.exitCode !== 0) || !['applied', 'restart-required'].includes(result.application)) {
      state = 'failed'; errorCode = result.error?.code ?? failureKind ?? 'operation-error';
    } else {
      state = result.application === 'restart-required' ? 'restart-required' : 'complete';
      installedVersion = release(result.version) ? result.version : latestVersion;
      restartReason = restartReasons.has(result.restartReason) ? result.restartReason : null;
      errorCode = null;
    }
  };
  const recover = manager => {
    if (recovering || !requestId || typeof manager?.waitForInstall !== 'function' || Date.now() - lastRecovery < 30000) return;
    lastRecovery = Date.now();
    recovering = Promise.resolve().then(() => manager.waitForInstall(requestId)).then(result => {
      if (result !== null && state === 'unknown') settle(result);
    }).catch(() => {}).finally(() => { recovering = null; });
  };
  const get = async () => {
    const info = await target();
    if (state === 'unknown') recover(info.manager);
    return view(info);
  };
  const check = async () => {
    if (checking) return checking;
    checking = (async () => {
      const info = await target();
      if (!info.supported || ['running', 'complete', 'restart-required', 'unknown'].includes(state)) return view(info);
      if (checkedAt && Date.now() - checkedAt < 5 * 60000) return view(info);
      latestVersion = null;
      const version = await readLatest(info.manager, { profile: getProfile() });
      if (!release(version)) throw new Error('Invalid released plugin version');
      latestVersion = version;
      checkedAt = Date.now();
      return view(info);
    })();
    try { return await checking; } finally { checking = null; }
  };
  const start = async payload => {
    if (starting) return starting;
    if (state === 'running') return get();
    starting = (async () => {
      const info = await target();
      if (!info.supported) throw new UsageRpcBadRequestError('This installation source must be managed in the Host plugin manager');
      if (getHotReload()) throw new UsageRpcBadRequestError('HMR requires upgrading from the Host plugin manager or the matching CLI after the Host exits');
      if (payload?.body?.confirm !== true) throw new UsageRpcBadRequestError('Upgrade requires explicit confirmation');
      if (!latestVersion || !newerRelease(latestVersion, currentVersion) || !checkedAt || Date.now() - checkedAt > 5 * 60000 || ['complete', 'restart-required', 'unknown'].includes(state)) throw new UsageRpcBadRequestError('Check for a new version before upgrading');
      if (payload?.body?.version !== latestVersion) throw new UsageRpcBadRequestError('Upgrade version does not match the checked release');
      const version = latestVersion;
      requestId = randomUUID(); state = 'running'; phase = 'installing'; attempt = null;
      errorCode = null; failureKind = null; pendingBuilds = []; restartReason = null; lastRecovery = 0;
      stopProgress = subscribeProgress?.(progress => {
        if (progress.requestId !== requestId || state !== 'running') return;
        if (['installing', 'applying', 'cancelling'].includes(progress.phase) && phase !== 'applying') phase = progress.phase;
        const next = progress.attempt;
        if (Number.isSafeInteger(next?.index) && Number.isSafeInteger(next?.total) && next.index > 0 && next.index <= next.total) attempt = { index: next.index, total: next.total };
      });
      void Promise.resolve().then(() => info.manager.installBundle(`${UPGRADE_PACKAGE}@${version}`, { enabled: info.bundle.enabled, saveExact: true, requestId })).then(settle).catch(() => {
        stopProgress?.(); stopProgress = null;
        state = 'unknown'; phase = null; errorCode = 'unconfirmed'; recover(info.manager);
      });
      return view(info);
    })();
    try { return await starting; } finally { starting = null; }
  };
  return { 'upgrade/get': get, 'upgrade/check': check, 'upgrade/start': start };
}
