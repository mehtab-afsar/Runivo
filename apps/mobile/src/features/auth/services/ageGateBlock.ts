/**
 * Under-13 block that survives a relaunch (B05). The age screen kept the block in
 * component state only, so killing the app and entering another year got past it
 * (a neutral age gate must not let someone simply try again). Kept per phone, not
 * per account, so making a fresh account on the same phone doesn't reset it.
 * It lasts a day: long enough that retrying with another year doesn't work, short
 * enough that a family phone a child once used isn't locked for its owner forever.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureHandledError } from '@shared/services/errorReporting';

export const AGE_BLOCK_KEY = 'runivo.ageGate.under13At';

export async function rememberUnder13(now: number = Date.now()): Promise<void> {
  await AsyncStorage.setItem(AGE_BLOCK_KEY, String(now)).catch(() => {});
}

export const AGE_BLOCK_MS = 24 * 60 * 60 * 1000;

/** True for a day after this phone answered with an under-13 birth date. */
export async function isAgeBlocked(now: number = Date.now()): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(AGE_BLOCK_KEY);
    if (raw == null) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || now - at < AGE_BLOCK_MS) return true;
    await AsyncStorage.removeItem(AGE_BLOCK_KEY).catch(() => {});
    return false;
  } catch (err) {
    captureHandledError(err, { domain: 'storage', operation: 'read-age-gate-block' });
    return false;
  }
}
