import { atom } from 'nanostores';

export const isMissingKeyModalOpen = atom<boolean>(false);
export const hasConfiguredKeysAtom = atom<boolean | null>(null);
export const onKeySavedCallback = atom<(() => void) | null>(null);

export function triggerKeySaved() {
  const cb = onKeySavedCallback.get();

  if (cb) {
    onKeySavedCallback.set(null);
    cb();
  }
}

let checkPromise: Promise<boolean> | null = null;

/**
 * Verifies whether the user has at least one configured API key
 * via the secure server status endpoint (without exposing raw keys).
 */
export async function checkHasConfiguredKeys(forceRefresh = false): Promise<boolean> {
  const cached = hasConfiguredKeysAtom.get();

  if (!forceRefresh && cached !== null) {
    return cached;
  }

  if (checkPromise) {
    return checkPromise;
  }

  checkPromise = (async () => {
    try {
      const headers: Record<string, string> = {};

      if (typeof window !== 'undefined') {
        const pbAuth = localStorage.getItem('pocketbase_auth');

        if (pbAuth) {
          try {
            const parsed = JSON.parse(pbAuth);

            if (parsed.token) {
              headers.Authorization = `Bearer ${parsed.token}`;
            }
          } catch {}
        }
      }

      const res = await fetch('/api/user/keys/status', {
        headers,
        cache: 'no-store',
      });

      if (res.ok) {
        const data = (await res.json()) as { configured?: Record<string, boolean> };
        const configured = data.configured || {};
        const hasKey = Object.values(configured).some(Boolean);
        hasConfiguredKeysAtom.set(hasKey);

        return hasKey;
      }
    } catch (err) {
      console.warn('[modalStore] Failed to check key status:', err);
    } finally {
      checkPromise = null;
    }

    return hasConfiguredKeysAtom.get() ?? false;
  })();

  return checkPromise;
}

// Initial status check in browser
if (typeof window !== 'undefined') {
  checkHasConfiguredKeys().catch(() => {});
}
