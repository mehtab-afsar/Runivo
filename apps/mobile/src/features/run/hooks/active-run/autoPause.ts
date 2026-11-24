/**
 * Auto-pause and GPS signal-loss rules. Pure: they update the session and say what
 * happened; the caller plays the sound/haptic and sets React state. Keeping them free
 * of React Native lets them be unit-tested.
 *
 * A user-tapped pause (`manualPause`) is never fought or auto-resumed; only a stop this
 * hook triggered itself (`autoPaused`) is resumed when movement returns.
 */
import {
  AUTO_PAUSE_DELAY_MS, AUTO_PAUSE_SPEED_MS, GPS_STALE_MS, type RunSession,
} from './types';

export type FixPauseResult = 'none' | 'paused' | 'resumed';

/**
 * 1 s watchdog: drops the "GPS locked" state when no accepted fix has arrived for
 * GPS_STALE_MS, so the UI stops claiming a lock while distance and pace are frozen.
 * Re-locking needs GPS_LOCK_REQUIRED_POINTS good fixes again. Paused time never counts
 * as signal loss. Returns true when the lock was just dropped.
 */
export function dropStaleGpsLock(s: RunSession, now: number): boolean {
  if (s.isPaused) s.lastGoodFixAt = now;
  if (s.gpsLocked && !s.isPaused && now - s.lastGoodFixAt > GPS_STALE_MS) {
    s.gpsLocked = false;
    s.consecutiveGoodPoints = 0;
    return true;
  }
  return false;
}

/**
 * Auto-pause from the timer: iOS sends no fixes at all while standing still
 * (distanceInterval), so waiting for a fix would never pause. The pause is dated from
 * when the runner stopped, so the stopped seconds don't count as moving time.
 * Returns true when the run was just paused.
 */
export function autoPauseFromTimer(s: RunSession, now: number): boolean {
  const due = s.autoPauseEnabled && !s.manualPause && !s.isPaused && s.gpsLocked && s.speedKnown
    && s.lastMovingFixAt > 0 && now - s.lastMovingFixAt >= AUTO_PAUSE_DELAY_MS;
  if (!due) return false;
  s.autoPaused = true;
  s.isPaused = true;
  s.pauseStart = s.stoppedSince ?? s.lastMovingFixAt;
  return true;
}

/**
 * Auto-pause / auto-resume from a fix. Evaluated even while already paused, so a stop
 * this hook triggered can see movement resume. Does nothing when the speed is unknown
 * (iOS reports -1 for a fix with no valid speed: "unknown", not "standing still").
 */
export function autoPauseFromFix(s: RunSession, now: number, gpsSpeed: number, speedKnown: boolean): FixPauseResult {
  if (!s.autoPauseEnabled || s.manualPause || !speedKnown) return 'none';
  if (gpsSpeed < AUTO_PAUSE_SPEED_MS) {
    if (s.stoppedSince == null) {
      s.stoppedSince = now;
    } else if (!s.isPaused && now - s.stoppedSince >= AUTO_PAUSE_DELAY_MS) {
      s.autoPaused = true;
      s.isPaused = true;
      s.pauseStart = s.stoppedSince;
      return 'paused';
    }
    return 'none';
  }
  s.stoppedSince = null;
  s.lastMovingFixAt = now;
  if (!s.autoPaused) return 'none';
  s.autoPaused = false;
  s.totalPausedMs += now - s.pauseStart;
  s.filter = { base: null, outliers: 0 };
  s.isPaused = false;
  return 'resumed';
}
