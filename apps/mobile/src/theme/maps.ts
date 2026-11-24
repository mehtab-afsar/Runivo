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
 * The basemap is CARTO vector tiles built from OpenStreetMap data. Both credits
 * are required wherever a map is shown. Every map renders <MapAttribution />
 * (theme/MapAttribution.tsx), a visible "© OpenStreetMap contributors © CARTO"
 * line, and also keeps MapLibre's own `attributionEnabled` control.
 *
 * ── Keys ─────────────────────────────────────────────────────────────────────
 * CARTO's free tier for commercial apps needs a basemap key. It is read from
 * EXPO_PUBLIC_MAP_TILE_KEY at build time (set it as an EAS env/secret for the
 * production profile); without it the URLs are used keyless.
 *
 * Terrain (OpenTopoMap) and Satellite (Esri World Imagery) were removed for
 * v1: both were used without a key or an agreement, which their terms don't
 * allow for a production app. Re-add them only with a keyed provider.
 */

// ── Providers ────────────────────────────────────────────────────────────────

const CARTO = 'https://basemaps.cartocdn.com/gl';
/**
 * CARTO basemap key (free at carto.com/basemaps/apikey: 1M tile requests a
 * month for commercial use). Vector styles still load without one, but CARTO
 * says the key requirement may extend to them, so set EXPO_PUBLIC_MAP_TILE_KEY
 * before launch. Unset, the URLs stay as they are.
 */
const CARTO_KEY = process.env.EXPO_PUBLIC_MAP_TILE_KEY;
const carto = (style: string) => `${CARTO}/${style}/style.json${CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : ''}`;

/** CARTO vector styles. Attribution required. */
export const MapStyleUrl = {
  /** Light, low-saturation. The app default. */
  positron:   carto('positron-gl-style'),
  /** Near-black. Used for run/replay/summary heroes. */
  darkMatter: carto('dark-matter-gl-style'),
  /** Slightly warmer light style. */
  voyager:    carto('voyager-gl-style'),
} as const;

// ── The user-facing picker ───────────────────────────────────────────────────

/**
 * `id` matches the values persisted in `settings.mapStyle` (see SettingsScreen's
 * Map Style cycle) — keep them in sync.
 */
export const MAP_STYLES = [
  { id: 'Standard',  label: 'Standard',  swatch: '#E8F5E9', url: MapStyleUrl.positron   },
  { id: 'Dark',      label: 'Dark',      swatch: '#263238', url: MapStyleUrl.darkMatter },
  { id: 'Light',     label: 'Light',     swatch: '#FAFAFA', url: MapStyleUrl.voyager    },
] as const;

/** The credit every map must show (OpenStreetMap data, CARTO tiles). */
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors © CARTO';
export const MAP_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';

export type MapStyleId = typeof MAP_STYLES[number]['id'];

const BY_ID: Record<string, string> = Object.fromEntries(MAP_STYLES.map(s => [s.id, s.url]));

/** Extra map styles are part of Runivo Plus (PRD "Free vs Runivo Plus"). None in v1 (see the header). */
export const PLUS_MAP_STYLE_IDS: ReadonlySet<MapStyleId> = new Set<MapStyleId>();

export function isPlusMapStyle(idOrUrl: string | null | undefined): boolean {
  if (!idOrUrl) return false;
  return MAP_STYLES.some(s => PLUS_MAP_STYLE_IDS.has(s.id) && (s.id === idOrUrl || s.url === idOrUrl));
}

/**
 * Resolve a persisted `settings.mapStyle` value to a style URL/JSON.
 * `isDark` only matters when the user has never explicitly picked a style —
 * an explicit choice (including a light one) always wins. A saved style that no
 * longer exists (Terrain, Satellite) falls back to the default.
 */
export function mapStyleUrlFor(id: string | undefined | null, isDark = false, plus = true): string {
  // A saved Plus style falls back to the default once Plus has lapsed.
  if (id && BY_ID[id] && (plus || !isPlusMapStyle(id))) return BY_ID[id];
  return isDark ? MapStyleUrl.darkMatter : MapStyleUrl.positron;
}
