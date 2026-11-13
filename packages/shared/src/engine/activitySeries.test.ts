import { describe, it, expect } from 'vitest';
import { activitySeries, climbM, type TracePoint } from './activitySeries';

// 2 km north, first km at 5:00/km on flat ground, second at 6:00/km climbing 20 m.
function trace(): TracePoint[] {
  const pts: TracePoint[] = [];
  let t = 0;
  for (let i = 0; i <= 200; i++) {
    const m = i * 10;
    pts.push({ lat: 12.9 + m / 111320, lng: 77.6, timestamp: 1_700_000_000_000 + t * 1000, altitude: m <= 1000 ? 900 : 900 + (m - 1000) / 50, accuracy: 5 });
    t += m < 1000 ? 3 : 3.6;
  }
  return pts;
}

describe('activitySeries', () => {
  it('buckets pace and elevation over distance', () => {
    const s = activitySeries(trace(), 20);
    expect(s.length).toBeGreaterThanOrEqual(19);
    expect(s[2].secPerKm!).toBeCloseTo(300, -1);
    expect(s[s.length - 3].secPerKm!).toBeCloseTo(360, -1);
    expect(s[s.length - 1].altitudeM!).toBeGreaterThan(915);
    expect(climbM(s)).toBeGreaterThanOrEqual(16);
  });

  it('ignores stops and returns nothing for tiny traces', () => {
    const pts = trace();
    // A 5-minute stop at 500 m.
    for (let i = 50; i < pts.length; i++) pts[i] = { ...pts[i], timestamp: pts[i].timestamp + 300_000 };
    const s = activitySeries(pts, 20);
    expect(Math.max(...s.map(p => p.secPerKm ?? 0))).toBeLessThan(400);
    expect(activitySeries(trace().slice(0, 8))).toEqual([]);
  });
});
