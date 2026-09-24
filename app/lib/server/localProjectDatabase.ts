import { createHash, randomBytes } from 'node:crypto';

export function corsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Project-Token, Last-Event-ID',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
}

let cachedPbUrl: string | undefined;
let cacheTime = 0;

export async function getLocalPbUrl(env?: any): Promise<string> {
  const now = Date.now();
  if (cachedPbUrl && now - cacheTime < 30000) {
    return cachedPbUrl;
  }

  const candidates = [
    env?.INTERNAL_PB_URL,
    process.env.INTERNAL_PB_URL,
    'http://pocketbase:8090',
    process.env.VITE_POCKETBASE_URL,
    'http://127.0.0.1:8090',
    'http://localhost:8090',
  ].filter((url, idx, arr): url is string => Boolean(url) && arr.indexOf(url) === idx);

  for (const url of candidates) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        cachedPbUrl = url;
        cacheTime = now;
        return url;
      }
    } catch {}
  }

  return candidates[0] || 'http://pocketbase:8090';
}

let cachedToken: string | undefined;
let tokenExpiresAt = 0;

export async function getLocalSuperuserToken(pbUrl: string): Promise<string | undefined> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const res = await fetch(`${pbUrl}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'manager@pocketapp.internal',
        password: 'pocketapp-local-db-pass',
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data?.token) {
        cachedToken = data.token;
        tokenExpiresAt = now + 30 * 60 * 1000;
        return cachedToken;
      }
    }
  } catch (err) {
    console.warn('[LocalProjectDatabase] Superuser auth attempt failed:', err);
  }

  return undefined;
}

export function handleLocalProjectCreate(request: Request, body?: ArrayBuffer): Response {
  let chatId = '';
  if (body && body.byteLength > 0) {
    try {
      const text = new TextDecoder().decode(body);
      const parsed = JSON.parse(text);
      if (parsed?.chatId) chatId = String(parsed.chatId);
    } catch {}
  }

  const hash = chatId ? createHash('md5').update(chatId).digest('hex') : randomBytes(16).toString('hex');
  const projectId = `p-${hash}`;

  return Response.json(
    {
      id: projectId,
      ownerToken: 'local-owner-token',
    },
    { headers: corsHeaders() },
  );
}

export function normalizeSchema(input: any): any[] {
  const definitions = Array.isArray(input) ? input : input?.collections;
  if (!Array.isArray(definitions)) return [];
  const names = new Set<string>();
  const results: any[] = [];

  for (const col of definitions) {
    if (!col || typeof col.name !== 'string' || names.has(col.name)) continue;
    names.add(col.name);
    const rawFields = col.fields || col.schema || [];
    const fields = Array.isArray(rawFields) ? rawFields.map((f: any) => ({ ...f })) : [];
    results.push({
      name: col.name,
      type: col.type || 'base',
      listRule: col.listRule ?? '',
      viewRule: col.viewRule ?? '',
      createRule: col.createRule ?? '',
      updateRule: defRule(col.updateRule),
      deleteRule: defRule(col.deleteRule),
      fields,
    });
  }
  return results;
}

function defRule(val: any): string {
  return typeof val === 'string' ? val : '';
}

export function resolveTargetCollectionId(target: string | undefined, fieldName: string, collections: any[]): string | undefined {
  if (target) {
    const hint = target.trim();
    const byId = collections.find((c) => c.id === hint);
    if (byId) return byId.id;
    const direct = collections.find((c) => c.name.toLowerCase() === hint.toLowerCase());
    if (direct) return direct.id;
  }
  if (fieldName) {
    const match = collections.find((c) => c.name.toLowerCase() === fieldName.toLowerCase());
    if (match) return match.id;
  }
  return undefined;
}

export async function handleLocalProjectSchema(
  request: Request,
  body: ArrayBuffer | undefined,
  pbUrl: string,
): Promise<Response> {
  if (!body || body.byteLength === 0) {
    return Response.json({ success: true }, { headers: corsHeaders() });
  }

  let schemaInput: any;
  try {
    const text = new TextDecoder().decode(body);
    const parsed = JSON.parse(text);
    schemaInput = parsed.schema;
  } catch {
    return Response.json({ error: 'Invalid JSON schema payload' }, { status: 400, headers: corsHeaders() });
  }

  if (!schemaInput) {
    return Response.json({ success: true }, { headers: corsHeaders() });
  }

  const token = await getLocalSuperuserToken(pbUrl);
  if (!token) {
    console.warn('[LocalProjectDatabase] Superuser token unavailable, skipping schema sync against local PocketBase');
    return Response.json({ success: true, localWarning: 'No superuser token' }, { headers: corsHeaders() });
  }

  try {
    const definitions = normalizeSchema(schemaInput);
    const authHeaders = { Authorization: token, 'Content-Type': 'application/json' };

    const listRes = await fetch(`${pbUrl}/api/collections?perPage=500`, { headers: authHeaders });
    if (!listRes.ok) {
      throw new Error(`Failed to list collections (${listRes.status})`);
    }
    const existing = (await listRes.json()) as { items: any[] };

    for (const def of definitions) {
      if (!existing.items.some((item) => item.name === def.name)) {
        const createRes = await fetch(`${pbUrl}/api/collections`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            name: def.name,
            type: def.type || 'base',
            fields: [],
            listRule: def.listRule ?? '',
            viewRule: def.viewRule ?? '',
            createRule: def.createRule ?? '',
            updateRule: def.updateRule ?? '',
            deleteRule: def.deleteRule ?? '',
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          existing.items.push(created);
        }
      }
    }

    for (const def of definitions) {
      const col = existing.items.find((item) => item.name === def.name);
      if (!col) continue;

      const fields = [...(col.fields || [])];
      for (const name of ['created', 'updated']) {
        if (!fields.some((f: any) => f.name === name) && !def.fields.some((f: any) => f.name === name)) {
          fields.push({ name, type: 'autodate', onCreate: true, onUpdate: name === 'updated' });
        }
      }

      for (const field of def.fields) {
        const next = { ...field };
        if (next.type === 'relation') {
          const target = resolveTargetCollectionId(next.collectionId, next.name, existing.items);
          if (target) {
            next.collectionId = target;
          } else {
            next.type = 'text';
            delete next.collectionId;
          }
        }

        const idx = fields.findIndex((f: any) => f.name === next.name);
        if (idx >= 0) {
          if (!fields[idx].system) {
            fields[idx] = { ...fields[idx], ...next };
          }
        } else {
          fields.push(next);
        }
      }

      await fetch(`${pbUrl}/api/collections/${col.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          ...def,
          fields,
        }),
      });
    }

    return Response.json({ success: true }, { headers: corsHeaders() });
  } catch (err: any) {
    console.warn('[LocalProjectDatabase] Schema sync warning:', err.message);
    return Response.json({ success: true, warning: err.message }, { headers: corsHeaders() });
  }
}

export async function handleLocalProjectProxy(
  request: Request,
  suffix: string,
  body: ArrayBuffer | undefined,
  pbUrl: string,
): Promise<Response> {
  const match = suffix.match(/^p-[a-f0-9]{32}\/(data|admin)\/(api\/.*)$/);
  if (!match) {
    return Response.json({ error: 'Invalid route format' }, { status: 400, headers: corsHeaders() });
  }

  const mode = match[1];
  const targetPath = match[2];
  const targetUrl = `${pbUrl}/${targetPath}${new URL(request.url).search}`;

  const headers = new Headers();
  for (const [name, value] of request.headers.entries()) {
    const lower = name.toLowerCase();
    if (!lower.startsWith('cf-') && !['host', 'connection', 'cookie', 'x-project-token'].includes(lower)) {
      headers.set(name, value);
    }
  }

  if (mode === 'admin') {
    const adminToken = await getLocalSuperuserToken(pbUrl);
    if (adminToken) {
      headers.set('Authorization', adminToken);
    }
  }

  if (body) {
    headers.set('content-length', body.byteLength.toString());
  }

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : body,
  });

  const isSSE = targetPath.includes('api/realtime') || upstream.headers.get('content-type')?.includes('text/event-stream');
  const responseHeaders = corsHeaders();
  for (const name of ['content-type', 'cache-control', 'content-disposition']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  if (isSSE) {
    responseHeaders.set('Content-Type', 'text/event-stream; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');
    responseHeaders.set('Connection', 'keep-alive');
    responseHeaders.set('X-Accel-Buffering', 'no');
  } else {
    responseHeaders.set('Cache-Control', 'no-store');
  }

  let responseBody = [204, 205, 304].includes(upstream.status) ? null : upstream.body;
  if (responseBody) {
    const { readable, writable } = new TransformStream();
    responseBody.pipeTo(writable).catch(() => {});
    responseBody = readable;
  }

  return new Response(responseBody, { status: upstream.status, headers: responseHeaders });
}
