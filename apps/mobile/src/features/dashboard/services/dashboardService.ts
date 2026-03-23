import {
  getAllTerritories,
  getRuns,
  getSettings,
  getNutritionProfile,
  getNutritionEntries,
  localDateString,
  type StoredTerritory,
  type StoredRun,
} from '@shared/services/store';
import { GAME_CONFIG } from '@shared/services/config';
import { ensureTodaysMissions } from '@shared/services/missionStore';
import type { Mission } from '@shared/services/missions';

export interface DashboardData {
  territories: StoredTerritory[];
  missions: Mission[];
  recentRuns: StoredRun[];
  loginBonusCoins: number;
  weeklyKm: number;
  runDays: boolean[];
  weeklyGoal: number;
  caloriesConsumed: number;
  calorieGoal: number;
}

export async function fetchDashboardData(userId: string): Promise<DashboardData> {
  const [missions, allTerritories, settings, allRuns] = await Promise.all([
    ensureTodaysMissions(),
    getAllTerritories(),
    getSettings(),
    getRuns(100),
  ]);

  const weeklyGoal = settings.weeklyGoalKm;

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weekRuns = allRuns.filter(r => r.startTime >= weekAgo);
  const weeklyKm =
    Math.round(weekRuns.reduce((s, r) => s + r.distanceMeters / 1000, 0) * 10) / 10;

  const todayMon = (new Date().getDay() + 6) % 7;
  const runDays = Array(7).fill(false) as boolean[];
  weekRuns.forEach(r => {
    const idx = (new Date(r.startTime).getDay() + 6) % 7;
    if (now - r.startTime < (todayMon + 1) * 86_400_000) runDays[idx] = true;
  });

  let caloriesConsumed = 0;
  let calorieGoal = 2000;
  try {
    const [nutProf, nutEntries] = await Promise.all([
      getNutritionProfile(),
      getNutritionEntries(localDateString()),
    ]);
    caloriesConsumed = Math.max(
      0,
      nutEntries.filter(e => e.source !== 'run').reduce((s, e) => s + e.kcal, 0),
    );
    calorieGoal = nutProf?.dailyGoalKcal ?? 2000;
  } catch { /* ignore */ }

  const recentRuns = [...allRuns]
    .filter(r => r.distanceMeters >= 50)
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 3);

  return {
    territories: allTerritories,
    missions,
    recentRuns,
    loginBonusCoins: 0, // provided by usePlayerStats
    weeklyKm,
    runDays,
    weeklyGoal,
    caloriesConsumed,
    calorieGoal,
  };
}
