import { GAME_CONFIG } from './config';
import type { TerritoryPolygon, TerritoryTier, RunnerRank } from '../types/game';

// ── Event types for live HUD ───────────────────────────────────────────────────

export type ClaimEventType = 'area_update' | 'rival_nearby' | 'loop_closing' | 'speed_warning';

export interface ClaimEvent {
  type: ClaimEventType;
  areaM2?: number;
  timestamp: number;
}

// ── GPS point types ────────────────────────────────────────────────────────────

interface RawGPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
  accuracy: number;
  altitude: number;
}

export interface ValidGPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
}

// ── Result types ───────────────────────────────────────────────────────────────

export interface TerritoryBuildResult {
  polygon: [number, number][];  // closed ring [lng, lat][]
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

// ── Haversine distance ─────────────────────────────────────────────────────────

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
          + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ── GPS filter: accuracy + anti-spoof variance check ──────────────────────────

export function filterGPSPoints(points: RawGPSPoint[]): ValidGPSPoint[] {
  const accurate = points.filter(p => p.accuracy <= GAME_CONFIG.GPS_ACCURACY_THRESHOLD_M);
  if (accurate.length < 4) return [];

  const lats = accurate.map(p => p.lat);
  const mean = lats.reduce((s, v) => s + v, 0) / lats.length;
  const variance = lats.reduce((s, v) => s + (v - mean) ** 2, 0) / lats.length;
  if (variance < GAME_CONFIG.GPS_VARIANCE_MIN * 1e-10) return [];

  return accurate.map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp, speed: p.speed }));
}

// ── Speed gate: split run into sub-5.5 m/s segments ──────────────────────────

export function stripFastSegments(points: ValidGPSPoint[]): ValidGPSPoint[][] {
  const segments: ValidGPSPoint[][] = [];
  let current: ValidGPSPoint[] = [];

  for (const p of points) {
    if (p.speed <= GAME_CONFIG.MAX_RUN_SPEED_MS) {
      current.push(p);
    } else {
      if (current.length >= 3) segments.push(current);
      current = [];
    }
  }
  if (current.length >= 3) segments.push(current);
  return segments;
}

// ── 1D Kalman smoother on lat + lng ───────────────────────────────────────────

export function kalmanSmooth(points: ValidGPSPoint[]): ValidGPSPoint[] {
  if (points.length === 0) return [];
  const Q = 1e-5; // process noise
  const R = 1e-4; // measurement noise

  let latEst = points[0].lat;
  let lngEst = points[0].lng;
  let P = 1.0;

  return points.map(p => {
    const Pp = P + Q;
    const K  = Pp / (Pp + R);
    latEst   = latEst + K * (p.lat - latEst);
    lngEst   = lngEst + K * (p.lng - lngEst);
    P        = (1 - K) * Pp;
    return { ...p, lat: latEst, lng: lngEst };
  });
}

// ── Polygon area — shoelace formula in m² ─────────────────────────────────────

export function polygonAreaM2(ring: [number, number][]): number {
  const n = ring.length;
  if (n < 3) return 0;
  const LAT_M = GAME_CONFIG.METERS_PER_DEGREE_LAT;
  // Use relative coordinates to avoid catastrophic cancellation when absolute
  // lat/lng values (e.g. 51.5 * 111320 ≈ 5.7M) dwarf the polygon dimensions.
  const refLng = ring[0][0];
  const refLat = ring[0][1];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % n];
    const LNG_M = LAT_M * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
    const x1 = (lng1 - refLng) * LNG_M;
    const y1 = (lat1 - refLat) * LAT_M;
    const x2 = (lng2 - refLng) * LNG_M;
    const y2 = (lat2 - refLat) * LAT_M;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

// ── Corridor polygon builder: ±widthM perpendicular to GPS trace ──────────────

export function buildCorridorPolygon(
  segment: ValidGPSPoint[],
  widthM: number = GAME_CONFIG.CORRIDOR_WIDTH_M,
): [number, number][] {
  if (segment.length < 2) return [];
  const LAT_M = GAME_CONFIG.METERS_PER_DEGREE_LAT;
  const refLat = segment[0].lat;
  const LNG_M  = LAT_M * Math.cos(refLat * Math.PI / 180);
  const dLat   = widthM / LAT_M;
  const dLng   = widthM / LNG_M;

  const left:  [number, number][] = [];
  const right: [number, number][] = [];

  for (let i = 0; i < segment.length; i++) {
    const prev = segment[Math.max(0, i - 1)];
    const next = segment[Math.min(segment.length - 1, i + 1)];
    const dlat = (next.lat - prev.lat) / LAT_M;
    const dlng = (next.lng - prev.lng) / LNG_M;
    const len  = Math.sqrt(dlat * dlat + dlng * dlng) || 1;
    // Perpendicular unit vector: tangent in (east, north) = (dlng, dlat),
    // so left-perp (CCW 90°) in (east, north) = (-dlat, dlng).
    const px   = -dlat / len;  // east (lng) component of perp
    const py   =  dlng / len;  // north (lat) component of perp
    left.push( [segment[i].lng + px * dLng, segment[i].lat + py * dLat]);
    right.push([segment[i].lng - px * dLng, segment[i].lat - py * dLat]);
  }

  return [...left, ...[...right].reverse(), left[0]];
}

// ── Convex hull (Graham scan) for loop-fill ───────────────────────────────────

export function buildConvexHull(points: ValidGPSPoint[]): [number, number][] {
  const pts: [number, number][] = points.map(p => [p.lng, p.lat]);
  if (pts.length < 3) return [...pts, pts[0]];

  pts.sort((a, b) => a[1] !== b[1] ? a[1] - b[1] : a[0] - b[0]);
  const pivot = pts[0];

  function cross(O: [number, number], A: [number, number], B: [number, number]): number {
    return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  }

  const rest = pts.slice(1).sort((a, b) => {
    const dA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
    const dB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
    return dA - dB;
  });

  const hull: [number, number][] = [pivot];
  for (const p of rest) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }
  hull.push(hull[0]);
  return hull;
}

// ── Loop-fill decision ────────────────────────────────────────────────────────

export function shouldLoopFill(
  allPoints: ValidGPSPoint[],
  corridorPolygon: [number, number][],
): boolean {
  if (allPoints.length < GAME_CONFIG.MIN_GPS_POINTS) return false;
  const start = allPoints[0];
  const end   = allPoints[allPoints.length - 1];
  if (haversineM(start, end) > GAME_CONFIG.LOOP_CLOSE_DIST_M) return false;
  const area  = polygonAreaM2(corridorPolygon);
  return area > 0 && area < GAME_CONFIG.LOOP_MAX_AREA_M2;
}

// ── RDP simplification ────────────────────────────────────────────────────────

function ptLineDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function rdp(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 2) return pts;
  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptLineDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > eps) {
    return [
      ...rdp(pts.slice(0, maxI + 1), eps).slice(0, -1),
      ...rdp(pts.slice(maxI), eps),
    ];
  }
  return [pts[0], pts[pts.length - 1]];
}

export function rdpSimplify(polygon: [number, number][], epsilon = 0.00003): [number, number][] {
  if (polygon.length <= 4) return polygon;
  const open = polygon.slice(0, -1);
  const simplified = rdp(open, epsilon);
  return [...simplified, simplified[0]];
}

// ── Tier from area ─────────────────────────────────────────────────────────────

export function computeTier(areaM2: number): TerritoryTier {
  if (areaM2 < 5_000)   return 'patch';
  if (areaM2 < 20_000)  return 'block';
  if (areaM2 < 80_000)  return 'district';
  if (areaM2 < 200_000) return 'quarter';
  return 'domain';
}

// ── Main territory builder ────────────────────────────────────────────────────

export function buildTerritoryPolygon(
  rawPoints: { lat: number; lng: number; timestamp: number; speed: number; accuracy: number; altitude: number }[],
  activityType: string,
): TerritoryBuildResult | null {
  if (activityType !== 'run') return null;
  if (rawPoints.length < GAME_CONFIG.MIN_GPS_POINTS) return null;

  const filtered = filterGPSPoints(rawPoints);
  if (filtered.length < GAME_CONFIG.MIN_GPS_POINTS) return null;

  let totalDist = 0;
  for (let i = 1; i < filtered.length; i++) {
    totalDist += haversineM(filtered[i - 1], filtered[i]);
  }
  if (totalDist < GAME_CONFIG.MIN_TERRITORY_DIST_M) return null;

  const segments = stripFastSegments(filtered);
  if (segments.length === 0) return null;

  const smoothed    = segments.map(kalmanSmooth);
  const allSmoothed = smoothed.flat();
  if (allSmoothed.length < 4) return null;

  const longestSegment = smoothed.reduce((a, b) => a.length > b.length ? a : b);
  const corridor       = buildCorridorPolygon(longestSegment);
  const isLoopFill     = shouldLoopFill(allSmoothed, corridor);
  const rawPolygon     = isLoopFill ? buildConvexHull(allSmoothed) : corridor;
  const polygon        = rdpSimplify(rawPolygon);
  const areaM2         = polygonAreaM2(polygon);

  if (areaM2 < 100) return null;

  return { polygon, areaM2, isLoopFill, tier: computeTier(areaM2) };
}

// ── PACE calculator ───────────────────────────────────────────────────────────

export function calculateRunPACE(params: {
  distanceKm: number;
  newZonesClaimed: number;
  stolenZones: number;
  streakDays: number;
  paceWeeklyEarned: number;
  isPremium: boolean;
}): RunPACEResult {
  const { distanceKm, newZonesClaimed, stolenZones, streakDays, paceWeeklyEarned, isPremium } = params;
  const cap       = isPremium ? GAME_CONFIG.PACE_WEEKLY_CAP_PREMIUM : GAME_CONFIG.PACE_WEEKLY_CAP_FREE;
  const remaining = Math.max(0, cap - paceWeeklyEarned);

  const fromDistance    = Math.floor(distanceKm * GAME_CONFIG.PACE_PER_KM);
  const fromNewZones    = newZonesClaimed * GAME_CONFIG.PACE_PER_NEW_ZONE;
  const fromStolenZones = stolenZones    * GAME_CONFIG.PACE_PER_STOLEN_ZONE;
  const fromStreak      = streakDays > 0 ? GAME_CONFIG.PACE_STREAK_BONUS : 0;

  const raw       = fromDistance + fromNewZones + fromStolenZones + fromStreak;
  const paceEarned = Math.min(raw, remaining);

  return {
    paceEarned,
    breakdown: { fromDistance, fromNewZones, fromStolenZones, fromStreak },
    cappedAt: paceEarned < raw ? cap : undefined,
  };
}

// ── Freshness decay (computed lazily on read) ──────────────────────────────────

export function computeFreshness(lastDefendedAt: string, storedFreshness: number): number {
  const daysSince = (Date.now() - new Date(lastDefendedAt).getTime()) / GAME_CONFIG.MS_PER_DAY;
  const decayed   = storedFreshness - Math.floor(daysSince * GAME_CONFIG.FRESHNESS_DECAY_PER_DAY);
  return Math.max(0, decayed);
}

// ── Territory Score ────────────────────────────────────────────────────────────

export function computeTerritoryScore(polygons: TerritoryPolygon[]): number {
  const { TS_FRESHNESS_SCALE_MIN: MIN, TS_FRESHNESS_SCALE_MAX: MAX } = GAME_CONFIG;
  return polygons.reduce((sum, t) => {
    const fresh = computeFreshness(t.lastDefendedAt, t.freshness);
    const scale = MIN + (fresh / 100) * (MAX - MIN);
    return sum + t.areaM2 * scale;
  }, 0);
}

// ── Runner Rank ────────────────────────────────────────────────────────────────

export function computeRunnerRank(totalPaceEarned: number): RunnerRank {
  const t = GAME_CONFIG.RUNNER_RANK_THRESHOLDS;
  if (totalPaceEarned >= t.sovereign) return 'sovereign';
  if (totalPaceEarned >= t.hunter)   return 'hunter';
  if (totalPaceEarned >= t.chaser)   return 'chaser';
  if (totalPaceEarned >= t.strider)  return 'strider';
  return 'pacer';
}

// ── Live HUD estimators ────────────────────────────────────────────────────────

export function estimateLiveArea(
  bufferedPoints: ValidGPSPoint[],
  activityType: string,
): number {
  if (activityType !== 'run' || bufferedPoints.length < 4) return 0;
  const segs = stripFastSegments(bufferedPoints);
  if (segs.length === 0) return 0;
  const longest  = segs.reduce((a, b) => a.length > b.length ? a : b);
  const corridor = buildCorridorPolygon(longest);
  return polygonAreaM2(corridor);
}

export function isNearRivalTerritory(
  lat: number,
  lng: number,
  cachedPolygons: TerritoryPolygon[],
  radiusDeg = 0.001,
): boolean {
  return cachedPolygons.some(t =>
    t.polygon.some(([pLng, pLat]) =>
      Math.abs(pLat - lat) < radiusDeg && Math.abs(pLng - lng) < radiusDeg
    )
  );
}

export function detectLoopClose(
  current: { lat: number; lng: number },
  start: { lat: number; lng: number },
  minRunDistM: number,
): boolean {
  if (minRunDistM < GAME_CONFIG.MIN_TERRITORY_DIST_M) return false;
  return haversineM(current, start) <= GAME_CONFIG.LOOP_CLOSE_DIST_M;
}
