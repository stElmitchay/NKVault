// NKVault — In-Memory Session Key Store
// Holds the derived vault key in memory. Cleared on page unload, sign-out,
// or after IDLE_LOCK_MS of no user input.

let vaultKey: CryptoKey | null = null;
let sharedVaultKey: CryptoKey | null = null;

// ---- Idle auto-lock ----
const IDLE_LOCK_MS = 10 * 60 * 1000; // 10 minutes
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function resetIdleTimer(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (vaultKey === null && sharedVaultKey === null) return;
  idleTimer = setTimeout(() => {
    clearKeys();
  }, IDLE_LOCK_MS);
}

export function setVaultKey(key: CryptoKey): void {
  vaultKey = key;
  resetIdleTimer();
}

export function getVaultKey(): CryptoKey | null {
  return vaultKey;
}

export function setSharedVaultKey(key: CryptoKey): void {
  sharedVaultKey = key;
  resetIdleTimer();
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
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

if (typeof window !== 'undefined') {
  // pagehide fires in more cases than beforeunload (incl. bfcache).
  window.addEventListener('pagehide', clearKeys);
  window.addEventListener('beforeunload', clearKeys);

  // Reset idle timer on user interaction.
  const events: (keyof WindowEventMap)[] = [
    'mousemove', 'keydown', 'pointerdown', 'touchstart', 'visibilitychange',
  ];
  for (const ev of events) {
    window.addEventListener(ev, resetIdleTimer, { passive: true });
  }
}
