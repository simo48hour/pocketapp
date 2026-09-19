/**
 * Utility for tracking and bulk-revoking Object URLs (blob URLs)
 * to prevent Chromium memory leaks across page navigations and bfcache.
 */

const trackedUrls = new Set<string>();
let isTrackingInstalled = false;

export function installGlobalObjectUrlTracking(): void {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || isTrackingInstalled) {
    return;
  }

  try {
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);

    URL.createObjectURL = (object: Blob | MediaSource): string => {
      const url = originalCreate(object);
      trackedUrls.add(url);
      return url;
    };

    URL.revokeObjectURL = (url: string): void => {
      trackedUrls.delete(url);
      originalRevoke(url);
    };

    isTrackingInstalled = true;
  } catch (err) {
    console.warn('[objectUrl] Failed to install global URL.createObjectURL tracking:', err);
  }
}

/**
 * Creates an object URL and tracks it for future bulk revocation.
 */
export function createTrackedObjectURL(object: Blob | MediaSource): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }
  const url = URL.createObjectURL(object);
  trackedUrls.add(url);
  return url;
}

/**
 * Explicitly revokes a tracked object URL.
 */
export function revokeTrackedObjectURL(url: string): void {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function' || !url) {
    return;
  }
  trackedUrls.delete(url);
  try {
    URL.revokeObjectURL(url);
  } catch {}
}

/**
 * Revokes all currently active blob URLs tracked in this window/tab.
 */
export function revokeAllObjectURLs(): void {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
    return;
  }
  for (const url of trackedUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  trackedUrls.clear();
}

// Auto-install tracking when running in browser
if (typeof window !== 'undefined') {
  installGlobalObjectUrlTracking();
}
