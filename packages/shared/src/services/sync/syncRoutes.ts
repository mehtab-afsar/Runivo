/** Saved routes: push the unsynced ones, pull the runner's own, and find public ones nearby. */
import { supabase } from '../supabase';
import { getSavedRoutes, saveSavedRoute } from '../store';
import { getAuthenticatedUser } from './syncAuth';

/** Push unsynced saved routes to Supabase. */
export async function pushSavedRoutes(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const all = await getSavedRoutes();
  const unsynced = all.filter(r => !r.synced);
  if (unsynced.length === 0) return;

  for (const route of unsynced) {
    const { error } = await supabase.from('saved_routes').upsert({
      id: route.id,
      user_id: user.id,
      name: route.name,
      emoji: route.emoji,
      distance_m: route.distanceM,
      duration_sec: route.durationSec,
      gps_points: route.gpsPoints,
      is_public: route.isPublic,
      source_run_id: route.sourceRunId,
    }, { onConflict: 'id' });

    if (!error) {
      await saveSavedRoute({ ...route, synced: true });
    } else {
      console.warn('[sync] Failed to push saved route', route.id, error.message);
    }
  }
}

/** Pull user's saved routes from Supabase. */
export async function pullSavedRoutes(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('saved_routes')
    .select('id, name, emoji, distance_m, duration_sec, gps_points, is_public, source_run_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return;

  for (const row of data) {
    await saveSavedRoute({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      distanceM: Number(row.distance_m),
      durationSec: row.duration_sec,
      gpsPoints: (row.gps_points as { lat: number; lng: number }[]) ?? [],
      isPublic: row.is_public,
      sourceRunId: row.source_run_id,
      synced: true,
      createdAt: new Date(row.created_at).getTime(),
    });
  }
}

/** Find public routes near a position via PostGIS RPC. */
export interface NearbyRoute {
  id: string;
  name: string;
  emoji: string;
  distanceM: number;
  durationSec: number | null;
  gpsPoints: { lat: number; lng: number }[];
  username: string;
  distM: number;
}

export async function findRoutesNearby(
  lng: number,
  lat: number,
  radiusM = 5000
): Promise<NearbyRoute[]> {
  const { data, error } = await supabase.rpc('find_routes_nearby', {
    p_lng: lng,
    p_lat: lat,
    p_radius_m: radiusM,
  });

  if (error || !data) return [];

  interface RouteNearbyRow {
    id: string; name: string; emoji: string; distance_m: number;
    duration_sec: number | null;
    gps_points: { lat: number; lng: number }[];
    username: string; dist_m: number;
  }

  return (data as RouteNearbyRow[]).map((r): NearbyRoute => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    distanceM: Number(r.distance_m),
    durationSec: r.duration_sec,
    gpsPoints: r.gps_points ?? [],
    username: r.username,
    distM: r.dist_m,
  }));
}
