// NKVault — Crypto State Store (Svelte 5 runes)
// Manages wallet-based vault setup, unlock, and encryption lifecycle.

import { db } from '$lib/db';
import { browser } from '$app/environment';
import { id as instantId } from '@instantdb/core';
import { deriveKeyFromWallet, type SolanaProvider } from '$lib/crypto/wallet';
import { generateVaultKey, wrapKey, unwrapKey, type WrappedKey } from '$lib/crypto/keys';
import {
  setVaultKey, getVaultKey, clearKeys, isUnlocked as sessionIsUnlocked,
  setSharedVaultKey, getSharedVaultKey
} from '$lib/crypto/session';
import {
  createSharedVaultKey, encryptSharedKeyForEscrow,
  decryptSharedKeyFromEscrow, encryptSharedKeyForUser, decryptSharedKeyForUser
} from '$lib/crypto/shared-vault';

const APP_ID = '60e86fb7-dd9b-49bb-949e-aa33675eb019';

// Reactive state
let profile = $state<any>(null);
let profileLoading = $state(true);
let isVaultUnlocked = $state(false);
let setupError = $state<string | null>(null);
let unlockError = $state<string | null>(null);

let unsubProfile: (() => void) | null = null;

/** Subscribe to the current user's crypto profile. */
function subscribeToProfile(userId: string) {
  if (!browser || !db) return;
  if (unsubProfile) unsubProfile();

  unsubProfile = db.subscribeQuery(
    { profiles: { $: { where: { clerkId: userId } } } },
    (resp: any) => {
      if (resp.data) {
        const profiles = resp.data.profiles || [];
        profile = profiles.length > 0 ? profiles[0] : null;
      }
      profileLoading = false;
    }
  );
}

/** Check if user has completed wallet setup. */
function hasCompletedSetup(): boolean {
  return profile !== null && profile.hasCompletedSetup === true;
}

/** Get the stored wallet address from the profile. */
function getStoredWalletAddress(): string | null {
  return profile?.walletAddress ?? null;
}

/**
 * First-time vault setup with a Solana wallet.
 *
 * 1. Wallet signs deterministic message → SHA-256 → derived key
 * 2. Generate random vault key (AES-256-GCM)
 * 3. Wrap vault key with wallet-derived key
 * 4. Store profile in DB (wallet address, wrapped key)
 */
async function setupWithWallet(
  userId: string,
  email: string,
  walletProvider: SolanaProvider,
  walletAddress: string
): Promise<void> {
  setupError = null;

  try {
    // 1. Derive key from wallet signature
    const derivedKey = await deriveKeyFromWallet(walletProvider, email);

    // 2. Generate vault key
    const vaultKey = await generateVaultKey();

    // 3. Wrap vault key with wallet-derived key
    const encryptedVaultKey = await wrapKey(vaultKey, derivedKey);

    // 4. Store/update profile — use existing ID if profile already exists
    const profileId = profile?.id ?? instantId();
    await db.transact(
      db.tx.profiles[profileId].update({
        clerkId: userId,
        email,
        walletAddress,
        encryptedVaultKey: JSON.stringify(encryptedVaultKey),
        hasCompletedSetup: true,
        createdAt: Date.now(),
      })
    );

    // Set session key
    setVaultKey(vaultKey);
    isVaultUnlocked = true;

    // Setup shared vault escrow
    await ensureSharedVaultEscrow(vaultKey, userId);
  } catch (err: any) {
    setupError = err.message || 'Failed to set up vault with wallet.';
    throw err;
  }
}

/**
 * Unlock the vault using a Solana wallet signature.
 *
 * 1. Wallet signs same deterministic message → same derived key
 * 2. Unwrap vault key with derived key
 * 3. Store vault key in session
 */
async function unlockWithWallet(email: string, walletProvider: SolanaProvider): Promise<void> {
  unlockError = null;

  if (!profile) {
    unlockError = 'No profile found. Please set up your vault first.';
    throw new Error(unlockError);
  }

  try {
    const derivedKey = await deriveKeyFromWallet(walletProvider, email);
    const encryptedVaultKey: WrappedKey = JSON.parse(profile.encryptedVaultKey);
    const vaultKey = await unwrapKey(encryptedVaultKey, derivedKey);

    setVaultKey(vaultKey);
    isVaultUnlocked = true;

    // Try to load shared vault key — non-fatal if it fails
    try {
      await loadSharedVaultKey(vaultKey, profile.clerkId);
    } catch (sharedErr) {
      console.warn('[SharedVault] Non-fatal: failed to load shared vault key:', sharedErr);
    }
  } catch (err: any) {
    unlockError = 'Failed to unlock vault. Make sure you\'re using the correct wallet.';
    throw new Error(unlockError);
  }
}

/** Ensure the shared vault has an escrow key. */
async function ensureSharedVaultEscrow(userVaultKey: CryptoKey, userId: string): Promise<void> {
  try {
    console.log('[SharedVault] Querying escrow...');
    const resp = await new Promise<any>((resolve) => {
      const unsub = db.subscribeQuery({ sharedVaultEscrow: {} }, (r: any) => {
        unsub();
        resolve(r);
      });
    });

    const escrows = resp.data?.sharedVaultEscrow || [];
    console.log('[SharedVault] Found', escrows.length, 'escrow entries');

    let sharedKey: CryptoKey | null = null;
    let existingEscrowId: string | null = null;

    if (escrows.length > 0) {
      existingEscrowId = escrows[0].id;
      try {
        console.log('[SharedVault] Decrypting shared key from escrow...');
        sharedKey = await decryptSharedKeyFromEscrow(escrows[0].encryptedSharedKey, APP_ID);
        console.log('[SharedVault] Shared key decrypted successfully');
      } catch (err) {
        console.warn('[SharedVault] Escrow data corrupt — will overwrite with fresh key...', err);
        sharedKey = null;
      }
    }

    // If no valid escrow, create a fresh shared vault key and save/overwrite escrow
    if (!sharedKey) {
      console.log('[SharedVault] Creating new shared vault key...');
      sharedKey = await createSharedVaultKey();
      const escrowEncrypted = await encryptSharedKeyForEscrow(sharedKey, APP_ID);

      const escrowId = existingEscrowId || instantId();
      await db.transact(
        db.tx.sharedVaultEscrow[escrowId].update({
          encryptedSharedKey: escrowEncrypted,
          createdAt: Date.now(),
        })
      );
      console.log('[SharedVault] Escrow saved (id:', escrowId, ')');
    }

    // Save or update the user's sharedVaultKeys entry
    const userEncryptedSharedKey = await encryptSharedKeyForUser(sharedKey, userVaultKey);
    const existingResp = await new Promise<any>((resolve) => {
      const unsub = db.subscribeQuery(
        { sharedVaultKeys: { $: { where: { userId } } } },
        (r: any) => { unsub(); resolve(r); }
      );
    });
    const existingKeys = existingResp.data?.sharedVaultKeys || [];
    const keyId = existingKeys.length > 0 ? existingKeys[0].id : instantId();
    console.log('[SharedVault] Saving user key entry (existing:', existingKeys.length, ')');

    await db.transact(
      db.tx.sharedVaultKeys[keyId].update({
        userId,
        encryptedSharedKey: userEncryptedSharedKey,
        createdAt: Date.now(),
      })
    );

    setSharedVaultKey(sharedKey);
    console.log('[SharedVault] ✅ Shared vault key loaded into session');
  } catch (err) {
    console.error('[SharedVault] ❌ Failed to setup shared vault escrow:', err);
  }
}

/** Load this user's shared vault key. */
async function loadSharedVaultKey(userVaultKey: CryptoKey, userId: string): Promise<void> {
  try {
    const resp = await new Promise<any>((resolve) => {
      const unsub = db.subscribeQuery(
        { sharedVaultKeys: { $: { where: { userId } } } },
        (r: any) => { unsub(); resolve(r); }
      );
    });

    const keys = resp.data?.sharedVaultKeys || [];
    if (keys.length > 0) {
      try {
        const sharedKey = await decryptSharedKeyForUser(keys[0].encryptedSharedKey, userVaultKey);
        setSharedVaultKey(sharedKey);
        return; // Success
      } catch {
        // Decryption failed — vault key changed (e.g. wallet migration).
        // Fall through to re-derive from escrow.
        console.warn('Shared vault key entry stale — re-deriving from escrow...');
      }
    }

    // No entry, or entry was encrypted with old key → get from escrow and (re)create user entry
    await ensureSharedVaultEscrow(userVaultKey, userId);
  } catch (err) {
    console.warn('Failed to load shared vault key:', err);
  }
}

/** Lock the vault (clear session keys). */
function lockVault(): void {
  clearKeys();
  isVaultUnlocked = false;
}

/**
 * Reset the user's profile to re-trigger WalletSetup.
 * Used when the vault key can't be unwrapped (e.g. migrating from Argon2id).
 */
async function resetProfile(): Promise<void> {
  if (!profile?.id) return;

  await db.transact(
    db.tx.profiles[profile.id].update({
      hasCompletedSetup: false,
      encryptedVaultKey: '',
      walletAddress: '',
    })
  );

  unlockError = null;
  clearKeys();
  isVaultUnlocked = false;
}

function destroy(): void {
  if (unsubProfile) unsubProfile();
}

export function getCryptoStore() {
  return {
    get profile() { return profile; },
    get profileLoading() { return profileLoading; },
    get isVaultUnlocked() { return isVaultUnlocked; },
    get setupError() { return setupError; },
    get unlockError() { return unlockError; },
    hasCompletedSetup,
    getStoredWalletAddress,
    subscribeToProfile,
    setupWithWallet,
    unlockWithWallet,
    lockVault,
    resetProfile,
    destroy,
  };
}
