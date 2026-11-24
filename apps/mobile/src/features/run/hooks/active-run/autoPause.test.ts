import { describe, it, expect } from 'vitest';
import { autoPauseFromFix, autoPauseFromTimer, dropStaleGpsLock } from './autoPause';
import { createRunSession } from './session';
import { AUTO_PAUSE_DELAY_MS, GPS_STALE_MS } from './types';

const session = (patch: Partial<ReturnType<typeof createRunSession>> = {}) =>
  Object.assign(createRunSession(), { autoPauseEnabled: true, gpsLocked: true, speedKnown: true }, patch);

describe('dropStaleGpsLock', () => {
  it('drops the lock after GPS_STALE_MS without an accepted fix, and resets the lock counter', () => {
    const s = session({ lastGoodFixAt: 1000, consecutiveGoodPoints: 5 });
    expect(dropStaleGpsLock(s, 1000 + GPS_STALE_MS + 1)).toBe(true);
    expect(s.gpsLocked).toBe(false);
    expect(s.consecutiveGoodPoints).toBe(0);
  });

  it('keeps the lock while fixes are fresh', () => {
    const s = session({ lastGoodFixAt: 1000 });
    expect(dropStaleGpsLock(s, 1000 + GPS_STALE_MS)).toBe(false);
    expect(s.gpsLocked).toBe(true);
  });

  it('never counts paused time as signal loss', () => {
    const s = session({ lastGoodFixAt: 0, isPaused: true });
    expect(dropStaleGpsLock(s, 10 * GPS_STALE_MS)).toBe(false);
    expect(s.gpsLocked).toBe(true);
    expect(s.lastGoodFixAt).toBe(10 * GPS_STALE_MS);
  });

  it('does nothing when there is no lock to drop', () => {
    expect(dropStaleGpsLock(session({ gpsLocked: false, lastGoodFixAt: 0 }), 1e9)).toBe(false);
  });
});

describe('autoPauseFromTimer', () => {
  const due = { lastMovingFixAt: 1000 };

  it('pauses once no movement has been seen for the delay, dated from when the runner stopped', () => {
    const s = session({ ...due, stoppedSince: 500 });
    expect(autoPauseFromTimer(s, 1000 + AUTO_PAUSE_DELAY_MS)).toBe(true);
    expect(s.isPaused).toBe(true);
    expect(s.autoPaused).toBe(true);
    expect(s.pauseStart).toBe(500);
  });

  it('falls back to the last moving fix when no stop was recorded', () => {
    const s = session(due);
    autoPauseFromTimer(s, 1000 + AUTO_PAUSE_DELAY_MS);
    expect(s.pauseStart).toBe(1000);
  });

  it('is off before the delay, when disabled, when manually paused, or without a known speed', () => {
    expect(autoPauseFromTimer(session(due), 1000 + AUTO_PAUSE_DELAY_MS - 1)).toBe(false);
    expect(autoPauseFromTimer(session({ ...due, autoPauseEnabled: false }), 1e9)).toBe(false);
    expect(autoPauseFromTimer(session({ ...due, manualPause: true }), 1e9)).toBe(false);
    expect(autoPauseFromTimer(session({ ...due, speedKnown: false }), 1e9)).toBe(false);
    expect(autoPauseFromTimer(session({ lastMovingFixAt: 0 }), 1e9)).toBe(false);
  });
});

describe('autoPauseFromFix', () => {
  it('ignores fixes with an unknown speed (iOS -1 is "unknown", not "stopped")', () => {
    const s = session();
    expect(autoPauseFromFix(s, 1000, 0, false)).toBe('none');
    expect(s.stoppedSince).toBeNull();
  });

  it('starts a stop, then pauses after the delay from the first slow fix', () => {
    const s = session();
    expect(autoPauseFromFix(s, 1000, 0.1, true)).toBe('none');
    expect(s.stoppedSince).toBe(1000);
    expect(autoPauseFromFix(s, 1000 + AUTO_PAUSE_DELAY_MS - 1, 0.1, true)).toBe('none');
    expect(autoPauseFromFix(s, 1000 + AUTO_PAUSE_DELAY_MS, 0.1, true)).toBe('paused');
    expect(s.isPaused).toBe(true);
    expect(s.pauseStart).toBe(1000);
  });

  it('never engages over a manual pause', () => {
    const s = session({ manualPause: true, isPaused: true });
    expect(autoPauseFromFix(s, 1000, 0, true)).toBe('none');
    expect(autoPauseFromFix(s, 1000 + 2 * AUTO_PAUSE_DELAY_MS, 3, true)).toBe('none');
    expect(s.isPaused).toBe(true);
  });

  it('resumes an auto-pause on movement: paused time is added and the distance filter restarts', () => {
    const s = session({ isPaused: true, autoPaused: true, pauseStart: 1000, totalPausedMs: 200, stoppedSince: 1000 });
    s.filter = { base: { lat: 1, lng: 1, timestamp: 1 }, outliers: 2 };
    expect(autoPauseFromFix(s, 21_000, 3, true)).toBe('resumed');
    expect(s.isPaused).toBe(false);
    expect(s.autoPaused).toBe(false);
    expect(s.totalPausedMs).toBe(200 + 20_000);
    expect(s.filter).toEqual({ base: null, outliers: 0 });
    expect(s.lastMovingFixAt).toBe(21_000);
    expect(s.stoppedSince).toBeNull();
  });

  it('moving while not auto-paused only refreshes the moving timestamp', () => {
    const s = session({ stoppedSince: 5 });
    expect(autoPauseFromFix(s, 9000, 3, true)).toBe('none');
    expect(s.stoppedSince).toBeNull();
    expect(s.lastMovingFixAt).toBe(9000);
  });
});
