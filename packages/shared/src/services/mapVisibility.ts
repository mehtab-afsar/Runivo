import { haversineM } from '../engine/runEngine';

/**
 * Map visibility, as the server applies it (supabase/migrations/
 * 20261112000001_map_visibility.sql → blur_route): points within the radius
 * of the first or last point are not shown to anyone else. 200 m is the floor.
 * Used for the share card and the settings preview; the server is the
 * authority for what others actually receive.
 */
export const MAP_HIDE_RADII = [200, 400, 800, 1600] as const;
export type MapHideRadius = (typeof MAP_HIDE_RADII)[number];
export const MAP_HIDE_MIN_M: MapHideRadius = 200;

export interface MapVisibility {
  radiusM?: number | null;
  hideAll?: boolean | null;
  /** This one activity's map is hidden. */
  hidden?: boolean | null;
  /** Private places (20261113000010): no point inside one is shown. */
  places?: { lat: number; lng: number; radiusM: number }[] | null;
}

type Pt = { lat: number; lng: number };

/** The radius actually applied: one of the allowed values, never under 200 m. */
export function effectiveRadius(radiusM?: number | null): MapHideRadius {
  const r = MAP_HIDE_RADII.find(v => v === radiusM);
  return r ?? MAP_HIDE_MIN_M;
}

/** Index of each point that others may see. Same rule as the server: strictly farther than the radius from both ends. */
export function visibleMask(points: Pt[], v: MapVisibility = {}): boolean[] {
  if (v.hideAll || v.hidden || points.length === 0) return points.map(() => false);
  const r = effectiveRadius(v.radiusM);
  const first = points[0];
  const last = points[points.length - 1];
  const places = v.places ?? [];
  return points.map(p => haversineM(p, first) > r && haversineM(p, last) > r && !places.some(pl => haversineM(p, pl) <= pl.radiusM));
}

/** The route others see. Empty when the map is hidden or the whole route sits inside the hidden ends. */
export function visibleRoute<T extends Pt>(points: T[], v: MapVisibility = {}): T[] {
  const mask = visibleMask(points, v);
  return points.filter((_, i) => mask[i]);
}

/** "200 m", "1.6 km". */
export function radiusLabel(r: number): string {
  return r >= 1000 ? `${(r / 1000).toFixed(1)} km` : `${r} m`;
}
