import { json } from '@remix-run/cloudflare';

export async function loader() {
  return json(
    {
      status: 'active',
      usage: 0,
      limit: 1000,
      freeRequestsLimit: 999999,
      freeRequestsUsed: 0,
      freeRequestsRemaining: 999999,
      periodEnd: 0,
      hasCustomer: false,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
