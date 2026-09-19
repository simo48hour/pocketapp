import type { WebContainer } from '@webcontainer/api';
import { spawnTracked } from './processes';

interface Manifest {
  format: number;
  sha256: string;
  bytes: number;
  dependencies: Record<string, string>;
  overrides: Record<string, string>;
}

const states: WeakMap<
  WebContainer,
  { ready: boolean; manifest?: Manifest; installed?: string; pending?: Promise<void> }
> = import.meta.hot?.data.dependencyStates ?? new WeakMap();

if (import.meta.hot) import.meta.hot.data.dependencyStates = states;

export function matchesDependencyCache(pkg: any, manifest: Pick<Manifest, 'dependencies' | 'overrides'>) {
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  return (
    Object.keys(dependencies).length > 0 &&
    Object.entries(dependencies).every(([name, version]) =>
      acceptsCachedVersion(version, manifest.dependencies[name]),
    ) &&
    Object.entries(pkg.overrides || {}).every(([name, version]) => manifest.overrides[name] === version)
  );
}

// Handle the starter's exact, caret, and tilde ranges conservatively. Other npm
// specifiers (git, workspace, aliases, complex ranges) use the install fallback.
export function acceptsCachedVersion(requested: unknown, cached?: string) {
  if (typeof requested !== 'string' || !cached) return false;
  if (requested === cached) return true;
  const range = requested.match(/^([~^])(\d+)\.(\d+)\.(\d+)$/);
  const version = cached.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!range || !version) return false;
  const [major, minor, patch] = range.slice(2).map(Number);
  const [actualMajor, actualMinor, actualPatch] = version.slice(1).map(Number);
  if (actualMajor !== major || actualMinor < minor || (actualMinor === minor && actualPatch < patch)) return false;
  if (range[1] === '~' || major === 0) {
    if (actualMinor !== minor) return false;
    if (range[1] === '^' && minor === 0) return actualPatch === patch;
  }
  return true;
}

function signature(pkg: any) {
  return JSON.stringify([pkg.dependencies, pkg.devDependencies, pkg.overrides]);
}

async function run(container: WebContainer, command: string, args: string[]) {
  const process = await spawnTracked(container, command, args);
  let output = '';
  const drain = process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        output = (output + chunk).slice(-4000);
      },
    }),
  );
  const code = await process.exit;
  await drain;
  if (code !== 0) throw new Error(`${command} failed (${code}): ${output}`);
}

/** Called once during boot, before the container is exposed to file/command runners. */
export async function hydrateDependencies(container: WebContainer) {
  const state = { ready: false, manifest: undefined as Manifest | undefined };
  states.set(container, state);
  const started = performance.now();
  try {
    const response = await fetch('/prebuilt/manifest.json', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Dependency manifest unavailable');
    const manifest = (await response.json()) as Manifest;
    if (manifest.format !== 1 || !/^[a-f0-9]{64}$/.test(manifest.sha256))
      throw new Error('Invalid dependency manifest');
    const url = `/prebuilt/dependencies.bin?v=${manifest.sha256}`;
    let cache: Cache | undefined;
    try {
      cache = await caches.open('pocketapp-dependencies-v1');
    } catch {
      /* Storage can be disabled. */
    }
    let archiveResponse = await cache?.match(url);
    if (!archiveResponse) archiveResponse = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!archiveResponse.ok) throw new Error('Dependency archive unavailable');
    const archive = await archiveResponse.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', archive)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    if (archive.byteLength !== manifest.bytes || digest !== manifest.sha256) {
      await cache?.delete(url);
      throw new Error('Dependency archive checksum mismatch');
    }
    try {
      await cache?.put(url, new Response(archive));
      for (const key of (await cache?.keys()) || [])
        if (key.url !== new URL(url, location.href).href) await cache?.delete(key);
    } catch {
      /* Quota errors must not prevent boot. */
    }
    const extractor = await fetch('/prebuilt/extract.cjs', { signal: AbortSignal.timeout(15000) });
    if (!extractor.ok) throw new Error('Dependency extractor unavailable');
    await container.fs.writeFile('.pocketapp-dependencies.tar.gz', new Uint8Array(archive));
    await container.fs.writeFile('.pocketapp-extract.cjs', await extractor.text());
    await run(container, 'node', ['.pocketapp-extract.cjs']);
    await container.fs.readFile('node_modules/vite/package.json');
    state.manifest = manifest;
    state.ready = true;
    console.info(`[Dependencies] Snapshot ready in ${Math.round(performance.now() - started)}ms`);
  } catch (error) {
    // A partial tree must never be mistaken for a completed installation.
    await container.fs.rm('node_modules', { recursive: true, force: true });
    console.warn('[Dependencies] Snapshot unavailable; using npm fallback.', error);
  } finally {
    await container.fs.rm('.pocketapp-extract.cjs', { force: true });
    await container.fs.rm('.pocketapp-dependencies.tar.gz', { force: true });
  }
}

export async function dependenciesReady(container: WebContainer) {
  const state = states.get(container);
  if (!state) return false;
  try {
    const pkg = JSON.parse(await container.fs.readFile('package.json', 'utf8'));
    await container.fs.readFile('node_modules/.bin/vite');
    return (
      state.installed === signature(pkg) ||
      Boolean(state.ready && state.manifest && matchesDependencyCache(pkg, state.manifest))
    );
  } catch {
    return false;
  }
}

export async function ensureDependencies(container: WebContainer) {
  if (await dependenciesReady(container)) return;
  const state = states.get(container) || { ready: false };
  states.set(container, state);
  if (state.pending) return state.pending;
  state.pending = (async () => {
    const pkg = JSON.parse(await container.fs.readFile('package.json', 'utf8'));
    await run(container, 'npm', ['install', '--prefer-offline', '--no-audit', '--no-fund']);
    state.ready = false;
    state.installed = signature(pkg);
  })();
  try {
    await state.pending;
  } finally {
    state.pending = undefined;
  }
}
