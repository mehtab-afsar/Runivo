import { positionIfAllowed } from '@mobile/shared/location/devicePosition';

export interface DevicePoint { lat: number; lng: number }

/**
 * The phone's last known position, for city-limited rewards when the profile
 * has no saved location. Never asks for permission (the store must not
 * prompt): if location isn't already granted, or there's no recent fix, it
 * returns null and the server falls back to the saved location. The point is
 * sent for that one check and the server never stores it.
 */
export async function lastKnownPoint(): Promise<DevicePoint | null> {
  const pos = await positionIfAllowed();
  if (!pos) return null;
  // ~1 km precision is plenty for a 35 km city check.
  return { lat: Math.round(pos.lat * 100) / 100, lng: Math.round(pos.lng * 100) / 100 };
}

/** RPC params for a point, or none. */
export function pointParams(point: DevicePoint | null): { p_lat?: number; p_lng?: number } {
  return point ? { p_lat: point.lat, p_lng: point.lng } : {};
}
