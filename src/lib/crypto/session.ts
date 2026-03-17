// NKVault — In-Memory Session Key Store
// Holds the derived vault key in memory. Cleared on page unload or sign-out.

let vaultKey: CryptoKey | null = null;
let sharedVaultKey: CryptoKey | null = null;

export function setVaultKey(key: CryptoKey): void {
  vaultKey = key;
}

export function getVaultKey(): CryptoKey | null {
  return vaultKey;
}

export function setSharedVaultKey(key: CryptoKey): void {
  sharedVaultKey = key;
}

export function getSharedVaultKey(): CryptoKey | null {
  return sharedVaultKey;
}

export function isUnlocked(): boolean {
  return vaultKey !== null;
}

export function clearKeys(): void {
  vaultKey = null;
  sharedVaultKey = null;
}

// Auto-clear on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', clearKeys);
}
