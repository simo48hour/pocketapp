import { describe, expect, it } from 'vitest';
import {
  parseCookies,
  getApiKeysFromCookie,
  serializeApiKeysCookie,
  serializeClearApiKeysCookie,
} from './cookies';

describe('cookies utility with AES-256-GCM encryption', () => {
  it('parses standard cookie headers', () => {
    const header = 'theme=dark; foo=bar; special=val%3Dwith%3Deq';
    const parsed = parseCookies(header);

    expect(parsed.theme).toBe('dark');
    expect(parsed.foo).toBe('bar');
    expect(parsed.special).toBe('val=with=eq');
  });

  it('serializes and encrypts apiKeys into HttpOnly and SameSite cookie', () => {
    const keys = {
      OpenAI: 'sk-proj-test123456',
      Anthropic: 'sk-ant-test7890',
    };

    const cookieString = serializeApiKeysCookie(keys, { isProduction: true });

    expect(cookieString).toContain('HttpOnly');
    expect(cookieString).toContain('SameSite=Lax');
    expect(cookieString).toContain('Secure');
    expect(cookieString).toContain('Path=/');
    expect(cookieString).not.toContain('sk-proj-test123456'); // Plaintext must NOT appear!

    // Parse the cookie back using getApiKeysFromCookie
    const [cookiePair] = cookieString.split(';');
    const decryptedKeys = getApiKeysFromCookie(cookiePair);

    expect(decryptedKeys.OpenAI).toBe('sk-proj-test123456');
    expect(decryptedKeys.Anthropic).toBe('sk-ant-test7890');
  });

  it('supports legacy unencrypted JSON cookie backwards compatibility', () => {
    const legacyCookie = `apiKeys=${encodeURIComponent(JSON.stringify({ OpenAI: 'sk-legacy-raw-key' }))}`;
    const keys = getApiKeysFromCookie(legacyCookie);

    expect(keys.OpenAI).toBe('sk-legacy-raw-key');
  });

  it('filters out dummy configured/boolean values from cookies', () => {
    const corruptedCookie = `apiKeys=${encodeURIComponent(
      JSON.stringify({
        OpenRouter: 'configured',
        OpenAI: 'true',
        DeepSeek: 'sk-real-deepseek-key',
      }),
    )}`;

    const keys = getApiKeysFromCookie(corruptedCookie);
    expect(keys.OpenRouter).toBeUndefined();
    expect(keys.OpenAI).toBeUndefined();
    expect(keys.DeepSeek).toBe('sk-real-deepseek-key');
  });

  it('filters out dummy values when serializing cookies', () => {
    const keys = {
      OpenRouter: 'configured',
      Google: 'true',
      Anthropic: 'sk-ant-valid-key',
    };

    const cookieString = serializeApiKeysCookie(keys);
    const [cookiePair] = cookieString.split(';');
    const decryptedKeys = getApiKeysFromCookie(cookiePair);

    expect(decryptedKeys.OpenRouter).toBeUndefined();
    expect(decryptedKeys.Google).toBeUndefined();
    expect(decryptedKeys.Anthropic).toBe('sk-ant-valid-key');
  });
});
