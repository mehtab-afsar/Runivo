import maplibregl from 'maplibre-gl';
import { StoredTerritory } from '@shared/services/store';

const SOURCE_ID = 'territories';
const FILL_LAYER = 'territory-fill';
const BORDER_LAYER = 'territory-border';

export interface TerritoryLayerOptions {
  playerId: string;
  showLabels?: boolean;
}

export function addTerritoryOverlay(
  map: maplibregl.Map,
  territories: StoredTerritory[],
  options: TerritoryLayerOptions
) {
  const geojson = territoriesToGeoJSON(territories, options.playerId);

  if (map.getLayer(BORDER_LAYER)) map.removeLayer(BORDER_LAYER);
  if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

  map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

  map.addLayer({
    id: FILL_LAYER,
    type: 'fill',
    source: SOURCE_ID,
    paint: {
      'fill-color': [
        'case',
        ['==', ['get', 'status'], 'owned'], 'rgba(232, 67, 90, 0.18)',
        'rgba(220, 38, 127, 0.10)',
      ],
      'fill-opacity': 1,
    },
  });

  map.addLayer({
    id: BORDER_LAYER,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'status'], 'owned'], '#E8435A',
        '#DC267F',
      ],
      'line-width': 1.5,
      'line-opacity': [
        'case',
        ['==', ['get', 'status'], 'owned'], 0.7,
        0.5,
      ],
    },
  });
}

export function updateTerritoryData(
  map: maplibregl.Map,
  territories: StoredTerritory[],
  playerId: string
) {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(territoriesToGeoJSON(territories, playerId));
  }
}

/**
 * Animate a freshly-captured territory polygon fading in then out.
 * coords is a closed GeoJSON [lng, lat][] ring.
 */
export function animateClaimPolygon(map: maplibregl.Map, coords: [number, number][]) {
  const animId = `claim-anim-${Date.now()}`;
  const layerId = `${animId}-layer`;

  if (map.getSource(animId)) return;

  map.addSource(animId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [coords] },
    },
  });

  map.addLayer({
    id: layerId,
    type: 'fill',
    source: animId,
    paint: { 'fill-color': 'rgba(232, 67, 90, 0.5)', 'fill-opacity': 0.9 },
  });

  let opacity = 0.9;
  const fadeInterval = setInterval(() => {
    opacity -= 0.04;
    if (opacity <= 0) {
      clearInterval(fadeInterval);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(animId)) map.removeSource(animId);
      return;
    }
    try {
      map.setPaintProperty(layerId, 'fill-opacity', opacity);
    } catch {
      clearInterval(fadeInterval);
    }
  }, 50);
}

function territoriesToGeoJSON(
  territories: StoredTerritory[],
  playerId: string
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = territories
    .filter(t => t.polygon && t.polygon.length >= 4)
    .map(t => {
      const status = t.ownerId === playerId ? 'owned' : 'enemy';
      return {
        type: 'Feature',
        properties: {
          id: t.id,
          status,
          ownerId: t.ownerId,
          ownerName: t.ownerName,
          defense: t.defense,
          areaM2: t.areaM2,
        },
        geometry: { type: 'Polygon', coordinates: [t.polygon] },
      };
    });

  return { type: 'FeatureCollection', features };
}
