import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { getInternalPbUrl } from '~/lib/.server/userKeys';

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: any = {};

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { credential } = body || {};

  if (!credential || typeof credential !== 'string') {
    return json({ error: 'Missing or invalid credential token' }, { status: 400 });
  }

  const pbUrl =
    (context as any)?.cloudflare?.env?.INTERNAL_PB_URL ||
    process.env.INTERNAL_PB_URL ||
    getInternalPbUrl(context) ||
    'http://pocketapp-db:8090';

  try {
    // Forward to PocketBase Google One Tap hook
    const pbResponse = await fetch(`${pbUrl}/api/google-one-tap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });

    if (pbResponse.ok) {
      const data = await pbResponse.json();
      return json(data);
    }

    const errorText = await pbResponse.text();
    console.warn('[GoogleOneTap API] PocketBase hook returned non-ok status:', pbResponse.status, errorText);

    return json(
      { error: 'Authentication failed', details: errorText },
      { status: pbResponse.status >= 400 && pbResponse.status < 600 ? pbResponse.status : 401 },
    );
  } catch (err: any) {
    console.error('[GoogleOneTap API] Error contacting PocketBase:', err);
    return json({ error: 'Failed to connect to authentication server' }, { status: 502 });
  }
}
