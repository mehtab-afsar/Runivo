import { describe, it, expect } from 'vitest';
import {
  ENGINE, ringAreaM2, enclosedAreaM2, buildTerritoryShape, verifiedDistance, computeRunPace,
  updateStreak, rankFor, weeklyCapFor, decayedFreshness, tierForArea, metresPerDegree,
  findLoopStart, paceWeekStartMs, zoneScore, lineToWKT, ringToWKT, type EnginePoint, type LngLat,
} from './runEngine';

// ── Trace helpers ─────────────────────────────────────────────────────────────

/** Walks a polyline of metre offsets from an origin, one fix every `stepM` at `speedMs`. */
function trace(lat0: number, lng0: number, waypointsM: [number, number][], stepM = 3, speedMs = 3): EnginePoint[] {
  const m = metresPerDegree(lat0);
  const pts: EnginePoint[] = [];
  let t = Date.UTC(2026, 10, 6, 7, 0, 0);
  for (let w = 1; w < waypointsM.length; w++) {
    const [x0, y0] = waypointsM[w - 1], [x1, y1] = waypointsM[w];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / stepM));
    for (let i = w === 1 ? 0 : 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      pts.push({ lat: lat0 + y / m.lat, lng: lng0 + x / m.lng, timestamp: t, accuracy: 5 });
      t += (len / n / speedMs) * 1000;
    }
  }
  return pts;
}

const square = (s: number): [number, number][] => [[0, 0], [s, 0], [s, s], [0, s], [0, 0]];
const ringFromM = (lat0: number, lng0: number, pts: [number, number][]): LngLat[] => {
  const m = metresPerDegree(lat0);
  return pts.map(([x, y]) => [lng0 + x / m.lng, lat0 + y / m.lat]);
};

// ── Area ──────────────────────────────────────────────────────────────────────

describe('area', () => {
  for (const lat of [0, 19.07, 51.507, 60]) {
    it(`a 200 m square at lat ${lat} measures 40,000 m² within 0.5%`, () => {
      const a = ringAreaM2(ringFromM(lat, 72.87, square(200)));
      expect(Math.abs(a - 40_000) / 40_000).toBeLessThan(0.005);
    });
  }

  it('even-odd area matches the simple area for a plain square', () => {
    const r = ringFromM(51.5, -0.16, square(200));
    expect(Math.abs(enclosedAreaM2(r) - 40_000) / 40_000).toBeLessThan(0.02);
  });

  it('even-odd area counts both lobes of a figure-8', () => {
    // Two 100 m squares touching at a crossing point.
    const r = ringFromM(51.5, -0.16, [[0, 0], [100, 0], [100, 100], [200, 100], [200, 200], [100, 200], [100, 100], [0, 100], [0, 0]]);
    expect(Math.abs(enclosedAreaM2(r) - 20_000) / 20_000).toBeLessThan(0.05);
  });

  it('tiers follow the published thresholds', () => {
    expect(tierForArea(4_999)).toBe('patch');
    expect(tierForArea(5_000)).toBe('block');
    expect(tierForArea(50_000)).toBe('district');
    expect(tierForArea(200_000)).toBe('quarter');
    expect(tierForArea(500_000)).toBe('domain');
  });
});

// ── Territory shapes ──────────────────────────────────────────────────────────

describe('buildTerritoryShape', () => {
  it('a closed 200 m square loop claims its interior plus the strip', () => {
    const shape = buildTerritoryShape(trace(51.507, -0.165, square(200)), 'run')!;
    expect(shape.kind).toBe('loop');
    // PostGIS measures this exact shape at 50,099 m² (supabase/tests/v1_integrity.test.sql).
    expect(Math.abs(shape.estimatedAreaM2 - 50_099) / 50_099).toBeLessThan(0.04);
    // 50,099 m² sits just over the 50k block/district line.
    expect(shape.tier).toBe('district');
  });

  it('an out-and-back run is not a loop', () => {
    const shape = buildTerritoryShape(trace(51.507, -0.165, [[0, 0], [600, 0], [0, 0]]), 'run')!;
    expect(shape.kind).toBe('corridor');
    // The return leg covers the same strip: PostGIS measures 14,859 m².
    expect(Math.abs(shape.estimatedAreaM2 - 14_859) / 14_859).toBeLessThan(0.05);
  });

  it('an open route claims only the strip', () => {
    const shape = buildTerritoryShape(trace(51.507, -0.165, [[0, 0], [500, 0], [500, 500]]), 'run')!;
    expect(shape.kind).toBe('corridor');
    expect(shape.ring).toBeNull();
  });

  it('a U-shape that ends far from its start is not a loop (no over-claim)', () => {
    const shape = buildTerritoryShape(trace(51.507, -0.165, [[0, 0], [0, 350], [200, 350], [200, 0]]), 'run')!;
    expect(shape.kind).toBe('corridor');
  });

  it('a lollipop claims the loop, not a hull around the stem', () => {
    const pts = trace(51.507, -0.165, [[0, 0], [0, 500], [-100, 500], [-100, 700], [100, 700], [100, 500], [0, 500], [0, 0]]);
    const shape = buildTerritoryShape(pts, 'run')!;
    expect(shape.kind).toBe('loop');
    // 200 × 200 lobe + strip around it + one 500 m stem strip ≈ 62k; a convex hull would be ~110k.
    expect(shape.estimatedAreaM2).toBeLessThan(68_000);
    expect(shape.estimatedAreaM2).toBeGreaterThan(56_000);
  });

  it('only running claims territory', () => {
    expect(buildTerritoryShape(trace(51.507, -0.165, square(200)), 'cycle')).toBeNull();
  });

  it('a run shorter than 200 m claims nothing', () => {
    expect(buildTerritoryShape(trace(51.507, -0.165, [[0, 0], [150, 0]], 2), 'run')).toBeNull();
  });

  it('a single GPS jump does not drop the rest of the run', () => {
    const pts = trace(51.507, -0.165, square(200));
    pts[100] = { ...pts[100], lat: pts[100].lat + 0.02 }; // 2 km teleport
    const shape = buildTerritoryShape(pts, 'run')!;
    expect(shape.kind).toBe('loop');
    expect(shape.estimatedAreaM2).toBeGreaterThan(47_000);
  });

  it('measures a repeated stretch of route once', () => {
    const once = buildTerritoryShape(trace(51.507, -0.165, [[0, 0], [400, 0], [400, 400]]), 'run')!;
    const twice = buildTerritoryShape(trace(51.507, -0.165, [[0, 0], [400, 0], [0, 0], [400, 0], [400, 400]]), 'run')!;
    expect(Math.abs(twice.estimatedAreaM2 - once.estimatedAreaM2) / once.estimatedAreaM2).toBeLessThan(0.05);
  });

  it('loop start is the earliest point the run ends near', () => {
    const pts = trace(51.507, -0.165, square(200), 10);
    expect(findLoopStart(pts)).toBe(0);
  });

  it('produces WKT the server can parse', () => {
    const shape = buildTerritoryShape(trace(51.507, -0.165, square(200)), 'run')!;
    expect(lineToWKT(shape.line)).toMatch(/^LINESTRING\(-?\d/);
    expect(ringToWKT(shape.ring!)).toMatch(/^POLYGON\(\(-?\d.*\)\)$/);
  });
});

// ── Verified distance (anti-cheat) ────────────────────────────────────────────

describe('verifiedDistance', () => {
  it('counts a normal run at full length', () => {
    const pts = trace(51.5, -0.16, [[0, 0], [5_000, 0]], 5, 3);
    const { distanceM } = verifiedDistance(pts, 5_000 / 3);
    expect(Math.abs(distanceM - 5_000) / 5_000).toBeLessThan(0.005);
  });

  it('a 100 km trace faked into 60 seconds pays almost nothing', () => {
    const pts = trace(51.5, -0.16, [[0, 0], [100_000, 0]], 500, 1_666);
    const { distanceM } = verifiedDistance(pts, 60);
    expect(distanceM).toBeLessThan(500);
  });

  it('cannot exceed what the duration allows', () => {
    const pts = trace(51.5, -0.16, [[0, 0], [5_000, 0]], 5, 3);
    const { distanceM } = verifiedDistance(pts, 100);
    expect(distanceM).toBeLessThanOrEqual(100 * ENGINE.MAX_SEGMENT_SPEED_MS);
  });

  it('ignores inaccurate fixes', () => {
    const pts = trace(51.5, -0.16, [[0, 0], [2_000, 0]], 5, 3).map((p, i) => (i % 2 ? { ...p, accuracy: 80 } : p));
    const { distanceM } = verifiedDistance(pts, 700);
    expect(Math.abs(distanceM - 2_000)).toBeLessThan(15);
  });
});

// ── PACE ──────────────────────────────────────────────────────────────────────

describe('computeRunPace', () => {
  const base = { newZones: 0, stolenZones: 0, streakAdvanced: false, streakDays: 0, weeklyEarned: 0, tier: 'free' };

  it.each([
    [40, 0], [400, 0], [990, 0], [1_000, 1], [5_240, 5], [8_100, 8], [42_195, 42],
  ])('%i m pays %i PACE for distance', (m, pace) => {
    expect(computeRunPace({ ...base, distanceM: m }).breakdown.distance).toBe(pace);
  });

  it('pays 5 per new zone and 10 per stolen zone', () => {
    const r = computeRunPace({ ...base, distanceM: 8_100, newZones: 1, stolenZones: 1 });
    expect(r.breakdown).toEqual({ distance: 8, newZones: 5, stolenZones: 10, streak: 0 });
    expect(r.total).toBe(23);
  });

  it('pays no zone PACE on a run shorter than 200 m', () => {
    expect(computeRunPace({ ...base, distanceM: 150, newZones: 1 }).total).toBe(0);
  });

  it('pays the streak bonus only on the run that advances the streak to a multiple of 7', () => {
    expect(computeRunPace({ ...base, distanceM: 3_000, streakAdvanced: true, streakDays: 7 }).breakdown.streak).toBe(3);
    expect(computeRunPace({ ...base, distanceM: 3_000, streakAdvanced: false, streakDays: 7 }).breakdown.streak).toBe(0);
    expect(computeRunPace({ ...base, distanceM: 3_000, streakAdvanced: true, streakDays: 8 }).breakdown.streak).toBe(0);
    expect(computeRunPace({ ...base, distanceM: 30, streakAdvanced: true, streakDays: 7 }).breakdown.streak).toBe(0);
  });

  it('respects the weekly cap by tier', () => {
    expect(computeRunPace({ ...base, distanceM: 50_000, weeklyEarned: 90 }).total).toBe(10);
    expect(computeRunPace({ ...base, distanceM: 50_000, weeklyEarned: 90, tier: 'premium' }).total).toBe(50);
    expect(computeRunPace({ ...base, distanceM: 50_000, weeklyEarned: 150, tier: 'premium' }).total).toBe(0);
    expect(weeklyCapFor('admin')).toBe(150);
    expect(weeklyCapFor(null)).toBe(100);
  });

  it('never goes negative', () => {
    expect(computeRunPace({ ...base, distanceM: 5_000, weeklyEarned: 500 }).total).toBe(0);
  });
});

describe('updateStreak', () => {
  it('advances once per day', () => {
    expect(updateStreak({ streakDays: 6, lastRunDay: '2026-11-05', today: '2026-11-06', meaningful: true }))
      .toEqual({ streakDays: 7, lastRunDay: '2026-11-06', advanced: true });
    expect(updateStreak({ streakDays: 7, lastRunDay: '2026-11-06', today: '2026-11-06', meaningful: true }))
      .toEqual({ streakDays: 7, lastRunDay: '2026-11-06', advanced: false });
  });
  it('restarts after a missed day', () => {
    expect(updateStreak({ streakDays: 12, lastRunDay: '2026-11-03', today: '2026-11-06', meaningful: true }).streakDays).toBe(1);
  });
  it('ignores runs that are too short', () => {
    expect(updateStreak({ streakDays: 6, lastRunDay: '2026-11-05', today: '2026-11-06', meaningful: false }).advanced).toBe(false);
  });
  it('handles month and year boundaries', () => {
    expect(updateStreak({ streakDays: 3, lastRunDay: '2026-12-31', today: '2027-01-01', meaningful: true }).streakDays).toBe(4);
  });
});

describe('ranks, freshness, score', () => {
  it('ranks by lifetime PACE', () => {
    expect([0, 199, 200, 599, 600, 1_499, 1_500, 3_999, 4_000].map(rankFor))
      .toEqual(['pacer', 'pacer', 'strider', 'strider', 'chaser', 'chaser', 'hunter', 'hunter', 'sovereign']);
  });
  it('decays 10 points a day, rounded down, never below 0', () => {
    const now = Date.UTC(2026, 10, 6);
    expect(decayedFreshness(100, now - 0.5 * ENGINE.MS_PER_DAY, now)).toBe(95);
    expect(decayedFreshness(100, now - 6.01 * ENGINE.MS_PER_DAY, now)).toBe(39);
    expect(decayedFreshness(100, now - 30 * ENGINE.MS_PER_DAY, now)).toBe(0);
  });
  it('scores a stale zone at half and a fresh one at full area', () => {
    expect(zoneScore(10_000, 0)).toBe(5_000);
    expect(zoneScore(10_000, 100)).toBe(10_000);
  });
  it('PACE weeks start Monday 00:00 UTC', () => {
    expect(new Date(paceWeekStartMs(Date.UTC(2026, 10, 8, 23))).toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(new Date(paceWeekStartMs(Date.UTC(2026, 10, 9, 0, 1))).toISOString()).toBe('2026-11-09T00:00:00.000Z');
  });
});
