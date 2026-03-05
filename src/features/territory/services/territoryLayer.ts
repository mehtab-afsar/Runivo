import maplibregl from 'maplibre-gl';
import { cellToBoundary, cellToLatLng } from 'h3-js';
import { StoredTerritory } from '@shared/services/store';

const SOURCE_ID = 'territories';
const FILL_LAYER = 'territory-fill';
const BORDER_LAYER = 'territory-border';
const LABEL_LAYER = 'territory-label';
const CLAIM_ANIM_PREFIX = 'claim-anim-';

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

  if (map.getLayer(LABEL_LAYER)) map.removeLayer(LABEL_LAYER);
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
        ['==', ['get', 'status'], 'owned'], 'rgba(0, 180, 198, 0.12)',
        ['==', ['get', 'status'], 'enemy'], 'rgba(220, 38, 127, 0.08)',
        ['==', ['get', 'status'], 'neutral'], 'rgba(0, 0, 0, 0.03)',
        'rgba(0, 0, 0, 0.02)',
      ],
      'fill-opacity': [
        'interpolate', ['linear'], ['get', 'defense'],
        0, 0.5, 50, 0.8, 100, 1.0,
      ],
    },
  });

  map.addLayer({
    id: BORDER_LAYER,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'status'], 'owned'], '#00B4C6',
        ['==', ['get', 'status'], 'enemy'], '#DC267F',
        ['==', ['get', 'status'], 'neutral'], 'rgba(0, 0, 0, 0.08)',
        'rgba(0, 0, 0, 0.04)',
      ],
      'line-width': 1.5,
      'line-opacity': [
        'case',
        ['==', ['get', 'status'], 'owned'], 0.6,
        ['==', ['get', 'status'], 'enemy'], 0.5,
        0.15,
      ],
    },
  });

  if (options.showLabels) {
    map.addLayer({
      id: LABEL_LAYER,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'ownerName'],
      layout: {
        'text-field': ['get', 'ownerName'],
        'text-size': 10,
        'text-font': ['Open Sans Regular'],
        'text-anchor': 'center',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': 'rgba(0, 0, 0, 0.4)',
        'text-halo-color': 'rgba(255, 255, 255, 0.9)',
        'text-halo-width': 1,
      },
    });
  }

  map.on('click', FILL_LAYER, (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties;
    window.dispatchEvent(new CustomEvent('territory-click', {
      detail: {
        hexId: props?.hexId,
        status: props?.status,
        ownerName: props?.ownerName,
        defense: props?.defense,
        tier: props?.tier,
      },
    }));
  });

  map.on('mouseenter', FILL_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', FILL_LAYER, () => { map.getCanvas().style.cursor = ''; });
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

export function animateClaimHex(map: maplibregl.Map, hexId: string) {
  const boundary = cellToBoundary(hexId);
  const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  coords.push(coords[0]);

  const animSourceId = `${CLAIM_ANIM_PREFIX}${hexId}`;
  const animLayerId = `${CLAIM_ANIM_PREFIX}layer-${hexId}`;

  if (map.getSource(animSourceId)) return;

  map.addSource(animSourceId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [coords] },
    },
  });

  map.addLayer({
    id: animLayerId,
    type: 'fill',
    source: animSourceId,
    paint: { 'fill-color': 'rgba(0, 180, 198, 0.5)', 'fill-opacity': 0.9 },
  });

  let opacity = 0.9;
  const fadeInterval = setInterval(() => {
    opacity -= 0.045;
    if (opacity <= 0) {
      clearInterval(fadeInterval);
      if (map.getLayer(animLayerId)) map.removeLayer(animLayerId);
      if (map.getSource(animSourceId)) map.removeSource(animSourceId);
      return;
    }
    try {
      map.setPaintProperty(animLayerId, 'fill-opacity', opacity);
    } catch {
      clearInterval(fadeInterval);
    }
  }, 50);
}

function territoriesToGeoJSON(
  territories: StoredTerritory[],
  playerId: string
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = territories.map(t => {
    const boundary = cellToBoundary(t.hexId);
    const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    coords.push(coords[0]);

    const center = cellToLatLng(t.hexId);

    let status: string;
    if (t.ownerId === playerId) {
      status = 'owned';
    } else if (t.ownerId) {
      status = 'enemy';
    } else {
      status = 'neutral';
    }

    return {
      type: 'Feature',
      properties: {
        hexId: t.hexId,
        status,
        ownerId: t.ownerId,
        ownerName: t.ownerName,
        defense: t.defense,
        tier: t.tier,
        centerLat: center[0],
        centerLng: center[1],
      },
      geometry: { type: 'Polygon', coordinates: [coords] },
    };
  });

  return { type: 'FeatureCollection', features };
}
