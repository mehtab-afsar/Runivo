/**
 * Guards for what we hand MapLibre. A NaN or Infinity coordinate, or a polygon
 * ring with fewer than four points or not closed, can throw inside the native
 * map and take the screen down; zones come from the phone, the server and old
 * app versions, so every ring and camera position goes through here first.
 */
export type LngLat = [number, number];

function okPoint(p: unknown): p is LngLat {
  return Array.isArray(p) && p.length >= 2
    && Number.isFinite(p[0]) && Number.isFinite(p[1])
    && Math.abs(p[0] as number) <= 180 && Math.abs(p[1] as number) <= 90;
}

/** A valid, closed polygon ring ([lng, lat] points), or null if there isn't one. */
export function safeRing(ring: unknown): LngLat[] | null {
  if (!Array.isArray(ring)) return null;
  const pts = ring.filter(okPoint).map(p => [p[0], p[1]] as LngLat);
  if (pts.length < 3) return null;
  const [f, l] = [pts[0], pts[pts.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) pts.push([f[0], f[1]]);
  return pts.length >= 4 ? pts : null;
}

/** A camera centre MapLibre can use, or undefined. 0,0 counts as "no position". */
export function safeCenter(c: unknown): LngLat | undefined {
  if (!okPoint(c)) return undefined;
  return c[0] === 0 && c[1] === 0 ? undefined : [c[0], c[1]];
}

/** Line coordinates with bad points dropped; null if fewer than two remain. */
export function safeLine(points: unknown[]): LngLat[] | null {
  const pts = points.filter(okPoint).map(p => [p[0], p[1]] as LngLat);
  return pts.length >= 2 ? pts : null;
}
