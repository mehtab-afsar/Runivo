import { GAME_CONFIG } from './config';
import { StoredPlayer } from './store';

/**
 * Calculate and apply passive territory income since the last collection.
 *
 * Conditions:
 * - Player must own at least one zone.
 * - Player must have run within TERRITORY_DECAY_START_DAYS days (income pauses if inactive).
 * - At least 1 coin must have accrued (i.e. enough time has passed).
 *
 * Returns { coinsEarned, updatedPlayer }. If nothing is owed, coinsEarned === 0.
 */
export function collectPassiveIncome(
  player: StoredPlayer,
  ownedZoneCount: number
): { coinsEarned: number; updatedPlayer: StoredPlayer } {
  const noop = { coinsEarned: 0, updatedPlayer: player };

  if (ownedZoneCount <= 0) return noop;

  // Income only flows if the player ran recently
  if (!player.lastRunDate) return noop;
  const daysSinceRun = (Date.now() - new Date(player.lastRunDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceRun >= GAME_CONFIG.TERRITORY_DECAY_START_DAYS) return noop;

  // How many days have passed since last collection?
  const hoursElapsed = (Date.now() - player.lastIncomeCollection) / (1000 * 60 * 60);
  const daysElapsed = hoursElapsed / 24;

  const coinsEarned = Math.floor(ownedZoneCount * GAME_CONFIG.BASE_INCOME_PER_HEX_DAY * daysElapsed);
  if (coinsEarned <= 0) return noop;

  const updatedPlayer: StoredPlayer = {
    ...player,
    coins: player.coins + coinsEarned,
    lastIncomeCollection: Date.now(),
  };

  return { coinsEarned, updatedPlayer };
}
