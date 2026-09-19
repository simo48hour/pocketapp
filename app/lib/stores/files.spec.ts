import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PathWatcherEvent, WebContainer } from '@webcontainer/api';
import { FilesStore } from './files';

vi.mock('~/utils/fileLocks', () => ({ getCurrentChatId: () => 'test' }));
vi.mock('~/lib/persistence/lockedFiles', () => ({
  migrateLegacyLocks: vi.fn(),
  getLockedItemsForChat: () => [],
  clearCache: vi.fn(),
}));
vi.mock('~/utils/buffer', () => ({
  bufferWatchEvents: (_delay: number, callback: (events: unknown[]) => void) => (events: unknown[]) =>
    callback([[events]]),
}));

afterEach(() => vi.useRealTimers());

function fixture() {
  vi.useFakeTimers();
  const watchPaths = vi.fn();
  const container = { internal: { watchPaths } } as unknown as WebContainer;
  const store = new FilesStore(Promise.resolve(container));
  store.initWithWebContainer(container);
  const emit = watchPaths.mock.calls[0][1] as (events: Partial<PathWatcherEvent>[]) => void;
  return { store, emit, options: watchPaths.mock.calls[0][0] };
}

const file = (path: string, content = 'hello'): Partial<PathWatcherEvent> => ({
  type: 'add_file',
  path,
  buffer: new TextEncoder().encode(content),
});

describe('filesystem event batches', () => {
  it('publishes a thousand file events once and ignores duplicate notifications', () => {
    const { store, emit, options } = fixture();
    const listener = vi.fn();
    store.files.listen(listener);
    const events = Array.from({ length: 1000 }, (_, i) => file(`/src/${i}.ts`));
    emit(events);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.filesCount).toBe(1000);
    emit(events);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.filesCount).toBe(1000);
    expect(options.includeContent).toBe(true);
    expect(options.exclude).toContain('**/.pocketapp-dependencies.tar.gz');
  });

  it('preserves metadata-only content and accepts intentionally empty files', () => {
    const { store, emit } = fixture();
    emit([file('/src/a.ts')]);
    emit([{ type: 'change', path: '/src/a.ts' }]);
    expect(store.files.get()['/src/a.ts']).toMatchObject({ content: 'hello' });
    emit([file('/src/a.ts', '')]);
    expect(store.files.get()['/src/a.ts']).toMatchObject({ content: '' });
  });

  it('removes directory descendants without removing similarly named siblings', () => {
    const { store, emit } = fixture();
    emit([file('/src/a.ts'), file('/src-other/b.ts')]);
    emit([{ type: 'remove_dir', path: '/src' }]);
    expect(store.files.get()['/src/a.ts']).toBeUndefined();
    expect(store.files.get()['/src-other/b.ts']).toBeDefined();
    expect(store.filesCount).toBe(1);
  });
});
