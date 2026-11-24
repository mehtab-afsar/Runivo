import { formatPace } from '@shared/lib/paceFormat';
import type { RunSession } from './types';

/**
 * The run's final numbers, worked out from the session at the moment of finishing, not
 * read from the last throttled screen update: the live pace lagged up to a second of
 * fixes and missed the screen-off tail merged just before. A run finished while paused
 * stops its clock at the pause.
 */
export function computeFinal(s: RunSession, now: number): { distance: number; elapsed: number; pace: string } {
  const endAt = s.isPaused && s.pauseStart ? s.pauseStart : now;
  const distance = s.totalDistance;
  const elapsed = Math.max(0, Math.floor((endAt - s.startTime - s.totalPausedMs) / 1000));
  const pace = elapsed > 0 ? formatPace(distance / elapsed) : s.pace;
  return { distance, elapsed, pace };
}
