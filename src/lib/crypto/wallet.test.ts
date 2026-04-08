// Wallet KDF — v2 HKDF determinism, salt sensitivity, info sensitivity,
// v1 fallback path, salt generator quality.

import { describe, it, expect } from 'vitest';
import { deriveKeyFromWallet, generateKdfSalt, type SolanaProvider } from './wallet';
import { wrapKey, unwrapKey, generateVaultKey } from './keys';
import { encrypt, decrypt } from './aes';

/**
 * Build a deterministic mock wallet provider. Ed25519 is deterministic,
 * so a real wallet returns the same signature for the same message —
 * we model that here by hashing the input bytes with a per-instance
 * "secret" prefix and returning the first 64 bytes.
 */
function mockWallet(secret = 'wallet-A'): SolanaProvider {
  return {
    publicKey: { toBase58: () => 'mockaddr', toBytes: () => new Uint8Array(32) },
    isConnected: true,
    async connect() {
      return { publicKey: this.publicKey! };
    },
    async disconnect() {},
    async signMessage(message: Uint8Array) {
      // Deterministic "signature" = SHA-512(secret || message), 64 bytes.
      const enc = new TextEncoder().encode(secret);
      const buf = new Uint8Array(enc.length + message.length);
      buf.set(enc, 0);
      buf.set(message, enc.length);
      const hash = await crypto.subtle.digest('SHA-512', buf);
      return { signature: new Uint8Array(hash) };
    },
  };
}

async function exportRaw(k: CryptoKey): Promise<Uint8Array> {
  // The derived key is non-extractable, so we can't read its bytes.
  // Instead, we test equivalence by wrap/unwrap round-tripping a known
  // vault key under both keys and checking we get the same output.
  return new Uint8Array(0);
}

describe('wallet KDF', () => {
  describe('generateKdfSalt', () => {
    it('produces 32 bytes of base64 entropy', () => {
      const s = generateKdfSalt();
      // 32 raw bytes → 44 base64 chars (with padding).
      expect(s.length).toBe(44);
      // Decodes cleanly.
      const decoded = atob(s);
      expect(decoded.length).toBe(32);
    });

    it('produces unique values across calls', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) seen.add(generateKdfSalt());
      expect(seen.size).toBe(100);
    });
  });

  describe('v2 (HKDF + per-profile salt)', () => {
    it('is deterministic for the same wallet, salt, and userId', async () => {
      const wallet = mockWallet();
      const salt = generateKdfSalt();
      const k1 = await deriveKeyFromWallet(wallet, 'a@x.com', { salt, userId: 'u1' });
      const k2 = await deriveKeyFromWallet(wallet, 'a@x.com', { salt, userId: 'u1' });

      // Both keys should successfully unwrap a blob wrapped by the other.
      const vaultKey = await generateVaultKey();
      const wrapped = await wrapKey(vaultKey, k1);
      const unwrapped = await unwrapKey(wrapped, k2);
      const blob = await encrypt(vaultKey, 'determinism check');
      expect(await decrypt(unwrapped, blob)).toBe('determinism check');
    });

    it('produces a DIFFERENT key for a different salt', async () => {
      const wallet = mockWallet();
      const k1 = await deriveKeyFromWallet(wallet, 'a@x.com', {
        salt: generateKdfSalt(),
        userId: 'u1',
      });
      const k2 = await deriveKeyFromWallet(wallet, 'a@x.com', {
        salt: generateKdfSalt(),
        userId: 'u1',
      });
      const vaultKey = await generateVaultKey();
      const wrapped = await wrapKey(vaultKey, k1);
      // Unwrapping with the differently-salted key MUST fail.
      await expect(unwrapKey(wrapped, k2)).rejects.toBeDefined();
    });

    it('produces a DIFFERENT key for a different userId (info string)', async () => {
      const wallet = mockWallet();
      const salt = generateKdfSalt();
      const k1 = await deriveKeyFromWallet(wallet, 'a@x.com', { salt, userId: 'u1' });
      const k2 = await deriveKeyFromWallet(wallet, 'a@x.com', { salt, userId: 'u2' });
      const vaultKey = await generateVaultKey();
      const wrapped = await wrapKey(vaultKey, k1);
      await expect(unwrapKey(wrapped, k2)).rejects.toBeDefined();
    });

    it('produces a DIFFERENT key for a different wallet (signature)', async () => {
      const w1 = mockWallet('wallet-A');
      const w2 = mockWallet('wallet-B');
      const salt = generateKdfSalt();
      const k1 = await deriveKeyFromWallet(w1, 'a@x.com', { salt, userId: 'u1' });
      const k2 = await deriveKeyFromWallet(w2, 'a@x.com', { salt, userId: 'u1' });
      const vaultKey = await generateVaultKey();
      const wrapped = await wrapKey(vaultKey, k1);
      await expect(unwrapKey(wrapped, k2)).rejects.toBeDefined();
    });
  });

  describe('v1 legacy fallback (no salt)', () => {
    it('is deterministic for the same wallet+email', async () => {
      const wallet = mockWallet();
      const k1 = await deriveKeyFromWallet(wallet, 'a@x.com');
      const k2 = await deriveKeyFromWallet(wallet, 'a@x.com');
      const vaultKey = await generateVaultKey();
      const wrapped = await wrapKey(vaultKey, k1);
      const unwrapped = await unwrapKey(wrapped, k2);
      const blob = await encrypt(vaultKey, 'legacy round-trip');
      expect(await decrypt(unwrapped, blob)).toBe('legacy round-trip');
    });

    it('produces a different key from v2 with the same wallet', async () => {
      const wallet = mockWallet();
      const v1 = await deriveKeyFromWallet(wallet, 'a@x.com');
      const v2 = await deriveKeyFromWallet(wallet, 'a@x.com', {
        salt: generateKdfSalt(),
        userId: 'u1',
      });
      const vaultKey = await generateVaultKey();
      const wrapped = await wrapKey(vaultKey, v1);
      // v1 path uses raw SHA-256(sig), v2 uses HKDF — must NOT be interchangeable.
      await expect(unwrapKey(wrapped, v2)).rejects.toBeDefined();
    });
  });
});
