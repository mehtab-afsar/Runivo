/**
 * "Plan a loop" (PRD M2). Suggests a loop of a chosen length that starts and
 * ends where you are, turned toward the best direction:
 *  - 'refresh': passes through as many of your fading zones as possible;
 *  - 'new':     covers ground you don't hold yet (least overlap with your zones).
 * There's no street router here: the loop is a guide line to follow on
 * nearby streets, and the live screen's route following keeps you near it.
 */
import { insideRing, ringCentroid } from './targetZone';

type LatLng = { lat: number; lng: number };
export type LoopMode = 'refresh' | 'new';

export interface LoopZone { ring: [number, number][]; fading: boolean }
export interface LoopPlan {
  points: LatLng[];
  /** Compass heading of the loop's far side, 0 = north. */
  heading: number;
  lengthM: number;
  /** Fading zones the loop runs through (refresh) */
  refreshes: number;
  /** Share of the enclosed area you don't hold yet, 0–1 (new) */
  newShare: number;
}

const M_PER_DEG_LAT = 111_320;
const toXY = (o: LatLng, p: LatLng) => ({ x: (p.lng - o.lng) * M_PER_DEG_LAT * Math.cos((o.lat * Math.PI) / 180), y: (p.lat - o.lat) * M_PER_DEG_LAT });
const toLL = (o: LatLng, x: number, y: number): LatLng => ({ lat: o.lat + y / M_PER_DEG_LAT, lng: o.lng + x / (M_PER_DEG_LAT * Math.cos((o.lat * Math.PI) / 180)) });

/** A circle-ish loop through `start` with the given perimeter, its centre at `heading`. */
export function loopAt(start: LatLng, lengthM: number, heading: number, vertices = 32): LatLng[] {
  const r = lengthM / (2 * Math.PI);
  const h = (heading * Math.PI) / 180;
  const cx = Math.sin(h) * r, cy = Math.cos(h) * r; // centre, metres from start
  const a0 = Math.atan2(-cy, -cx);                    // angle of start seen from the centre
  const pts: LatLng[] = [];
  for (let i = 0; i <= vertices; i++) {
    const a = a0 + (i / vertices) * 2 * Math.PI;
    pts.push(toLL(start, cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  pts[0] = { ...start }; pts[pts.length - 1] = { ...start };
  return pts;
}

/** Fraction of sample points inside the loop that fall in none of your zones. */
function newShareOf(loop: LatLng[], own: LoopZone[]): number {
  const ring = loop.map(p => [p.lng, p.lat] as [number, number]);
  const lats = loop.map(p => p.lat), lngs = loop.map(p => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  let inside = 0, fresh = 0;
  const N = 14;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p = { lat: minLat + ((maxLat - minLat) * i) / N, lng: minLng + ((maxLng - minLng) * j) / N };
    if (!insideRing(p, ring)) continue;
    inside++;
    if (!own.some(z => insideRing(p, z.ring))) fresh++;
  }
  return inside ? fresh / inside : 1;
}

/** Fading zones whose centre is within ~150 m of the loop line. */
function refreshCount(loop: LatLng[], own: LoopZone[]): number {
  const o = loop[0];
  const line = loop.map(p => toXY(o, p));
  return own.filter(z => z.fading).filter(z => {
    const c = toXY(o, ringCentroid(z.ring));
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(a.x + t * dx - c.x, a.y + t * dy - c.y) <= 150) return true;
    }
    return false;
  }).length;
}

export function planLoop(start: LatLng, lengthM: number, mode: LoopMode, own: LoopZone[]): LoopPlan {
  let best: LoopPlan | null = null;
  for (let heading = 0; heading < 360; heading += 30) {
    const points = loopAt(start, lengthM, heading);
    const plan: LoopPlan = { points, heading, lengthM, refreshes: refreshCount(points, own), newShare: newShareOf(points, own) };
    const score = (p: LoopPlan) => (mode === 'refresh' ? p.refreshes * 10 + p.newShare : p.newShare * 10 + p.refreshes * 0.1);
    if (!best || score(plan) > score(best)) best = plan;
  }
  return best!;
}

/** How a loop scores against your zones: fading zones it passes, and the share of new ground inside. */
export function scoreLoop(points: LatLng[], own: LoopZone[]): { refreshes: number; newShare: number } {
  return { refreshes: refreshCount(points, own), newShare: newShareOf(points, own) };
}

/** Loop length that reaches the nearest fading zone and back: 2× the distance + 1 km, 2–8 km in whole km. */
export function suggestedLoopKm(nearestFadingM: number | null): number {
  if (nearestFadingM == null) return 3;
  return Math.max(2, Math.min(8, Math.round((2 * nearestFadingM) / 1000 + 1)));
}
