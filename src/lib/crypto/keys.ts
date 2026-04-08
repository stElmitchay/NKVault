// NKVault — Key Generation & Wrapping Utilities

export interface WrappedKey {
  iv: string;   // base64
  data: string; // base64
}

/** Generate a random 256-bit AES-GCM key for vault encryption. */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — needed for wrapKey
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/** Export a CryptoKey to raw bytes. */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/** Import raw bytes as a CryptoKey. */
export async function importKey(
  raw: Uint8Array,
  usages: KeyUsage[] = ['encrypt', 'decrypt'],
  extractable: boolean = true
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM' },
    extractable,
    usages
  );
}

/**
 * Wrap (encrypt) a key using AES-GCM.
 * wrappingKey must have 'wrapKey' usage; keyToWrap must be extractable.
 */
export async function wrapKey(keyToWrap: CryptoKey, wrappingKey: CryptoKey): Promise<WrappedKey> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    wrappingKey,
    { name: 'AES-GCM', iv }
  );

  return {
    iv: bufferToBase64(iv),
    data: bufferToBase64(new Uint8Array(wrapped)),
  };
}

/**
 * Unwrap (decrypt) a key using AES-GCM.
 * wrappingKey must have 'unwrapKey' usage.
 */
export async function unwrapKey(wrapped: WrappedKey, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const iv = base64ToBuffer(wrapped.iv);
  const data = base64ToBuffer(wrapped.data);

  return crypto.subtle.unwrapKey(
    'raw',
    data as BufferSource,
    wrappingKey,
    { name: 'AES-GCM', iv: iv as BufferSource },
    { name: 'AES-GCM', length: 256 },
    true, // extractable — so it can be re-wrapped on password change
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// ---- Base64 helpers ----

function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}
