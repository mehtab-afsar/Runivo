import { describe, it, expect } from 'vitest';
import { sameRoute, matchedRuns, plannedVsActual, type RunLike } from './analysis';
import type { Session } from './training';

const loop = (dLat = 0, n = 40): { lat: number; lng: number }[] =>
  Array.from({ length: n }, (_, i) => ({ lat: 12.97 + dLat + 0.004 * Math.sin((i / n) * 2 * Math.PI), lng: 77.6 + 0.004 * Math.cos((i / n) * 2 * Math.PI) }));
const run = (id: string, t: number, sec: number, pts = loop(), m = 2700): RunLike => ({ id, startTime: t, durationSec: sec, distanceMeters: m, gpsPoints: pts });

describe('matched runs (A5)', () => {
  it('matches the same loop and not a different one', () => {
    expect(sameRoute(run('a', 1, 900), run('b', 2, 950))).toBe(true);
    expect(sameRoute(run('a', 1, 900), run('c', 2, 950, loop(0.01)))).toBe(false);
    expect(sameRoute(run('a', 1, 900), run('d', 2, 950, loop(), 4000))).toBe(false);
  });
  it('ranks this run and compares with the last attempt', () => {
    const r = matchedRuns(run('now', 30, 880), [run('old', 10, 950), run('mid', 20, 900), run('far', 25, 800, loop(0.02))]);
    expect(r?.efforts.length).toBe(3);
    expect(r?.rank).toBe(1);
    expect(r?.vsLast).toBe(-20);
  });
  it('returns null with no earlier efforts', () => {
    expect(matchedRuns(run('now', 30, 880), [])).toBeNull();
  });
});

describe('planned vs actual (A6)', () => {
  const s = (kind: Session['kind'], km: number): Session => ({
    id: 's', date: '2026-11-13', kind, title: 't', summary: '', distanceKm: km, status: 'done',
    steps: [{ kind: 'run', label: 'Easy', distanceM: km * 1000, pace: { fast: 330, slow: 360 } }],
  });
  it('on target, fast, slow, short', () => {
    expect(plannedVsActual(s('easy', 5), { distanceMeters: 5000, durationSec: 5 * 345 }).verdict).toBe('on_target');
    expect(plannedVsActual(s('easy', 5), { distanceMeters: 5000, durationSec: 5 * 300 }).verdict).toBe('fast');
    expect(plannedVsActual(s('easy', 5), { distanceMeters: 5000, durationSec: 5 * 400 }).verdict).toBe('slow');
    expect(plannedVsActual(s('easy', 5), { distanceMeters: 3000, durationSec: 1000 }).verdict).toBe('short');
  });
  it('intervals are not judged on whole-run pace', () => {
    expect(plannedVsActual(s('intervals', 6), { distanceMeters: 6000, durationSec: 6 * 400 }).verdict).toBe('done');
  });
});
