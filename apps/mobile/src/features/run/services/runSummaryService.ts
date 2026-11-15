import { getRunById, saveRun, getDefaultShoe, getShoes, getNutritionProfile } from '@shared/services/store';
import type { StoredRun, StoredShoe } from '@shared/services/store';
import { writeRunToHealth } from '@mobile/shared/services/healthService';
import { estimateRunCalories } from '@shared/services/nutrition';
import { haversineM } from '@shared/services/claimEngine';

export async function fetchRunById(runId: string): Promise<StoredRun | null> {
  return (await getRunById(runId)) ?? null;
}

interface GpsPoint { lat: number; lng: number; timestamp?: number }
export interface Split { km: number; pace: number }

/**
 * Splits are derived from each GPS point's real timestamp, not from the total run
 * duration spread proportionally across distance — the latter collapses every split
 * to the same overall average pace (a straight line through the run's midpoint has
 * exactly zero variance). Falls back to the old duration-proportional estimate only
 * when points lack timestamps (e.g. a very old cached run recorded before timestamps
 * were persisted on the route).
 */
export function computeSplits(gpsPoints: GpsPoint[], totalDuration?: number): Split[] {
  if (gpsPoints.length < 2) return [];

  let cumDist = 0;
  const pts: { dist: number }[] = [{ dist: 0 }];
  for (let i = 1; i < gpsPoints.length; i++) {
    cumDist += haversineM(gpsPoints[i - 1], gpsPoints[i]) / 1000; // this function works in km throughout
    pts.push({ dist: cumDist });
  }
  const totalDist = cumDist;
  if (totalDist < 0.1) return [];

  const hasTimestamps = gpsPoints.every(p => typeof p.timestamp === 'number');
  const splits: Split[] = [];

  if (hasTimestamps) {
    const times = gpsPoints.map(p => p.timestamp as number);
    let prevSplitTime = times[0];
    let km = 1;
    for (let i = 1; i < pts.length; i++) {
      while (pts[i].dist >= km && km <= Math.floor(totalDist) + 1) {
        const segStartDist = pts[i - 1].dist;
        const segDist = pts[i].dist - segStartDist;
        const frac = segDist === 0 ? 0 : (km - segStartDist) / segDist;
        const tAtKm = times[i - 1] + frac * (times[i] - times[i - 1]);
        splits.push({ km, pace: (tAtKm - prevSplitTime) / 1000 / 60 });
        prevSplitTime = tAtKm;
        km++;
      }
    }
  } else if (totalDuration && totalDuration > 0) {
    let prevDist = 0, prevTime = 0, km = 1;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].dist;
      while (d >= km && km <= Math.floor(totalDist) + 1) {
        const segDist = d - prevDist;
        if (segDist === 0) { km++; continue; }
        const frac = (km - prevDist) / segDist;
        const t = prevTime + frac * ((pts[i].dist / totalDist) * totalDuration - prevTime);
        splits.push({ km, pace: (t - prevTime) / 60 });
        prevDist = km;
        prevTime = t;
        km++;
      }
      prevTime = (pts[i].dist / totalDist) * totalDuration;
    }
  }

  return splits.slice(0, 20);
}

export async function fetchShoesForSummary(): Promise<{ defaultShoe: StoredShoe | null; allShoes: StoredShoe[] }> {
  const [def, all] = await Promise.all([getDefaultShoe(), getShoes()]);
  return { defaultShoe: def ?? null, allShoes: all.filter(s => !s.isRetired) };
}

export async function assignShoeToRun(runId: string, shoeId: string): Promise<void> {
  const existing = await getRunById(runId);
  if (existing) await saveRun({ ...existing, shoeId });
}

export async function syncRunToHealth(run: {
  success?: boolean; duration: number; distance: number; startTime?: number;
}): Promise<void> {
  if (!run.success || run.duration <= 0) return;
  const profile = await getNutritionProfile().catch(() => undefined);
  // No weight on file means no honest calorie figure: leave energy out rather than
  // writing an estimate built on an assumed 70 kg into the runner's Health data.
  const weightKg = profile?.weightKg;
  const now = Date.now();
  await writeRunToHealth({
    startTime:      run.startTime ?? (now - run.duration * 1000),
    endTime:        run.startTime ? run.startTime + run.duration * 1000 : now,
    distanceMeters: run.distance * 1000,
    calories:       weightKg ? estimateRunCalories(run.distance * 1000, weightKg) : undefined,
  }).catch(() => {});
}

export interface RunStats {
  distKm: number;
  paceStr: string;
  duration: number;
  territories: number;
  calories?: number;
}

export function computeRunStats(run: {
  distance: number; duration: number; pace: number;
  territoriesClaimed?: number;
  weightKg?: number;
}): RunStats {
  const m = Math.floor(run.pace);
  const s = Math.floor((run.pace - m) * 60);
  return {
    distKm:      run.distance,
    paceStr:     `${m}:${s.toString().padStart(2, '0')}`,
    duration:    run.duration,
    territories: run.territoriesClaimed ?? 0,
    // No weight on file: no number, rather than one built on an assumed 70 kg.
    calories:    run.weightKg ? estimateRunCalories(run.distance * 1000, run.weightKg) : undefined,
  };
}
