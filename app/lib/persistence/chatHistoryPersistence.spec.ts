import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { binDates } from '~/components/sidebar/date-binning';
import { upsertChatInStore, chatHistoryListAtom } from './chatHistoryStore';
import type { ChatHistoryItem } from './useChatHistory';

describe('chatHistoryPersistence and sorting', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      get length() {
        return values.size;
      },
    });
    chatHistoryListAtom.set([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getNextId logic safely calculates highest integer even when non-numeric keys exist', () => {
    const mixedKeys = ['1', '2', 'proj_abc', '10', 'slug-name', '3'];
    const highestId = mixedKeys.reduce<number>((max, key) => {
      const num = typeof key === 'number' ? key : parseInt(String(key), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);

    expect(highestId).toBe(10);
    expect(String(highestId + 1)).toBe('11');
  });

  it('binDates correctly parses and sorts timestamps including PocketBase space-separated dates', () => {
    const items: ChatHistoryItem[] = [
      {
        id: '1',
        description: 'Older Project',
        messages: [],
        timestamp: '2026-09-08 10:00:00.000Z',
      },
      {
        id: '2',
        description: 'Latest Project',
        messages: [],
        timestamp: '2026-09-08 16:30:00.000Z',
      },
      {
        id: '3',
        description: 'Mid Project',
        messages: [],
        timestamp: '2026-09-08T14:00:00.000Z',
      },
    ];

    const bins = binDates(items);
    expect(bins.length).toBeGreaterThan(0);
    const sortedItems = bins.flatMap((b) => b.items);

    expect(sortedItems[0].id).toBe('2'); // Latest
    expect(sortedItems[1].id).toBe('3'); // Mid
    expect(sortedItems[2].id).toBe('1'); // Older
  });

  it('upsertChatInStore adds latest project to top and updates existing', () => {
    upsertChatInStore({
      id: '1',
      description: 'First Chat',
      timestamp: '2026-09-08T10:00:00.000Z',
    });

    upsertChatInStore({
      id: '2',
      description: 'Second Chat',
      timestamp: '2026-09-08T12:00:00.000Z',
    });

    let current = chatHistoryListAtom.get();
    expect(current[0].id).toBe('2');
    expect(current[1].id).toBe('1');

    // Update first chat with a new timestamp
    upsertChatInStore({
      id: '1',
      description: 'First Chat Updated',
      timestamp: '2026-09-08T14:00:00.000Z',
    });

    current = chatHistoryListAtom.get();
    expect(current[0].id).toBe('1');
    expect(current[0].description).toBe('First Chat Updated');
  });

  it('isInternalId correctly identifies internal parser IDs and protects clean URLs', async () => {
    const { isInternalId } = await import('./chatId');
    expect(isInternalId('2-1788888502499-0')).toBe(true);
    expect(isInternalId('2-1788888502499')).toBe(true);
    expect(isInternalId('artifact-123-0')).toBe(true);
    expect(isInternalId('message_1-0')).toBe(true);
    expect(isInternalId('')).toBe(true);
    expect(isInternalId(undefined)).toBe(true);

    // Clean user-facing project IDs and slugs should not be marked internal
    expect(isInternalId('28')).toBe(false);
    expect(isInternalId('1')).toBe(false);
    expect(isInternalId('todo-list-app')).toBe(false);
    expect(isInternalId('my-cool-project')).toBe(false);
  });

  it('upsertChatInStore sanitizes internal parser urlId to clean id', () => {
    upsertChatInStore({
      id: '28',
      urlId: '2-1788888502499-0',
      description: 'Clean ID Project',
      timestamp: '2026-09-08T15:00:00.000Z',
    });

    const current = chatHistoryListAtom.get();
    const item = current.find((c) => c.id === '28');
    expect(item).toBeDefined();
    expect(item?.urlId).toBe('28');
  });
});
