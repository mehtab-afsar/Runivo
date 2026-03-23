import { StoredPlayer } from './store';

/**
 * Daily login bonus: collect LOGIN_BONUS_COINS_PER_TERRITORY × owned territories.
 * Awarded once per calendar day when the app is opened.
 *
 * Returns { coinsEarned, updatedPlayer, alreadyCollected }.
 * If already collected today, coinsEarned === 0 and alreadyCollected === true.
 */
export function collectLoginBonus(
  player: StoredPlayer,
  ownedZoneCount: number
): { coinsEarned: number; updatedPlayer: StoredPlayer; alreadyCollected: boolean } {
  const today = new Date().toISOString().split('T')[0];
  const noop = { coinsEarned: 0, updatedPlayer: player, alreadyCollected: true };

  if (player.lastLoginBonusDate === today) return noop;
  if (ownedZoneCount <= 0) {
    // Still mark as collected for today so we don't spam a 0-coin toast
    const updatedPlayer: StoredPlayer = { ...player, lastLoginBonusDate: today };
    return { coinsEarned: 0, updatedPlayer, alreadyCollected: false };
  }

  const coinsEarned = 0;
  const updatedPlayer: StoredPlayer = { ...player, lastLoginBonusDate: today };

  return { coinsEarned, updatedPlayer, alreadyCollected: false };
}

/** @deprecated Use collectLoginBonus instead. */
export function collectPassiveIncome(
  player: StoredPlayer,
  ownedZoneCount: number
): { coinsEarned: number; updatedPlayer: StoredPlayer } {
  const { coinsEarned, updatedPlayer } = collectLoginBonus(player, ownedZoneCount);
  return { coinsEarned, updatedPlayer };
}
