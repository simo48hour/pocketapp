import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes standard recommended for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes auth tag

/**
 * Derives a 32-byte (256-bit) encryption key from the environment variable.
 */
export function getEncryptionKey(context?: any): Buffer {
  const secret =
    context?.cloudflare?.env?.API_KEY_ENCRYPTION_SECRET ||
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    'pocketapp-master-secret-key-fallback-seed-32b';

  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts an API key using AES-256-GCM.
 * Output format: `iv:authTag:encryptedData` (in hex).
 */
export function encryptApiKey(plainText: string, context?: any): string {
  if (!plainText || typeof plainText !== 'string') {
    return '';
  }

  const key = getEncryptionKey(context);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Checks whether a given string is formatted as `iv:authTag:encryptedData` (AES-256-GCM hex).
 */
export function isEncryptedApiKey(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parts = value.split(':');

  if (parts.length !== 3) {
    return false;
  }

  const [ivHex, authTagHex, cipherTextHex] = parts;

  // IV must be 12 bytes = 24 hex characters
  // AuthTag must be 16 bytes = 32 hex characters
  // CipherText must be non-empty hex
  const isHex = (str: string) => /^[0-9a-fA-F]+$/.test(str);

  return (
    ivHex.length === IV_LENGTH * 2 &&
    authTagHex.length === AUTH_TAG_LENGTH * 2 &&
    cipherTextHex.length > 0 &&
    isHex(ivHex) &&
    isHex(authTagHex) &&
    isHex(cipherTextHex)
  );
}

/**
 * Decrypts an AES-256-GCM encrypted API key.
 * If the input is not in encrypted format (e.g. legacy plain text starting with sk-),
 * it gracefully returns the plain text.
 */
export function decryptApiKey(encryptedData: string, context?: any): string {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return '';
  }

  if (!isEncryptedApiKey(encryptedData)) {
    // Legacy plain text fallback
    return encryptedData;
  }

  try {
    const [ivHex, authTagHex, cipherTextHex] = encryptedData.split(':');
    const key = getEncryptionKey(context);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.warn('[crypto] Decryption failed:', error);
    return '';
  }
}
