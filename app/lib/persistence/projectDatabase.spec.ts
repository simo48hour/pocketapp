import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureProjectDatabase, projectDatabaseRequest, syncProjectSchema } from './projectDatabase';
import templates from '~/utils/bundledTemplates.json';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    get length() {
      return values.size;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('project database persistence', () => {
  it('reuses a connection for one project and isolates different projects', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: 'first', ownerToken: 'one' }))
      .mockResolvedValueOnce(Response.json({ id: 'second', ownerToken: 'two' }));
    vi.stubGlobal('fetch', fetcher);

    const [first, same] = await Promise.all([ensureProjectDatabase('chat-a'), ensureProjectDatabase('chat-a')]);
    expect(same).toEqual(first);
    expect(await ensureProjectDatabase('chat-a')).toEqual(first);
    expect((await ensureProjectDatabase('chat-b')).id).toBe('second');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not claim success or cache failed provisioning and allows retry', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: 'Unavailable' }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ id: 'retry', ownerToken: 'token' }));
    vi.stubGlobal('fetch', fetcher);
    await expect(ensureProjectDatabase('retry')).rejects.toThrow('Unavailable');
    expect(localStorage.length).toBe(0);
    expect((await ensureProjectDatabase('retry')).id).toBe('retry');
  });

  it('surfaces schema and record write failures without saving records locally', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() => Promise.resolve(Response.json({ message: 'Validation failed' }, { status: 400 }))),
    );

    const project = { id: 'one', ownerToken: 'secret' };
    await expect(syncProjectSchema(project, [])).rejects.toThrow('Validation failed');
    await expect(
      projectDatabaseRequest(project, 'admin/api/collections/tasks/records', {
        method: 'POST',
        body: JSON.stringify({ title: 'Real record' }),
      }),
    ).rejects.toThrow('Validation failed');
    expect(localStorage.length).toBe(0);
  });

  it('ships a live SDK client without fake health or CRUD responses', () => {
    const client = templates['xKevIsDev/bolt-vite-react-ts-template'].find(
      (file) => file.path === 'src/lib/pocketbase.ts',
    )!.content;
    expect(client).toContain('pocketapp_origin');
    expect(client).not.toMatch(/localStorage|pb\.send\s*=|parent.*location|localhost:5173/);
  });
});
