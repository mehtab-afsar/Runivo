/**
 * Running to a target zone (Defend / Attack, PRD M1 and F6): how far it is,
 * which way, and whether you have reached it.
 */
import { haversineM } from './runEngine';

export interface TargetZone {
  id: string;
  name: string;
  /** Closed ring, [lng, lat] pairs (the territory polygon format). */
  ring: [number, number][];
  /** 'defend' your own fading zone, or 'attack' a rival's. */
  mode: 'defend' | 'attack';
}

type LatLng = { lat: number; lng: number };

export function ringCentroid(ring: [number, number][]): LatLng {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const n = Math.max(1, pts.length);
  return { lng: pts.reduce((s, p) => s + p[0], 0) / n, lat: pts.reduce((s, p) => s + p[1], 0) / n };
}

/** Ray casting; the ring is [lng, lat]. */
export function insideRing(p: LatLng, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Compass bearing from a to b, 0–360 (0 = north). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180, Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

export interface TargetProgress { inside: boolean; distanceM: number; bearing: number; direction: string }

/** Where the target is from your position. Distance is to the centre, 0 when inside. */
export function targetProgress(pos: LatLng, zone: TargetZone): TargetProgress {
  const c = ringCentroid(zone.ring);
  const inside = insideRing(pos, zone.ring);
  const b = bearingDeg(pos, c);
  return { inside, distanceM: inside ? 0 : haversineM(pos, c), bearing: b, direction: compass(b) };
}

/** What's around you before a run (PRD R3): rival zones, and your own fading ones. */
export function nearbyZoneCounts(
  pos: LatLng,
  own: { polygon: [number, number][]; freshness: number }[],
  rivals: { polygon: [number, number][] }[],
  fadingBelow: number,
  radiusM = 1000,
): { rivals: number; fading: number } {
  const near = (ring: [number, number][]) => ring.length >= 3 && haversineM(pos, ringCentroid(ring)) <= radiusM;
  return {
    rivals: rivals.filter(z => near(z.polygon)).length,
    fading: own.filter(z => z.freshness < fadingBelow && near(z.polygon)).length,
  };
}

/** "3 rival zones and 2 fading zones of yours within 1 km", or null when there's nothing. */
export function nearbyZonesLine(c: { rivals: number; fading: number }): string | null {
  const parts: string[] = [];
  if (c.rivals) parts.push(`${c.rivals} rival zone${c.rivals > 1 ? 's' : ''}`);
  if (c.fading) parts.push(`${c.fading} fading zone${c.fading > 1 ? 's' : ''} of yours`);
  return parts.length ? `${parts.join(' and ')} within 1 km` : null;
}

/** Points every ~step metres along a straight line a→b (a included, b excluded). */
function densify(a: LatLng, b: LatLng, stepM = 40): LatLng[] {
  const n = Math.max(1, Math.ceil(haversineM(a, b) / stepM));
  return Array.from({ length: n }, (_, i) => ({ lat: a.lat + ((b.lat - a.lat) * i) / n, lng: a.lng + ((b.lng - a.lng) * i) / n }));
}

/**
 * A guide route for Defend / Attack (PRD M1): out to the nearest point of the
 * zone, once around its outline (closing that loop is what claims it), and
 * back to where you started. Straight lines between: follow nearby streets.
 */
export function routeThroughZone(start: LatLng, zone: TargetZone): LatLng[] {
  const ring = zone.ring.length > 1 && zone.ring[0][0] === zone.ring[zone.ring.length - 1][0] && zone.ring[0][1] === zone.ring[zone.ring.length - 1][1]
    ? zone.ring.slice(0, -1) : zone.ring;
  if (ring.length < 3) return [];
  const pts = ring.map(([lng, lat]) => ({ lat, lng }));
  let entry = 0;
  pts.forEach((p, i) => { if (haversineM(start, p) < haversineM(start, pts[entry])) entry = i; });
  const around = [...pts.slice(entry), ...pts.slice(0, entry), pts[entry]];
  const out: LatLng[] = [...densify(start, around[0])];
  for (let i = 0; i < around.length - 1; i++) out.push(...densify(around[i], around[i + 1]));
  out.push(...densify(around[around.length - 1], start), { ...start });
  return out;
}
