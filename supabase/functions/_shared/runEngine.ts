/**
 * runEngine — the single source of truth for Runivo's game maths.
 *
 * Used by BOTH the app (packages/shared) and the server
 * (supabase/functions/_shared/runEngine.ts is a byte-for-byte copy, enforced by
 * runEngine.sync.test.ts). Change the rules here, then run
 * `npm run engine:sync` to refresh the server copy.
 *
 * Pure TypeScript: no imports, no platform APIs, so it runs in React Native,
 * Node (tests) and Deno (edge functions) unchanged.
 *
 * What lives here:
 *   - GPS cleaning and verified distance (time-aware, anti-teleport)
 *   - loop detection and territory shape building
 *   - area, tier, freshness decay, territory score
 *   - PACE for a run, streak update, weekly caps, runner rank
 */

// ── Rules ─────────────────────────────────────────────────────────────────────

export const ENGINE = {
  // GPS
  GPS_ACCURACY_THRESHOLD_M: 50,
  /** Faster than this between two fixes is a GPS jump (27 km/h). */
  MAX_SEGMENT_SPEED_MS: 7.5,
  /** Rides: faster than this between two fixes is a GPS jump (79 km/h). */
  MAX_RIDE_SEGMENT_SPEED_MS: 22,
  /** Faster than this is not running; such stretches don't claim territory. */
  MAX_TERRITORY_SPEED_MS: 5.5,
  MIN_GPS_POINTS: 20,

  // Territory
  /** Half-width of the strip claimed along a route (strip is 24 m wide). */
  CORRIDOR_HALF_WIDTH_M: 12,
  /** A run "closes a loop" when it ends within this distance of an earlier point. */
  LOOP_CLOSE_DIST_M: 100,
  /** The looped part of the route must be at least this long. */
  LOOP_MIN_PERIMETER_M: 300,
  LOOP_MAX_AREA_M2: 500_000,
  MIN_TERRITORY_DIST_M: 200,
  MIN_TERRITORY_AREA_M2: 100,
  /**
   * On-foot activities: these claim zones, earn PACE and move the streak.
   * Rides are recorded but don't play the territory game (a bike covers ground
   * 3-4x faster, which would let riders sweep the map).
   */
  TERRITORY_ACTIVITIES: ['run', 'trail_run', 'trail', 'walk', 'hike', 'wheelchair', 'stroller'] as readonly string[],

  // Freshness and score
  FRESHNESS_DECAY_PER_DAY: 10,
  FRESHNESS_STALE_AT: 40,
  TS_FRESHNESS_SCALE_MIN: 0.5,
  TS_FRESHNESS_SCALE_MAX: 1.0,

  // Runs
  MIN_MEANINGFUL_RUN_DISTANCE_M: 50,
  MIN_RUN_DURATION_S: 60,

  // PACE
  PACE_PER_KM: 2,
  PACE_PER_NEW_ZONE: 5,
  PACE_PER_STOLEN_ZONE: 10,
  PACE_STREAK_BONUS: 3,
  STREAK_BONUS_EVERY_DAYS: 7,
  PACE_WEEKLY_CAP_FREE: 100,
  PACE_WEEKLY_CAP_PREMIUM: 150,
  RANK_THRESHOLDS: { pacer: 0, strider: 200, chaser: 600, hunter: 1500, sovereign: 4000 },

  MS_PER_DAY: 86_400_000,
} as const;

export type Tier = 'patch' | 'block' | 'district' | 'quarter' | 'domain';
export type Rank = 'pacer' | 'strider' | 'chaser' | 'hunter' | 'sovereign';
export type LngLat = [number, number];

export interface EnginePoint {
  lat: number;
  lng: number;
  /** Milliseconds since epoch. */
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

// ── Geometry basics ───────────────────────────────────────────────────────────

const R_EARTH = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R_EARTH * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Metres per degree of latitude and longitude at a latitude (WGS84 series). */
export function metresPerDegree(lat: number): { lat: number; lng: number } {
  const p = toRad(lat);
  return {
    lat: 111_132.954 - 559.822 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p),
    lng: 111_412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p) + 0.118 * Math.cos(5 * p),
  };
}

type XY = [number, number];

function project(ring: LngLat[], originLat: number, originLng: number): XY[] {
  const m = metresPerDegree(originLat);
  return ring.map(([lng, lat]) => [(lng - originLng) * m.lng, (lat - originLat) * m.lat]);
}

function centreOf(ring: LngLat[]): { lat: number; lng: number } {
  let lat = 0, lng = 0;
  for (const [x, y] of ring) { lng += x; lat += y; }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

/** Area of a simple (non self-crossing) ring in m². Ring is [lng, lat][]. */
export function ringAreaM2(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const c = centreOf(ring);
  const xy = project(ring, c.lat, c.lng);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/**
 * Area enclosed by a ring that may cross itself (figure-8, lollipop stem),
 * using the even-odd rule on a grid. Zero-width stems count as nothing.
 */
export function enclosedAreaM2(ring: LngLat[], maxCells = 40_000): number {
  if (ring.length < 4) return 0;
  const c = centreOf(ring);
  const xy = project(ring, c.lat, c.lng);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of xy) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY;
  if (w <= 0 || h <= 0) return 0;
  const cell = Math.max(2, Math.sqrt((w * h) / maxCells));
  const cols = Math.max(0, Math.ceil((maxX - minX - cell / 2) / cell));
  let inside = 0;
  for (let y = minY + cell / 2; y < maxY; y += cell) {
    scanRow(xy, y, minX, cell, cols, () => { inside++; });
  }
  return inside * cell * cell;
}

/**
 * Even-odd fill of one grid row: calls `hit(gx)` for every cell whose centre
 * (minX + (gx + 0.5) * cell, y) is inside the ring. Same answer as testing
 * each centre against every edge, but one pass over the edges per row instead
 * of one per cell: a long lap course went from seconds to milliseconds
 * (the edge function has a 2 s CPU budget).
 */
function scanRow(xy: XY[], y: number, minX: number, cell: number, cols: number, hit: (gx: number) => void): void {
  const xs: number[] = [];
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const [xi, yi] = xy[i], [xj, yj] = xy[j];
    if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  if (xs.length < 2) return;
  xs.sort((a, b) => a - b);
  // A centre x is inside when an odd number of crossings lie at or left of it:
  // x in [xs[0], xs[1]), [xs[2], xs[3]), …
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const from = Math.max(0, Math.ceil((xs[k] - minX) / cell - 0.5));
    const to = Math.min(cols, Math.ceil((xs[k + 1] - minX) / cell - 0.5));
    for (let gx = from; gx < to; gx++) hit(gx);
  }
}

/**
 * Ground covered by the 24 m strip along a line, optionally plus a loop's
 * interior, counted once even where the route repeats itself. This is the
 * app-side twin of the server's ST_Union(ST_Buffer(line), loop): same idea,
 * measured on a grid of small cells.
 */
export function coverageAreaM2(line: LngLat[], ring: LngLat[] | null, halfWidthM: number = ENGINE.CORRIDOR_HALF_WIDTH_M): number {
  if (line.length < 2) return 0;
  const origin = { lat: line[0][1], lng: line[0][0] };
  const lineXY = project(line, origin.lat, origin.lng);
  const ringXY = ring ? project(ring, origin.lat, origin.lng) : null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of [...lineXY, ...(ringXY ?? [])]) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  minX -= halfWidthM; minY -= halfWidthM; maxX += halfWidthM; maxY += halfWidthM;
  const bboxArea = (maxX - minX) * (maxY - minY);
  const cell = Math.max(3, Math.sqrt(bboxArea / 250_000));
  const cols = Math.ceil((maxX - minX) / cell) + 1;
  const covered = new Set<number>();

  // Strip: stamp a disc of cells every half-cell along the line.
  const r = Math.ceil(halfWidthM / cell);
  const r2 = halfWidthM * halfWidthM;
  for (let i = 1; i < lineXY.length; i++) {
    const [x0, y0] = lineXY[i - 1], [x1, y1] = lineXY[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / (cell / 2)));
    for (let s = 0; s <= steps; s++) {
      const px = x0 + ((x1 - x0) * s) / steps, py = y0 + ((y1 - y0) * s) / steps;
      const cx = Math.floor((px - minX) / cell), cy = Math.floor((py - minY) / cell);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = cx + dx, gy = cy + dy;
          const mx = minX + (gx + 0.5) * cell - px, my = minY + (gy + 0.5) * cell - py;
          if (mx * mx + my * my <= r2) covered.add(gy * cols + gx);
        }
      }
    }
  }

  // Loop interior: even-odd fill, one scan per row.
  if (ringXY && ringXY.length >= 4) {
    const rows = Math.ceil((maxY - minY) / cell) + 1;
    for (let gy = 0; gy < rows; gy++) {
      const y = minY + (gy + 0.5) * cell;
      scanRow(ringXY, y, minX, cell, cols, gx => { covered.add(gy * cols + gx); });
    }
  }
  return covered.size * cell * cell;
}

export function pathLengthM(points: { lat: number; lng: number }[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineM(points[i - 1], points[i]);
  return d;
}

/** Ramer–Douglas–Peucker in metres. */
export function simplifyPath<T extends { lat: number; lng: number }>(pts: T[], toleranceM = 4): T[] {
  if (pts.length < 3) return pts.slice();
  const c = centreOf(pts.map(p => [p.lng, p.lat] as LngLat));
  const xy = project(pts.map(p => [p.lng, p.lat] as LngLat), c.lat, c.lng);
  const keep = new Uint8Array(pts.length);
  keep[0] = 1; keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, bestD = 0;
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best > 0 && bestD > toleranceM) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i] === 1);
}

// ── GPS cleaning and verified distance ────────────────────────────────────────

/** Drops inaccurate fixes and fixes that imply an impossible speed. */
export function cleanPoints<T extends EnginePoint>(points: T[], maxSpeedMs: number = ENGINE.MAX_SEGMENT_SPEED_MS): T[] {
  const sorted = points
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .filter(p => (p.accuracy ?? 0) <= ENGINE.GPS_ACCURACY_THRESHOLD_M)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);
  const out: T[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (!last) { out.push(p); continue; }
    const dt = (p.timestamp - last.timestamp) / 1000;
    if (dt <= 0) continue;
    if (haversineM(last, p) / dt > maxSpeedMs) continue;
    out.push(p);
  }
  return out;
}

/**
 * Distance the server will pay PACE on. Only counts accurate fixes at a
 * plausible speed, and never more than the run's duration allows.
 */
/** Whether an activity plays the territory game (claims zones, earns PACE). */
export function isOnFoot(activityType: string | null | undefined): boolean {
  return ENGINE.TERRITORY_ACTIVITIES.includes(activityType ?? 'run');
}

export function verifiedDistance(
  points: EnginePoint[], durationSec: number, activityType: string = 'run',
): { distanceM: number; durationS: number } {
  const maxSpeed = isOnFoot(activityType) ? ENGINE.MAX_SEGMENT_SPEED_MS : ENGINE.MAX_RIDE_SEGMENT_SPEED_MS;
  const clean = cleanPoints(points, maxSpeed);
  if (clean.length < 2) return { distanceM: 0, durationS: 0 };
  const spanS = (clean[clean.length - 1].timestamp - clean[0].timestamp) / 1000;
  const durationS = Math.max(0, Math.min(durationSec > 0 ? durationSec : spanS, spanS));
  const distanceM = Math.min(pathLengthM(clean), durationS * maxSpeed);
  return { distanceM, durationS };
}

// ── Territory shapes ──────────────────────────────────────────────────────────

export function tierForArea(m2: number): Tier {
  if (m2 < 5_000) return 'patch';
  if (m2 < 50_000) return 'block';
  if (m2 < 200_000) return 'district';
  if (m2 < 500_000) return 'quarter';
  return 'domain';
}

/**
 * Finds the loop: the latest point that the run ends within
 * LOOP_CLOSE_DIST_M of, with at least LOOP_MIN_PERIMETER_M of route after it
 * (so a multi-lap run uses its last lap).
 * Returns the index where the loop starts, or -1.
 */
export function findLoopStart(points: { lat: number; lng: number }[]): number {
  if (points.length < 4) return -1;
  const end = points[points.length - 1];
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversineM(points[i - 1], points[i]));
  const total = cum[cum.length - 1];
  // The last lap: the latest point the run comes back to with at least
  // LOOP_MIN_PERIMETER_M of route after it. Taking the earliest stacked every
  // lap into one ring, and the even-odd fill emptied it on 2, 4, … laps.
  // Within that lap, start at the earliest of the points still near the end,
  // so the loop isn't cut short by up to LOOP_CLOSE_DIST_M.
  for (let i = points.length - 2; i >= 0; i--) {
    if (total - cum[i] < ENGINE.LOOP_MIN_PERIMETER_M) continue;
    if (haversineM(points[i], end) > ENGINE.LOOP_CLOSE_DIST_M) continue;
    while (i > 0 && haversineM(points[i - 1], end) <= ENGINE.LOOP_CLOSE_DIST_M) i--;
    return i;
  }
  return -1;
}

/** Display-only strip polygon around a line (the server buffers the line itself). */
export function corridorRing(line: LngLat[], halfWidthM: number = ENGINE.CORRIDOR_HALF_WIDTH_M): LngLat[] {
  if (line.length < 2) return [];
  const m = metresPerDegree(line[0][1]);
  const L: LngLat[] = [], R: LngLat[] = [];
  for (let i = 0; i < line.length; i++) {
    const prev = line[Math.max(0, i - 1)], next = line[Math.min(line.length - 1, i + 1)];
    const dx = (next[0] - prev[0]) * m.lng, dy = (next[1] - prev[1]) * m.lat;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    L.push([line[i][0] + (nx * halfWidthM) / m.lng, line[i][1] + (ny * halfWidthM) / m.lat]);
    R.push([line[i][0] - (nx * halfWidthM) / m.lng, line[i][1] - (ny * halfWidthM) / m.lat]);
  }
  return [...L, ...R.reverse(), L[0]];
}

export interface TerritoryShape {
  kind: 'loop' | 'corridor';
  /** Simplified route, [lng, lat][]. The server buffers this into the strip. */
  line: LngLat[];
  /** Closed loop ring for loop shapes, [lng, lat][]. */
  ring: LngLat[] | null;
  /** What the app draws before the server's shape arrives. */
  displayRing: LngLat[];
  /** App-side estimate; the server's measured area replaces it after sync. */
  estimatedAreaM2: number;
  tier: Tier;
}

/**
 * Builds the territory a run claims, or null if it claims nothing.
 * A loop claims its interior plus the strip along the route, whichever
 * reading gives the runner more ground; anything else claims the strip.
 */
export function buildTerritoryShape(points: EnginePoint[], activityType: string): TerritoryShape | null {
  if (!ENGINE.TERRITORY_ACTIVITIES.includes(activityType)) return null;
  const clean = cleanPoints(points, ENGINE.MAX_TERRITORY_SPEED_MS);
  if (clean.length < ENGINE.MIN_GPS_POINTS) return null;
  const length = pathLengthM(clean);
  if (length < ENGINE.MIN_TERRITORY_DIST_M) return null;

  const simple = simplifyPath(clean, 4);
  const line: LngLat[] = simple.map(p => [p.lng, p.lat]);
  const stripArea = coverageAreaM2(line, null);

  let kind: 'loop' | 'corridor' = 'corridor';
  let ring: LngLat[] | null = null;
  let estimate = stripArea;

  const start = findLoopStart(simple);
  if (start >= 0) {
    const loopPts = simple.slice(start);
    const candidate: LngLat[] = [...loopPts.map(p => [p.lng, p.lat] as LngLat), [loopPts[0].lng, loopPts[0].lat]];
    const interior = enclosedAreaM2(candidate);
    if (interior <= ENGINE.LOOP_MAX_AREA_M2) {
      const withLoop = coverageAreaM2(line, candidate);
      // Only call it a loop when filling it actually adds ground (an
      // out-and-back "loop" encloses nothing).
      if (withLoop > stripArea * 1.1) {
        kind = 'loop';
        ring = candidate;
        estimate = withLoop;
      }
    }
  }

  if (estimate < ENGINE.MIN_TERRITORY_AREA_M2) return null;
  return {
    kind,
    line,
    ring,
    displayRing: ring ?? corridorRing(line),
    estimatedAreaM2: Math.round(estimate),
    tier: tierForArea(estimate),
  };
}

export function lineToWKT(line: LngLat[]): string {
  return `LINESTRING(${line.map(([x, y]) => `${x} ${y}`).join(', ')})`;
}

export function ringToWKT(ring: LngLat[]): string {
  const closed = ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    ? [...ring, ring[0]] : ring;
  return `POLYGON((${closed.map(([x, y]) => `${x} ${y}`).join(', ')}))`;
}

// ── Freshness and score ───────────────────────────────────────────────────────

/** Freshness now, decayed from the stored value (whole points, rounded down). */
export function decayedFreshness(stored: number, lastDefendedAtMs: number, nowMs: number): number {
  const days = Math.max(0, (nowMs - lastDefendedAtMs) / ENGINE.MS_PER_DAY);
  return Math.max(0, Math.min(100, Math.floor(stored - days * ENGINE.FRESHNESS_DECAY_PER_DAY)));
}

export function isStale(freshness: number): boolean {
  return freshness < ENGINE.FRESHNESS_STALE_AT;
}

/** One zone's contribution to Territory Score: area scaled 0.5x (stale) to 1.0x (fresh). */
export function zoneScore(areaM2: number, freshness: number): number {
  const f = Math.max(0, Math.min(100, freshness)) / 100;
  return areaM2 * (ENGINE.TS_FRESHNESS_SCALE_MIN + f * (ENGINE.TS_FRESHNESS_SCALE_MAX - ENGINE.TS_FRESHNESS_SCALE_MIN));
}

// ── Streak, PACE, caps, rank ──────────────────────────────────────────────────

/**
 * PACE earned this week. The server zeroes the weekly counter only when it next
 * credits PACE, so on a Monday before any run the stored number is still last
 * week's; anything reset before this week's Monday counts as 0.
 */
export function weeklyPaceNow(earned: number | null | undefined, resetAt: string | null | undefined, nowMs = Date.now()): number {
  const reset = resetAt ? Date.parse(resetAt) : NaN;
  if (!Number.isFinite(reset) || reset < paceWeekStartMs(nowMs)) return 0;
  return Math.max(0, earned ?? 0);
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Streak after a run. A run only counts if it's meaningful, and only the
 * first meaningful run of a UTC day advances the streak.
 */
export function updateStreak(params: {
  streakDays: number;
  lastRunDay: string | null;
  today: string;
  meaningful: boolean;
}): { streakDays: number; lastRunDay: string | null; advanced: boolean } {
  const { streakDays, lastRunDay, today, meaningful } = params;
  if (!meaningful || lastRunDay === today) return { streakDays, lastRunDay, advanced: false };
  const yesterday = utcDay(Date.parse(`${today}T00:00:00Z`) - ENGINE.MS_PER_DAY);
  const next = lastRunDay === yesterday ? streakDays + 1 : 1;
  return { streakDays: next, lastRunDay: today, advanced: true };
}

export function weeklyCapFor(tier: string | null | undefined): number {
  return tier === 'premium' || tier === 'admin' ? ENGINE.PACE_WEEKLY_CAP_PREMIUM : ENGINE.PACE_WEEKLY_CAP_FREE;
}

export function rankFor(totalPaceEarned: number): Rank {
  const t = ENGINE.RANK_THRESHOLDS;
  if (totalPaceEarned >= t.sovereign) return 'sovereign';
  if (totalPaceEarned >= t.hunter) return 'hunter';
  if (totalPaceEarned >= t.chaser) return 'chaser';
  if (totalPaceEarned >= t.strider) return 'strider';
  return 'pacer';
}

export interface RunPace {
  total: number;
  raw: number;
  breakdown: { distance: number; newZones: number; stolenZones: number; streak: number };
  cap: number;
  capped: boolean;
}

/**
 * PACE for one run. `distanceM` must be the verified distance.
 * Distance pays whole kilometres only; zones need a territory-length run;
 * the streak bonus pays once, on the day the streak reaches a multiple of 7.
 */
export function computeRunPace(params: {
  distanceM: number;
  newZones: number;
  stolenZones: number;
  streakAdvanced: boolean;
  streakDays: number;
  weeklyEarned: number;
  tier: string | null | undefined;
  /** Rides earn nothing; omitted means a run. */
  activityType?: string;
}): RunPace {
  const meaningful = params.distanceM >= ENGINE.MIN_MEANINGFUL_RUN_DISTANCE_M && isOnFoot(params.activityType);
  const claimsCount = params.distanceM >= ENGINE.MIN_TERRITORY_DIST_M && isOnFoot(params.activityType);
  const distance = meaningful ? Math.floor(params.distanceM / 1000) * ENGINE.PACE_PER_KM : 0;
  const newZones = claimsCount ? Math.max(0, params.newZones) * ENGINE.PACE_PER_NEW_ZONE : 0;
  const stolenZones = claimsCount ? Math.max(0, params.stolenZones) * ENGINE.PACE_PER_STOLEN_ZONE : 0;
  const streak = meaningful && params.streakAdvanced && params.streakDays > 0
    && params.streakDays % ENGINE.STREAK_BONUS_EVERY_DAYS === 0 ? ENGINE.PACE_STREAK_BONUS : 0;
  const raw = distance + newZones + stolenZones + streak;
  const cap = weeklyCapFor(params.tier);
  const remaining = Math.max(0, cap - Math.max(0, params.weeklyEarned));
  const total = Math.min(raw, remaining);
  return { total, raw, breakdown: { distance, newZones, stolenZones, streak }, cap, capped: total < raw };
}

/** Start of the PACE week (Monday 00:00 UTC) for a time. */
export function paceWeekStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  const dow = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
}
