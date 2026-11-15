/**
 * claimEngine.test.ts — the app-facing contract for territory and PACE.
 *
 * The rules themselves are pinned in ../engine/runEngine.test.ts (and the
 * database side in supabase/tests/v1_integrity.test.sql). These tests check
 * that the functions the app calls give the same answers the server pays.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildTerritoryPolygon,
  calculateRunPACE,
  computeFreshness,
  computeRunnerRank,
  computeTerritoryScore,
  computeTier,
  detectLoopClose,
  estimateLiveArea,
  haversineM,
  isNearRivalTerritory,
  kalmanSmooth,
  polygonAreaM2,
} from './claimEngine';
import { computeRunPace, buildTerritoryShape, verifiedDistance, isOnFoot } from '../engine/runEngine';
import type { TerritoryPolygon } from '../types/game';

// ── Fixtures: metre offsets around Hyde Park, one fix every 2 s at ~3 m/s ────

const LAT0 = 51.507;
const LNG0 = -0.165;
const M_LAT = 111_250;
const M_LNG = 111_250 * Math.cos((LAT0 * Math.PI) / 180);

function trace(corners: [number, number][], stepM = 6) {
  const pts: { lat: number; lng: number; timestamp: number; speed: number; accuracy: number; altitude: number }[] = [];
  let t = 1_700_000_000_000;
  const push = (x: number, y: number) =>
    pts.push({ lat: LAT0 + y / M_LAT, lng: LNG0 + x / M_LNG, timestamp: (t += 2000), speed: 3, accuracy: 5, altitude: 10 });
  push(...corners[0]);
  for (let i = 1; i < corners.length; i++) {
    const [x0, y0] = corners[i - 1], [x1, y1] = corners[i];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / stepM));
    for (let k = 1; k <= n; k++) push(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n);
  }
  return pts;
}

const square200 = () => trace([[0, 0], [200, 0], [200, 200], [0, 200], [0, 0]]);
// 600 m out and 600 m back along the same street.
const outAndBack600 = () => trace([[0, 0], [600, 0], [0, 0]]);

function zone(over: Partial<TerritoryPolygon> = {}): TerritoryPolygon {
  return {
    id: 'z', runId: 'r', ownerId: 'u', ownerName: 'me', polygon: [[0, 0], [0, 1], [1, 1], [0, 0]],
    areaM2: 10_000, freshness: 100, lastDefendedAt: new Date().toISOString(), claimedAt: new Date().toISOString(),
    isLoopFill: false, tier: 'block', synced: true, ...over,
  };
}

// ── Territory ─────────────────────────────────────────────────────────────────

describe('buildTerritoryPolygon', () => {
  it('a 200 m square loop claims its inside, about what PostGIS measures (50,099 m²)', () => {
    const r = buildTerritoryPolygon(square200(), 'run')!;
    expect(r.isLoopFill).toBe(true);
    expect(Math.abs(r.areaM2 - 50_099) / 50_099).toBeLessThan(0.04);
    expect(r.tier).toBe(computeTier(r.areaM2));
  });

  it('an out-and-back claims only the strip, measured once (PostGIS: 14,859 m²)', () => {
    const r = buildTerritoryPolygon(outAndBack600(), 'run')!;
    expect(r.isLoopFill).toBe(false);
    expect(Math.abs(r.areaM2 - 14_859) / 14_859).toBeLessThan(0.05);
  });

  it('matches the shared engine exactly', () => {
    const pts = square200();
    expect(buildTerritoryPolygon(pts, 'run')!.areaM2).toBe(buildTerritoryShape(pts, 'run')!.estimatedAreaM2);
  });

  it('claims on foot (walks and hikes too) but not on a bike, and nothing under 200 m', () => {
    expect(buildTerritoryPolygon(square200(), 'walk')).not.toBeNull();
    expect(buildTerritoryPolygon(square200(), 'hike')).not.toBeNull();
    expect(buildTerritoryPolygon(square200(), 'cycle')).toBeNull();
    expect(buildTerritoryPolygon(square200(), 'ride')).toBeNull();
    expect(buildTerritoryPolygon(trace([[0, 0], [150, 0]]), 'run')).toBeNull();
  });

  it('pays no PACE for rides', () => {
    const base = { distanceKm: 20, newZonesClaimed: 1, stolenZones: 1, streakDays: 7, streakAdvanced: true, paceWeeklyEarned: 0, tier: 'free' };
    expect(calculateRunPACE({ ...base, activityType: 'cycle' }).paceEarned).toBe(0);
    expect(calculateRunPACE({ ...base, activityType: 'walk' }).paceEarned).toBeGreaterThan(0);
    expect(calculateRunPACE(base).paceEarned).toBeGreaterThan(0);
  });

  it('draws a closed ring', () => {
    const ring = buildTerritoryPolygon(square200(), 'run')!.polygon;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(polygonAreaM2(ring)).toBeGreaterThan(40_000);
  });
});

describe('computeTier', () => {
  it('uses the server thresholds', () => {
    expect(computeTier(4_999)).toBe('patch');
    expect(computeTier(5_000)).toBe('block');
    expect(computeTier(50_000)).toBe('district');
    expect(computeTier(200_000)).toBe('quarter');
    expect(computeTier(500_000)).toBe('domain');
  });
});

// ── PACE ──────────────────────────────────────────────────────────────────────

describe('calculateRunPACE', () => {
  const base = { newZonesClaimed: 0, stolenZones: 0, streakDays: 0, paceWeeklyEarned: 0 };

  it.each([
    [0.04, 0], [0.9, 0], [1.0, 2], [1.99, 2], [5.0, 10], [10.4, 20], [21.1, 42],
  ])('%s km pays %s PACE for distance', (km, pace) => {
    expect(calculateRunPACE({ ...base, distanceKm: km }).breakdown.fromDistance).toBe(pace);
  });

  it('pays 5 per new zone and 10 per stolen zone on runs of 200 m or more', () => {
    const r = calculateRunPACE({ ...base, distanceKm: 3, newZonesClaimed: 1, stolenZones: 2 });
    expect(r.breakdown).toEqual({ fromDistance: 6, fromNewZones: 5, fromStolenZones: 20, fromStreak: 0 });
    expect(r.paceEarned).toBe(31);
  });

  it('pays nothing for zones on a run under 200 m', () => {
    const r = calculateRunPACE({ ...base, distanceKm: 0.15, newZonesClaimed: 1, stolenZones: 1 });
    expect(r.paceEarned).toBe(0);
  });

  it('pays the streak bonus only when the run moved the streak to a multiple of 7', () => {
    expect(calculateRunPACE({ ...base, distanceKm: 2, streakDays: 7, streakAdvanced: true }).breakdown.fromStreak).toBe(3);
    expect(calculateRunPACE({ ...base, distanceKm: 2, streakDays: 7, streakAdvanced: false }).breakdown.fromStreak).toBe(0);
    expect(calculateRunPACE({ ...base, distanceKm: 2, streakDays: 8, streakAdvanced: true }).breakdown.fromStreak).toBe(0);
  });

  it('caps free runners at 100 a week and premium at 150', () => {
    const free = calculateRunPACE({ ...base, distanceKm: 20, paceWeeklyEarned: 90 });
    expect(free.paceEarned).toBe(10);
    expect(free.cappedAt).toBe(100);
    const premium = calculateRunPACE({ ...base, distanceKm: 20, paceWeeklyEarned: 90, tier: 'premium' });
    expect(premium.paceEarned).toBe(40);
    expect(premium.cappedAt).toBeUndefined();
    expect(calculateRunPACE({ ...base, distanceKm: 20, paceWeeklyEarned: 145, tier: 'admin' }).paceEarned).toBe(5);
  });

  it('agrees with the engine the server runs', () => {
    const app = calculateRunPACE({ distanceKm: 7.3, newZonesClaimed: 1, stolenZones: 1, streakDays: 14, streakAdvanced: true, paceWeeklyEarned: 40, tier: 'free' });
    const server = computeRunPace({ distanceM: 7_300, newZones: 1, stolenZones: 1, streakAdvanced: true, streakDays: 14, weeklyEarned: 40, tier: 'free' });
    expect(app.paceEarned).toBe(server.total);
  });
});

// ── Freshness, score, rank ────────────────────────────────────────────────────

describe('freshness and score', () => {
  // Frozen clock: decay is floored, so a millisecond between "now" in the test
  // and "now" in computeFreshness would turn 100 into 99.
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

  it('decays 10 a day, floored, never below 0', () => {
    expect(computeFreshness(daysAgo(0), 100)).toBe(100);
    expect(computeFreshness(daysAgo(2.5), 100)).toBe(75);
    expect(computeFreshness(daysAgo(2.55), 100)).toBe(74);
    expect(computeFreshness(daysAgo(30), 100)).toBe(0);
  });

  it('fresh zones score more than fading ones of the same size', () => {
    const fresh = computeTerritoryScore([zone()]);
    const fading = computeTerritoryScore([zone({ lastDefendedAt: daysAgo(5) })]);
    expect(fresh).toBeGreaterThan(fading);
  });

  it('does not decay twice when told the zones are already decayed', () => {
    const z = zone({ freshness: 50, lastDefendedAt: daysAgo(5) });
    expect(computeTerritoryScore([z], true)).toBeGreaterThan(computeTerritoryScore([z], false));
  });

  it('ranks by lifetime PACE', () => {
    expect(computeRunnerRank(0)).toBe('pacer');
    expect(computeRunnerRank(200)).toBe('strider');
    expect(computeRunnerRank(600)).toBe('chaser');
    expect(computeRunnerRank(1_500)).toBe('hunter');
    expect(computeRunnerRank(4_000)).toBe('sovereign');
  });
});

// ── Live HUD ──────────────────────────────────────────────────────────────────

describe('live HUD', () => {
  it('the live estimate grows with the run and ends at the finished claim', () => {
    const pts = square200();
    const early = estimateLiveArea(pts.slice(0, 20), 'run');
    const late = estimateLiveArea(pts, 'run');
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
    expect(late).toBe(buildTerritoryPolygon(pts, 'run')!.areaM2);
  });

  it('shows nothing for rides', () => {
    expect(estimateLiveArea(square200(), 'cycle')).toBe(0);
    expect(estimateLiveArea(square200(), 'walk')).toBeGreaterThan(0);
  });

  it('spots a closed loop from the trace, not just start/end', () => {
    // Lollipop: 300 m stem, then a 200 m square that closes far from the start.
    const pts = trace([[0, 0], [0, 300], [200, 300], [200, 500], [0, 500], [0, 300]]);
    const last = pts[pts.length - 1];
    expect(detectLoopClose(last, pts[0], 1_100)).toBe(false);
    expect(detectLoopClose(last, pts[0], 1_100, pts)).toBe(true);
  });

  it('needs 200 m before a loop counts', () => {
    const pts = square200();
    expect(detectLoopClose(pts[pts.length - 1], pts[0], 150, pts)).toBe(false);
  });

  it('flags rival zones within ~100 m', () => {
    const rival = zone({ polygon: [[LNG0, LAT0], [LNG0 + 0.0005, LAT0], [LNG0, LAT0 + 0.0005], [LNG0, LAT0]] });
    expect(isNearRivalTerritory(LAT0 + 0.0003, LNG0, [rival])).toBe(true);
    expect(isNearRivalTerritory(LAT0 + 0.01, LNG0, [rival])).toBe(false);
  });
});

describe('helpers', () => {
  it('haversine: 0.001° of latitude is ~111 m', () => {
    expect(haversineM({ lat: 51.5, lng: 0 }, { lat: 51.501, lng: 0 })).toBeCloseTo(111.2, 0);
  });

  it('trail smoothing keeps point count and stays close to the route', () => {
    const pts = outAndBack600();
    const smooth = kalmanSmooth(pts);
    expect(smooth).toHaveLength(pts.length);
    expect(haversineM(smooth[10], pts[10])).toBeLessThan(30);
  });
});

describe('activity types', () => {
  it('treats run, trail run, walk and hike as on foot; rides are not', () => {
    for (const a of ['run', 'trail_run', 'trail', 'walk', 'hike']) expect(isOnFoot(a)).toBe(true);
    expect(isOnFoot('cycle')).toBe(false);
    expect(isOnFoot(undefined)).toBe(true);
  });

  it('keeps riding-speed GPS for rides but drops it for runs', () => {
    // 2 km in 2 minutes: 16.7 m/s, a fast ride and impossible on foot.
    const t0 = 1_700_000_000_000;
    const pts = Array.from({ length: 21 }, (_, i) => ({ lat: 51.5, lng: -0.1 + (i * 100) / 69_400, timestamp: t0 + i * 6_000 }));
    expect(verifiedDistance(pts, 120, 'cycle').distanceM).toBeGreaterThan(1_900);
    expect(verifiedDistance(pts, 120, 'run').distanceM).toBeLessThan(1_000);
  });
});
