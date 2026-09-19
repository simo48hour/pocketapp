import type { Message } from 'ai';

export const FREE_DAILY_REQUEST_LIMIT = Infinity;

export const freeLimitReachedError = () =>
  new Response(
    JSON.stringify({
      error: 'Please configure your API key in settings to continue.',
    }),
    { status: 402, headers: { 'Content-Type': 'application/json' } },
  );

/**
 * Chat access validator for Community Edition.
 * All models and requests are unlocked for users using their own API keys (BYOK)
 * or local environment variables.
 */
export async function chatAccess(
  _request: Request,
  _context: any,
  _apiKeys: Record<string, string>,
  _messages: Message[],
) {
  return {
    managed: false,
    managedFetch: undefined,
    finish: async () => {},
  };
}
