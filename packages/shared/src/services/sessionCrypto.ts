/**
 * Encryption for the saved sign-in session (security audit M4).
 *
 * The Supabase session (access + refresh token) used to sit in AsyncStorage as
 * plain JSON, where a device backup or a rooted phone can read it. SecureStore
 * (the Keychain) is the right place, but it refuses values over 2048 characters
 * and a session is bigger. The standard answer is the one used here: keep a small
 * random key in SecureStore, keep the session in AsyncStorage encrypted with it.
 *
 * AES-256 in counter mode with a fresh random counter for every write, stored as
 * "enc1:" + hex(counter) + hex(ciphertext). This hides the tokens at rest; it does
 * not authenticate them (an attacker who can write the file could also just delete
 * the session), which is the same trade-off Supabase's own React Native guide makes.
 *
 * Pure functions on bytes so they are unit-tested; the SecureStore/AsyncStorage
 * wiring is in secureSessionStorage.ts.
 */
import * as aes from 'aes-js';

export const ENC_PREFIX = 'enc1:';

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX);
}

/** key: 32 bytes. counter: 16 random bytes, never reused with the same key. */
export function encryptSession(key: Uint8Array, counter: Uint8Array, plaintext: string): string {
  const ctr = new aes.ModeOfOperation.ctr(key, new aes.Counter(counter as unknown as number[]));
  const cipher = ctr.encrypt(aes.utils.utf8.toBytes(plaintext));
  return ENC_PREFIX + aes.utils.hex.fromBytes(counter) + aes.utils.hex.fromBytes(cipher);
}

/** Throws when the value is not ours or the key is wrong (the caller then treats the session as gone). */
export function decryptSession(key: Uint8Array, stored: string): string {
  if (!isEncrypted(stored)) throw new Error('not an encrypted session');
  const hex = stored.slice(ENC_PREFIX.length);
  if (hex.length < 34 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error('malformed session');
  const counter = aes.utils.hex.toBytes(hex.slice(0, 32));
  const cipher = aes.utils.hex.toBytes(hex.slice(32));
  const ctr = new aes.ModeOfOperation.ctr(key, new aes.Counter(counter as unknown as number[]));
  const text = aes.utils.utf8.fromBytes(ctr.decrypt(cipher));
  // CTR cannot tell a wrong key from the right one; a session is JSON, so a wrong
  // key produces garbage that is not parseable and is rejected here.
  JSON.parse(text);
  return text;
}
