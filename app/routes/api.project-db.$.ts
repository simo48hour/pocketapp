import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import {
  corsHeaders,
  getLocalPbUrl,
  handleLocalProjectCreate,
  handleLocalProjectProxy,
  handleLocalProjectSchema,
} from '~/lib/server/localProjectDatabase';

async function proxy({ request, params, context }: LoaderFunctionArgs | ActionFunctionArgs) {
  const suffix = params['*'] || '';
  const allowed = suffix === 'create' || /^p-[a-f0-9]{32}\/(schema|(?:data|admin)\/api\/(?:realtime|.*))$/.test(suffix);
  if (!allowed || suffix.includes('..')) return Response.json({ error: 'Invalid database route' }, { status: 400 });

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

  const env = (context as any)?.cloudflare?.env;
  // This route runs inside the app container in production; Cloudflare's
  // worker shim does not reliably expose process.env to request handlers.
  const workers = [
    env?.DEPLOY_WORKER_URL,
    'http://deploy-worker:4000',
    'http://pocketapp-deploy-worker:4000',
    'http://127.0.0.1:4000',
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  const headers = new Headers();
  for (const [name, value] of request.headers.entries()) {
    const lower = name.toLowerCase();
    if (!lower.startsWith('cf-') && !['host', 'connection', 'cookie'].includes(lower)) {
      headers.set(name, value);
    }
  }

  const internalPbUrl = env?.INTERNAL_PB_URL || process.env.INTERNAL_PB_URL || 'http://platform-db:8090';
  headers.set('x-internal-pb-url', internalPbUrl);

  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body) {
      headers.set('content-length', body.byteLength.toString());
    }

    let upstream: Response | undefined;
    for (const worker of workers) {
      try {
        upstream = await fetch(
          `${worker}/projects${suffix === 'create' ? '' : '/' + suffix}${new URL(request.url).search}`,
          {
            method: request.method,
            headers,
            body,
            signal: AbortSignal.timeout(1500),
          },
        );
        break;
      } catch {
        // Try the next address so local development and compose deployments both work.
      }
    }

    // Fall back to local PocketBase instance if deploy-worker is not present (e.g. open-source local dev / docker compose)
    if (!upstream) {
      const localPb = await getLocalPbUrl(env);
      if (suffix === 'create') {
        return handleLocalProjectCreate(request, body);
      }
      if (suffix.endsWith('/schema')) {
        return await handleLocalProjectSchema(request, body, localPb);
      }
      return await handleLocalProjectProxy(request, suffix, body, localPb);
    }

    const isSSE = suffix.includes('/api/realtime') || upstream.headers.get('content-type')?.includes('text/event-stream');
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
      responseBody.pipeTo(writable).catch(() => {
        // Client disconnected or upstream stream closed - safely ignore
      });
      responseBody = readable;
    }

    return new Response(responseBody, { status: upstream.status, headers: responseHeaders });
  } catch (error: any) {
    console.error('[ProjectDatabaseProxy] Route proxy error:', error?.message);
    return Response.json({ error: 'Project database service is unavailable' }, { status: 503, headers: corsHeaders() });
  }
}

export const loader = proxy;
export const action = proxy;
