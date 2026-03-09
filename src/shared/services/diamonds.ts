import { GAME_CONFIG } from './config';

/**
 * Calculate diamonds earned from level-up milestones.
 * PRD Part 4: Diamonds awarded at levels 5, 10, 15, 20.
 */
export function calculateLevelUpDiamonds(oldLevel: number, newLevel: number): number {
  let total = 0;
  const milestones = GAME_CONFIG.DIAMONDS_LEVELUP_MILESTONE;
  const amounts = GAME_CONFIG.DIAMONDS_LEVELUP_AMOUNTS;
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    if (oldLevel < m && newLevel >= m) {
      total += amounts[i];
    }
  }
  return total;
}

/**
 * Calculate diamonds earned from streak milestones.
 * PRD Part 4: 7-day=3, 30-day=10, 100-day=25.
 */
export function calculateStreakDiamonds(oldStreak: number, newStreak: number): number {
  let total = 0;
  const milestones = [
    { days: 7, diamonds: GAME_CONFIG.DIAMONDS_STREAK_7 },
    { days: 30, diamonds: GAME_CONFIG.DIAMONDS_STREAK_30 },
    { days: 100, diamonds: GAME_CONFIG.DIAMONDS_STREAK_100 },
  ];
  for (const m of milestones) {
    if (oldStreak < m.days && newStreak >= m.days) {
      total += m.diamonds;
    }
  }
  return total;
}

/**
 * Total diamonds earned in a run session.
 * Includes level-up milestones, streak milestones, and mission diamond rewards.
 */
export function calculateRunDiamonds({
  oldLevel,
  newLevel,
  oldStreak,
  newStreak,
  missionDiamonds,
}: {
  oldLevel: number;
  newLevel: number;
  oldStreak: number;
  newStreak: number;
  missionDiamonds: number;
}): number {
  return (
    calculateLevelUpDiamonds(oldLevel, newLevel) +
    calculateStreakDiamonds(oldStreak, newStreak) +
    missionDiamonds
  );
}
