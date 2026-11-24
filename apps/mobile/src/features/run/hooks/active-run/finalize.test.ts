import { describe, it, expect } from 'vitest';
import { computeFinal } from './finalize';
import { createRunSession } from './session';

describe('computeFinal', () => {
  it('subtracts paused time from the wall clock', () => {
    const s = createRunSession();
    Object.assign(s, { startTime: 0, totalPausedMs: 60_000, totalDistance: 5 });
    const f = computeFinal(s, 1_800_000);   // 30 min on the clock, 1 min paused
    expect(f.elapsed).toBe(1740);
    expect(f.distance).toBe(5);
    expect(f.pace).toBe('5:48');
  });

  it('stops the clock at the pause when finished while paused', () => {
    const s = createRunSession();
    Object.assign(s, { startTime: 0, isPaused: true, pauseStart: 600_000, totalDistance: 2 });
    expect(computeFinal(s, 9_999_999).elapsed).toBe(600);
  });

  it('falls back to the last live pace when no time has passed', () => {
    const s = createRunSession();
    Object.assign(s, { startTime: 5000, pace: '6:10' });
    expect(computeFinal(s, 5000).pace).toBe('6:10');
  });

  it('never goes negative', () => {
    const s = createRunSession();
    Object.assign(s, { startTime: 10_000, totalPausedMs: 50_000 });
    expect(computeFinal(s, 20_000).elapsed).toBe(0);
  });
});
