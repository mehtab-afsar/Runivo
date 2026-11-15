// Pure helpers (no Deno APIs) so vitest can cover them.
//
// The scoring trace arrives in the request body, written by the client, and the
// `runs` row is client-written too, so neither is proof on its own. What this
// buys: the two must AGREE, and the trace must fit inside the run's own time
// window. That rules out crafted requests that pair a real, honest run row with
// a different trace, a different sport, or a trace from another day, and bounds
// the work a single request can demand. It is NOT a substitute for device
// attestation, which is what stops a determined cheater who fabricates both.

export const MAX_GPS_POINTS = 40_000;      // ~11 h at 1 Hz
export const TRACE_SLACK_MS = 10 * 60_000; // clock skew, bg-buffer merge, crash recovery

export interface StoredRunFacts {
  activity_type: string | null;
  duration_sec: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface ClaimedRun {
  activityType: string;
  durationSec?: number;
  gpsPoints: { timestamp?: number }[];
}

/** Returns a short reason when the claimed run disagrees with the stored row, else null. */
export function runMismatch(stored: StoredRunFacts, claimed: ClaimedRun, now = Date.now()): string | null {
  if (stored.activity_type && claimed.activityType !== stored.activity_type) return 'activity_type';

  const claimedDuration = Number(claimed.durationSec) || 0;
  if (stored.duration_sec != null) {
    const allowed = Math.max(5, stored.duration_sec * 0.02);
    if (Math.abs(stored.duration_sec - claimedDuration) > allowed) return 'duration';
  }

  let first = Infinity;
  let last = -Infinity;
  for (const p of claimed.gpsPoints) {
    const t = Number(p.timestamp);
    if (!Number.isFinite(t)) continue;
    if (t < first) first = t;
    if (t > last) last = t;
  }
  if (first === Infinity) return null; // no timestamps: the engine's own checks decide

  if (last > now + TRACE_SLACK_MS) return 'trace_in_future';
  const startMs = stored.started_at ? Date.parse(stored.started_at) : NaN;
  const endMs = stored.finished_at ? Date.parse(stored.finished_at) : NaN;
  if (Number.isFinite(startMs) && first < startMs - TRACE_SLACK_MS) return 'trace_before_start';
  if (Number.isFinite(endMs) && last > endMs + TRACE_SLACK_MS) return 'trace_after_end';
  return null;
}
