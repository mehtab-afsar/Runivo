/**
 * claimEngine — the app's entry points for territory and PACE.
 *
 * Every rule lives in ../engine/runEngine.ts, which the server runs too
 * (supabase/functions/_shared/runEngine.ts is a byte-for-byte copy). This file
 * only adapts it to the shapes the app already uses, so a number the app shows
 * after a run is the number the server pays.
 */
import type { TerritoryPolygon, TerritoryTier, RunnerRank } from '../types/game';
import {
  ENGINE,
  buildTerritoryShape,
  cleanPoints,
  computeRunPace,
  coverageAreaM2,
  decayedFreshness,
  findLoopStart,
  haversineM as engineHaversineM,
  rankFor,
  ringAreaM2,
  tierForArea,
  zoneScore,
  type EnginePoint,
  type LngLat,
} from '../engine/runEngine';

// ── Event types for live HUD ───────────────────────────────────────────────────

export type ClaimEventType = 'area_update' | 'rival_nearby' | 'loop_closing' | 'speed_warning';

export interface ValidGPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
}

export interface TerritoryBuildResult {
  /** Closed ring [lng, lat][] the app draws until the server's shape arrives. */
  polygon: [number, number][];
  /** App estimate; replaced by the server's measured area after sync. */
  areaM2: number;
  isLoopFill: boolean;
  tier: TerritoryTier;
}

export interface RunPACEResult {
  paceEarned: number;
  breakdown: {
    fromDistance: number;
    fromNewZones: number;
    fromStolenZones: number;
    fromStreak: number;
  };
  cappedAt?: number;
}

// ── Geometry ───────────────────────────────────────────────────────────────────

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return engineHaversineM(a, b);
}

/** Area of a closed [lng, lat] ring in m². */
export function polygonAreaM2(ring: [number, number][]): number {
  return ringAreaM2(ring as LngLat[]);
}

/**
 * Light smoothing for drawing the live trail only. Never used for distance or
 * territory: smoothing shrinks a route depending on GPS spacing.
 */
export function kalmanSmooth<T extends { lat: number; lng: number }>(points: T[]): T[] {
  if (points.length === 0) return [];
  const Q = 1e-5;
  const R = 1e-4;
  let latEst = points[0].lat;
  let lngEst = points[0].lng;
  let P = 1.0;
  return points.map(p => {
    const Pp = P + Q;
    const K = Pp / (Pp + R);
    latEst = latEst + K * (p.lat - latEst);
    lngEst = lngEst + K * (p.lng - lngEst);
    P = (1 - K) * Pp;
    return { ...p, lat: latEst, lng: lngEst };
  });
}

export function computeTier(areaM2: number): TerritoryTier {
  return tierForArea(areaM2);
}

// ── Territory ──────────────────────────────────────────────────────────────────

/**
 * The territory a finished run claims, or null. Same rules as the server:
 * on foot only (run, trail run, walk, hike), at least 200 m, a loop claims its inside plus the strip along
 * the route, anything else claims the 24 m strip.
 */
export function buildTerritoryPolygon(
  rawPoints: EnginePoint[],
  activityType: string,
): TerritoryBuildResult | null {
  const shape = buildTerritoryShape(rawPoints, activityType);
  if (!shape) return null;
  return {
    polygon: shape.displayRing,
    areaM2: shape.estimatedAreaM2,
    isLoopFill: shape.kind === 'loop',
    tier: shape.tier,
  };
}

// ── PACE ───────────────────────────────────────────────────────────────────────

/**
 * PACE for one run, as the server will pay it. `distanceKm` should be the
 * run's recorded distance; `streakAdvanced` is whether this run moved the
 * streak (only the day's first meaningful run does).
 */
export function calculateRunPACE(params: {
  distanceKm: number;
  newZonesClaimed: number;
  stolenZones: number;
  streakDays: number;
  streakAdvanced?: boolean;
  paceWeeklyEarned: number;
  tier?: string | null;
  /** @deprecated pass `tier`; kept so older call sites still compile. */
  isPremium?: boolean;
  /** Rides earn no PACE. Omitted means a run. */
  activityType?: string;
}): RunPACEResult {
  const tier = params.tier ?? (params.isPremium ? 'premium' : 'free');
  const r = computeRunPace({
    distanceM: params.distanceKm * 1000,
    newZones: params.newZonesClaimed,
    stolenZones: params.stolenZones,
    streakAdvanced: params.streakAdvanced ?? true,
    streakDays: params.streakDays,
    weeklyEarned: params.paceWeeklyEarned,
    tier,
    activityType: params.activityType,
  });
  return {
    paceEarned: r.total,
    breakdown: {
      fromDistance: r.breakdown.distance,
      fromNewZones: r.breakdown.newZones,
      fromStolenZones: r.breakdown.stolenZones,
      fromStreak: r.breakdown.streak,
    },
    cappedAt: r.capped ? r.cap : undefined,
  };
}

// ── Freshness, score, rank ─────────────────────────────────────────────────────

export function computeFreshness(lastDefendedAt: string, storedFreshness: number): number {
  return decayedFreshness(storedFreshness, new Date(lastDefendedAt).getTime(), Date.now());
}

/**
 * Territory score: each zone's area weighted by how fresh it is.
 * Pass alreadyDecayed when the caller ran computeFreshness on each zone.
 */
export function computeTerritoryScore(polygons: TerritoryPolygon[], alreadyDecayed = false): number {
  return polygons.reduce((sum, t) => {
    const fresh = alreadyDecayed ? t.freshness : computeFreshness(t.lastDefendedAt, t.freshness);
    return sum + zoneScore(t.areaM2, fresh);
  }, 0);
}

export function computeRunnerRank(totalPaceEarned: number): RunnerRank {
  return rankFor(totalPaceEarned);
}

// ── Live HUD ───────────────────────────────────────────────────────────────────

/**
 * Ground the run would claim if it ended now, using the same shape rules as
 * the finished run. Before 200 m it shows the strip so far, so the number
 * grows from the first step instead of jumping.
 */
export function estimateLiveArea(
  bufferedPoints: (ValidGPSPoint & { accuracy?: number })[],
  activityType: string,
): number {
  if (!ENGINE.TERRITORY_ACTIVITIES.includes(activityType as 'run') || bufferedPoints.length < 2) return 0;
  const shape = buildTerritoryShape(bufferedPoints, activityType);
  if (shape) return shape.estimatedAreaM2;
  const clean = cleanPoints(bufferedPoints);
  if (clean.length < 2) return 0;
  return coverageAreaM2(clean.map(p => [p.lng, p.lat] as LngLat), null);
}

export function isNearRivalTerritory(
  lat: number,
  lng: number,
  cachedPolygons: TerritoryPolygon[],
  radiusDeg = 0.001,
): boolean {
  return cachedPolygons.some(t =>
    t.polygon.some(([pLng, pLat]) =>
      Math.abs(pLat - lat) < radiusDeg && Math.abs(pLng - lng) < radiusDeg,
    ),
  );
}

/**
 * True when the runner is back within 100 m of an earlier part of the route,
 * with enough of a lap behind them to enclose ground. Pass the trace to use
 * the same test the finished run uses; with only start/current it falls back
 * to "near the start".
 */
export function detectLoopClose(
  current: { lat: number; lng: number },
  start: { lat: number; lng: number },
  minRunDistM: number,
  trace?: { lat: number; lng: number }[],
): boolean {
  if (minRunDistM < ENGINE.MIN_TERRITORY_DIST_M) return false;
  if (trace && trace.length >= 3) return findLoopStart(trace) >= 0;
  return haversineM(current, start) <= ENGINE.LOOP_CLOSE_DIST_M;
}
