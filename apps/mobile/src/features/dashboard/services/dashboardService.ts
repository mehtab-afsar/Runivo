import {
  getTerritoryPolygons,
  getRuns,
  getSettings,
  getNutritionProfile,
  getNutritionEntries,
  localDateString,
  type StoredRun,
} from '@shared/services/store';
import type { TerritoryPolygon } from '@shared/types/game';
import { ensureTodaysMissions } from '@shared/services/missionStore';
import type { Mission } from '@shared/services/missions';

export interface DashboardData {
  territories: TerritoryPolygon[];
  missions: Mission[];
  recentRuns: StoredRun[];
  weeklyKm: number;
  runDays: boolean[];
  /** km per day this calendar week, Monday first. */
  dayKm: number[];
  weeklyGoal: number;
  caloriesConsumed: number;
  calorieGoal: number;
  weightKg: number;
}

export async function fetchDashboardData(_userId: string): Promise<DashboardData> {
  const [missions, allTerritories, settings, allRuns] = await Promise.all([
    ensureTodaysMissions(),
    getTerritoryPolygons(),
    getSettings(),
    getRuns(100),
  ]);

  const weeklyGoal = settings.weeklyGoalKm;

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weekRuns = allRuns.filter(r => r.startTime >= weekAgo);
  const weeklyKm =
    Math.round(weekRuns.filter(r => !r.excluded).reduce((s, r) => s + r.distanceMeters / 1000, 0) * 10) / 10;

  const todayMon = (new Date().getDay() + 6) % 7;
  const runDays = Array(7).fill(false) as boolean[];
  weekRuns.forEach(r => {
    const idx = (new Date(r.startTime).getDay() + 6) % 7;
    if (now - r.startTime < (todayMon + 1) * 86_400_000) runDays[idx] = true;
  });

  // This calendar week (Monday 00:00 local) for the bar chart.
  const monday = new Date(); monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - todayMon);
  const dayKm = Array(7).fill(0) as number[];
  allRuns.filter(r => r.startTime >= monday.getTime()).forEach(r => {
    const idx = (new Date(r.startTime).getDay() + 6) % 7;
    dayKm[idx] += r.distanceMeters / 1000;
  });

  let caloriesConsumed = 0;
  let calorieGoal = 2000;
  let weightKg = 70;
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
    weightKg = nutProf?.weightKg ?? 70;
  } catch { /* The nutrition card is optional; the dashboard renders without it. */ }

  const recentRuns = [...allRuns]
    .filter(r => r.distanceMeters >= 50)
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 3);

  return {
    territories: allTerritories,
    missions,
    recentRuns,
    weeklyKm,
    runDays,
    dayKm,
    weeklyGoal,
    caloriesConsumed,
    calorieGoal,
    weightKg,
  };
}
