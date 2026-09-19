import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

async function proxy({ request, params, context }: LoaderFunctionArgs | ActionFunctionArgs) {
  const suffix = params['*'] || '';
  const allowed = suffix === 'create' || /^p-[a-f0-9]{32}\/(schema|(?:data|admin)\/api\/(?:realtime|.*))$/.test(suffix);
  if (!allowed || suffix.includes('..')) return Response.json({ error: 'Invalid database route' }, { status: 400 });
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
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
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
          },
        );
        break;
      } catch {
        // Try the next address so local development and compose deployments both work.
      }
    }
    if (!upstream) throw new Error('No deploy worker endpoint available');
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
  } catch {
    return Response.json({ error: 'Project database service is unavailable' }, { status: 503, headers: corsHeaders() });
  }
}
function corsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Project-Token, Last-Event-ID',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
}
export const loader = proxy;
export const action = proxy;
