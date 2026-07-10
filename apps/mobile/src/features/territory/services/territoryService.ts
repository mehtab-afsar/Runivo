import { supabase } from '@shared/services/supabase';
import { getTerritoryPolygons } from '@shared/services/store';
import { pullMapPolygons } from '@shared/services/sync';
import { computeFreshness } from '@shared/services/claimEngine';
import type { TerritoryPolygon } from '@shared/types/game';

export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export async function fetchOwnPolygons(userId: string): Promise<TerritoryPolygon[]> {
  const all = await getTerritoryPolygons(userId);
  return all.map(p => ({
    ...p,
    freshness: computeFreshness(p.lastDefendedAt, p.freshness),
  }));
}

export async function fetchRivalPolygons(
  bbox: BBox,
  currentUserId: string,
): Promise<TerritoryPolygon[]> {
  // get_map_polygons is a spatially-indexed (GiST) PostGIS RPC — it filters by the
  // viewport bbox server-side, unlike the previous "download the 200 newest rows
  // globally and filter client-side" approach, which meant nearby rivals could
  // vanish entirely once >200 rows existed elsewhere in the world.
  const all = await pullMapPolygons(bbox);
  return all
    .filter(p => p.ownerId !== currentUserId)
    .map(p => ({ ...p, freshness: computeFreshness(p.lastDefendedAt, p.freshness) }));
}

export function subscribeToOwnPolygons(userId: string, onUpdate: () => void): () => void {
  const channel = supabase
    .channel('territory-map-own')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'territory_polygons',
      filter: `owner_id=eq.${userId}`,
    }, onUpdate)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
