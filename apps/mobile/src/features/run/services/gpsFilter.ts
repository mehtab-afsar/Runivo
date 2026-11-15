import { haversineM } from '@shared/services/claimEngine';

/**
 * How each GPS fix affects the distance of a live run.
 *
 *  - Too fast to be real (a jump faster than the sport allows) is an outlier:
 *    ignored, and distance keeps measuring from the last good fix. Three in a
 *    row means the phone really is somewhere else (a fresh lock after a
 *    tunnel or a bad start), so the next fix becomes the new base.
 *  - A step shorter than the fix's own error (at least 2 m, at most 8 m) is
 *    drift: standing at a light, the dot wanders and used to add distance.
 *    It isn't counted yet, and the base stays put, so slow movement still adds
 *    up once it's clearly more than the error.
 *  - Anything else counts, however long the gap: 300 m over a minute in a
 *    tunnel is real distance (it used to be thrown away as a "teleport").
 */
export interface Fix { lat: number; lng: number; timestamp: number; accuracy?: number }
export type StepAction = 'base' | 'count' | 'hold' | 'outlier';

/** Fastest believable speed between two fixes, m/s. */
export const MAX_FOOT_SPEED_MS = 12;   // ~43 km/h: a sprint plus GPS slack
export const MAX_RIDE_SPEED_MS = 25;   // ~90 km/h
export const OUTLIERS_BEFORE_REBASE = 3;

export function stepFor(prev: Fix | null, next: Fix, maxSpeedMs: number): { action: StepAction; metres: number } {
  if (!prev) return { action: 'base', metres: 0 };
  const metres = haversineM(prev, next);
  const seconds = Math.max(0.5, (next.timestamp - prev.timestamp) / 1000);
  if (metres / seconds > maxSpeedMs) return { action: 'outlier', metres };
  const minStep = Math.min(8, Math.max(2, (next.accuracy ?? 10) * 0.5));
  if (metres < minStep) return { action: 'hold', metres };
  return { action: 'count', metres };
}

/**
 * Runs a sequence of fixes through stepFor, keeping the base and the outlier
 * streak. Returns the distance they add and the new state.
 */
export function addFixes<F extends Fix>(
  state: { base: Fix | null; outliers: number },
  fixes: F[],
  maxSpeedMs: number,
): { addedM: number; base: Fix | null; outliers: number; kept: F[] } {
  let { base, outliers } = state;
  let added = 0;
  const kept: F[] = [];
  for (const f of fixes) {
    const { action, metres } = stepFor(base, f, maxSpeedMs);
    if (action === 'outlier') {
      outliers += 1;
      if (outliers >= OUTLIERS_BEFORE_REBASE) { base = f; outliers = 0; kept.push(f); }
      continue;
    }
    outliers = 0;
    kept.push(f);   // drift fixes stay in the trace; only outliers are left out
    if (action === 'base') base = f;
    else if (action === 'count') { added += metres; base = f; }
  }
  return { addedM: added, base, outliers, kept };
}
