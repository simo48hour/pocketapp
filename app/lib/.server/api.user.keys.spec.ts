import { describe, expect, it } from 'vitest';
import { action as keysAction } from '~/routes/api.user.keys';
import { loader as statusLoader } from '~/routes/api.user.keys.status';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

const mockContext = {
  cloudflare: {
    env: {},
    cf: {} as any,
    ctx: {} as any,
    caches: {} as any,
  },
} as any;

describe('API Keys Endpoints & Security Hardening', () => {
  it('POST /api/user/keys sets an encrypted HttpOnly, SameSite=Lax cookie and returns configuration status without leaking the key', async () => {
    const rawKey = 'sk-proj-super-secret-key-12345';
    const request = new Request('http://localhost/api/user/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'OpenAI',
        apiKey: rawKey,
      }),
    });

    const response = await keysAction({ request, params: {}, context: mockContext });
    const data = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.provider).toBe('OpenAI');
    expect(data.isConfigured).toBe(true);
    expect(data.apiKey).toBeUndefined(); // Raw key must NOT be leaked in JSON!

    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain(rawKey); // Raw key must NOT be in plaintext in cookie!

    // Verify the cookie can be decrypted on the server
    const [cookieValue] = setCookie!.split(';');
    const decryptedKeys = getApiKeysFromCookie(cookieValue);
    expect(decryptedKeys.OpenAI).toBe(rawKey);
  });

  it('DELETE /api/user/keys removes provider key from cookie', async () => {
    // First setup request with existing key in cookie
    const initialReq = new Request('http://localhost/api/user/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'OpenAI', apiKey: 'sk-123' }),
    });
    const initialRes = await keysAction({ request: initialReq, params: {}, context: mockContext });
    const cookieHeader = initialRes.headers.get('Set-Cookie')!.split(';')[0];

    // Now delete it
    const deleteReq = new Request('http://localhost/api/user/keys', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ provider: 'OpenAI' }),
    });

    const deleteRes = await keysAction({ request: deleteReq, params: {}, context: mockContext });
    const data = (await deleteRes.json()) as any;

    expect(data.success).toBe(true);
    expect(data.isConfigured).toBe(false);

    const updatedCookie = deleteRes.headers.get('Set-Cookie')!.split(';')[0];
    const remainingKeys = getApiKeysFromCookie(updatedCookie);
    expect(remainingKeys.OpenAI).toBeUndefined();
  });

  it('GET /api/user/keys/status returns boolean flags without exposing keys', async () => {
    // Setup request with cookie containing OpenAI key
    const postReq = new Request('http://localhost/api/user/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'OpenAI', apiKey: 'sk-test-key-abc' }),
    });
    const postRes = await keysAction({ request: postReq, params: {}, context: mockContext });
    const cookieHeader = postRes.headers.get('Set-Cookie')!.split(';')[0];

    const statusReq = new Request('http://localhost/api/user/keys/status', {
      headers: { Cookie: cookieHeader },
    });

    const statusRes = await statusLoader({ request: statusReq, params: {}, context: mockContext });
    const statusData = (await statusRes.json()) as any;

    expect(statusData.hasOpenAiKey).toBe(true);
    expect(statusData.hasDeepSeekKey).toBe(false);
    expect(statusData.configured.OpenAI).toBe(true);
    expect(statusData.configured.DeepSeek).toBeFalsy();

    // Verify response does not leak raw keys in any field
    const jsonString = JSON.stringify(statusData);
    expect(jsonString).not.toContain('sk-test-key-abc');
  });
});
