import { haversineM } from '../../engine/runEngine';
import type { StoredRun } from '../store';

type Points = StoredRun['gpsPoints'];

/**
 * Ramer-Douglas-Peucker path simplification.
 * Reduces GPS point count before cloud upload while preserving route shape.
 * epsilon is in degrees (~0.00005 ≈ 5 m at equator — keeps ~50-150 points per run).
 */
function rdpSimplify(points: Points, epsilon = 0.00005): Points {
  if (points.length <= 2) return points;

  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const lineLen = Math.sqrt(dx * dx + dy * dy);

  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dist = lineLen === 0
      ? Math.sqrt((p.lng - start.lng) ** 2 + (p.lat - start.lat) ** 2)
      : Math.abs(dy * p.lng - dx * p.lat + end.lng * start.lat - end.lat * start.lng) / lineLen;
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }

  if (maxDist > epsilon) {
    const left  = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

/** Longest gap allowed between uploaded points. */
const MAX_UPLOAD_GAP_M = 100;

/**
 * The trace the server receives: the simplified shape, plus a point at least
 * every 100 m. Simplifying alone turned a straight 1 km road into 9 points,
 * and the server refuses any run over 1 km with fewer than 10
 * ("requires a GPS trace"), so straight runs never uploaded.
 */
export function uploadTrace(points: Points): Points {
  if (points.length <= 2) return points;
  const keep = new Set(rdpSimplify(points).map(p => p.timestamp));
  const out: Points = [];
  let last = points[0];
  points.forEach((p, i) => {
    const far = haversineM(last, p) >= MAX_UPLOAD_GAP_M;
    if (i === 0 || i === points.length - 1 || keep.has(p.timestamp) || far) {
      out.push(p);
      last = p;
    }
  });
  return out;
}
