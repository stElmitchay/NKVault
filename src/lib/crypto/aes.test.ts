// AES-256-GCM round-trip, IV uniqueness, tamper detection, wrong-key.

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncrypted, type EncryptedBlob } from './aes';

async function freshKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

describe('aes', () => {
  it('round-trips an ASCII plaintext', async () => {
    const key = await freshKey();
    const plaintext = 'hello, vault';
    const blob = await encrypt(key, plaintext);
    expect(isEncrypted(blob)).toBe(true);
    expect(blob.iv).toBeTypeOf('string');
    expect(blob.ciphertext).toBeTypeOf('string');
    const out = await decrypt(key, blob);
    expect(out).toBe(plaintext);
  });

  it('round-trips a unicode plaintext', async () => {
    const key = await freshKey();
    const plaintext = '🔐 пароль — كلمة المرور — パスワード';
    const blob = await encrypt(key, plaintext);
    expect(await decrypt(key, blob)).toBe(plaintext);
  });

  it('round-trips an empty string', async () => {
    const key = await freshKey();
    const blob = await encrypt(key, '');
    expect(await decrypt(key, blob)).toBe('');
  });

  it('round-trips a large plaintext', async () => {
    const key = await freshKey();
    const plaintext = 'x'.repeat(64 * 1024);
    const blob = await encrypt(key, plaintext);
    expect(await decrypt(key, blob)).toBe(plaintext);
  });

  it('produces a fresh IV on every call (no IV reuse)', async () => {
    const key = await freshKey();
    const plaintext = 'same input';
    const ivs = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const blob = await encrypt(key, plaintext);
      ivs.add(blob.iv);
    }
    // 50 calls → 50 distinct IVs. Birthday-bound for 96-bit IVs makes
    // a collision astronomically unlikely.
    expect(ivs.size).toBe(50);
  });

  it('rejects tampered ciphertext', async () => {
    const key = await freshKey();
    const blob = await encrypt(key, 'do not tamper');
    // Flip one byte in the ciphertext payload.
    const tampered: EncryptedBlob = {
      ...blob,
      ciphertext: flipFirstBase64Byte(blob.ciphertext),
    };
    await expect(decrypt(key, tampered)).rejects.toBeDefined();
  });

  it('rejects tampered IV', async () => {
    const key = await freshKey();
    const blob = await encrypt(key, 'do not tamper');
    const tampered: EncryptedBlob = {
      ...blob,
      iv: flipFirstBase64Byte(blob.iv),
    };
    await expect(decrypt(key, tampered)).rejects.toBeDefined();
  });

  it('rejects decryption with the wrong key', async () => {
    const k1 = await freshKey();
    const k2 = await freshKey();
    const blob = await encrypt(k1, 'secret');
    await expect(decrypt(k2, blob)).rejects.toBeDefined();
  });

  describe('isEncrypted', () => {
    it('accepts a real blob', async () => {
      const key = await freshKey();
      const blob = await encrypt(key, 'x');
      expect(isEncrypted(blob)).toBe(true);
    });

    it('rejects plain objects', () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted({})).toBe(false);
      expect(isEncrypted({ __encrypted: true })).toBe(false);
      expect(isEncrypted({ __encrypted: true, iv: 1, ciphertext: '' })).toBe(false);
      expect(isEncrypted('hello')).toBe(false);
    });
  });
});

function flipFirstBase64Byte(b64: string): string {
  // Decode, flip one bit in byte 0, re-encode. Avoids producing
  // structurally invalid base64 (which would throw before AES sees it).
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  bytes[0] ^= 0x01;
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return btoa(out);
}
