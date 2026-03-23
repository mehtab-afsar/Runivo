/**
 * @deprecated Diamonds have been merged into coins.
 * This file is kept as a shim so any remaining imports compile cleanly.
 * All functions return 0 — coin bonuses are handled in useGameEngine.ts.
 */

export function calculateLevelUpDiamonds(_oldLevel: number, _newLevel: number): number {
  return 0;
}

export function calculateStreakDiamonds(_oldStreak: number, _newStreak: number): number {
  return 0;
}

export function calculateRunDiamonds(_params: {
  oldLevel: number;
  newLevel: number;
  oldStreak: number;
  newStreak: number;
  missionDiamonds: number;
}): number {
  return 0;
}
