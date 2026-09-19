import { atom } from 'nanostores';
import { pb } from '~/lib/auth/pocketbase';
import Cookies from 'js-cookie';
import { hasConfiguredKeysAtom } from '~/lib/stores/modalStore';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  subscription_status?: string;
  daily_free_requests_count?: number;
  free_requests_day?: string;
}

export interface AvailableAuthProviders {
  google: boolean;
  github: boolean;
}

export function extractUserProfile(record: any, meta?: any): UserProfile {
  let avatarUrl: string | undefined;

  try {
    if (record?.avatar) {
      avatarUrl = pb.files.getURL(record, record.avatar);
    } else if (meta?.avatarUrl) {
      avatarUrl = meta.avatarUrl;
    } else if (record?.avatarUrl) {
      avatarUrl = record.avatarUrl;
    }
  } catch {
    avatarUrl = meta?.avatarUrl || record?.avatarUrl || undefined;
  }

  return {
    id: record?.id || '',
    email: record?.email || '',
    name: record?.name || meta?.name || record?.email?.split('@')[0] || 'Developer',
    avatar: avatarUrl,
    subscription_status: record?.subscription_status,
    daily_free_requests_count: record?.daily_free_requests_count,
    free_requests_day: record?.free_requests_day,
  };
}

const initialRecord = pb.authStore.isValid ? pb.authStore.record || (pb.authStore as any).model : null;

export const currentUser = atom<UserProfile | null>(
  initialRecord ? extractUserProfile(initialRecord) : null
);

export function getAuthenticatedUser(): UserProfile | null {
  const current = currentUser.get();
  if (current) return current;

  if (typeof window !== 'undefined' && pb.authStore.isValid) {
    const record = pb.authStore.record || (pb.authStore as any).model;
    if (record) {
      const profile = extractUserProfile(record);
      currentUser.set(profile);
      return profile;
    }
  }

  return null;
}

export const authProvidersState = atom<AvailableAuthProviders | null>(null);

export async function fetchAvailableAuthProviders(): Promise<AvailableAuthProviders> {
  try {
    const methods = (await pb.collection('users').listAuthMethods()) as any;
    const providers = methods?.oauth2?.providers || methods?.authProviders || [];
    const googleEnabled = Array.isArray(providers) && providers.some((p: any) => p.name === 'google');
    const githubEnabled = Array.isArray(providers) && providers.some((p: any) => p.name === 'github');

    const result = { google: googleEnabled, github: githubEnabled };
    authProvidersState.set(result);
    return result;
  } catch (err) {
    console.warn('[PocketBase] Failed to fetch auth methods:', err);
    const fallback = { google: false, github: false };
    authProvidersState.set(fallback);
    return fallback;
  }
}

if (typeof window !== 'undefined') {
  pb.authStore.onChange(() => {
    const record = pb.authStore.record || (pb.authStore as any).model;
    if (pb.authStore.isValid && record) {
      currentUser.set(extractUserProfile(record));
    } else {
      currentUser.set(null);
    }
  });

  // Prefetch auth methods in browser
  fetchAvailableAuthProviders().catch(() => {});
}

export const isAuthModalOpen = atom<boolean>(false);
export const onAuthSuccessCallback = atom<(() => void) | null>(null);

export function triggerAuthSuccess() {
  const cb = onAuthSuccessCallback.get();

  if (cb) {
    onAuthSuccessCallback.set(null);
    cb();
  }
}

export async function loginWithPassword(email: string, pass: string) {
  const authData = await pb.collection('users').authWithPassword(email, pass);
  currentUser.set(extractUserProfile(authData.record));
  await syncApiKeysFromCloud(authData.record.id);
  return authData;
}

export async function registerWithPassword(email: string, pass: string, passConfirm: string, name?: string) {
  await pb.collection('users').create({
    email,
    password: pass,
    passwordConfirm: passConfirm,
    name: name || email.split('@')[0],
  });
  return loginWithPassword(email, pass);
}

export async function loginWithOAuth(provider: 'google' | 'github') {
  const authData = await pb.collection('users').authWithOAuth2({
    provider,
  });

  if (authData.record) {
    currentUser.set(extractUserProfile(authData.record, authData.meta));
    await syncApiKeysFromCloud(authData.record.id);
  }
  return authData;
}

export async function loginWithGoogleOneTap(credential: string) {
  let authData: any = null;

  // Primary: Try direct PocketBase hook via pb.send
  try {
    authData = await pb.send('/api/google-one-tap', {
      method: 'POST',
      body: { credential },
    });
  } catch (err) {
    console.warn('[Google One Tap] pb.send(/api/google-one-tap) failed, falling back to /api/auth/google-one-tap:', err);
    // Fallback: Try Remix backend proxy route
    const res = await fetch('/api/auth/google-one-tap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    if (res.ok) {
      authData = await res.json();
    } else {
      const errText = await res.text();
      throw new Error(`Google One Tap login failed: ${errText}`);
    }
  }

  if (authData && authData.token && authData.record) {
    pb.authStore.save(authData.token, authData.record);
    currentUser.set(extractUserProfile(authData.record, authData.meta));
    await syncApiKeysFromCloud(authData.record.id);
    return authData;
  }

  throw new Error('Invalid authentication response received');
}

export function logout() {
  pb.authStore.clear();
  currentUser.set(null);
  window.location.reload();
}

/**
 * Save user API key to backend with AES-256-GCM encryption and HttpOnly cookie hardening
 */
export async function saveUserApiKeyToCloud(provider: string, apiKey: string): Promise<boolean> {
  if (
    !apiKey ||
    typeof apiKey !== 'string' ||
    apiKey.trim().length === 0 ||
    apiKey === 'configured' ||
    apiKey === 'true' ||
    apiKey === 'false' ||
    apiKey.startsWith('iv:')
  ) {
    return false;
  }

  try {
    const res = await fetch('/api/user/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
      },
      body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
    });

    if (res.ok) {
      hasConfiguredKeysAtom.set(true);
    }

    return res.ok;
  } catch (err) {
    console.warn('[authStore] Failed to save API key to server:', err);
    return false;
  }
}

/**
 * Delete a user API key from backend and HttpOnly cookie
 */
export async function deleteUserApiKey(provider: string): Promise<boolean> {
  try {
    const res = await fetch('/api/user/keys', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
      },
      body: JSON.stringify({ provider }),
    });

    return res.ok;
  } catch (err) {
    console.warn('[authStore] Failed to delete API key on server:', err);
    return false;
  }
}

/**
 * Sync user API keys from PocketBase via the server endpoint.
 * This triggers opportunistic AES-256-GCM encryption of legacy keys
 * and establishes the secure HttpOnly cookie.
 */
export async function syncApiKeysFromCloud(userId?: string) {
  try {
    const res = await fetch('/api/user/keys/status', {
      headers: {
        ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
      },
    });

    // Remove legacy client-accessible plain text cookie if present
    Cookies.remove('apiKeys');

    if (res.ok) {
      const data = (await res.json()) as { configured?: Record<string, boolean> };

      if (data?.configured) {
        const hasKey = Object.values(data.configured).some(Boolean);
        hasConfiguredKeysAtom.set(hasKey);
      }

      return data;
    }
  } catch (err) {
    console.warn('[authStore] Failed to sync keys from server:', err);
  }
}

// Auto-sync on startup if already logged in
if (typeof window !== 'undefined' && pb.authStore.isValid && pb.authStore.record) {
  syncApiKeysFromCloud(pb.authStore.record.id).catch(() => {});
}
