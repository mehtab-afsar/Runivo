/**
 * Merging fixes the background task buffered while the screen was off.
 *
 * On iOS the live watcher keeps receiving fixes while the screen is locked (the
 * background task keeps the app alive) and the task buffers the same fixes, so merging
 * the whole buffer counted every screen-off stretch twice: distance, pace, PACE and the
 * trace. Only fixes newer than the last one the live watcher recorded are new; on
 * Android, where the watcher stops in the background, that is all of them.
 */
import { freshScreenOffFixes, type BufferedFix } from '../../services/screenOffMerge';
import { addFixes } from '../../services/gpsFilter';
import type { RunSession } from './types';

/**
 * Adds the new buffered fixes to the session. Returns true when any were kept (the
 * caller then refreshes the screen).
 *
 * PAUSED RUNS ARE SKIPPED WHOLE. Pausing can only be toggled from the foreground UI, so
 * a paused run when this is called means the entire buffered window was spent paused;
 * counting it would inflate distance (the live callback also ignores fixes while paused).
 */
export function mergeBgFixes(s: RunSession, bgPoints: BufferedFix[], maxSpeedMs: number): boolean {
  if (bgPoints.length === 0 || s.isPaused) return false;

  const pts = s.gpsPoints;
  const fresh = freshScreenOffFixes(pts.length ? pts[pts.length - 1].timestamp : 0, bgPoints);
  if (fresh.some(p => p.mocked)) s.mocked = true;

  const r = addFixes(s.filter, fresh, maxSpeedMs);
  s.filter = { base: r.base, outliers: r.outliers };
  s.totalDistance += r.addedM / 1000;
  for (const pt of r.kept) {
    s.gpsPoints.push({ lat: pt.lat, lng: pt.lng, timestamp: pt.timestamp, speed: pt.speed, accuracy: pt.accuracy, altitude: 0 });
  }
  return r.kept.length > 0;
}
