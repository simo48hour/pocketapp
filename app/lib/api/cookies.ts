import { encryptApiKey, decryptApiKey, isEncryptedApiKey } from '~/lib/security/crypto';

export function parseCookies(cookieHeader: string | null) {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  // Split the cookie string by semicolons and spaces
  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest.length > 0) {
      // Decode the name and value, and join value parts in case it contains '='
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

function isValidApiKey(val: unknown): val is string {
  return (
    typeof val === 'string' &&
    val.trim().length > 0 &&
    val !== 'configured' &&
    val !== 'true' &&
    val !== 'false' &&
    !val.includes('your_') &&
    !isEncryptedApiKey(val)
  );
}

/**
 * Parses and decrypts API keys from the incoming cookie header.
 * Seamlessly supports:
 * 1. Fully encrypted AES-256-GCM cookie payloads
 * 2. Per-key encrypted JSON dictionaries
 * 3. Legacy plaintext JSON dictionaries (sk-...)
 */
export function getApiKeysFromCookie(cookieHeader: string | null, context?: any): Record<string, string> {
  const cookies = parseCookies(cookieHeader);

  if (!cookies.apiKeys) {
    return {};
  }

  const rawCookie = cookies.apiKeys;

  // 1. Check if the entire cookie payload is AES-256-GCM encrypted
  if (isEncryptedApiKey(rawCookie)) {
    try {
      const decryptedJson = decryptApiKey(rawCookie, context);

      if (decryptedJson) {
        const parsed = JSON.parse(decryptedJson);

        if (parsed && typeof parsed === 'object') {
          const result: Record<string, string> = {};

          for (const [provider, key] of Object.entries(parsed)) {
            if (isValidApiKey(key)) {
              result[provider] = key.trim();
            }
          }

          return result;
        }
      }
    } catch (err) {
      console.warn('[cookies] Failed to parse decrypted apiKeys JSON payload:', err);
    }
  }

  // 2. Fallback: Parse JSON directly (either legacy plain text keys or per-key encrypted)
  try {
    const parsed = JSON.parse(rawCookie);

    if (parsed && typeof parsed === 'object') {
      const result: Record<string, string> = {};

      for (const [provider, key] of Object.entries(parsed)) {
        if (typeof key === 'string') {
          const decrypted = decryptApiKey(key, context);

          if (isValidApiKey(decrypted)) {
            result[provider] = decrypted.trim();
          }
        }
      }

      return result;
    }
  } catch {
    // 3. Fallback: Try decrypting as ciphertext string
    try {
      const decrypted = decryptApiKey(rawCookie, context);

      if (decrypted) {
        const parsed = JSON.parse(decrypted);

        if (parsed && typeof parsed === 'object') {
          const result: Record<string, string> = {};

          for (const [provider, key] of Object.entries(parsed)) {
            if (isValidApiKey(key)) {
              result[provider] = key.trim();
            }
          }

          return result;
        }
      }
    } catch {}
  }

  return {};
}

/**
 * Serializes an API keys dictionary into an encrypted HttpOnly, SameSite=Lax, Secure cookie string.
 */
export function serializeApiKeysCookie(
  keys: Record<string, string>,
  options: { isProduction?: boolean; maxAge?: number; context?: any } = {},
): string {
  const {
    isProduction = process.env.NODE_ENV === 'production' || (process.env.NODE_ENV as string) === 'staging',
    maxAge = 30 * 24 * 60 * 60,
    context,
  } = options;

  const validKeys: Record<string, string> = {};

  for (const [provider, key] of Object.entries(keys)) {
    if (isValidApiKey(key)) {
      validKeys[provider] = key.trim();
    }
  }

  const jsonStr = JSON.stringify(validKeys);
  const encrypted = encryptApiKey(jsonStr, context);
  const cookieValue = encodeURIComponent(encrypted);

  const parts = [
    `apiKeys=${cookieValue}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Serializes a clearing header for the apiKeys cookie.
 */
export function serializeClearApiKeysCookie(options: { isProduction?: boolean } = {}): string {
  const { isProduction = process.env.NODE_ENV === 'production' } = options;
  const parts = [
    'apiKeys=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];

  if (isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function getProviderSettingsFromCookie(cookieHeader: string | null): Record<string, any> {
  const cookies = parseCookies(cookieHeader);
  return cookies.providers ? JSON.parse(cookies.providers) : {};
}
