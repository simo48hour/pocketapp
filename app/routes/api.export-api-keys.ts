import type { LoaderFunction } from '@remix-run/cloudflare';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

export const loader: LoaderFunction = async ({ request }) => {
  // Only export user-configured keys from the secure cookie, never server-level environment secrets
  const cookieHeader = request.headers.get('Cookie');
  const userKeys = getApiKeysFromCookie(cookieHeader);

  return Response.json(userKeys);
};
