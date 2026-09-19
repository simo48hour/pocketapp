import { pb } from '~/lib/auth/pocketbase';
import { currentUser } from '~/lib/stores/authStore';
import type { Message } from 'ai';
import type { ChatHistoryItem } from './useChatHistory';
import { isInternalId } from './chatId';
import type { Snapshot } from './types';

const POCKETBASE_CACHE_STORAGE_KEY = 'bolt_pocketbase_projects_cache';
const POCKETBASE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL

let cachedCloudProjects: ChatHistoryItem[] | null = null;
let lastCloudFetchTime = 0;
let cachedUserId: string | null = null;
let activeCloudFetchPromise: Promise<ChatHistoryItem[]> | null = null;

function loadInitialCloudCache(): ChatHistoryItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(POCKETBASE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items) && typeof parsed.timestamp === 'number') {
      lastCloudFetchTime = parsed.timestamp;
      cachedUserId = parsed.userId || null;
      return parsed.items;
    }
  } catch {}
  return null;
}

cachedCloudProjects = loadInitialCloudCache();

function persistCloudCache(items: ChatHistoryItem[], userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const lightweightItems = items.map((i) => ({
      id: i.id,
      urlId: i.urlId || i.id,
      description: i.description,
      timestamp: i.timestamp,
      projectId: i.projectId,
      messages: [],
    }));
    localStorage.setItem(
      POCKETBASE_CACHE_STORAGE_KEY,
      JSON.stringify({
        items: lightweightItems,
        timestamp: lastCloudFetchTime,
        userId,
      }),
    );
  } catch {}
}

function updateCloudCacheItem(item: Partial<ChatHistoryItem> & { id: string }, userId?: string): void {
  if (!cachedCloudProjects) cachedCloudProjects = [];
  const idx = cachedCloudProjects.findIndex((c) => c.id === item.id || (item.urlId && c.urlId === item.urlId));
  if (idx >= 0) {
    cachedCloudProjects[idx] = {
      ...cachedCloudProjects[idx],
      ...item,
      timestamp: item.timestamp || cachedCloudProjects[idx].timestamp,
    };
  } else {
    cachedCloudProjects.unshift({
      id: item.id,
      urlId: item.urlId || item.id,
      description: item.description || 'Untitled Project',
      messages: item.messages || [],
      timestamp: item.timestamp || new Date().toISOString(),
      projectId: item.projectId,
    });
  }
  if (userId) {
    persistCloudCache(cachedCloudProjects, userId);
  }
}

function removeCloudCacheItem(id: string, userId?: string): void {
  if (!cachedCloudProjects) return;
  cachedCloudProjects = cachedCloudProjects.filter((c) => c.id !== id && c.urlId !== id);
  if (userId) {
    persistCloudCache(cachedCloudProjects, userId);
  }
}

const activeSyncPromises = new Map<string, Promise<void>>();

export function invalidatePocketBaseCache(): void {
  lastCloudFetchTime = 0;
  cachedCloudProjects = null;
}

export async function syncChatToPocketBase(
  id: string,
  messages: Message[],
  description?: string,
  snapshot?: Snapshot,
  projectId?: string,
): Promise<void> {
  const user = currentUser.get() || pb.authStore.record || (pb.authStore as any).model;
  if (!user || !pb.authStore.isValid || !id) return;

  const existingSync = activeSyncPromises.get(id);
  if (existingSync) {
    return existingSync;
  }

  const syncPromise = (async () => {
    try {
      const existing = await pb
        .collection('projects')
        .getFirstListItem(`(chat_id = "${id}" || id = "${id}") && user = "${user.id}"`)
        .catch(() => null);

      const payload: Record<string, any> = {
        chat_id: id,
        title: description || 'Untitled Project',
        user: user.id,
        description: description || '',
        file_tree: snapshot?.files ? snapshot.files : existing?.file_tree || {},
        prompt_history: messages,
        project_id: projectId || '',
      };

      if (existing) {
        await pb.collection('projects').update(existing.id, payload);
      } else {
        await pb.collection('projects').create(payload);
      }

      invalidatePocketBaseCache();

      // Immediately update browser memory cache
      updateCloudCacheItem(
        {
          id,
          description: payload.title,
          projectId,
          timestamp: new Date().toISOString(),
        },
        user.id,
      );
    } catch (error) {
      console.warn('[PocketBase] Failed to sync project to cloud:', error);
    } finally {
      activeSyncPromises.delete(id);
    }
  })();

  activeSyncPromises.set(id, syncPromise);
  return syncPromise;
}

export async function fetchPocketBaseProjects(options?: { force?: boolean }): Promise<ChatHistoryItem[]> {
  const user = currentUser.get() || pb.authStore.record || (pb.authStore as any).model;
  if (!user || !pb.authStore.isValid) return [];

  // If user changed, invalidate memory cache
  if (cachedUserId && cachedUserId !== user.id) {
    cachedCloudProjects = null;
    lastCloudFetchTime = 0;
  }
  cachedUserId = user.id;

  const force = options?.force === true;

  if (force) {
    lastCloudFetchTime = 0;
    cachedCloudProjects = null;
  }

  // Use browser memory cache if fresh and not forced (0 database hits!)
  if (!force && cachedCloudProjects !== null && Date.now() - lastCloudFetchTime < POCKETBASE_CACHE_TTL_MS) {
    return cachedCloudProjects;
  }

  // Deduplicate concurrent fetch requests UNLESS forced
  if (!force && activeCloudFetchPromise) {
    return activeCloudFetchPromise;
  }

  activeCloudFetchPromise = (async () => {
    try {
      // Sort chronologically newest first by updated then created
      const records = await pb.collection('projects').getFullList({
        sort: '-updated,-created',
        filter: `user = "${user.id}"`,
      });

      const seenIds = new Set<string>();
      const items: ChatHistoryItem[] = [];

      for (const record of records as any[]) {
        const canonicalId = record.chat_id || record.id;
        if (!canonicalId || seenIds.has(canonicalId)) {
          continue;
        }
        seenIds.add(canonicalId);

        const rawTimestamp = record.updated || record.created || new Date().toISOString();
        const safeTimestamp =
          typeof rawTimestamp === 'string' ? rawTimestamp.replace(' ', 'T') : new Date().toISOString();

        items.push({
          id: canonicalId,
          urlId: isInternalId(record.chat_id) ? (record.id || record.chat_id) : (record.chat_id || record.id),
          description: record.title || record.description || 'Untitled Project',
          messages:
            typeof record.prompt_history === 'string'
              ? JSON.parse(record.prompt_history)
              : record.prompt_history || [],
          timestamp: safeTimestamp,
          projectId: record.project_id || undefined,
        });
      }

      cachedCloudProjects = items;
      lastCloudFetchTime = Date.now();
      persistCloudCache(items, user.id);

      return items;
    } catch (error) {
      console.warn('[PocketBase] Failed to fetch cloud projects:', error);
      if (cachedCloudProjects !== null) {
        return cachedCloudProjects;
      }
      return [];
    } finally {
      activeCloudFetchPromise = null;
    }
  })();

  return activeCloudFetchPromise;
}

export async function deletePocketBaseProject(id: string): Promise<void> {
  const user = currentUser.get() || pb.authStore.record || (pb.authStore as any).model;
  if (!user || !pb.authStore.isValid) return;

  // Immediately remove from browser memory cache
  removeCloudCacheItem(id, user.id);

  try {
    const existing = await pb
      .collection('projects')
      .getFirstListItem(`(chat_id = "${id}" || id = "${id}") && user = "${user.id}"`)
      .catch(() => null);

    if (existing) {
      await pb.collection('projects').delete(existing.id);
    }
  } catch (error) {
    console.warn('[PocketBase] Failed to delete cloud project:', error);
  }
}

