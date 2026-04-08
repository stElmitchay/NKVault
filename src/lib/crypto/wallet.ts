// NKVault — Solana Wallet Crypto Module
// Derives AES-256 encryption key from a deterministic Solana wallet signature.
// Ed25519 signatures are deterministic: same key + same message = same signature.

const VAULT_KEY_MESSAGE = 'NKVault Vault Key';

/**
 * Solana wallet provider interface.
 * Matches the standard API exposed by Phantom, Solflare, Backpack, etc.
 */
export interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey: { toBase58(): string; toBytes(): Uint8Array } | null;
  isConnected: boolean;
  connect(): Promise<{ publicKey: { toBase58(): string; toBytes(): Uint8Array } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  on?(event: string, callback: (...args: any[]) => void): void;
  off?(event: string, callback: (...args: any[]) => void): void;
}

/** A detected wallet with display metadata. */
export interface DetectedWallet {
  name: string;
  icon: string;
  provider: SolanaProvider;
}

/**
 * Detect installed Solana wallets in the browser.
 * Checks for Phantom, Solflare, and Backpack.
 */
export function detectWallets(): DetectedWallet[] {
  if (typeof window === 'undefined') return [];

  const wallets: DetectedWallet[] = [];
  const seen = new Set<any>(); // avoid duplicates

  // Phantom (checks both injection points — some browsers inject differently)
  const phantom = (window as any).phantom?.solana;
  if (phantom?.isPhantom) {
    wallets.push({ name: 'Phantom', icon: '👻', provider: phantom });
    seen.add(phantom);
  }

  // Solflare
  const solflare = (window as any).solflare;
  if (solflare?.isSolflare && !seen.has(solflare)) {
    wallets.push({ name: 'Solflare', icon: '🔆', provider: solflare });
    seen.add(solflare);
  }

  // Backpack
  const backpack = (window as any).backpack;
  if (backpack?.isBackpack && !seen.has(backpack)) {
    wallets.push({ name: 'Backpack', icon: '🎒', provider: backpack });
    seen.add(backpack);
  }

  // Brave Wallet
  const brave = (window as any).braveSolana;
  if (brave && !seen.has(brave)) {
    wallets.push({ name: 'Brave Wallet', icon: '🦁', provider: brave });
    seen.add(brave);
  }

  // Generic window.solana fallback (Opera, older injections, or other wallets)
  const generic = (window as any).solana;
  if (generic && typeof generic.connect === 'function' && !seen.has(generic)) {
    const name = generic.isPhantom ? 'Phantom'
      : generic.isSolflare ? 'Solflare'
      : generic.isBackpack ? 'Backpack'
      : 'Solana Wallet';
    const icon = generic.isPhantom ? '👻'
      : generic.isSolflare ? '🔆'
      : generic.isBackpack ? '🎒'
      : '🔗';
    wallets.push({ name, icon, provider: generic });
    seen.add(generic);
  }

  return wallets;
}

/**
 * Connect to a wallet provider.
 * @returns The wallet address (base58-encoded public key).
 */
export async function connectWallet(provider: SolanaProvider): Promise<string> {
  const resp = await provider.connect();
  // Some wallets return { publicKey } from connect(), others set provider.publicKey directly
  const pubKey = resp?.publicKey ?? provider.publicKey;
  if (!pubKey) {
    throw new Error('Wallet connected but no public key returned. Try refreshing the page.');
  }
  return pubKey.toBase58();
}

/**
 * Disconnect from a wallet provider.
 */
export async function disconnectWallet(provider: SolanaProvider): Promise<void> {
  await provider.disconnect();
}

/**
 * Get the connected wallet address, or null if not connected.
 */
export function getWalletAddress(provider: SolanaProvider): string | null {
  return provider.publicKey?.toBase58() ?? null;
}

/**
 * Truncate a wallet address for display: "7xKX...3nRp"
 */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Build the deterministic message that gets signed.
 * Must remain constant between setup and unlock — changing this
 * would invalidate all existing vaults.
 */
function buildSignMessage(email: string): Uint8Array {
  const message = [
    VAULT_KEY_MESSAGE,
    `Account: ${email}`,
    '',
    'Sign this message to unlock your vault.',
    'This does NOT send a transaction or cost SOL.',
  ].join('\n');

  return new TextEncoder().encode(message);
}

/** Generate a fresh random salt for wallet key derivation. Base64-encoded. */
export function generateKdfSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Derive an AES-256-GCM wrap key from a Solana wallet signature using HKDF
 * with a per-profile random salt and a domain-separation context label.
 *
 * Flow:
 * 1. Wallet signs a deterministic message → 64-byte Ed25519 signature
 * 2. Import the signature as HKDF input key material
 * 3. HKDF-SHA256(salt = profile.kdfSalt, info = "NKVault v2 wrapKey:<userId>")
 *    → AES-256-GCM CryptoKey with wrapKey/unwrapKey usages
 *
 * If `salt` is omitted (legacy profile), falls back to the v1 SHA-256(sig)
 * derivation so existing vaults can still be unlocked. Callers should
 * generate a fresh salt and re-wrap the vault key the next time the user
 * sets up — see crypto.svelte.ts.
 */
export async function deriveKeyFromWallet(
  provider: SolanaProvider,
  email: string,
  opts?: { salt?: string; userId?: string }
): Promise<CryptoKey> {
  const messageBytes = buildSignMessage(email);

  // 1. Sign — deterministic for Ed25519
  const { signature } = await provider.signMessage(messageBytes);

  // ---- Legacy v1 path: no salt yet ----
  if (!opts?.salt) {
    const keyMaterial = await crypto.subtle.digest('SHA-256', signature.buffer as ArrayBuffer);
    return crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['wrapKey', 'unwrapKey']
    );
  }

  // ---- v2 path: HKDF with per-profile salt ----
  const ikm = await crypto.subtle.importKey(
    'raw',
    signature.buffer as ArrayBuffer,
    'HKDF',
    false,
    ['deriveKey']
  );

  const saltBytes = b64decode(opts.salt);
  const info = new TextEncoder().encode(`NKVault v2 wrapKey:${opts.userId ?? ''}`);

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBytes,
      info,
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}
