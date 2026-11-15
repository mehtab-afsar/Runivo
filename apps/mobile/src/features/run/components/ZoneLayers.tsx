import { safeRing } from '@mobile/shared/map/geo';
import React, { useMemo } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import type { TerritoryPolygon } from '@shared/types/game';
import { territoryPalette } from '@theme/territory';
import { useIsDark } from '@theme';

function toGeoJSON(zones: TerritoryPolygon[] | undefined): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: 'FeatureCollection',
    features: (zones ?? []).flatMap(z => {
      const ring = safeRing(z.polygon);
      if (!ring) return [];
      const fresh = Number.isFinite(z.freshness) ? Math.max(0, Math.min(100, z.freshness)) / 100 : 1;
      return [{ type: 'Feature' as const, id: z.id, geometry: { type: 'Polygon' as const, coordinates: [ring] }, properties: { fresh } }];
    }),
  };
}

/** Your zones and rivals' zones on a run map; fill fades as a zone goes stale. */
export function ZoneLayers({ own, rivals, idPrefix }: { own?: TerritoryPolygon[]; rivals?: TerritoryPolygon[]; idPrefix: string }) {
  const zone = territoryPalette(useIsDark());
  const ownGeo = useMemo(() => toGeoJSON(own), [own]);
  const rivalGeo = useMemo(() => toGeoJSON(rivals), [rivals]);
  return (
    <>
      <MapLibreGL.ShapeSource id={`${idPrefix}-rival-zones`} shape={rivalGeo}>
        <MapLibreGL.FillLayer id={`${idPrefix}-rival-fill`} style={{ fillColor: zone.rival, fillOpacity: ['interpolate', ['linear'], ['get', 'fresh'], 0, zone.rivalOpacity[0], 1, zone.rivalOpacity[1]] }} />
        <MapLibreGL.LineLayer id={`${idPrefix}-rival-line`} style={{ lineColor: zone.rival, lineWidth: 1, lineOpacity: 0.6 }} />
      </MapLibreGL.ShapeSource>
      <MapLibreGL.ShapeSource id={`${idPrefix}-own-zones`} shape={ownGeo}>
        <MapLibreGL.FillLayer id={`${idPrefix}-own-fill`} style={{ fillColor: zone.own, fillOpacity: ['interpolate', ['linear'], ['get', 'fresh'], 0, zone.ownOpacity[0], 1, zone.ownOpacity[1]] }} />
        <MapLibreGL.LineLayer id={`${idPrefix}-own-line`} style={{ lineColor: zone.own, lineWidth: 1, lineOpacity: 0.6 }} />
      </MapLibreGL.ShapeSource>
    </>
  );
}
