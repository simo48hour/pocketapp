import { getApiKeysFromCookie, parseCookies } from '~/lib/api/cookies';
import { decryptApiKey, encryptApiKey, isEncryptedApiKey } from './crypto';

export function getInternalPbUrl(context?: any): string {
  return (
    context?.cloudflare?.env?.INTERNAL_PB_URL ||
    process.env.INTERNAL_PB_URL ||
    (process.env.PORT === '3001' ? 'http://pocketbase-staging:8090' : 'http://platform-db:8090')
  );
}

export function extractPbAuth(request: Request): { token?: string; userId?: string } {
  const authHeader = request.headers.get('Authorization');

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token) {
      let userId: string | undefined;

      // Extract userId from PocketBase JWT payload
      try {
        const parts = token.split('.');

        if (parts.length === 3) {
          const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
          const payload = JSON.parse(payloadStr);

          if (payload && payload.id) {
            userId = payload.id;
          }
        }
      } catch {}

      return { token, userId };
    }
  }

  const cookieHeader = request.headers.get('Cookie');

  if (!cookieHeader) {
    return {};
  }

  const cookies = parseCookies(cookieHeader);

  if (cookies.pb_auth) {
    try {
      const parsed = JSON.parse(cookies.pb_auth);
      let userId: string | undefined = parsed.record?.id || parsed.model?.id;
      const token: string | undefined = parsed.token;

      if (token && !userId) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
            userId = payload?.id;
          }
        } catch {}
      }

      return { token, userId };
    } catch {}
  }

  return {};
}

/**
 * Resolves user API keys across:
 * 1. Encrypted HttpOnly cookie (apiKeys)
 * 2. PocketBase user_api_keys table (if authenticated)
 *
 * Automatically migrates legacy unencrypted database keys to AES-256-GCM.
 */
export async function resolveUserApiKeys(
  request: Request,
  context?: any,
): Promise<{
  apiKeys: Record<string, string>;
  needsCookieUpdate: boolean;
}> {
  const cookieHeader = request.headers.get('Cookie');
  const cookieKeys = getApiKeysFromCookie(cookieHeader, context);
  const keys: Record<string, string> = { ...cookieKeys };

  let needsCookieUpdate = false;

  const { token, userId } = extractPbAuth(request);

  if (token && userId) {
    try {
      const pbUrl = getInternalPbUrl(context);
      const res = await fetch(
        `${pbUrl}/api/collections/user_api_keys/records?filter=(user='${userId}')`,
        {
          headers: {
            Authorization: token,
          },
        },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          items: Array<{ id: string; provider: string; encrypted_key: string }>;
        };

        for (const item of data.items || []) {
          if (!item.provider || !item.encrypted_key) continue;

          let plainKey = '';

          if (!isEncryptedApiKey(item.encrypted_key)) {
            // Legacy plain text key - decrypt gracefully and opportunistically re-save as AES-256-GCM
            plainKey = item.encrypted_key;

            try {
              const encrypted = encryptApiKey(plainKey, context);
              await fetch(`${pbUrl}/api/collections/user_api_keys/records/${item.id}`, {
                method: 'PATCH',
                headers: {
                  Authorization: token,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  encrypted_key: encrypted,
                }),
              });
            } catch (patchErr) {
              console.warn('[userKeys] Failed to migrate legacy key in DB:', patchErr);
            }
          } else {
            plainKey = decryptApiKey(item.encrypted_key, context);
          }

          if (
            plainKey &&
            plainKey !== 'configured' &&
            plainKey !== 'true' &&
            plainKey !== 'false' &&
            !plainKey.includes('your_')
          ) {
            if (keys[item.provider] !== plainKey) {
              keys[item.provider] = plainKey;
              needsCookieUpdate = true;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[userKeys] PocketBase sync skipped:', err);
    }
  }

  // Final sanitization: strip any dummy or corrupted entries
  for (const [provider, key] of Object.entries(keys)) {
    if (
      typeof key !== 'string' ||
      key.trim() === '' ||
      key === 'configured' ||
      key === 'true' ||
      key === 'false' ||
      key.includes('your_') ||
      isEncryptedApiKey(key)
    ) {
      delete keys[provider];
      needsCookieUpdate = true;
    }
  }

  return { apiKeys: keys, needsCookieUpdate };
}
