const PBKDF2_ITERATIONS = 310_000;

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a string with AES-GCM using a passphrase.
 * Returns a base64-encoded string: [16B salt][12B IV][ciphertext]
 */
export async function encryptData(data: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(data),
  );

  const combined = new Uint8Array(16 + 12 + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(ciphertext), 28);
  return bufferToBase64(combined.buffer);
}

/**
 * Decrypt a base64-encoded AES-GCM ciphertext produced by encryptData.
 */
export async function decryptData(encoded: string, passphrase: string): Promise<string> {
  const combined = base64ToUint8Array(encoded);
  const salt = combined.slice(0, 16) as Uint8Array<ArrayBuffer>;
  const iv = combined.slice(16, 28) as Uint8Array<ArrayBuffer>;
  const data = combined.slice(28);
  const key = await deriveKey(passphrase, salt);

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plaintext);
}

/**
 * Hash a passphrase for local verification (not for encryption).
 * Uses SHA-256 for speed; good enough for local check only.
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>;
  const key = await deriveKey(passphrase, salt);
  // Export key material is not allowed for non-extractable keys; instead, produce
  // a verification token by encrypting a known sentinel.
  const token = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(12) },
    key,
    new TextEncoder().encode('pl-verify'),
  );
  const combined = new Uint8Array(16 + token.byteLength);
  combined.set(salt, 0);
  combined.set(new Uint8Array(token), 16);
  return bufferToBase64(combined.buffer);
}

export async function verifyPassphrase(passphrase: string, stored: string): Promise<boolean> {
  try {
    const combined = base64ToUint8Array(stored);
    const salt = combined.slice(0, 16) as Uint8Array<ArrayBuffer>;
    const token = combined.slice(16);
    const key = await deriveKey(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(12) },
      key,
      token,
    );
    return new TextDecoder().decode(plaintext) === 'pl-verify';
  } catch {
    return false;
  }
}
