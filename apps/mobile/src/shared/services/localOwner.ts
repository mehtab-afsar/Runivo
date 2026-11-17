/**
 * The data saved on this phone (runs, zones, PACE, onboarding profile, cached
 * plan) belongs to one account. Signing out wipes it, but a session can also
 * end without a sign-out (expired, Keychain lost, app reinstalled with old
 * data restored). Then the next person to sign in or sign up on this phone
 * inherited it: a brand-new account skipped onboarding (the old profile said
 * "done") and showed the previous runner's runs and zones.
 *
 * Call before anything reads local data for a newly signed-in user.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlayer, clearAllLocalData } from '@shared/services/store';
import { clearCachedPlan } from '@features/training/services/planService';

const checks = new Map<string, Promise<boolean>>();

/**
 * Returns true when another account's data was found and wiped. Calls made while a
 * check is running share it, so the first sync can't write the new
 * account's data and then have it wiped by a check that started earlier.
 */
export function ensureLocalDataBelongsTo(userId: string): Promise<boolean> {
  let p = checks.get(userId);
  if (!p) {
    p = check(userId).finally(() => checks.delete(userId));
    checks.set(userId, p);
  }
  return p;
}

async function check(userId: string): Promise<boolean> {
  const player = await getPlayer().catch(() => null);
  if (!player || player.id === userId) return false;
  await clearAllLocalData();
  await clearCachedPlan().catch(() => {});
  await AsyncStorage.multiRemove(['runivo.pendingInviteCode']).catch(() => {});
  return true;
}
