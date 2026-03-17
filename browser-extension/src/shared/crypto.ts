// NKVault Extension — AES-256-GCM Crypto (copied from web app)
// Used by the background service worker for decrypt operations.

export interface EncryptedBlob {
  __encrypted: true;
  iv: string;        // base64
  ciphertext: string; // base64
}

/** Encrypt plaintext with AES-256-GCM. */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    __encrypted: true,
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(new Uint8Array(ciphertextBuffer)),
  };
}

/** Decrypt an EncryptedBlob back to plaintext. */
export async function decrypt(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const iv = base64ToBuffer(blob.iv);
  const ciphertextBuffer = base64ToBuffer(blob.ciphertext);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertextBuffer
  );

  return new TextDecoder().decode(plaintext);
}

/** Check if a data object is an encrypted blob. */
export function isEncrypted(data: unknown): data is EncryptedBlob {
  return (
    typeof data === 'object' &&
    data !== null &&
    '__encrypted' in data &&
    (data as any).__encrypted === true &&
    typeof (data as any).iv === 'string' &&
    typeof (data as any).ciphertext === 'string'
  );
}

// ---- Key utilities (from web app keys.ts) ----

export interface WrappedKey {
  iv: string;   // base64
  data: string; // base64
}

/** Generate a random 256-bit AES-GCM key. */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/** Export a CryptoKey to raw bytes. */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/** Import raw bytes as an AES-GCM CryptoKey. */
export async function importKey(
  raw: Uint8Array,
  usages: KeyUsage[] = ['encrypt', 'decrypt'],
  extractable: boolean = true
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    extractable,
    usages
  );
}

/** Unwrap (decrypt) a key using AES-GCM. */
export async function unwrapKey(wrapped: WrappedKey, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const iv = base64ToBuffer(wrapped.iv);
  const data = base64ToBuffer(wrapped.data);

  return crypto.subtle.unwrapKey(
    'raw',
    data,
    wrappingKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/** Wrap (encrypt) a key using AES-GCM. */
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

// ---- Base64 helpers ----

export function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}
