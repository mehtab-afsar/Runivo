/**
 * Activity analysis helpers:
 *   A5 matched runs — earlier activities on the same route as this one
 *   A6 planned vs actual — how a run compared with the session it came from
 */
import type { Session, Step } from './training';

export interface LatLng { lat: number; lng: number }
export interface RunLike { id: string; startTime: number; distanceMeters: number; durationSec: number; gpsPoints?: LatLng[]; excluded?: boolean; activityType?: string | null }

function metres(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Up to n points spread evenly along the trace. */
export function samplePoints(points: LatLng[], n = 24): LatLng[] {
  if (points.length <= n) return points.slice();
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push(points[Math.round((i * (points.length - 1)) / (n - 1))]);
  return out;
}

/** Mean distance from each sampled point of `a` to the nearest sampled point of `b`. */
function meanNearest(a: LatLng[], b: LatLng[]): number {
  let sum = 0;
  for (const p of a) {
    let best = Infinity;
    for (const q of b) { const d = metres(p, q); if (d < best) best = d; }
    sum += best;
  }
  return sum / Math.max(1, a.length);
}

/**
 * Same route: distance within 10%, starts within 150 m, and the two traces
 * stay within ~60 m of each other on average, both ways round.
 */
export function sameRoute(a: RunLike, b: RunLike): boolean {
  const pa = a.gpsPoints ?? [], pb = b.gpsPoints ?? [];
  if (pa.length < 5 || pb.length < 5) return false;
  if (Math.abs(a.distanceMeters - b.distanceMeters) > 0.1 * Math.max(a.distanceMeters, b.distanceMeters)) return false;
  if (metres(pa[0], pb[0]) > 150) return false;
  const sa = samplePoints(pa), sb = samplePoints(pb);
  return meanNearest(sa, sb) < 60 && meanNearest(sb, sa) < 60;
}

export interface MatchedRuns {
  /** Every activity on this route, this one included, fastest first. */
  efforts: { id: string; startTime: number; durationSec: number; isThis: boolean }[];
  /** 1-based place of this run among them by time. */
  rank: number;
  /** Seconds faster (negative) or slower than the previous attempt. */
  vsLast: number | null;
}

export function matchedRuns(thisRun: RunLike, others: RunLike[]): MatchedRuns | null {
  const same = others.filter(r => r.id !== thisRun.id && !r.excluded && (r.activityType ?? 'run') === (thisRun.activityType ?? 'run') && sameRoute(thisRun, r));
  if (same.length === 0) return null;
  const all = [...same, thisRun].map(r => ({ id: r.id, startTime: r.startTime, durationSec: r.durationSec, isThis: r.id === thisRun.id }));
  const byTime = [...all].sort((x, y) => x.durationSec - y.durationSec);
  const prev = same.filter(r => r.startTime < thisRun.startTime).sort((x, y) => y.startTime - x.startTime)[0];
  return {
    efforts: byTime,
    rank: byTime.findIndex(e => e.isThis) + 1,
    vsLast: prev ? thisRun.durationSec - prev.durationSec : null,
  };
}

export interface PlannedVsActual {
  plannedKm: number;
  actualKm: number;
  /** The session's main target pace band (s/km), if it has one. */
  targetPace: { fast: number; slow: number } | null;
  actualPace: number | null;
  verdict: 'on_target' | 'fast' | 'slow' | 'short' | 'long' | 'done';
}

function mainStep(steps: Step[]): Step | undefined {
  const work = steps.filter(s => s.kind === 'run' && s.pace);
  return work.sort((a, b) => (b.distanceM ?? 0) - (a.distanceM ?? 0))[0];
}

export function plannedVsActual(session: Session, run: { distanceMeters: number; durationSec: number }): PlannedVsActual {
  const actualKm = run.distanceMeters / 1000;
  const actualPace = actualKm > 0.2 ? run.durationSec / actualKm : null;
  const step = mainStep(session.steps);
  const targetPace = step?.pace ? { fast: step.pace.fast, slow: step.pace.slow } : null;
  let verdict: PlannedVsActual['verdict'] = 'done';
  if (session.distanceKm > 0 && actualKm < session.distanceKm * 0.85) verdict = 'short';
  else if (session.distanceKm > 0 && actualKm > session.distanceKm * 1.2) verdict = 'long';
  // Only the easy-type sessions are judged on whole-run pace; intervals mix paces.
  else if (targetPace && actualPace && ['easy', 'long', 'recovery', 'tempo'].includes(session.kind)) {
    verdict = actualPace < targetPace.fast - 10 ? 'fast' : actualPace > targetPace.slow + 15 ? 'slow' : 'on_target';
  }
  return { plannedKm: session.distanceKm, actualKm, targetPace, actualPace, verdict };
}
