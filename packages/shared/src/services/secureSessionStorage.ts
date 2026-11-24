/**
 * Where the Supabase session is kept on the phone (security audit M4).
 *
 * The 256-bit key lives in the Keychain/Keystore through expo-secure-store; the
 * session itself, which is too big for SecureStore, lives in AsyncStorage encrypted
 * with that key (sessionCrypto.ts). Plug it in as `auth.storage`.
 *
 *  - The key is THIS_DEVICE_ONLY and readable after the first unlock, so background
 *    token refresh still works with the screen locked, and neither the key nor (so)
 *    a restored backup's session can be used on another device.
 *  - A session saved by an older build (plain JSON) is read once and immediately
 *    re-saved encrypted, so nobody is signed out by the upgrade.
 *  - If the key cannot be read or created (no Keychain entitlement, e.g. an
 *    unsigned simulator build, or a Keychain error), the session is kept in
 *    memory for this run only: nothing reaches the disk, and the runner signs in
 *    again next launch. It never falls back to plaintext storage.
 *    (It used to keep nothing at all, so the app looked signed in while every
 *    server call went out without a session: clubs, challenges, PACE all failed.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';
import { decryptSession, encryptSession, isEncrypted } from './sessionCrypto';
import { captureHandledError } from './errorReporting';

const KEY_NAME = 'runivo-session-key-v1';
const KEY_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

let keyPromise: Promise<Uint8Array | null> | null = null;
/** This run's session when there is no key to encrypt it with. Never written to disk. */
const memoryOnly = new Map<string, string>();

const toHex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], x => parseInt(x, 16));

/** One shared promise, so two storage calls racing at first launch cannot create two keys. */
function getKey(): Promise<Uint8Array | null> {
  keyPromise ??= (async () => {
    try {
      const existing = await SecureStore.getItemAsync(KEY_NAME, KEY_OPTIONS);
      if (existing && /^[0-9a-f]{64}$/i.test(existing)) return fromHex(existing);
      const fresh = getRandomBytes(32);
      await SecureStore.setItemAsync(KEY_NAME, toHex(fresh), KEY_OPTIONS);
      return fresh;
    } catch (err) {
      captureHandledError(err, { domain: 'auth', operation: 'secure-key-store' });
      keyPromise = null; // try again next call instead of staying broken
      return null;
    }
  })();
  return keyPromise;
}

export const secureSessionStorage = {
  async getItem(name: string): Promise<string | null> {
    if (memoryOnly.has(name)) return memoryOnly.get(name) ?? null;
    const stored = await AsyncStorage.getItem(name);
    if (stored == null) return null;
    const key = await getKey();
    if (!key) return null;

    if (!isEncrypted(stored)) {
      // Saved by a build before encryption: keep the runner signed in, and encrypt it now.
      await this.setItem(name, stored);
      return stored;
    }
    try {
      return decryptSession(key, stored);
    } catch {
      // Wrong key (restored from a backup, key lost) or damaged: the session is unusable.
      await AsyncStorage.removeItem(name).catch(() => {});
      return null;
    }
  },

  async setItem(name: string, value: string): Promise<void> {
    const key = await getKey();
    if (!key) { memoryOnly.set(name, value); return; }
    memoryOnly.delete(name);
    await AsyncStorage.setItem(name, encryptSession(key, getRandomBytes(16), value));
  },

  async removeItem(name: string): Promise<void> {
    memoryOnly.delete(name);
    await AsyncStorage.removeItem(name);
  },
};
