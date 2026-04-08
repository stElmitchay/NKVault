// NKVault — Crypto State Store (Svelte 5 runes)
// Manages wallet-based vault setup, unlock, and encryption lifecycle.

import { db } from '$lib/db';
import { browser } from '$app/environment';
import { id as instantId } from '@instantdb/core';
import { deriveKeyFromWallet, generateKdfSalt, type SolanaProvider } from '$lib/crypto/wallet';
import { generateVaultKey, wrapKey, unwrapKey, type WrappedKey } from '$lib/crypto/keys';
import { setVaultKey, clearKeys } from '$lib/crypto/session';
// NOTE: shared-vault escrow is disabled (security/hardening-pass-1).
// The previous design wrapped the shared key with a hardcoded constant
// derivable from the JS bundle, breaking zero-knowledge for shared data.
// Shared vault distribution will be redesigned to use per-user wraps
// initiated by the shared vault owner. Until then, the escrow path is
// dead code and the perms layer will reject any access to it.

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
    // 1. Generate a fresh per-profile KDF salt (HKDF v2 derivation)
    const kdfSalt = generateKdfSalt();

    // 2. Derive key from wallet signature using HKDF + per-profile salt
    const derivedKey = await deriveKeyFromWallet(walletProvider, email, {
      salt: kdfSalt,
      userId,
    });

    // 3. Generate vault key
    const vaultKey = await generateVaultKey();

    // 4. Wrap vault key with wallet-derived key
    const encryptedVaultKey = await wrapKey(vaultKey, derivedKey);

    // 5. Store/update profile — use existing ID if profile already exists
    const profileId = profile?.id ?? instantId();
    await db.transact(
      db.tx.profiles[profileId].update({
        clerkId: userId,
        email,
        walletAddress,
        encryptedVaultKey: JSON.stringify(encryptedVaultKey),
        kdfSalt,
        hasCompletedSetup: true,
        createdAt: Date.now(),
      })
    );

    // Set session key
    setVaultKey(vaultKey);
    isVaultUnlocked = true;
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
    // Derive key. If the profile has a kdfSalt → HKDF v2 path. Otherwise
    // fall back to legacy SHA-256(sig) so old vaults still unlock.
    const derivedKey = await deriveKeyFromWallet(walletProvider, email, {
      salt: profile.kdfSalt,
      userId: profile.clerkId,
    });
    const encryptedVaultKey: WrappedKey = JSON.parse(profile.encryptedVaultKey);
    const vaultKey = await unwrapKey(encryptedVaultKey, derivedKey);

    setVaultKey(vaultKey);
    isVaultUnlocked = true;

    // Opportunistic migration: legacy profile → re-wrap under v2 HKDF.
    if (!profile.kdfSalt) {
      try {
        const newSalt = generateKdfSalt();
        const newDerived = await deriveKeyFromWallet(walletProvider, email, {
          salt: newSalt,
          userId: profile.clerkId,
        });
        const rewrapped = await wrapKey(vaultKey, newDerived);
        await db.transact(
          db.tx.profiles[profile.id].update({
            encryptedVaultKey: JSON.stringify(rewrapped),
            kdfSalt: newSalt,
          })
        );
      } catch (migErr) {
        // Non-fatal — user will retry on next unlock.
        console.warn('[Crypto] KDF v2 migration deferred:', migErr);
      }
    }
  } catch (err: any) {
    unlockError = 'Failed to unlock vault. Make sure you\'re using the correct wallet.';
    throw new Error(unlockError);
  }
}

// Shared-vault escrow flow has been removed (security/hardening-pass-1).
// The original implementation derived its wrap key from a hardcoded
// constant shipped in the JS bundle, breaking confidentiality. Shared
// vault distribution will be redesigned with per-user wraps initiated by
// the shared vault owner.


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
