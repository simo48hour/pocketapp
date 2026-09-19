import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { serializeApiKeysCookie } from '~/lib/api/cookies';
import { resolveUserApiKeys } from '~/lib/.server/userKeys';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { apiKeys: keys, needsCookieUpdate } = await resolveUserApiKeys(request, context);

  // Check which providers have valid keys configured
  const configured: Record<string, boolean> = {};

  for (const [provider, key] of Object.entries(keys)) {
    if (typeof key === 'string' && key.trim().length > 0 && !key.includes('your_')) {
      configured[provider] = true;
    }
  }

  const responseHeaders = new Headers({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });

  if (needsCookieUpdate) {
    responseHeaders.append('Set-Cookie', serializeApiKeysCookie(keys, { context }));
  }

  return json(
    {
      configured,
      hasOpenAiKey: Boolean(configured.OpenAI),
      hasDeepSeekKey: Boolean(configured.DeepSeek),
      hasAnthropicKey: Boolean(configured.Anthropic),
      hasGoogleKey: Boolean(configured.Google),
      hasGroqKey: Boolean(configured.Groq),
      hasOpenRouterKey: Boolean(configured.OpenRouter),
    },
    { headers: responseHeaders },
  );
}
