/**
 * Heart-rate zones for an activity (PRD A4): time in each of five zones,
 * as a share of max heart rate (Z1 <60%, Z2 60–70, Z3 70–80, Z4 80–90, Z5 90%+).
 * Needs per-sample heart rate (watch runs); phone-only runs have none.
 */
export interface HrSample { timestamp: number; hr?: number | null }
export interface HrZone { zone: 1 | 2 | 3 | 4 | 5; label: string; fromBpm: number; toBpm: number | null; seconds: number; share: number }

const BOUNDS = [0.6, 0.7, 0.8, 0.9];
const LABELS = ['Easy', 'Endurance', 'Tempo', 'Threshold', 'Max'];

/** Your max: the highest seen, else 190 until there's enough to know. */
export function estimateMaxHr(seen: (number | null | undefined)[]): number {
  const vals = seen.filter((v): v is number => typeof v === 'number' && v >= 120 && v <= 230);
  return vals.length ? Math.max(...vals) : 190;
}

export function hrZones(points: HrSample[], maxHr: number): HrZone[] | null {
  const pts = points.filter(p => typeof p.hr === 'number' && Number.isFinite(p.timestamp));
  if (pts.length < 10) return null;
  const secs = [0, 0, 0, 0, 0];
  for (let i = 1; i < pts.length; i++) {
    const dt = Math.min(30, Math.max(0, (pts[i].timestamp - pts[i - 1].timestamp) / 1000)); // gaps count at most 30 s
    const frac = (pts[i].hr as number) / maxHr;
    const z = BOUNDS.filter(b => frac >= b).length; // 0..4
    secs[z] += dt;
  }
  const total = secs.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  return secs.map((s, i) => ({
    zone: (i + 1) as HrZone['zone'],
    label: LABELS[i],
    fromBpm: i === 0 ? 0 : Math.round(BOUNDS[i - 1] * maxHr),
    toBpm: i === 4 ? null : Math.round(BOUNDS[i] * maxHr) - 1,
    seconds: Math.round(s),
    share: s / total,
  }));
}
