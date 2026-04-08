// NKVault — AES-256-GCM Encryption / Decryption

export interface EncryptedBlob {
  __encrypted: true;
  iv: string;        // base64
  ciphertext: string; // base64
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Generates a fresh 12-byte IV for each call.
 */
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

/**
 * Decrypt an EncryptedBlob back to plaintext using AES-256-GCM.
 */
export async function decrypt(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const iv = base64ToBuffer(blob.iv);
  const ciphertextBuffer = base64ToBuffer(blob.ciphertext);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertextBuffer as BufferSource
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
