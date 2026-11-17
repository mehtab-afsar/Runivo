import { describe, expect, it, vi, beforeEach } from 'vitest';

const disk = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => disk.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => { disk.set(k, v); }),
    removeItem: vi.fn(async (k: string) => { disk.delete(k); }),
  },
}));
// No Keychain (unsigned simulator build): every key-store call fails.
vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: vi.fn(async () => { throw new Error('A required entitlement isn\'t present.'); }),
  setItemAsync: vi.fn(async () => { throw new Error('A required entitlement isn\'t present.'); }),
}));
vi.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(n) }));

import { secureSessionStorage } from './secureSessionStorage';

describe('secureSessionStorage without a Keychain', () => {
  beforeEach(() => disk.clear());

  it('keeps the session for this run so the app stays signed in', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await secureSessionStorage.setItem('runivo-auth', '{"access_token":"t"}');
    expect(await secureSessionStorage.getItem('runivo-auth')).toBe('{"access_token":"t"}');
  });

  it('never writes it to disk', async () => {
    await secureSessionStorage.setItem('runivo-auth', '{"access_token":"t"}');
    expect(disk.size).toBe(0);
  });

  it('signing out clears it', async () => {
    await secureSessionStorage.setItem('runivo-auth', '{"access_token":"t"}');
    await secureSessionStorage.removeItem('runivo-auth');
    expect(await secureSessionStorage.getItem('runivo-auth')).toBeNull();
  });
});
