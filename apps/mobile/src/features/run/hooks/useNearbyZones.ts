import { useEffect, useRef, useState } from 'react';
import { getPlayer } from '@shared/services/store';
import { nearbyZoneCounts, nearbyZonesLine } from '@shared/engine/targetZone';
import { fetchOwnPolygons, fetchRivalPolygons } from '@features/territory/services/territoryService';
import { ENGINE } from '@shared/engine/runEngine';

/**
 * Territory preview on the record sheet (PRD R3): rival zones and your fading
 * zones within 1 km. Looks once per ~300 m of movement, not on every GPS tick.
 */
export function useNearbyZones(pos: { lat: number; lng: number } | null, enabled: boolean): string | null {
  const [line, setLine] = useState<string | null>(null);
  const last = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || !pos) return;
    const moved = !last.current || Math.abs(last.current.lat - pos.lat) > 0.003 || Math.abs(last.current.lng - pos.lng) > 0.003;
    if (!moved) return;
    last.current = pos;
    let live = true;
    (async () => {
      const me = (await getPlayer())?.id;
      if (!me) return;
      const dLat = 0.012, dLng = 0.012 / Math.max(0.2, Math.cos((pos.lat * Math.PI) / 180));
      const bbox = { minLat: pos.lat - dLat, maxLat: pos.lat + dLat, minLng: pos.lng - dLng, maxLng: pos.lng + dLng };
      const [own, rivals] = await Promise.all([fetchOwnPolygons(me), fetchRivalPolygons(bbox, me).catch(() => [])]);
      if (live) setLine(nearbyZonesLine(nearbyZoneCounts(pos, own, rivals, ENGINE.FRESHNESS_STALE_AT)));
    })().catch(() => {});
    return () => { live = false; };
  }, [enabled, pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return enabled ? line : null;
}
