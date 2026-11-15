/**
 * Territory colours — the one place every map gets its zone, trail and friend
 * colours from, so "mine", "rival" and "fading" look the same everywhere.
 *
 *   Mine        accent red, fill strength follows freshness
 *   Mine fading amber, dashed outline: defend it
 *   Rival       blue, lighter
 *   Rival fading grey-blue, thin: easy to take
 *   Selected    thick outline only, keeps the zone's own colour
 *   New capture white halo for 24 h after the claim
 *   Your trail  accent red; friends get their own palette, never red or blue
 */
import { ENGINE } from '@shared/engine/runEngine';

export interface TerritoryPalette {
  own: string;
  ownFading: string;
  rival: string;
  rivalFading: string;
  selected: string;
  newCapture: string;
  trail: string;
  trailGlow: string;
  ghost: string;
  /** Fill opacity range for own zones, stale → fresh. */
  ownOpacity: [number, number];
  rivalOpacity: [number, number];
}

export const TerritoryColors: { light: TerritoryPalette; dark: TerritoryPalette } = {
  light: {
    own: '#FF4518',
    ownFading: '#F59E0B',
    rival: '#2F56F5',
    rivalFading: '#8A94B8',
    selected: '#0C0C0D',
    newCapture: '#FFFFFF',
    trail: '#FF4518',
    trailGlow: '#FF4518',
    ghost: '#64636A',
    ownOpacity: [0.18, 0.42],
    rivalOpacity: [0.10, 0.26],
  },
  dark: {
    own: '#FF5A2E',
    ownFading: '#FBBF24',
    rival: '#5B7BFF',
    rivalFading: '#6B7394',
    selected: '#FFFFFF',
    newCapture: '#FFFFFF',
    trail: '#FF5A2E',
    trailGlow: '#FF5A2E',
    ghost: '#A3A1A8',
    ownOpacity: [0.22, 0.50],
    rivalOpacity: [0.14, 0.32],
  },
};

export const territoryPalette = (isDark: boolean): TerritoryPalette =>
  isDark ? TerritoryColors.dark : TerritoryColors.light;

/** Friends on the live map: distinct from your red trail and rival blue. */
export const FRIEND_COLORS = ['#7C3AED', '#0EA5A4', '#DB2777', '#12A150', '#0891B2', '#C026D3'] as const;

export function friendColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return FRIEND_COLORS[h % FRIEND_COLORS.length];
}

const STALE = ENGINE.FRESHNESS_STALE_AT;
const isOwn = ['==', ['get', 'isOwn'], true];
const fresh = ['>=', ['get', 'freshness'], STALE];

/**
 * MapLibre layer styles for zones. Features need `isOwn`, `freshness`
 * (already decayed) and optionally `isNew`.
 */
/**
 * Zone layers, one per kind (yours or a rival's, fresh or fading), each with a
 * plain colour. Colours must never be expressions here: maplibre-react-native
 * converts plain colour strings for the native side but passes expressions
 * through untouched, and on iOS a ['case', ..., '#hex'] fill colour crashed
 * the map (MLRNStyle setFillColor, EXC_BAD_ACCESS) the moment it opened.
 * Numbers inside expressions are fine, so opacity still fades with freshness.
 */
export interface ZoneKind {
  key: 'own' | 'ownFading' | 'rival' | 'rivalFading';
  filter: unknown[];
  fill: { fillColor: string; fillOpacity: unknown[] };
  line: { lineColor: string; lineWidth: number; lineOpacity: number };
}

export function territoryLayerStyles(p: TerritoryPalette) {
  const lerp = ([lo, hi]: [number, number]) =>
    ['interpolate', ['linear'], ['get', 'freshness'], 0, lo, 100, hi];
  const notOwn = ['!', isOwn];
  const stale = ['!', fresh];
  const kinds: ZoneKind[] = [
    { key: 'rivalFading', filter: ['all', notOwn, stale], fill: { fillColor: p.rivalFading, fillOpacity: lerp(p.rivalOpacity) }, line: { lineColor: p.rivalFading, lineWidth: 0.75, lineOpacity: 0.6 } },
    { key: 'rival',       filter: ['all', notOwn, fresh], fill: { fillColor: p.rival,       fillOpacity: lerp(p.rivalOpacity) }, line: { lineColor: p.rival,       lineWidth: 1.25, lineOpacity: 0.9 } },
    { key: 'ownFading',   filter: ['all', isOwn, stale],  fill: { fillColor: p.ownFading,   fillOpacity: lerp(p.ownOpacity) },   line: { lineColor: p.ownFading,   lineWidth: 2,    lineOpacity: 0.6 } },
    { key: 'own',         filter: ['all', isOwn, fresh],  fill: { fillColor: p.own,         fillOpacity: lerp(p.ownOpacity) },   line: { lineColor: p.own,         lineWidth: 2,    lineOpacity: 0.9 } },
  ];
  return {
    /** Drawn in this order: rivals under your zones, fading under fresh. */
    kinds,
    /** Dashed outline on your fading zones: "defend me". */
    fadingLine: {
      lineColor: p.ownFading,
      lineWidth: 2,
      lineDasharray: [2, 1.5],
      lineOpacity: 1,
    },
    fadingFilter: ['all', isOwn, ['<', ['get', 'freshness'], STALE]],
    /** Halo under newly captured zones. */
    newHalo: { lineColor: p.newCapture, lineWidth: 5, lineOpacity: 0.9, lineBlur: 1 },
    newFilter: ['==', ['get', 'isNew'], true],
    /** Selection is an outline, so a rival zone never turns your colour. */
    selectedLine: { lineColor: p.selected, lineWidth: 3, lineOpacity: 1 },
  } as const;
}

/** True for zones claimed in the last 24 h. */
export function isNewCapture(claimedAt: string | undefined, nowMs = Date.now()): boolean {
  if (!claimedAt) return false;
  const t = Date.parse(claimedAt);
  return Number.isFinite(t) && nowMs - t < ENGINE.MS_PER_DAY;
}
