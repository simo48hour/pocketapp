import { atom } from 'nanostores';
import type { ChatHistoryItem } from './useChatHistory';
import { isInternalId } from './chatId';
import { getAll } from './db';
import { fetchPocketBaseProjects } from './pocketbaseSync';

const CHAT_HISTORY_STORAGE_KEY = 'bolt_sidebar_chat_history_cache';
const CHAT_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL

let lastHistoryFetchTime = 0;
let activeFetchPromise: Promise<ChatHistoryItem[]> | null = null;

function sanitizeCachedItems(items: any[]): ChatHistoryItem[] {
  return items.map((item) => {
    const cleanUrlId = isInternalId(item.urlId) ? item.id : (item.urlId || item.id);
    return {
      ...item,
      urlId: cleanUrlId,
    };
  });
}

/**
 * Load initial chat list from localStorage synchronously so sidebar renders instantly
 */
function loadInitialCachedChats(): ChatHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return sanitizeCachedItems(parsed);
    }
    if (parsed && Array.isArray(parsed.items)) {
      lastHistoryFetchTime = typeof parsed.timestamp === 'number' ? parsed.timestamp : 0;
      return sanitizeCachedItems(parsed.items);
    }
  } catch (e) {
    console.warn('[chatHistoryStore] Failed to load cached chats from localStorage:', e);
  }
  return [];
}

/**
 * Save chat items to localStorage (trimming bulky messages array to keep storage lightweight)
 */
function persistChatsToStorage(items: ChatHistoryItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const lightweightItems = items.map((item) => ({
      id: item.id,
      urlId: isInternalId(item.urlId) ? item.id : (item.urlId || item.id),
      description: item.description || 'Untitled Chat',
      timestamp: item.timestamp || new Date().toISOString(),
      projectId: item.projectId,
      messages: [],
    }));

    localStorage.setItem(
      CHAT_HISTORY_STORAGE_KEY,
      JSON.stringify({
        items: lightweightItems,
        timestamp: lastHistoryFetchTime || Date.now(),
      }),
    );
  } catch (e) {
    console.warn('[chatHistoryStore] Failed to persist cached chats to localStorage:', e);
  }
}

// Nanostore atom for reactive sidebar chat list
export const chatHistoryListAtom = atom<ChatHistoryItem[]>(loadInitialCachedChats());

/**
 * Optimistically upsert a chat in browser memory store
 */
export function upsertChatInStore(item: Partial<ChatHistoryItem> & { id: string }): void {
  const current = chatHistoryListAtom.get();
  const existingIndex = current.findIndex((c) => c.id === item.id || (item.urlId && c.urlId === item.urlId));

  let updated: ChatHistoryItem[];
  if (existingIndex >= 0) {
    const cleanUrlId = isInternalId(item.urlId || current[existingIndex].urlId)
      ? current[existingIndex].id
      : (item.urlId || current[existingIndex].urlId || current[existingIndex].id);
    const mergedItem: ChatHistoryItem = {
      ...current[existingIndex],
      ...item,
      urlId: cleanUrlId,
      timestamp: item.timestamp || current[existingIndex].timestamp || new Date().toISOString(),
    };
    updated = [...current];
    updated[existingIndex] = mergedItem;
  } else {
    const cleanUrlId = isInternalId(item.urlId) ? item.id : (item.urlId || item.id);
    const newItem: ChatHistoryItem = {
      id: item.id,
      urlId: cleanUrlId,
      description: item.description || 'Untitled Chat',
      messages: item.messages || [],
      timestamp: item.timestamp || new Date().toISOString(),
      projectId: item.projectId,
      metadata: item.metadata,
    };
    updated = [newItem, ...current];
  }

  // Sort by timestamp descending
  updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  chatHistoryListAtom.set(updated);
  persistChatsToStorage(updated);
}

/**
 * Optimistically remove a chat from browser memory store
 */
export function removeChatFromStore(id: string): void {
  const current = chatHistoryListAtom.get();
  const updated = current.filter((c) => c.id !== id && c.urlId !== id);
  chatHistoryListAtom.set(updated);
  persistChatsToStorage(updated);
}

/**
 * Optimistically remove multiple chats from browser memory store
 */
export function removeMultipleChatsFromStore(ids: string[]): void {
  const idSet = new Set(ids);
  const current = chatHistoryListAtom.get();
  const updated = current.filter((c) => !idSet.has(c.id) && (!c.urlId || !idSet.has(c.urlId)));
  chatHistoryListAtom.set(updated);
  persistChatsToStorage(updated);
}

/**
 * Optimistically update the projectId of a chat in browser memory store
 */
export function setChatProjectInStore(chatId: string, projectId?: string): void {
  const current = chatHistoryListAtom.get();
  const index = current.findIndex((c) => c.id === chatId || c.urlId === chatId);
  if (index >= 0) {
    const updated = [...current];
    updated[index] = {
      ...updated[index],
      projectId: projectId || undefined,
    };
    chatHistoryListAtom.set(updated);
    persistChatsToStorage(updated);
  }
}

/**
 * Invalidate the chat history cache timestamp
 */
export function invalidateChatHistoryCache(): void {
  lastHistoryFetchTime = 0;
}

/**
 * Check if the browser memory cache is currently fresh
 */
export function isChatHistoryCacheFresh(): boolean {
  const hasItems = chatHistoryListAtom.get().length > 0;
  const isWithinTTL = Date.now() - lastHistoryFetchTime < CHAT_CACHE_TTL_MS;
  return hasItems && isWithinTTL;
}

/**
 * Load chat history with Stale-While-Revalidate and deduplication.
 * If fresh in memory and not forced, returns memory cache immediately without touching the database.
 */
export async function loadChatHistoryEntries(
  db?: IDBDatabase,
  options?: { force?: boolean },
): Promise<ChatHistoryItem[]> {
  const force = options?.force === true;

  if (force) {
    invalidateChatHistoryCache();
  }

  // If cache is fresh and not forced, return in-memory items immediately (0 database calls)
  if (!force && isChatHistoryCacheFresh()) {
    return chatHistoryListAtom.get();
  }

  // Deduplicate concurrent fetch calls UNLESS forced
  if (!force && activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      // 1. Fetch from local IndexedDB if db is provided
      let localItems: ChatHistoryItem[] = [];
      if (db) {
        try {
          const rawLocal = await getAll(db);
          localItems = rawLocal
            .filter((item) => item && (item.urlId || item.id))
            .map((item) => ({
              ...item,
              urlId: item.urlId || item.id,
              description: item.description || 'Untitled Chat',
              projectId: item.projectId,
            }));
        } catch (e) {
          console.warn('[chatHistoryStore] Error reading local IndexedDB chats:', e);
        }
      }

      // 2. Fetch from PocketBase cloud (with internal caching and TTL)
      let cloudItems: ChatHistoryItem[] = [];
      try {
        cloudItems = await fetchPocketBaseProjects({ force });
      } catch (e) {
        console.warn('[chatHistoryStore] Error fetching PocketBase cloud projects:', e);
      }

      // 3. Merge local + cloud items
      const mergedMap = new Map<string, ChatHistoryItem>();

      for (const item of localItems) {
        const idKey = String(item.id);
        mergedMap.set(idKey, item);
        if (item.urlId) {
          mergedMap.set(String(item.urlId), item);
        }
      }

      for (const cItem of cloudItems) {
        const idKey = String(cItem.id);
        const urlKey = cItem.urlId ? String(cItem.urlId) : undefined;
        const existing = mergedMap.get(idKey) || (urlKey ? mergedMap.get(urlKey) : undefined);

        if (!existing) {
          const cleanUrlId = isInternalId(cItem.urlId) ? cItem.id : (cItem.urlId || cItem.id);
          const normalizedCloudItem: ChatHistoryItem = {
            ...cItem,
            urlId: cleanUrlId,
            projectId: cItem.projectId,
          };
          mergedMap.set(idKey, normalizedCloudItem);
          if (urlKey) {
            mergedMap.set(urlKey, normalizedCloudItem);
          }
        } else {
          // Sync fresher cloud information
          const isGenericLocalTitle =
            !existing.description ||
            existing.description === 'Untitled Chat' ||
            existing.description === 'Untitled Project';

          if (isGenericLocalTitle && cItem.description) {
            existing.description = cItem.description;
          }
          if (!existing.projectId && cItem.projectId) {
            existing.projectId = cItem.projectId;
          }

          const cTime = new Date(cItem.timestamp).getTime();
          const eTime = new Date(existing.timestamp).getTime();
          if (!isNaN(cTime) && (isNaN(eTime) || cTime > eTime)) {
            existing.timestamp = cItem.timestamp;
          }
        }
      }

      const deduplicated = Array.from(new Set(mergedMap.values()));
      deduplicated.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      // 4. Update memory atom and persist to browser storage
      lastHistoryFetchTime = Date.now();
      chatHistoryListAtom.set(deduplicated);
      persistChatsToStorage(deduplicated);

      return deduplicated;
    } finally {
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
}
