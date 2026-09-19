import PocketBase from 'pocketbase';

const isBrowser = typeof window !== 'undefined';

const getPocketBaseUrl = () => {
  if (isBrowser) {
    const customUrl = (import.meta as any).env?.VITE_POCKETBASE_URL;
    if (customUrl) {
      return customUrl;
    }
    if (window.location.port === '5173') {
      return `${window.location.protocol}//${window.location.hostname}:8090`;
    }
    return window.location.origin + '/api/pb';
  }
  return process.env.INTERNAL_PB_URL || process.env.VITE_POCKETBASE_URL || 'http://platform-db:8090';
};

export const pb = new PocketBase(getPocketBaseUrl());

if (isBrowser) {
  if (document.cookie && document.cookie.includes('pb_auth')) {
    pb.authStore.loadFromCookie(document.cookie);
  }

  // Fallback to localStorage if cookie didn't yield a valid session
  if (!pb.authStore.isValid) {
    try {
      const local = localStorage.getItem('pocketbase_auth');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed?.token) {
          pb.authStore.save(parsed.token, parsed.model || parsed.record);
        }
      }
    } catch {}
  }

  // Ensure document.cookie and localStorage are synced if session is valid
  if (pb.authStore.isValid) {
    document.cookie = pb.authStore.exportToCookie({
      httpOnly: false,
      sameSite: 'Lax',
      secure: window.location.protocol === 'https:',
      path: '/',
    });
    try {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token: pb.authStore.token, model: pb.authStore.record || (pb.authStore as any).model }),
      );
    } catch {}

    // Refresh record in background to fetch updated subscription_status or settings
    pb.collection('users').authRefresh().catch(() => {});
  }

  pb.authStore.onChange(() => {
    if (pb.authStore.isValid) {
      document.cookie = pb.authStore.exportToCookie({
        httpOnly: false,
        sameSite: 'Lax',
        secure: window.location.protocol === 'https:',
        path: '/',
      });
      try {
        localStorage.setItem(
          'pocketbase_auth',
          JSON.stringify({ token: pb.authStore.token, model: pb.authStore.record || (pb.authStore as any).model }),
        );
      } catch {}
    } else {
      document.cookie = 'pb_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
      try {
        localStorage.removeItem('pocketbase_auth');
      } catch {}
    }
  });
}
