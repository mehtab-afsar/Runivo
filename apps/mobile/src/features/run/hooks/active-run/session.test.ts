import { describe, it, expect } from 'vitest';
import { beginRunSession, createRunSession } from './session';

describe('beginRunSession', () => {
  it('resets everything one run owns', () => {
    const s = createRunSession();
    Object.assign(s, {
      totalDistance: 9, pendingDistance: 1, totalPausedMs: 5, pauseStart: 7, mocked: true,
      gpsLocked: true, consecutiveGoodPoints: 4, prevAltitude: 3, elevationGain: 8, isPaused: true, isFinishing: true,
    });
    s.gpsPoints.push({ lat: 1, lng: 1, timestamp: 1, speed: 0, accuracy: 1, altitude: 0 });
    beginRunSession(s, 1234, 'run-1');
    expect(s).toMatchObject({
      startTime: 1234, runId: 'run-1', totalDistance: 0, pendingDistance: 0, totalPausedMs: 0, pauseStart: 0,
      mocked: false, gpsLocked: false, consecutiveGoodPoints: 0, prevAltitude: null, elevationGain: 0,
      isPaused: false, isFinishing: false,
    });
    expect(s.gpsPoints).toEqual([]);
    expect(s.filter).toEqual({ base: null, outliers: 0 });
  });

  it('leaves the clock display, last km and start guard to their own owners', () => {
    const s = createRunSession();
    Object.assign(s, { elapsed: 99, pace: '4:00', lastKm: 3, isStarting: true });
    beginRunSession(s, 1, 'r');
    expect(s).toMatchObject({ elapsed: 99, pace: '4:00', lastKm: 3, isStarting: true });
  });
});
