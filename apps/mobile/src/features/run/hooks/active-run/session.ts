import type { RunSession } from './types';

export function createRunSession(): RunSession {
  return {
    startTime: 0, pauseStart: 0, totalPausedMs: 0, elapsed: 0, pace: '0:00', isPaused: false,
    runId: '', isFinishing: false, isStarting: false, appState: 'active',
    filter: { base: null, outliers: 0 }, gpsPoints: [], pendingDistance: 0, totalDistance: 0,
    lastGpsStateUpdate: 0, gpsLocked: false, lastGoodFixAt: 0, consecutiveGoodPoints: 0,
    mocked: false, prevAltitude: null, elevationGain: 0, lastKm: 0,
    autoPauseEnabled: false, manualPause: false, autoPaused: false, stoppedSince: null,
    lastMovingFixAt: 0, speedKnown: false,
    liveSharingEnabled: false, lastLiveBroadcast: 0, playerId: null,
  };
}

/**
 * Resets everything one run owns, at the moment a new run starts. `elapsed`, `pace`,
 * `lastKm` and the lifecycle flags are deliberately left to their own owners (the timer's
 * first tick, the end of startRun) exactly as before the hook was split up.
 */
export function beginRunSession(s: RunSession, now: number, runId: string): void {
  s.startTime = now;
  s.pauseStart = 0;
  s.totalPausedMs = 0;
  s.filter = { base: null, outliers: 0 };
  s.runId = runId;
  s.mocked = false;
  s.gpsPoints = [];
  s.pendingDistance = 0;
  s.totalDistance = 0;
  s.isFinishing = false;
  s.isPaused = false;
  s.gpsLocked = false;
  s.consecutiveGoodPoints = 0;
  s.prevAltitude = null;
  s.elevationGain = 0;
}
