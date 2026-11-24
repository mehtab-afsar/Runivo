// Pure calculations over rows the context builder has already fetched: pace
// trend and zones, personal records, race predictions, territory freshness and
// nutrition aggregates. No I/O, so each can be tested with plain objects.
import { MS_PER_DAY, fmtPaceSec, fmtTime, meanSec, paceSecPerKm } from './format.ts';
import type { NutritionContext, NutritionDayLog, RunRecord, UserContext } from './types.ts';

export interface RunMetrics {
  weeklyKm: number;
  trend: string;
  paceZones: UserContext['paceZones'];
  easyPace: string;
  tempoPace: string;
  prs: UserContext['prs'];
  racePredictions: UserContext['racePredictions'];
}

export function computeRunMetrics(runs90d: RunRecord[]): RunMetrics {
  // ── Weekly avg (last 8 weeks) ────────────────────────────────────────────────
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
  const last8wRuns    = runs90d.filter(r => r.started_at >= eightWeeksAgo);
  const totalKm8w     = last8wRuns.reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);
  const weeklyKm      = totalKm8w / 8;

  // ── Pace trend ───────────────────────────────────────────────────────────────
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentRuns   = last8wRuns.filter(r => r.started_at >= fourWeeksAgo);
  const olderRuns    = last8wRuns.filter(r => r.started_at < fourWeeksAgo);
  const recentAvg    = meanSec(recentRuns);
  const olderAvg     = meanSec(olderRuns);
  const trend        = recentAvg > 0 && olderAvg > 0
    ? recentAvg < olderAvg - 5 ? 'improving'
      : recentAvg > olderAvg + 5 ? 'declining'
      : 'stable'
    : 'building base';

  // ── Pace zones ───────────────────────────────────────────────────────────────
  const validForZones = runs90d.filter(r => (r.distance_m ?? 0) > 1000 && (r.duration_sec ?? 0) > 60);
  const zoneCounts    = { easy: 0, moderate: 0, tempo: 0, hard: 0 };
  const zonePaces: { easy: number[]; moderate: number[]; tempo: number[]; hard: number[] } =
    { easy: [], moderate: [], tempo: [], hard: [] };

  validForZones.forEach(r => {
    const pace = paceSecPerKm(r);
    if      (pace >= 390) { zoneCounts.easy++;     zonePaces.easy.push(pace);     }
    else if (pace >= 330) { zoneCounts.moderate++;  zonePaces.moderate.push(pace); }
    else if (pace >= 285) { zoneCounts.tempo++;     zonePaces.tempo.push(pace);    }
    else                  { zoneCounts.hard++;      zonePaces.hard.push(pace);     }
  });
  const total     = Math.max(1, validForZones.length);
  const paceZones = {
    easy:     Math.round(zoneCounts.easy     / total * 100),
    moderate: Math.round(zoneCounts.moderate / total * 100),
    tempo:    Math.round(zoneCounts.tempo    / total * 100),
    hard:     Math.round(zoneCounts.hard     / total * 100),
  };

  const mean       = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const allPaces   = runs90d.filter(r => r.distance_m && r.duration_sec).map(r => paceSecPerKm(r)).sort((a, b) => a - b);
  const medianAll  = allPaces.length > 0 ? allPaces[Math.floor(allPaces.length / 2)] : 0;
  const easyAvg    = mean(zonePaces.easy);
  const tempoAvg   = mean(zonePaces.tempo);
  const easyPace   = fmtPaceSec(easyAvg  > 0 ? easyAvg  : medianAll + 90);
  const tempoPace  = fmtPaceSec(tempoAvg > 0 ? tempoAvg : Math.max(240, medianAll - 30));

  // ── PRs ──────────────────────────────────────────────────────────────────────
  let fastestPaceSec = Infinity;
  let longestRunKm   = 0;
  let best5kPaceSec  = Infinity;

  runs90d.filter(r => (r.distance_m ?? 0) > 0 && (r.duration_sec ?? 0) > 0).forEach(r => {
    const pace   = paceSecPerKm(r);
    const distKm = (r.distance_m ?? 0) / 1000;
    if (pace   < fastestPaceSec) fastestPaceSec = pace;
    if (distKm > longestRunKm)   longestRunKm   = distKm;
    if (distKm >= 4.8 && pace < best5kPaceSec) best5kPaceSec = pace;
  });

  const prs = {
    fastestPace: fastestPaceSec < Infinity ? fmtPaceSec(fastestPaceSec) : null,
    longestRun:  parseFloat(longestRunKm.toFixed(1)),
    best5kPace:  best5kPaceSec  < Infinity ? fmtPaceSec(best5kPaceSec)  : null,
  };

  // ── Race predictions ─────────────────────────────────────────────────────────
  const refRun = runs90d
    .filter(r => (r.distance_m ?? 0) >= 3000 && (r.duration_sec ?? 0) > 0)
    .sort((a, b) => (b.distance_m ?? 0) - (a.distance_m ?? 0))[0] ?? null;

  let racePredictions: UserContext['racePredictions'] = null;
  if (refRun) {
    const t1      = refRun.duration_sec!;
    const d1      = refRun.distance_m! / 1000;
    const predict = (d2: number) => t1 * Math.pow(d2 / d1, 1.06);
    racePredictions = {
      fiveK: fmtTime(predict(5)),
      tenK:  fmtTime(predict(10)),
      half:  fmtTime(predict(21.0975)),
      full:  fmtTime(predict(42.195)),
    };
  }

  return { weeklyKm: parseFloat(weeklyKm.toFixed(1)), trend, paceZones, easyPace, tempoPace, prs, racePredictions };
}

// ─── Territory ────────────────────────────────────────────────────────────────
export interface PolygonRow {
  area_m2: number;
  freshness: number;
  last_defended_at: string;
  tier: string;
}

export interface TerritoryMetrics {
  staleZoneCount: number;
  totalArea: number;
  avgFreshness: number;
  largestTierHeld: string;
}

export function computeTerritory(polygonRows: PolygonRow[]): TerritoryMetrics {
  const now         = Date.now();
  const tierOrder   = ['patch', 'block', 'district', 'quarter', 'domain'];

  let staleZoneCount  = 0;
  let totalArea       = 0;
  let weightedFresh   = 0;
  let largestTierHeld = 'patch';

  for (const p of polygonRows) {
    const daysSince        = (now - new Date(p.last_defended_at).getTime()) / MS_PER_DAY;
    const currentFreshness = Math.max(0, p.freshness - Math.floor(daysSince * 10));
    if (currentFreshness < 40) staleZoneCount++;
    totalArea     += p.area_m2;
    weightedFresh += currentFreshness * p.area_m2;
    if (tierOrder.indexOf(p.tier) > tierOrder.indexOf(largestTierHeld)) largestTierHeld = p.tier;
  }

  const avgFreshness = totalArea > 0 ? Math.round(weightedFresh / totalArea) : 100;
  return { staleZoneCount, totalArea, avgFreshness, largestTierHeld };
}

// ─── Nutrition ────────────────────────────────────────────────────────────────
export interface NutritionProfileRow {
  daily_goal_kcal: number;
  protein_goal_g: number;
  goal: string;
  weight_kg: number;
}

export interface NutritionLogRow {
  log_date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number;
}

export interface EventRow {
  events: { starts_at: string };
}

export function computeNutrition(
  np: NutritionProfileRow,
  rawLogs: NutritionLogRow[],
  nextEvent: EventRow | null,
): NutritionContext {
  // Build per-day aggregates from raw logs
  const dayMap = new Map<string, NutritionDayLog>();
  rawLogs.forEach(l => {
    const existing = dayMap.get(l.log_date) ?? { date: l.log_date, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    existing.kcal     += l.kcal     ?? 0;
    existing.proteinG += l.protein_g ?? 0;
    existing.carbsG   += l.carbs_g  ?? 0;
    existing.fatG     += l.fat_g    ?? 0;
    dayMap.set(l.log_date, existing);
  });
  const dailyLogs = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Last 7 days for averages
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const last7Logs    = dailyLogs.filter(d => d.date >= sevenDaysAgo);
  const recentAvgKcal     = last7Logs.length > 0 ? Math.round(last7Logs.reduce((s, d) => s + d.kcal, 0) / 7) : 0;
  const recentAvgProteinG = last7Logs.length > 0 ? Math.round(last7Logs.reduce((s, d) => s + d.proteinG, 0) / last7Logs.length) : 0;
  const daysHitKcalTarget  = last7Logs.filter(d => d.kcal >= np.daily_goal_kcal * 0.9).length;
  const daysUnderProtein80g = last7Logs.filter(d => d.proteinG < 80).length;

  // Days until next registered event
  let daysUntilEvent: number | null = null;
  try {
    if (nextEvent?.events?.starts_at) {
      const diff = (new Date(nextEvent.events.starts_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      daysUntilEvent = Math.max(0, Math.round(diff));
    }
  } catch { /* no event data — leave null */ }

  return {
    dailyGoalKcal:      np.daily_goal_kcal,
    proteinGoalG:       np.protein_goal_g ?? 0,
    goal:               np.goal ?? 'maintain',
    weightKg:           np.weight_kg,
    recentAvgKcal,
    recentAvgProteinG,
    daysHitKcalTarget,
    daysUnderProtein80g,
    dailyLogs,
    daysUntilEvent,
  };
}
