import { supabase } from '@shared/services/supabase';
import { getTerritoryPolygons } from '@shared/services/store';
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
  const { data, error } = await supabase
    .from('territory_polygons')
    .select('id, run_id, owner_id, owner_name, polygon_coords, area_m2, freshness, last_defended_at, claimed_at, is_loop_fill, tier')
    .neq('owner_id', currentUserId)
    .order('claimed_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data
    .filter(row => {
      const coords = row.polygon_coords as [number, number][] | null;
      if (!coords?.length) return false;
      const [lng, lat] = coords[0];
      return (
        lat >= bbox.minLat && lat <= bbox.maxLat &&
        lng >= bbox.minLng && lng <= bbox.maxLng
      );
    })
    .map(row => ({
      id:             row.id as string,
      runId:          row.run_id as string,
      ownerId:        row.owner_id as string,
      ownerName:      (row.owner_name as string | null) ?? 'Runner',
      polygon:        row.polygon_coords as [number, number][],
      areaM2:         (row.area_m2 as number | null) ?? 0,
      freshness:      computeFreshness(
        (row.last_defended_at as string | null) ?? '',
        (row.freshness as number | null) ?? 100,
      ),
      lastDefendedAt: (row.last_defended_at as string | null) ?? '',
      claimedAt:      (row.claimed_at as string | null) ?? '',
      isLoopFill:     (row.is_loop_fill as boolean | null) ?? false,
      tier:           ((row.tier as string | null) ?? 'patch') as TerritoryPolygon['tier'],
      synced:         true,
    }));
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
