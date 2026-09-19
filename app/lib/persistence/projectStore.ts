import { atom } from 'nanostores';
import type { SidebarProject } from './projectTypes';
import { getMessages, setMessages, deleteById, getAll } from './db';
import { chatProjectId } from './chatId';
import { removeChatFromStore, setChatProjectInStore } from './chatHistoryStore';
import { deletePocketBaseProject } from './pocketbaseSync';
import { pb } from '~/lib/auth/pocketbase';
import { currentUser } from '~/lib/stores/authStore';

const STORAGE_KEY = 'bolt_sidebar_projects';

// Nanostore atoms for reactive UI
export const projectsAtom = atom<SidebarProject[]>(loadInitialProjects());
export const currentProjectIdAtom = chatProjectId;

function loadInitialProjects(): SidebarProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistToStorage(projects: SidebarProject[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to persist projects to localStorage:', err);
  }
}

let lastProjectsFetchTime = 0;
const PROJECTS_CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

/**
 * Fetch all projects from IndexedDB, falling back to localStorage
 */
export async function getAllProjects(db?: IDBDatabase, options?: { force?: boolean }): Promise<SidebarProject[]> {
  const force = options?.force === true;
  if (force) {
    lastProjectsFetchTime = 0;
  }

  if (!force && projectsAtom.get().length > 0 && Date.now() - lastProjectsFetchTime < PROJECTS_CACHE_TTL_MS) {
    return projectsAtom.get();
  }

  const localProjects = loadInitialProjects();
  let idbProjects: SidebarProject[] = [];

  if (db && db.objectStoreNames.contains('projects')) {
    try {
      idbProjects = await new Promise<SidebarProject[]>((resolve) => {
        const transaction = db.transaction('projects', 'readonly');
        const store = transaction.objectStore('projects');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn('Failed to read projects from IndexedDB:', err);
    }
  }

  // Fetch from PocketBase cloud if user is authenticated
  let cloudProjects: SidebarProject[] = [];
  try {
    const user = currentUser.get() || pb.authStore.record || (pb.authStore as any).model;
    if (user && pb.authStore.isValid) {
      const records = await pb.collection('sidebar_projects').getFullList({
        filter: `user = "${user.id}"`,
      });
      cloudProjects = (records as any[]).map((r) => ({
        id: r.project_id || r.id,
        name: r.name,
        description: r.description || '',
        color: r.color || 'purple',
        createdAt: r.created || new Date().toISOString(),
        updatedAt: r.updated || new Date().toISOString(),
      }));
    }
  } catch (cloudErr) {
    // Cloud fetch optional
  }

  // Merge IDB + localStorage + PocketBase
  const map = new Map<string, SidebarProject>();
  for (const p of localProjects) {
    map.set(p.id, p);
  }
  for (const p of idbProjects) {
    map.set(p.id, p);
  }
  for (const p of cloudProjects) {
    map.set(p.id, p);
  }

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  persistToStorage(merged);
  projectsAtom.set(merged);
  lastProjectsFetchTime = Date.now();
  return merged;
}

/**
 * Create a new SidebarProject
 */
export async function createSidebarProject(
  name: string,
  options?: { description?: string; color?: string; db?: IDBDatabase },
): Promise<SidebarProject> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Project name cannot be empty');
  }

  const now = new Date().toISOString();
  const id = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const newProject: SidebarProject = {
    id,
    name: trimmedName,
    description: options?.description?.trim() || '',
    color: options?.color || 'purple',
    createdAt: now,
    updatedAt: now,
  };

  const current = projectsAtom.get();
  const updated = [newProject, ...current];
  projectsAtom.set(updated);
  persistToStorage(updated);

  if (options?.db && options.db.objectStoreNames.contains('projects')) {
    try {
      const transaction = options.db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      store.put(newProject);
    } catch (err) {
      console.warn('Failed to save project to IndexedDB:', err);
    }
  }

  const user = currentUser.get() || pb.authStore.record || (pb.authStore as any).model;
  if (user && pb.authStore.isValid) {
    pb.collection('sidebar_projects')
      .create({
        user: user.id,
        project_id: newProject.id,
        name: newProject.name,
        description: newProject.description,
        color: newProject.color,
      })
      .catch((err) => console.warn('Failed to sync sidebar project to PocketBase:', err));
  }

  return newProject;
}

/**
 * Update an existing project
 */
export async function updateSidebarProject(
  id: string,
  updates: Partial<Pick<SidebarProject, 'name' | 'description' | 'color'>>,
  db?: IDBDatabase,
): Promise<SidebarProject> {
  const current = projectsAtom.get();
  const index = current.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error('Project not found');
  }

  const updatedProject: SidebarProject = {
    ...current[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const updatedList = [...current];
  updatedList[index] = updatedProject;
  projectsAtom.set(updatedList);
  persistToStorage(updatedList);

  if (db && db.objectStoreNames.contains('projects')) {
    try {
      const transaction = db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      store.put(updatedProject);
    } catch (err) {
      console.warn('Failed to update project in IndexedDB:', err);
    }
  }

  const user = currentUser.get() || pb.authStore.record || (pb.authStore as any).model;
  if (user && pb.authStore.isValid) {
    pb.collection('sidebar_projects')
      .getFirstListItem(`(project_id = "${id}" || id = "${id}") && user = "${user.id}"`)
      .then((record) =>
        pb.collection('sidebar_projects').update(record.id, {
          name: updatedProject.name,
          description: updatedProject.description,
          color: updatedProject.color,
        }),
      )
      .catch(() => {});
  }

  return updatedProject;
}

/**
 * Delete a project and optionally delete or unassign its chats
 */
export async function deleteSidebarProject(
  id: string,
  db?: IDBDatabase,
  deleteChats: boolean = false,
): Promise<void> {
  const current = projectsAtom.get();
  const updatedList = current.filter((p) => p.id !== id);
  projectsAtom.set(updatedList);
  persistToStorage(updatedList);

  if (currentProjectIdAtom.get() === id) {
    currentProjectIdAtom.set(undefined);
  }

  const user = currentUser.get() || pb.authStore.record || (pb.authStore as any).model;
  if (user && pb.authStore.isValid) {
    pb.collection('sidebar_projects')
      .getFirstListItem(`(project_id = "${id}" || id = "${id}") && user = "${user.id}"`)
      .then((record) => pb.collection('sidebar_projects').delete(record.id))
      .catch(() => {});
  }

  if (db) {
    if (db.objectStoreNames.contains('projects')) {
      try {
        const transaction = db.transaction('projects', 'readwrite');
        const store = transaction.objectStore('projects');
        store.delete(id);
      } catch (err) {
        console.warn('Failed to delete project from IndexedDB:', err);
      }
    }

    // Handle project chats
    try {
      const allChats = await getAll(db);
      const projectChats = allChats.filter((c) => c.projectId === id);

      for (const chat of projectChats) {
        if (deleteChats) {
          removeChatFromStore(chat.id);
          deletePocketBaseProject(chat.id).catch(() => {});
          await deleteById(db, chat.id);
        } else {
          // Unassign chat from project
          setChatProjectInStore(chat.id, undefined);
          await setMessages(
            db,
            chat.id,
            chat.messages,
            chat.urlId,
            chat.description,
            chat.timestamp,
            chat.metadata,
            undefined, // Clear projectId
          );
        }
      }
    } catch (err) {
      console.warn('Failed to clean up project chats:', err);
    }
  }
}

/**
 * Assign or reassign a chat to a project (or undefined to unassign)
 */
export async function assignChatToProject(
  chatId: string,
  projectId: string | undefined,
  db?: IDBDatabase,
): Promise<void> {
  // Instantly update browser memory store
  setChatProjectInStore(chatId, projectId);

  if (!db || !chatId) return;

  const chat = await getMessages(db, chatId);
  if (!chat) return;

  await setMessages(
    db,
    chat.id,
    chat.messages,
    chat.urlId,
    chat.description,
    chat.timestamp,
    chat.metadata,
    projectId,
  );
}

/**
 * Helper to synchronously look up a project by ID
 */
export function getProjectById(id?: string): SidebarProject | undefined {
  if (!id) return undefined;
  return projectsAtom.get().find((p) => p.id === id);
}
