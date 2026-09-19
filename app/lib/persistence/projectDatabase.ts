import { pb } from '~/lib/auth/pocketbase';
export interface ProjectDatabaseConnection {
  id: string;
  ownerToken: string;
}

const pending = new Map<string, Promise<ProjectDatabaseConnection>>();

export function resetDraftChatId(): string {
  if (typeof window !== 'undefined') {
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('pocketapp_draft_chat_id', draftId);
    return draftId;
  }
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function clearDraftChatId(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('pocketapp_draft_chat_id');
  }
}

/** Store connection metadata only; application records always live in PocketBase. */
export function ensureProjectDatabase(chatId?: string, projectId?: string): Promise<ProjectDatabaseConnection> {
  let effectiveId = projectId || chatId;
  if (!effectiveId && typeof window !== 'undefined') {
    let draftId = sessionStorage.getItem('pocketapp_draft_chat_id');
    if (!draftId) {
      draftId = resetDraftChatId();
    }
    effectiveId = draftId;
  }
  if (!effectiveId) {
    return Promise.reject(new Error('Save the project before connecting its database'));
  }

  const key = `pocketapp_project_db:${effectiveId}`;
  const existing = pending.get(key);

  if (existing) {
    return existing;
  }

  const request = (async () => {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');

    if (!pb.authStore.token && saved?.id && saved?.ownerToken) {
      return saved as ProjectDatabaseConnection;
    }

    let response = await fetch('/api/project-db/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(pb.authStore.token ? { Authorization: pb.authStore.token } : {}),
      },
      body: JSON.stringify({ chatId: effectiveId }),
    });

    if (response.status === 401 && pb.authStore.token) {
      console.warn('[ProjectDatabase] Auth token not accepted by project-db worker; retrying as guest...');
      response = await fetch('/api/project-db/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: effectiveId }),
      });
    }

    const project = (await response.json()) as ProjectDatabaseConnection & { error?: string };

    if (!response.ok || !project.id || !project.ownerToken) {
      if (saved?.id && saved?.ownerToken) {
        return saved as ProjectDatabaseConnection;
      }
      throw new Error(project.error || 'Could not provision the project database');
    }

    localStorage.setItem(key, JSON.stringify(project));

    return project;
  })();
  pending.set(key, request);
  void request.finally(() => pending.delete(key)).catch(() => {});

  return request;
}

export async function projectDatabaseRequest(
  project: ProjectDatabaseConnection,
  suffix: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set('X-Project-Token', project.ownerToken);

  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/project-db/${project.id}/${suffix}`, { ...init, headers });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(error.error || error.message || `Database request failed (${response.status})`);
  }

  return response;
}

export async function syncProjectSchema(project: ProjectDatabaseConnection, schema: unknown) {
  await projectDatabaseRequest(project, 'schema', { method: 'POST', body: JSON.stringify({ schema }) });
}
