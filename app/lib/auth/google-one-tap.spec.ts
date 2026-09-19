import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loginWithGoogleOneTap, currentUser } from '~/lib/stores/authStore';
import { pb } from '~/lib/auth/pocketbase';
import { action as googleOneTapAction } from '~/routes/api.auth.google-one-tap';

describe('Google One Tap Authentication', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pb.authStore.clear();
    currentUser.set(null);
  });

  it('loginWithGoogleOneTap successfully authenticates via pb.send and updates currentUser', async () => {
    const mockAuthResponse = {
      token: 'mock-pb-jwt-token-xyz',
      record: {
        id: 'user123',
        email: 'developer@example.com',
        name: 'Test Developer',
        avatar: '',
      },
      meta: {
        avatarUrl: 'https://lh3.googleusercontent.com/a/avatar.jpg',
      },
    };

    vi.spyOn(pb, 'send').mockResolvedValueOnce(mockAuthResponse);

    const result = await loginWithGoogleOneTap('mock-google-id-token');

    expect(pb.send).toHaveBeenCalledWith('/api/google-one-tap', {
      method: 'POST',
      body: { credential: 'mock-google-id-token' },
    });

    expect(result.token).toBe('mock-pb-jwt-token-xyz');
    expect(pb.authStore.token).toBe('mock-pb-jwt-token-xyz');
    expect(currentUser.get()).toEqual({
      id: 'user123',
      email: 'developer@example.com',
      name: 'Test Developer',
      avatar: 'https://lh3.googleusercontent.com/a/avatar.jpg',
    });
  });

  it('loginWithGoogleOneTap falls back to /api/auth/google-one-tap if pb.send throws', async () => {
    vi.spyOn(pb, 'send').mockRejectedValueOnce(new Error('PocketBase 404'));

    const mockAuthResponse = {
      token: 'fallback-jwt-token',
      record: {
        id: 'user456',
        email: 'fallback@example.com',
        name: 'Fallback User',
      },
    };

    const globalFetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAuthResponse,
    } as any);

    const result = await loginWithGoogleOneTap('mock-google-id-token');

    expect(globalFetchSpy).toHaveBeenCalledWith('/api/auth/google-one-tap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'mock-google-id-token' }),
    });

    expect(result.token).toBe('fallback-jwt-token');
    expect(currentUser.get()?.email).toBe('fallback@example.com');
  });

  describe('api.auth.google-one-tap route handler', () => {
    it('returns 405 for non-POST requests', async () => {
      const request = new Request('http://localhost:5173/api/auth/google-one-tap', {
        method: 'GET',
      });

      const response = await googleOneTapAction({ request, context: {}, params: {} } as any);
      expect(response.status).toBe(405);
    });

    it('returns 400 for missing credential token', async () => {
      const request = new Request('http://localhost:5173/api/auth/google-one-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await googleOneTapAction({ request, context: {}, params: {} } as any);
      expect(response.status).toBe(400);
    });

    it('forwards valid credential to PocketBase', async () => {
      const globalFetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'mock-token', record: { id: 'rec-123' } }),
      } as any);

      const request = new Request('http://localhost:5173/api/auth/google-one-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: 'valid-google-jwt' }),
      });

      const response = await googleOneTapAction({ request, context: {}, params: {} } as any);
      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data.token).toBe('mock-token');
      expect(globalFetchSpy).toHaveBeenCalled();
    });
  });
});
