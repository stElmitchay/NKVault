// Vault key generation, wrap/unwrap round-trip, wrong wrap key fails.

import { describe, it, expect } from 'vitest';
import { generateVaultKey, wrapKey, unwrapKey, exportKey, importKey } from './keys';
import { encrypt, decrypt } from './aes';

async function freshWrapKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

describe('keys', () => {
  it('generates a usable AES-256 vault key', async () => {
    const k = await generateVaultKey();
    expect(k.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(k.usages).toContain('encrypt');
    expect(k.usages).toContain('decrypt');
    // Round-trip a payload to confirm it works.
    const blob = await encrypt(k, 'payload');
    expect(await decrypt(k, blob)).toBe('payload');
  });

  it('wraps and unwraps a vault key', async () => {
    const wrap = await freshWrapKey();
    const vaultKey = await generateVaultKey();
    const wrapped = await wrapKey(vaultKey, wrap);
    expect(wrapped.iv).toBeTypeOf('string');
    expect(wrapped.data).toBeTypeOf('string');

    const unwrapped = await unwrapKey(wrapped, wrap);
    // Unwrapped key must produce identical ciphertext-decryption behavior.
    const blob = await encrypt(vaultKey, 'shared payload');
    const out = await decrypt(unwrapped, blob);
    expect(out).toBe('shared payload');
  });

  it('uses a fresh IV for every wrap call', async () => {
    const wrap = await freshWrapKey();
    const vaultKey = await generateVaultKey();
    const ivs = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ivs.add((await wrapKey(vaultKey, wrap)).iv);
    }
    expect(ivs.size).toBe(20);
  });

  it('rejects unwrap with the wrong wrap key', async () => {
    const wrap = await freshWrapKey();
    const wrong = await freshWrapKey();
    const vaultKey = await generateVaultKey();
    const wrapped = await wrapKey(vaultKey, wrap);
    await expect(unwrapKey(wrapped, wrong)).rejects.toBeDefined();
  });

  it('exports and re-imports raw key bytes losslessly', async () => {
    const k = await generateVaultKey();
    const raw = await exportKey(k);
    expect(raw.length).toBe(32); // 256 bits
    const reimported = await importKey(raw);
    const blob = await encrypt(k, 'cross-import');
    expect(await decrypt(reimported, blob)).toBe('cross-import');
  });
});
