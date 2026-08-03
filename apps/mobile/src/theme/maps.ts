/**
 * Map basemap configuration — the single source of truth for every map in the app.
 *
 * Previously these URLs were hardcoded across 10 files, which caused two real bugs:
 *   1. RunScreen's "Terrain" and "Satellite" options both pointed at ordinary
 *      CARTO vector styles, so picking Satellite showed the dark basemap. The
 *      real raster styles existed but only in TerritoryMapScreen/RunMapView.
 *   2. A provider swap or CDN outage meant editing ten files.
 *
 * ── ATTRIBUTION — do not disable it ──────────────────────────────────────────
 * All three tile providers below are used WITHOUT an API key on their free
 * tiers, and all three require visible attribution:
 *   • CARTO basemaps  — free tier requires the CARTO + OpenStreetMap credit
 *   • OpenTopoMap     — volunteer-run; has an explicit tile usage policy and
 *                       requires attribution (CC-BY-SA)
 *   • Esri World Imagery — keyless use is not supported for production
 *
 * MapLibre renders `attribution` from the style JSON automatically when the
 * MapView has `attributionEnabled` (the default). Do not disable it. If you
 * need the control repositioned rather than removed, use
 * `attributionPosition` instead of turning it off.
 *
 * Before public launch, move to keyed tiers (CARTO and MapTiler both offer
 * free keyed plans with real terms) and put the key in EXPO_PUBLIC_MAP_TILE_KEY.
 */

// ── Providers ────────────────────────────────────────────────────────────────

const CARTO = 'https://basemaps.cartocdn.com/gl';

/** CARTO vector styles. Keyless free tier — attribution required. */
export const MapStyleUrl = {
  /** Light, low-saturation. The app default. */
  positron:   `${CARTO}/positron-gl-style/style.json`,
  /** Near-black. Used for run/replay/summary heroes. */
  darkMatter: `${CARTO}/dark-matter-gl-style/style.json`,
  /** Slightly warmer light style. */
  voyager:    `${CARTO}/voyager-gl-style/style.json`,
} as const;

/** Raster tile sources must be wrapped in an inline GL style JSON. */
function rasterStyle(opts: {
  tiles: string[];
  attribution: string;
  maxzoom: number;
}): string {
  return JSON.stringify({
    version: 8,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles: opts.tiles,
        tileSize: 256,
        attribution: opts.attribution,
      },
    },
    layers: [
      { id: 'simple-tiles', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: opts.maxzoom },
    ],
  });
}

export const TERRAIN_STYLE = rasterStyle({
  tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
  attribution: '© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors',
  maxzoom: 17,
});

export const SATELLITE_STYLE = rasterStyle({
  tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  attribution: '© Esri, Maxar, Earthstar Geographics',
  maxzoom: 19,
});

// ── The user-facing picker ───────────────────────────────────────────────────

/**
 * `id` matches the values persisted in `settings.mapStyle` (see SettingsScreen's
 * Map Style cycle) — keep them in sync.
 */
export const MAP_STYLES = [
  { id: 'Standard',  label: 'Standard',  swatch: '#E8F5E9', url: MapStyleUrl.positron   },
  { id: 'Dark',      label: 'Dark',      swatch: '#263238', url: MapStyleUrl.darkMatter },
  { id: 'Light',     label: 'Light',     swatch: '#FAFAFA', url: MapStyleUrl.voyager    },
  { id: 'Terrain',   label: 'Terrain',   swatch: '#C8E6C9', url: TERRAIN_STYLE          },
  { id: 'Satellite', label: 'Satellite', swatch: '#1B5E20', url: SATELLITE_STYLE        },
] as const;

export type MapStyleId = typeof MAP_STYLES[number]['id'];

export const MAP_STYLE_IDS: MapStyleId[] = MAP_STYLES.map(s => s.id);

const BY_ID: Record<string, string> = Object.fromEntries(MAP_STYLES.map(s => [s.id, s.url]));

/** Resolve a persisted `settings.mapStyle` value to a style URL/JSON, with a safe default. */
export function mapStyleUrlFor(id: string | undefined | null): string {
  return (id && BY_ID[id]) || MapStyleUrl.positron;
}
