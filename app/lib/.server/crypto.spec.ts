import { describe, expect, it } from 'vitest';
import {
  encryptApiKey,
  decryptApiKey,
  isEncryptedApiKey,
  getEncryptionKey,
} from './crypto';

describe('crypto utility (AES-256-GCM)', () => {
  it('derives a 32-byte key for AES-256', () => {
    const key = getEncryptionKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('encrypts and decrypts an API key accurately', () => {
    const rawKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
    const encrypted = encryptApiKey(rawKey);

    expect(encrypted).not.toBe(rawKey);
    expect(isEncryptedApiKey(encrypted)).toBe(true);

    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(24); // 12 bytes iv = 24 hex
    expect(parts[1].length).toBe(32); // 16 bytes auth tag = 32 hex

    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(rawKey);
  });

  it('generates unique IVs for each encryption', () => {
    const rawKey = 'sk-test-key';
    const enc1 = encryptApiKey(rawKey);
    const enc2 = encryptApiKey(rawKey);

    expect(enc1).not.toBe(enc2);
    expect(decryptApiKey(enc1)).toBe(rawKey);
    expect(decryptApiKey(enc2)).toBe(rawKey);
  });

  it('gracefully handles legacy plain text keys without crashing', () => {
    const legacyOpenAiKey = 'sk-legacy-12345';
    expect(isEncryptedApiKey(legacyOpenAiKey)).toBe(false);

    const decrypted = decryptApiKey(legacyOpenAiKey);
    expect(decrypted).toBe(legacyOpenAiKey);

    const legacyAnthropicKey = 'sk-ant-api03-abcdef';
    expect(isEncryptedApiKey(legacyAnthropicKey)).toBe(false);
    expect(decryptApiKey(legacyAnthropicKey)).toBe(legacyAnthropicKey);
  });

  it('handles empty or invalid inputs safely', () => {
    expect(encryptApiKey('')).toBe('');
    expect(decryptApiKey('')).toBe('');
    expect(isEncryptedApiKey('')).toBe(false);
    expect(isEncryptedApiKey('invalid:token')).toBe(false);
  });

  it('safely handles tampered ciphertext or corrupted auth tags', () => {
    const rawKey = 'sk-secret-payload';
    const encrypted = encryptApiKey(rawKey);
    const [iv, tag, cipher] = encrypted.split(':');

    // Tamper with ciphertext
    const tamperedCipher = cipher.slice(0, -2) + (cipher.slice(-2) === 'aa' ? 'bb' : 'aa');
    const tampered = `${iv}:${tag}:${tamperedCipher}`;

    // Should not crash, returns safe empty string fallback
    const result = decryptApiKey(tampered);
    expect(result).toBe('');
  });
});
