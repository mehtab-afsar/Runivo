/**
 * Pace (or speed) and elevation over distance for the activity charts (PRD A4).
 * Buckets the GPS trace by distance, drops stopped time, and smooths lightly.
 */
import { haversineM } from './runEngine';

export interface TracePoint { lat: number; lng: number; timestamp: number; altitude?: number | null; accuracy?: number | null }
export interface SeriesPoint { km: number; secPerKm: number | null; altitudeM: number | null }

/** At most `buckets` points; empty when there's too little to draw. */
export function activitySeries(points: TracePoint[], buckets = 60): SeriesPoint[] {
  const pts = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.timestamp && (p.accuracy == null || p.accuracy <= 50));
  if (pts.length < 10) return [];
  // Cumulative moving distance and time (gaps over 30 s without 10 m of progress count as stopped).
  const cum: { m: number; s: number; alt: number | null }[] = [{ m: 0, s: 0, alt: pts[0].altitude ?? null }];
  for (let i = 1; i < pts.length; i++) {
    const d = haversineM(pts[i - 1], pts[i]);
    const dt = Math.max(0, (pts[i].timestamp - pts[i - 1].timestamp) / 1000);
    const stopped = dt > 30 && d < 15;
    const prev = cum[cum.length - 1];
    cum.push({ m: prev.m + d, s: prev.s + (stopped ? 0 : dt), alt: Number.isFinite(pts[i].altitude as number) ? (pts[i].altitude as number) : null });
  }
  const total = cum[cum.length - 1].m;
  if (total < 300) return [];
  const step = Math.max(50, total / buckets);
  const out: SeriesPoint[] = [];
  let j = 0;
  for (let edge = step; edge <= total + 1e-6; edge += step) {
    const startM = edge - step;
    let startIdx = j;
    while (j < cum.length - 1 && cum[j].m < edge) j++;
    while (startIdx > 0 && cum[startIdx].m > startM) startIdx--;
    const a = cum[startIdx], b = cum[j];
    const dm = b.m - a.m, ds = b.s - a.s;
    const alts = cum.slice(startIdx, j + 1).map(c => c.alt).filter((x): x is number => x != null);
    out.push({
      km: edge / 1000,
      secPerKm: dm > 10 && ds > 0 ? ds / (dm / 1000) : null,
      altitudeM: alts.length ? alts.reduce((s, x) => s + x, 0) / alts.length : null,
    });
  }
  // Light smoothing: average with neighbours.
  return out.map((p, i) => {
    const near = out.slice(Math.max(0, i - 1), i + 2).map(x => x.secPerKm).filter((x): x is number => x != null);
    return { ...p, secPerKm: p.secPerKm == null ? null : near.reduce((s, x) => s + x, 0) / near.length };
  });
}

/** Total climb, ignoring wiggles under 2 m. */
export function climbM(series: SeriesPoint[]): number {
  let up = 0, base: number | null = null;
  for (const p of series) {
    if (p.altitudeM == null) continue;
    if (base == null) { base = p.altitudeM; continue; }
    const d = p.altitudeM - base;
    if (d >= 2) { up += d; base = p.altitudeM; } else if (d <= -2) base = p.altitudeM;
  }
  return Math.round(up);
}
