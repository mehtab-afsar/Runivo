import { getRunById, saveRun, getDefaultShoe, getShoes } from '@shared/services/store';
import type { StoredRun, StoredShoe } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { writeRunToHealth } from '@mobile/shared/services/healthService';

export async function fetchRunById(runId: string): Promise<StoredRun | null> {
  return (await getRunById(runId)) ?? null;
}

export async function saveRunToSupabase(run: StoredRun): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('runs').upsert({
    id: run.id,
    user_id: user?.id,
    distance_m: run.distanceMeters,
    duration_sec: run.durationSec,
    started_at: new Date(run.startTime).toISOString(),
    gps_points: run.gpsPoints,
  });
}

interface GpsPoint { lat: number; lng: number }
export interface Split { km: number; pace: number }

function haversineDist(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function computeSplits(gpsPoints: GpsPoint[], totalDuration: number): Split[] {
  const coords: [number, number][] = gpsPoints.map(p => [p.lng, p.lat]);
  if (coords.length < 2 || totalDuration <= 0) return [];

  let cumDist = 0;
  const pts: { dist: number }[] = [{ dist: 0 }];
  for (let i = 1; i < coords.length; i++) {
    cumDist += haversineDist(coords[i - 1], coords[i]);
    pts.push({ dist: cumDist });
  }
  const totalDist = cumDist;
  if (totalDist < 0.1) return [];

  const splits: Split[] = [];
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
  const now = Date.now();
  await writeRunToHealth({
    startTime:      run.startTime ?? (now - run.duration * 1000),
    endTime:        run.startTime ? run.startTime + run.duration * 1000 : now,
    distanceMeters: run.distance * 1000,
    calories:       Math.round(run.distance * 60 * 0.95),
  }).catch(() => {});
}

export interface RunStats {
  distKm: number;
  paceStr: string;
  duration: number;
  territories: number;
  xp: number;
  coins: number;
  calories: number;
}

export function computeRunStats(run: {
  distance: number; duration: number; pace: number;
  territoriesClaimed?: number; xpEarned?: number; coinsEarned?: number;
}): RunStats {
  const m = Math.floor(run.pace);
  const s = Math.floor((run.pace - m) * 60);
  return {
    distKm:      run.distance,
    paceStr:     `${m}:${s.toString().padStart(2, '0')}`,
    duration:    run.duration,
    territories: run.territoriesClaimed ?? 0,
    xp:          run.xpEarned ?? 0,
    coins:       run.coinsEarned ?? 0,
    calories:    Math.round(run.distance * 60 * 0.95),
  };
}
