import { describe, it, expect } from 'vitest';
import { mergeBgFixes } from './bgMerge';
import { createRunSession } from './session';

const FOOT = 7.5;
// ~5 m north per second: counts as distance (not drift, not an outlier).
const fix = (i: number, extra: Record<string, unknown> = {}) => ({
  lat: 51 + i * 0.000045, lng: 0, timestamp: 1_000_000 + i * 1000, speed: 5, accuracy: 3, ...extra,
});

describe('mergeBgFixes', () => {
  it('adds buffered screen-off fixes to distance and trace', () => {
    const s = createRunSession();
    const merged = mergeBgFixes(s, [0, 1, 2, 3, 4].map(i => fix(i)), FOOT);
    expect(merged).toBe(true);
    expect(s.gpsPoints).toHaveLength(5);
    expect(s.gpsPoints[0].altitude).toBe(0);
    expect(s.totalDistance).toBeGreaterThan(0.015);
    expect(s.totalDistance).toBeLessThan(0.025);
  });

  it('skips the whole buffer when the run is paused (the window was spent paused)', () => {
    const s = createRunSession();
    s.isPaused = true;
    expect(mergeBgFixes(s, [0, 1, 2, 3].map(i => fix(i)), FOOT)).toBe(false);
    expect(s.gpsPoints).toHaveLength(0);
    expect(s.totalDistance).toBe(0);
  });

  it('only counts fixes newer than the last live point, so a screen-off stretch is not counted twice', () => {
    const s = createRunSession();
    const all = [0, 1, 2, 3, 4, 5].map(i => fix(i));
    mergeBgFixes(s, all.slice(0, 4), FOOT);
    const after = s.totalDistance;
    const pointsAfter = s.gpsPoints.length;
    // The buffer still holds the first four (iOS: same fixes the live watcher saw).
    mergeBgFixes(s, all, FOOT);
    expect(s.gpsPoints.length - pointsAfter).toBe(2);
    expect(s.totalDistance).toBeGreaterThan(after);
    expect(s.totalDistance).toBeLessThan(0.04);
  });

  it('does nothing for an empty buffer', () => {
    const s = createRunSession();
    expect(mergeBgFixes(s, [], FOOT)).toBe(false);
  });

  it('flags the run when any buffered fix came from a mock provider', () => {
    const s = createRunSession();
    mergeBgFixes(s, [fix(0), fix(1, { mocked: true })], FOOT);
    expect(s.mocked).toBe(true);
  });

  it('ignores an impossible jump instead of counting it as distance', () => {
    const s = createRunSession();
    mergeBgFixes(s, [fix(0), fix(1), { ...fix(2), lat: 52 }], FOOT);
    expect(s.totalDistance).toBeLessThan(0.02);
  });
});
