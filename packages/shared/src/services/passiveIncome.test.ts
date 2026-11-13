/**
 * passiveIncome.test.ts — daily login bonus.
 *
 * This function shipped broken: it computed `const coinsEarned = 0` while its
 * own docstring promised LOGIN_BONUS_COINS_PER_TERRITORY × owned territories,
 * so the bonus silently paid nothing regardless of how much land a player held.
 * These tests pin the once-per-day guard and the actual arithmetic so it can't
 * regress to a no-op again.
 */

import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from './config';
import { collectLoginBonus } from './passiveIncome';
import type { StoredPlayer } from './store';

const PER_ZONE = GAME_CONFIG.LOGIN_BONUS_COINS_PER_TERRITORY;
const today = new Date().toISOString().split('T')[0];

function player(over: Partial<StoredPlayer> = {}): StoredPlayer {
  return {
    id: 'p1',
    username: 'Runner',
    totalDistanceKm: 0,
    totalRuns: 0,
    totalTerritoriesClaimed: 0,
    totalEnemyCaptured: 0,
    streakDays: 0,
    lastRunDate: null,
    lastLoginBonusDate: null,
    unlockedAchievements: [],
    createdAt: Date.now(),
    ...over,
  } as StoredPlayer;
}

describe('collectLoginBonus', () => {
  it('pays coins proportional to the number of territories owned', () => {
    const { coinsEarned } = collectLoginBonus(player(), 5);
    expect(coinsEarned).toBe(5 * PER_ZONE);
  });

  it('actually credits the coins onto the player record', () => {
    const { updatedPlayer } = collectLoginBonus(player({ coins: 10 }), 3);
    expect(updatedPlayer.coins).toBe(10 + 3 * PER_ZONE);
  });

  it('treats a player with no prior coins as starting from zero', () => {
    const { updatedPlayer } = collectLoginBonus(player(), 2);
    expect(updatedPlayer.coins).toBe(2 * PER_ZONE);
  });

  it('stamps today so the bonus is once per calendar day', () => {
    const { updatedPlayer, alreadyCollected } = collectLoginBonus(player(), 4);
    expect(alreadyCollected).toBe(false);
    expect(updatedPlayer.lastLoginBonusDate).toBe(today);
  });

  it('refuses a second collection on the same day', () => {
    const { coinsEarned, alreadyCollected, updatedPlayer } =
      collectLoginBonus(player({ lastLoginBonusDate: today, coins: 99 }), 5);
    expect(alreadyCollected).toBe(true);
    expect(coinsEarned).toBe(0);
    expect(updatedPlayer.coins).toBe(99); // untouched
  });

  it('allows collecting again the next day', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const { alreadyCollected, coinsEarned } =
      collectLoginBonus(player({ lastLoginBonusDate: yesterday }), 5);
    expect(alreadyCollected).toBe(false);
    expect(coinsEarned).toBe(5 * PER_ZONE);
  });

  it('pays nothing for a player who owns no territory, but still marks the day', () => {
    // Marking the day even at zero avoids re-showing a "+0 coins" toast all day.
    const { coinsEarned, alreadyCollected, updatedPlayer } = collectLoginBonus(player(), 0);
    expect(coinsEarned).toBe(0);
    expect(alreadyCollected).toBe(false);
    expect(updatedPlayer.lastLoginBonusDate).toBe(today);
  });

  it('never pays negative coins for a nonsensical zone count', () => {
    expect(collectLoginBonus(player(), -3).coinsEarned).toBe(0);
  });

  it('does not mutate the player it was given', () => {
    const original = player({ coins: 10 });
    collectLoginBonus(original, 5);
    expect(original.coins).toBe(10);
    expect(original.lastLoginBonusDate).toBeNull();
  });
});

