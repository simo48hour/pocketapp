import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getApiKeysFromCookie, serializeApiKeysCookie } from '~/lib/api/cookies';
import { encryptApiKey } from '~/lib/.server/crypto';
import { extractPbAuth, getInternalPbUrl } from '~/lib/.server/userKeys';
import { loader as statusLoader } from './api.user.keys.status';

export async function loader(args: LoaderFunctionArgs) {
  return statusLoader(args);
}

export async function action({ request, context }: ActionFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');
  const currentKeys = getApiKeysFromCookie(cookieHeader, context);
  const { token, userId } = extractPbAuth(request);
  const pbUrl = getInternalPbUrl(context);

  if (request.method === 'POST') {
    let body: any = {};

    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { provider, apiKey } = body || {};

    if (!provider || typeof provider !== 'string') {
      return json({ error: 'Provider name is required' }, { status: 400 });
    }

    const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';

    if (
      trimmedKey === 'configured' ||
      trimmedKey === 'true' ||
      trimmedKey === 'false' ||
      trimmedKey.startsWith('iv:')
    ) {
      return json({ error: 'Invalid API key value' }, { status: 400 });
    }

    if (trimmedKey.length === 0) {
      // Treat empty key as remove
      delete currentKeys[provider];

      if (token && userId) {
        try {
          const listRes = await fetch(
            `${pbUrl}/api/collections/user_api_keys/records?filter=(user='${userId}' && provider='${provider}')`,
            { headers: { Authorization: token } },
          );

          if (listRes.ok) {
            const data = (await listRes.json()) as any;

            for (const item of data.items || []) {
              await fetch(`${pbUrl}/api/collections/user_api_keys/records/${item.id}`, {
                method: 'DELETE',
                headers: { Authorization: token },
              });
            }
          }
        } catch (e) {
          console.warn('[KeysAction] Failed to delete key from PocketBase:', e);
        }
      }

      return json(
        { success: true, provider, isConfigured: false },
        {
          headers: {
            'Set-Cookie': serializeApiKeysCookie(currentKeys, { context }),
          },
        },
      );
    }

    // Update in-memory cookie dictionary
    currentKeys[provider] = trimmedKey;

    // Encrypt with AES-256-GCM before writing to PocketBase
    if (token && userId) {
      try {
        const encryptedKey = encryptApiKey(trimmedKey, context);
        const hint =
          trimmedKey.length > 8 ? `${trimmedKey.slice(0, 4)}...${trimmedKey.slice(-4)}` : '****';

        const listRes = await fetch(
          `${pbUrl}/api/collections/user_api_keys/records?filter=(user='${userId}' && provider='${provider}')`,
          { headers: { Authorization: token } },
        );

        if (listRes.ok) {
          const data = (await listRes.json()) as any;

          if (data.items && data.items.length > 0) {
            const existingId = data.items[0].id;

            await fetch(`${pbUrl}/api/collections/user_api_keys/records/${existingId}`, {
              method: 'PATCH',
              headers: {
                Authorization: token,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                encrypted_key: encryptedKey,
                key_hint: hint,
              }),
            });
          } else {
            await fetch(`${pbUrl}/api/collections/user_api_keys/records`, {
              method: 'POST',
              headers: {
                Authorization: token,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user: userId,
                provider,
                encrypted_key: encryptedKey,
                key_hint: hint,
              }),
            });
          }
        }
      } catch (dbErr) {
        console.warn('[KeysAction] Failed to persist encrypted key to PocketBase:', dbErr);
      }
    }

    return json(
      { success: true, provider, isConfigured: true },
      {
        headers: {
          'Set-Cookie': serializeApiKeysCookie(currentKeys, { context }),
        },
      },
    );
  }

  if (request.method === 'DELETE') {
    let body: any = {};

    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { provider } = body || {};

    if (!provider || typeof provider !== 'string') {
      return json({ error: 'Provider name is required' }, { status: 400 });
    }

    delete currentKeys[provider];

    if (token && userId) {
      try {
        const listRes = await fetch(
          `${pbUrl}/api/collections/user_api_keys/records?filter=(user='${userId}' && provider='${provider}')`,
          { headers: { Authorization: token } },
        );

        if (listRes.ok) {
          const data = (await listRes.json()) as any;

          for (const item of data.items || []) {
            await fetch(`${pbUrl}/api/collections/user_api_keys/records/${item.id}`, {
              method: 'DELETE',
              headers: { Authorization: token },
            });
          }
        }
      } catch (e) {
        console.warn('[KeysAction] Failed to delete key from PocketBase:', e);
      }
    }

    return json(
      { success: true, provider, isConfigured: false },
      {
        headers: {
          'Set-Cookie': serializeApiKeysCookie(currentKeys, { context }),
        },
      },
    );
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}
