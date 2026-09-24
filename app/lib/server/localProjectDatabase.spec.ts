import { describe, expect, it } from 'vitest';
import {
  corsHeaders,
  handleLocalProjectCreate,
  normalizeSchema,
  resolveTargetCollectionId,
} from './localProjectDatabase';

describe('localProjectDatabase', () => {
  it('corsHeaders includes cross-origin and allowed methods', () => {
    const headers = corsHeaders();
    expect(headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    expect(headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('handleLocalProjectCreate returns valid p-[32-hex] ID and owner token', async () => {
    const encoded = new TextEncoder().encode(JSON.stringify({ chatId: 'test-chat-123' }));
    const body = encoded.buffer.slice(0) as ArrayBuffer;
    const req = new Request('http://localhost:5173/api/project-db/create', { method: 'POST' });
    const res = handleLocalProjectCreate(req, body);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { id: string; ownerToken: string };
    expect(data.id).toMatch(/^p-[a-f0-9]{32}$/);
    expect(data.ownerToken).toBe('local-owner-token');

    // Deterministic ID for the same chatId
    const res2 = handleLocalProjectCreate(req, body);
    const data2 = (await res2.json()) as { id: string };
    expect(data2.id).toBe(data.id);
  });

  it('normalizeSchema sanitizes collections and sets defaults', () => {
    const input = [
      {
        name: 'posts',
        type: 'base',
        fields: [{ name: 'title', type: 'text' }],
      },
    ];
    const normalized = normalizeSchema(input);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].name).toBe('posts');
    expect(normalized[0].listRule).toBe('');
    expect(normalized[0].fields).toHaveLength(1);
  });

  it('resolveTargetCollectionId resolves target collection correctly', () => {
    const collections = [
      { id: 'col_users_123', name: 'users' },
      { id: 'col_categories_456', name: 'categories' },
    ];

    expect(resolveTargetCollectionId('col_users_123', 'user', collections)).toBe('col_users_123');
    expect(resolveTargetCollectionId('categories', 'category', collections)).toBe('col_categories_456');
    expect(resolveTargetCollectionId(undefined, 'categories', collections)).toBe('col_categories_456');
    expect(resolveTargetCollectionId(undefined, 'unknown', collections)).toBeUndefined();
  });
});
