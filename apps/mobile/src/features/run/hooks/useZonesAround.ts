import { useEffect, useRef, useState } from 'react';
import type { TerritoryPolygon } from '@shared/types/game';
import { getPlayer } from '@shared/services/store';
import { fetchOwnPolygons, fetchRivalPolygons } from '@features/territory/services/territoryService';

export interface ZonesAround { own: TerritoryPolygon[]; rivals: TerritoryPolygon[] }

/**
 * The runner's zones and rivals' zones within about 3 km, for the run maps.
 *
 * The phone stores only the runner's own zones; rivals come from the server
 * (get_map_polygons). Loads around the first position, then again once the
 * runner is about 2 km from where it last loaded.
 */
export function useZonesAround(pos: { lat: number; lng: number } | null, enabled: boolean): ZonesAround {
  const [zones, setZones] = useState<ZonesAround>({ own: [], rivals: [] });
  const centre = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || !pos) return;
    const c = centre.current;
    if (c && Math.abs(c.lat - pos.lat) < 0.018 && Math.abs(c.lng - pos.lng) < 0.018) return;
    centre.current = { lat: pos.lat, lng: pos.lng };
    let live = true;
    (async () => {
      const me = (await getPlayer())?.id;
      if (!me) return;
      const dLat = 0.027, dLng = 0.027 / Math.max(0.2, Math.cos((pos.lat * Math.PI) / 180));
      const bbox = { minLat: pos.lat - dLat, maxLat: pos.lat + dLat, minLng: pos.lng - dLng, maxLng: pos.lng + dLng };
      const [own, rivals] = await Promise.all([
        fetchOwnPolygons(me).catch(() => [] as TerritoryPolygon[]),
        fetchRivalPolygons(bbox, me).catch(() => [] as TerritoryPolygon[]),
      ]);
      if (live) setZones({ own, rivals });
    })().catch(() => { centre.current = null; });
    return () => { live = false; };
  }, [enabled, pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return zones;
}
