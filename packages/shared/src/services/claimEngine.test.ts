/**
 * claimEngine.test.ts — the code that mints PACE and claims territory.
 *
 * This file was previously untested despite being the most consequential logic
 * in the repo: it decides how much currency a run earns, what land it claims,
 * and whether a rival's territory can be taken. Several shipped bugs have
 * originated here (streak bonus diverging from the server, loop-fill capping
 * the wrong polygon, collinear hull points producing self-intersecting rings),
 * so the tests below deliberately pin the *boundaries* and the *anti-cheat
 * gates*, not just the happy path.
 *
 * Pure functions only — no mocks required.
 */

import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from './config';
import {
  haversineM,
  filterGPSPoints,
  stripFastSegments,
  kalmanSmooth,
  polygonAreaM2,
  buildCorridorPolygon,
  buildConvexHull,
  shouldLoopFill,
  rdpSimplify,
  computeTier,
  buildTerritoryPolygon,
  calculateRunPACE,
  computeFreshness,
  computeTerritoryScore,
  computeRunnerRank,
  estimateLiveArea,
  isNearRivalTerritory,
  detectLoopClose,
  type ValidGPSPoint,
} from './claimEngine';
import type { TerritoryPolygon } from '../types/game';

// ── Fixtures ──────────────────────────────────────────────────────────────────

interface RawPt {
  lat: number; lng: number; timestamp: number;
  speed: number; accuracy: number; altitude: number;
}

/** A straight north-bound run: `n` points spaced `stepDeg` of latitude apart. */
function straightRun(n = 25, stepDeg = 0.0002, overrides: Partial<RawPt> = {}): RawPt[] {
  return Array.from({ length: n }, (_, i) => ({
    lat: i * stepDeg,
    lng: 0,
    timestamp: 1_700_000_000_000 + i * 10_000,
    speed: 3,
    accuracy: 5,
    altitude: 10,
    ...overrides,
  }));
}

/**
 * A closed square loop — the final point returns exactly to the origin, so
 * start/end coincide and the loop-close gate passes. Closing the loop matters:
 * without the final point the trace ends one side-segment short of the start,
 * and `shouldLoopFill` bails on the distance check before it ever evaluates the
 * area cap — which silently makes any area-cap assertion vacuously true.
 */
function squareLoopRun(perSide = 6, sizeDeg = 0.001): RawPt[] {
  const pts: RawPt[] = [];
  let t = 1_700_000_000_000;
  const push = (lat: number, lng: number) => {
    pts.push({ lat, lng, timestamp: (t += 10_000), speed: 3, accuracy: 5, altitude: 10 });
  };
  for (let i = 0; i < perSide; i++) push(0, (i / perSide) * sizeDeg);            // east along lat 0
  for (let i = 0; i < perSide; i++) push((i / perSide) * sizeDeg, sizeDeg);      // north along lng=size
  for (let i = 0; i < perSide; i++) push(sizeDeg, sizeDeg - (i / perSide) * sizeDeg); // west
  for (let i = 0; i < perSide; i++) push(sizeDeg - (i / perSide) * sizeDeg, 0);  // south
  push(0, 0);                                                                    // close the loop
  return pts;
}

const valid = (p: RawPt): ValidGPSPoint => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp, speed: p.speed });

// ── haversineM ────────────────────────────────────────────────────────────────

describe('haversineM', () => {
  it('measures one degree of latitude as ~111.2 km', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });

  it('returns 0 for identical points', () => {
    expect(haversineM({ lat: 51.5, lng: -0.12 }, { lat: 51.5, lng: -0.12 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { lat: 51.5, lng: -0.12 };
    const b = { lat: 51.51, lng: -0.13 };
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 9);
  });

  it('shrinks longitude distance at higher latitude', () => {
    const atEquator = haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const atSixty   = haversineM({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(atSixty).toBeLessThan(atEquator * 0.55); // cos(60°) = 0.5
  });
});

// ── filterGPSPoints (accuracy gate + anti-spoof variance check) ───────────────

describe('filterGPSPoints', () => {
  it('keeps points within the accuracy threshold', () => {
    expect(filterGPSPoints(straightRun(25))).toHaveLength(25);
  });

  it('drops points worse than GPS_ACCURACY_THRESHOLD_M', () => {
    const pts = straightRun(25);
    pts[3].accuracy = GAME_CONFIG.GPS_ACCURACY_THRESHOLD_M + 1;
    pts[7].accuracy = 999;
    expect(filterGPSPoints(pts)).toHaveLength(23);
  });

  it('returns nothing when fewer than 4 accurate points survive', () => {
    expect(filterGPSPoints(straightRun(3))).toEqual([]);
  });

  it('rejects a stationary trace as GPS spoofing (variance floor)', () => {
    // Every point identical => zero variance => must be rejected outright,
    // otherwise a spoofer could sit still and farm territory.
    const stationary = straightRun(30, 0);
    expect(filterGPSPoints(stationary)).toEqual([]);
  });

  it('strips accuracy/altitude from the returned shape', () => {
    const [first] = filterGPSPoints(straightRun(25));
    expect(first).toEqual({
      lat: expect.any(Number), lng: expect.any(Number),
      timestamp: expect.any(Number), speed: expect.any(Number),
    });
  });
});

// ── stripFastSegments (speed gate) ────────────────────────────────────────────

describe('stripFastSegments', () => {
  it('keeps a single segment when every point is under the speed cap', () => {
    const segs = stripFastSegments(straightRun(25).map(valid));
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(25);
  });

  it('splits the run where speed exceeds MAX_RUN_SPEED_MS', () => {
    const pts = straightRun(25).map(valid);
    pts[12].speed = GAME_CONFIG.MAX_RUN_SPEED_MS + 0.1; // e.g. in a car
    const segs = stripFastSegments(pts);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveLength(12);
    expect(segs[1]).toHaveLength(12);
  });

  it('discards fragments shorter than 3 points', () => {
    const pts = straightRun(10).map(valid);
    pts[1].speed = 99; // leaves a 1-point fragment before the break
    const segs = stripFastSegments(pts);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(8);
  });

  it('returns no segments when the whole trace is too fast', () => {
    expect(stripFastSegments(straightRun(25, 0.0002, { speed: 30 }).map(valid))).toEqual([]);
  });
});

// ── kalmanSmooth ──────────────────────────────────────────────────────────────

describe('kalmanSmooth', () => {
  it('returns an empty array for empty input', () => {
    expect(kalmanSmooth([])).toEqual([]);
  });

  it('preserves point count and non-positional fields', () => {
    const input = straightRun(25).map(valid);
    const out = kalmanSmooth(input);
    expect(out).toHaveLength(input.length);
    expect(out[5].timestamp).toBe(input[5].timestamp);
    expect(out[5].speed).toBe(input[5].speed);
  });

  it('pulls a single outlier back toward the trend', () => {
    const input = straightRun(25).map(valid);
    const spikeIndex = 12;
    input[spikeIndex] = { ...input[spikeIndex], lat: input[spikeIndex].lat + 0.01 };
    const out = kalmanSmooth(input);
    // Smoothed position must sit well below the raw spike.
    expect(out[spikeIndex].lat).toBeLessThan(input[spikeIndex].lat);
  });
});

// ── polygonAreaM2 ─────────────────────────────────────────────────────────────

describe('polygonAreaM2', () => {
  it('computes the area of a known square', () => {
    // 0.001° per side at the equator ≈ 111.32 m => ≈ 12,392 m²
    const square: [number, number][] = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]];
    expect(polygonAreaM2(square)).toBeCloseTo(12_392, -2);
  });

  it('is independent of winding direction', () => {
    const cw: [number, number][]  = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]];
    const ccw: [number, number][] = [...cw].reverse();
    expect(polygonAreaM2(ccw)).toBeCloseTo(polygonAreaM2(cw), 6);
  });

  it('returns 0 for degenerate rings', () => {
    expect(polygonAreaM2([])).toBe(0);
    expect(polygonAreaM2([[0, 0]])).toBe(0);
    expect(polygonAreaM2([[0, 0], [1, 1]])).toBe(0);
  });

  it('stays precise far from the origin (no catastrophic cancellation)', () => {
    // Same square translated to London — relative-coordinate maths must keep
    // the result stable rather than losing precision to large absolute values.
    const lat = 51.5, lng = -0.12;
    const square: [number, number][] = [
      [lng, lat], [lng + 0.001, lat], [lng + 0.001, lat + 0.001], [lng, lat + 0.001], [lng, lat],
    ];
    const expected = 111.32 * (111.32 * Math.cos(lat * Math.PI / 180));
    expect(polygonAreaM2(square)).toBeCloseTo(expected, -2);
  });
});

// ── buildCorridorPolygon ──────────────────────────────────────────────────────

describe('buildCorridorPolygon', () => {
  it('returns an empty ring for fewer than 2 points', () => {
    expect(buildCorridorPolygon([])).toEqual([]);
    expect(buildCorridorPolygon(straightRun(1).map(valid))).toEqual([]);
  });

  it('produces a closed ring', () => {
    const ring = buildCorridorPolygon(straightRun(10).map(valid));
    expect(ring.length).toBeGreaterThan(3);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('produces an area consistent with length × 2·width', () => {
    const pts = straightRun(10, 0.0002).map(valid); // 9 gaps × ~22.26 m ≈ 200 m
    const ring = buildCorridorPolygon(pts, 12);
    const lengthM = haversineM(pts[0], pts[pts.length - 1]);
    // Corridor is ±12 m around the trace, so ≈ length × 24 m.
    expect(polygonAreaM2(ring)).toBeCloseTo(lengthM * 24, -3);
  });

  it('scales with the width parameter', () => {
    const pts = straightRun(10).map(valid);
    const narrow = polygonAreaM2(buildCorridorPolygon(pts, 6));
    const wide   = polygonAreaM2(buildCorridorPolygon(pts, 12));
    expect(wide).toBeCloseTo(narrow * 2, -2);
  });

  it('skips hairpin interior points instead of self-intersecting', () => {
    // Out-and-back along the same line: the turn is a 180° hairpin. Without the
    // miter guard the offset flips side at the apex and the ribbon bow-ties.
    const out  = straightRun(6, 0.0002).map(valid);
    const back = out.slice(0, -1).reverse().map((p, i) => ({ ...p, timestamp: p.timestamp + 100_000 + i }));
    const ring = buildCorridorPolygon([...out, ...back]);
    expect(polygonAreaM2(ring)).toBeGreaterThan(0);
  });
});

// ── buildConvexHull ───────────────────────────────────────────────────────────

describe('buildConvexHull', () => {
  it('wraps a point cloud in its hull, dropping interior points', () => {
    const pts: ValidGPSPoint[] = [
      { lat: 0, lng: 0, timestamp: 0, speed: 1 },
      { lat: 0, lng: 1, timestamp: 1, speed: 1 },
      { lat: 1, lng: 1, timestamp: 2, speed: 1 },
      { lat: 1, lng: 0, timestamp: 3, speed: 1 },
      { lat: 0.5, lng: 0.5, timestamp: 4, speed: 1 }, // interior — must be excluded
    ];
    const hull = buildConvexHull(pts);
    expect(hull).not.toContainEqual([0.5, 0.5]);
    expect(hull[0]).toEqual(hull[hull.length - 1]); // closed
  });

  it('handles collinear points without producing a self-intersecting ring', () => {
    // Equal-angle points from the pivot exercise the distance tie-break.
    const pts: ValidGPSPoint[] = [
      { lat: 0, lng: 0, timestamp: 0, speed: 1 },
      { lat: 0, lng: 1, timestamp: 1, speed: 1 },
      { lat: 0, lng: 2, timestamp: 2, speed: 1 },
      { lat: 1, lng: 1, timestamp: 3, speed: 1 },
    ];
    const hull = buildConvexHull(pts);
    expect(hull[0]).toEqual(hull[hull.length - 1]);
    expect(polygonAreaM2(hull)).toBeGreaterThan(0);
  });

  it('degrades gracefully for fewer than 3 points', () => {
    const two: ValidGPSPoint[] = [
      { lat: 0, lng: 0, timestamp: 0, speed: 1 },
      { lat: 1, lng: 1, timestamp: 1, speed: 1 },
    ];
    expect(buildConvexHull(two)).toHaveLength(3); // [a, b, a]
  });
});

// ── shouldLoopFill ────────────────────────────────────────────────────────────

describe('shouldLoopFill', () => {
  const loopPts = squareLoopRun().map(valid);
  const hull = buildConvexHull(loopPts);

  it('fills a closed loop of reasonable size', () => {
    expect(shouldLoopFill(loopPts, hull)).toBe(true);
  });

  it('refuses when there are too few GPS points', () => {
    expect(shouldLoopFill(loopPts.slice(0, GAME_CONFIG.MIN_GPS_POINTS - 1), hull)).toBe(false);
  });

  it('refuses when start and end are too far apart to be a loop', () => {
    const openRun = straightRun(25, 0.0005).map(valid); // ~2.7 km end-to-end
    expect(shouldLoopFill(openRun, buildConvexHull(openRun))).toBe(false);
  });

  it('refuses when the enclosed area exceeds LOOP_MAX_AREA_M2', () => {
    // Cap must be tested against the polygon actually claimed (the hull) —
    // a huge loop must not be claimable in one run.
    const bigLoop = squareLoopRun(6, 0.05).map(valid);
    const bigHull = buildConvexHull(bigLoop);
    expect(polygonAreaM2(bigHull)).toBeGreaterThan(GAME_CONFIG.LOOP_MAX_AREA_M2);
    expect(shouldLoopFill(bigLoop, bigHull)).toBe(false);
  });

  it('refuses a zero-area polygon', () => {
    expect(shouldLoopFill(loopPts, [[0, 0], [0, 0], [0, 0]])).toBe(false);
  });
});

// ── rdpSimplify ───────────────────────────────────────────────────────────────

describe('rdpSimplify', () => {
  it('leaves very small rings untouched', () => {
    const tiny: [number, number][] = [[0, 0], [0, 1], [1, 1], [0, 0]];
    expect(rdpSimplify(tiny)).toEqual(tiny);
  });

  it('removes near-collinear intermediate points', () => {
    const noisyLine: [number, number][] = [
      [0, 0], [0.0001, 0], [0.0002, 0], [0.0003, 0], [0.0004, 0], [0.001, 0.001], [0, 0],
    ];
    expect(rdpSimplify(noisyLine).length).toBeLessThan(noisyLine.length);
  });

  it('keeps the ring closed', () => {
    const ring = buildCorridorPolygon(straightRun(20).map(valid));
    const simplified = rdpSimplify(ring);
    expect(simplified[0]).toEqual(simplified[simplified.length - 1]);
  });
});

// ── computeTier (must mirror the server's computeTierFromArea) ────────────────

describe('computeTier', () => {
  it.each([
    [0, 'patch'], [4_999, 'patch'],
    [5_000, 'block'], [49_999, 'block'],
    [50_000, 'district'], [199_999, 'district'],
    [200_000, 'quarter'], [499_999, 'quarter'],
    [500_000, 'domain'], [10_000_000, 'domain'],
  ] as const)('classifies %i m² as %s', (area, tier) => {
    expect(computeTier(area)).toBe(tier);
  });
});

// ── buildTerritoryPolygon (the full pipeline + its refusal gates) ─────────────

describe('buildTerritoryPolygon', () => {
  it('claims a corridor for a straight run', () => {
    const result = buildTerritoryPolygon(straightRun(25, 0.0002), 'run');
    expect(result).not.toBeNull();
    expect(result!.isLoopFill).toBe(false);
    expect(result!.areaM2).toBeGreaterThan(0);
    expect(result!.polygon[0]).toEqual(result!.polygon[result!.polygon.length - 1]);
  });

  it('fills the interior for a closed loop', () => {
    const result = buildTerritoryPolygon(squareLoopRun(), 'run');
    expect(result).not.toBeNull();
    expect(result!.isLoopFill).toBe(true);
    // Enclosed area must dwarf a mere corridor around the same path.
    expect(result!.areaM2).toBeGreaterThan(5_000);
  });

  it('claims nothing for non-run activities', () => {
    expect(buildTerritoryPolygon(straightRun(25), 'cycle')).toBeNull();
    expect(buildTerritoryPolygon(straightRun(25), 'walk')).toBeNull();
  });

  it('claims nothing below MIN_GPS_POINTS', () => {
    expect(buildTerritoryPolygon(straightRun(GAME_CONFIG.MIN_GPS_POINTS - 1), 'run')).toBeNull();
  });

  it('claims nothing below MIN_TERRITORY_DIST_M', () => {
    // 25 points spaced ~1.1 m apart — enough points, nowhere near enough distance.
    expect(buildTerritoryPolygon(straightRun(25, 0.00001), 'run')).toBeNull();
  });

  it('claims nothing from a spoofed stationary trace', () => {
    expect(buildTerritoryPolygon(straightRun(30, 0), 'run')).toBeNull();
  });

  it('claims nothing when the entire trace exceeds the speed cap', () => {
    expect(buildTerritoryPolygon(straightRun(25, 0.0002, { speed: 30 }), 'run')).toBeNull();
  });

  it('assigns a tier consistent with the area it computed', () => {
    const result = buildTerritoryPolygon(squareLoopRun(), 'run')!;
    expect(result.tier).toBe(computeTier(result.areaM2));
  });
});

// ── calculateRunPACE (currency minting) ──────────────────────────────────────

describe('calculateRunPACE', () => {
  const base = {
    distanceKm: 0, newZonesClaimed: 0, stolenZones: 0,
    streakDays: 0, paceWeeklyEarned: 0, isPremium: false,
  };

  it('awards 1 PACE per whole kilometre and ignores the remainder', () => {
    expect(calculateRunPACE({ ...base, distanceKm: 5.9 }).breakdown.fromDistance).toBe(5);
  });

  it('awards per new zone and per stolen zone', () => {
    const r = calculateRunPACE({ ...base, newZonesClaimed: 2, stolenZones: 3 });
    expect(r.breakdown.fromNewZones).toBe(2 * GAME_CONFIG.PACE_PER_NEW_ZONE);
    expect(r.breakdown.fromStolenZones).toBe(3 * GAME_CONFIG.PACE_PER_STOLEN_ZONE);
  });

  it('pays the streak bonus only on 7-day milestones — matching the server', () => {
    // The server (process-run-territory) awards this only when streakDays % 7 === 0.
    // A client that paid it on every streak day showed +3 PACE that silently
    // vanished on sync and tripped the anti-cheat discrepancy log.
    for (const streakDays of [7, 14, 21, 70]) {
      expect(calculateRunPACE({ ...base, streakDays }).breakdown.fromStreak)
        .toBe(GAME_CONFIG.PACE_STREAK_BONUS);
    }
    for (const streakDays of [0, 1, 3, 6, 8, 13]) {
      expect(calculateRunPACE({ ...base, streakDays }).breakdown.fromStreak).toBe(0);
    }
  });

  it('sums the breakdown into paceEarned when under the cap', () => {
    const r = calculateRunPACE({ ...base, distanceKm: 5, newZonesClaimed: 1, stolenZones: 1, streakDays: 7 });
    const { fromDistance, fromNewZones, fromStolenZones, fromStreak } = r.breakdown;
    expect(r.paceEarned).toBe(fromDistance + fromNewZones + fromStolenZones + fromStreak);
    expect(r.cappedAt).toBeUndefined();
  });

  it('clamps to the free weekly cap and reports where it capped', () => {
    const r = calculateRunPACE({
      ...base, distanceKm: 100, paceWeeklyEarned: GAME_CONFIG.PACE_WEEKLY_CAP_FREE - 5,
    });
    expect(r.paceEarned).toBe(5);
    expect(r.cappedAt).toBe(GAME_CONFIG.PACE_WEEKLY_CAP_FREE);
  });

  it('gives premium runners the higher weekly cap', () => {
    const params = { ...base, distanceKm: 500, paceWeeklyEarned: 0 };
    expect(calculateRunPACE({ ...params, isPremium: false }).paceEarned)
      .toBe(GAME_CONFIG.PACE_WEEKLY_CAP_FREE);
    expect(calculateRunPACE({ ...params, isPremium: true }).paceEarned)
      .toBe(GAME_CONFIG.PACE_WEEKLY_CAP_PREMIUM);
  });

  it('never awards negative PACE once the cap is already exhausted', () => {
    const r = calculateRunPACE({
      ...base, distanceKm: 10, paceWeeklyEarned: GAME_CONFIG.PACE_WEEKLY_CAP_FREE + 50,
    });
    expect(r.paceEarned).toBe(0);
  });

  it('earns nothing from a zero-distance, zero-zone run', () => {
    expect(calculateRunPACE(base).paceEarned).toBe(0);
  });
});

// ── computeFreshness ──────────────────────────────────────────────────────────

describe('computeFreshness', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * GAME_CONFIG.MS_PER_DAY).toISOString();

  it('leaves freshly defended territory at full strength', () => {
    expect(computeFreshness(daysAgo(0), 100)).toBe(100);
  });

  it('decays by FRESHNESS_DECAY_PER_DAY per elapsed day', () => {
    expect(computeFreshness(daysAgo(3), 100)).toBe(100 - 3 * GAME_CONFIG.FRESHNESS_DECAY_PER_DAY);
  });

  it('floors at zero rather than going negative', () => {
    expect(computeFreshness(daysAgo(365), 100)).toBe(0);
  });

  it('decays from the stored value, not from 100', () => {
    expect(computeFreshness(daysAgo(2), 50)).toBe(50 - 2 * GAME_CONFIG.FRESHNESS_DECAY_PER_DAY);
  });
});

// ── computeTerritoryScore ─────────────────────────────────────────────────────

describe('computeTerritoryScore', () => {
  const poly = (areaM2: number, freshness: number, daysSinceDefended: number): TerritoryPolygon => ({
    id: `t-${areaM2}-${freshness}`,
    runId: 'r1',
    ownerId: 'u1',
    ownerName: 'Runner',
    polygon: [[0, 0], [0, 1], [1, 1], [0, 0]],
    areaM2,
    freshness,
    lastDefendedAt: new Date(Date.now() - daysSinceDefended * GAME_CONFIG.MS_PER_DAY).toISOString(),
    claimedAt: new Date().toISOString(),
    isLoopFill: false,
    tier: 'block',
    synced: true,
  } as TerritoryPolygon);

  it('scores an empty portfolio as zero', () => {
    expect(computeTerritoryScore([])).toBe(0);
  });

  it('scales a fully fresh zone by TS_FRESHNESS_SCALE_MAX', () => {
    expect(computeTerritoryScore([poly(1000, 100, 0)]))
      .toBeCloseTo(1000 * GAME_CONFIG.TS_FRESHNESS_SCALE_MAX, 6);
  });

  it('scales a fully stale zone by TS_FRESHNESS_SCALE_MIN', () => {
    expect(computeTerritoryScore([poly(1000, 0, 0)], true))
      .toBeCloseTo(1000 * GAME_CONFIG.TS_FRESHNESS_SCALE_MIN, 6);
  });

  it('does not double-apply decay when alreadyDecayed is true', () => {
    // The territory map pre-decays for display; passing those values through
    // without this flag produced a lower score than the dashboard's for the
    // same data.
    const stale = [poly(1000, 100, 5)];
    expect(computeTerritoryScore(stale, true)).toBeGreaterThan(computeTerritoryScore(stale, false));
  });

  it('sums across multiple zones', () => {
    const score = computeTerritoryScore([poly(1000, 100, 0), poly(2000, 100, 0)]);
    expect(score).toBeCloseTo(3000 * GAME_CONFIG.TS_FRESHNESS_SCALE_MAX, 6);
  });
});

// ── computeRunnerRank ─────────────────────────────────────────────────────────

describe('computeRunnerRank', () => {
  const t = GAME_CONFIG.RUNNER_RANK_THRESHOLDS;

  it.each([
    [0, 'pacer'], [t.strider - 1, 'pacer'],
    [t.strider, 'strider'], [t.chaser - 1, 'strider'],
    [t.chaser, 'chaser'], [t.hunter - 1, 'chaser'],
    [t.hunter, 'hunter'], [t.sovereign - 1, 'hunter'],
    [t.sovereign, 'sovereign'], [t.sovereign * 10, 'sovereign'],
  ])('ranks %i total PACE as %s', (pace, rank) => {
    expect(computeRunnerRank(pace as number)).toBe(rank);
  });

  it('never drops below pacer for nonsensical input', () => {
    expect(computeRunnerRank(-100)).toBe('pacer');
  });
});

// ── Live HUD estimators ───────────────────────────────────────────────────────

describe('estimateLiveArea', () => {
  it('estimates a positive area for an in-progress run', () => {
    expect(estimateLiveArea(straightRun(25).map(valid), 'run')).toBeGreaterThan(0);
  });

  it('reports nothing for non-run activities', () => {
    expect(estimateLiveArea(straightRun(25).map(valid), 'cycle')).toBe(0);
  });

  it('reports nothing before enough points exist', () => {
    expect(estimateLiveArea(straightRun(3).map(valid), 'run')).toBe(0);
  });

  it('reports nothing when every point is above the speed cap', () => {
    expect(estimateLiveArea(straightRun(25, 0.0002, { speed: 30 }).map(valid), 'run')).toBe(0);
  });
});

describe('isNearRivalTerritory', () => {
  const rival = {
    polygon: [[0.0, 0.0], [0.0, 0.001], [0.001, 0.001], [0.0, 0.0]],
  } as unknown as TerritoryPolygon;

  it('detects proximity to a rival vertex', () => {
    expect(isNearRivalTerritory(0.0001, 0.0001, [rival])).toBe(true);
  });

  it('reports no rivals when far away', () => {
    expect(isNearRivalTerritory(10, 10, [rival])).toBe(false);
  });

  it('reports no rivals for an empty cache', () => {
    expect(isNearRivalTerritory(0, 0, [])).toBe(false);
  });
});

describe('detectLoopClose', () => {
  const origin = { lat: 0, lng: 0 };

  it('detects a closed loop once the minimum distance has been run', () => {
    expect(detectLoopClose(origin, origin, GAME_CONFIG.MIN_TERRITORY_DIST_M)).toBe(true);
  });

  it('does not fire before the minimum run distance — standing at the start is not a loop', () => {
    expect(detectLoopClose(origin, origin, GAME_CONFIG.MIN_TERRITORY_DIST_M - 1)).toBe(false);
  });

  it('does not fire while still far from the start', () => {
    const farAway = { lat: 0.01, lng: 0 }; // ~1.1 km north
    expect(detectLoopClose(farAway, origin, 5_000)).toBe(false);
  });
});
