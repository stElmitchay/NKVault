// NKVault — Shared Vault Key Management
// Handles escrow-based key distribution for the shared vault.
import { generateVaultKey, wrapKey, unwrapKey, type WrappedKey } from './keys';

const ESCROW_PEPPER = 'nkvault-shared-vault-escrow-v1';
const ESCROW_SALT = 'nkvault-escrow-salt-v1';

/**
 * Derive the escrow key from the app ID + pepper.
 * Only @christex.foundation authenticated users can reach this code.
 */
async function deriveEscrowKey(appId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appId + ESCROW_PEPPER),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(ESCROW_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/** Generate a new shared vault key. */
export async function createSharedVaultKey(): Promise<CryptoKey> {
  return generateVaultKey();
}

/** Encrypt the shared vault key for escrow storage. */
export async function encryptSharedKeyForEscrow(
  sharedKey: CryptoKey,
  appId: string
): Promise<string> {
  const escrowKey = await deriveEscrowKey(appId);
  const wrapped = await wrapKey(sharedKey, escrowKey);
  return JSON.stringify(wrapped);
}

/** Decrypt the shared vault key from escrow. */
export async function decryptSharedKeyFromEscrow(
  encryptedKey: string,
  appId: string
): Promise<CryptoKey> {
  const escrowKey = await deriveEscrowKey(appId);
  const wrapped: WrappedKey = JSON.parse(encryptedKey);
  return unwrapKey(wrapped, escrowKey);
}

/** Encrypt the shared vault key for a specific user (with their vault key). */
export async function encryptSharedKeyForUser(
  sharedKey: CryptoKey,
  userVaultKey: CryptoKey
): Promise<string> {
  const wrapped = await wrapKey(sharedKey, userVaultKey);
  return JSON.stringify(wrapped);
}

/** Decrypt the shared vault key for a specific user. */
export async function decryptSharedKeyForUser(
  encryptedKey: string,
  userVaultKey: CryptoKey
): Promise<CryptoKey> {
  const wrapped: WrappedKey = JSON.parse(encryptedKey);
  return unwrapKey(wrapped, userVaultKey);
}
