import { describe, expect, it, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    removeItem: vi.fn(async (k: string) => { store.delete(k); }),
  },
}));

import { isAgeBlocked, rememberUnder13, AGE_BLOCK_KEY, AGE_BLOCK_MS } from './ageGateBlock';

describe('age gate block persistence', () => {
  beforeEach(() => store.clear());

  it('is not blocked on a fresh install', async () => {
    expect(await isAgeBlocked()).toBe(false);
  });

  it('stays blocked after an under-13 answer, across a relaunch (module state is not used)', async () => {
    await rememberUnder13(1_700_000_000_000);
    expect(store.get(AGE_BLOCK_KEY)).toBe('1700000000000');
    vi.resetModules();
    const again = await import('./ageGateBlock');
    expect(await again.isAgeBlocked(1_700_000_000_000 + 60_000)).toBe(true);
  });

  it('lifts after a day, so a shared family phone is not locked for good', async () => {
    await rememberUnder13(1_700_000_000_000);
    expect(await isAgeBlocked(1_700_000_000_000 + AGE_BLOCK_MS - 1)).toBe(true);
    expect(await isAgeBlocked(1_700_000_000_000 + AGE_BLOCK_MS)).toBe(false);
    expect(store.has(AGE_BLOCK_KEY)).toBe(false);
  });

  it('fails open to "not blocked" only when storage itself is broken', async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    expect(await isAgeBlocked()).toBe(false);
  });
});
