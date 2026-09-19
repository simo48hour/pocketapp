import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebContainer } from '@webcontainer/api';
import { dependenciesReady, ensureDependencies, hydrateDependencies, matchesDependencyCache } from './dependency-cache';

const pkg = { dependencies: { react: '18.3.1' }, overrides: {} };
const manifest = { format: 1, bytes: 3, sha256: '', dependencies: pkg.dependencies, overrides: {} };
function containerStub() {
  return {
    fs: {
      readFile: vi.fn(async (file: string) => (file === 'package.json' ? JSON.stringify(pkg) : 'ready')),
      writeFile: vi.fn(),
      rm: vi.fn(),
    },
    spawn: vi.fn(async () => ({
      output: new ReadableStream({
        start(c) {
          c.close();
        },
      }),
      exit: Promise.resolve(0),
    })),
  };
}
afterEach(() => vi.unstubAllGlobals());

describe('dependency snapshots', () => {
  it('hydrates matching projects and starts without installing', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('manifest')) return Response.json({ ...manifest, sha256 });
        if (url.includes('extract')) return new Response('// extractor');
        return new Response(bytes);
      }),
    );
    const stub = containerStub();
    const container = stub as unknown as WebContainer;
    await hydrateDependencies(container);
    expect(await dependenciesReady(container)).toBe(true);
    await ensureDependencies(container);
    expect(stub.spawn).toHaveBeenCalledTimes(1);
    expect(stub.spawn).toHaveBeenCalledWith('node', ['.pocketapp-extract.cjs'], undefined);
  });

  it('rejects new dependencies and changed versions', () => {
    expect(matchesDependencyCache(pkg, manifest)).toBe(true);
    expect(matchesDependencyCache({ ...pkg, dependencies: { react: '^18.3.1' } }, manifest)).toBe(true);
    expect(matchesDependencyCache({ ...pkg, dependencies: { react: '^19.0.0' } }, manifest)).toBe(false);
    expect(matchesDependencyCache({ ...pkg, dependencies: { ...pkg.dependencies, extra: '1.0.0' } }, manifest)).toBe(
      false,
    );
  });

  it('falls back once after a missing archive and reuses the successful installation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    const stub = containerStub();
    const container = stub as unknown as WebContainer;
    await hydrateDependencies(container);
    expect(await dependenciesReady(container)).toBe(false);
    await Promise.all([ensureDependencies(container), ensureDependencies(container)]);
    expect(stub.spawn).toHaveBeenCalledTimes(1);
    expect(stub.spawn).toHaveBeenCalledWith(
      'npm',
      ['install', '--prefer-offline', '--no-audit', '--no-fund'],
      undefined,
    );
    expect(await dependenciesReady(container)).toBe(true);
    await ensureDependencies(container);
    expect(stub.spawn).toHaveBeenCalledTimes(1);
  });

  it('does not extract a corrupt archive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('manifest')
          ? Response.json({ ...manifest, sha256: '0'.repeat(64) })
          : new Response(new Uint8Array([1, 2, 3])),
      ),
    );
    const stub = containerStub();
    const container = stub as unknown as WebContainer;
    await hydrateDependencies(container);
    expect(stub.spawn).not.toHaveBeenCalled();
    expect(await dependenciesReady(container)).toBe(false);
    expect(stub.fs.rm).toHaveBeenCalledWith('node_modules', { recursive: true, force: true });
  });
});
