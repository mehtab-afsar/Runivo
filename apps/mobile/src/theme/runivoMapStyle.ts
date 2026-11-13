/**
 * The Runivo basemap, as drawn in the HTML mock: warm grey ground, white
 * streets with a soft casing, green parks, pale blue water, quiet grey labels.
 *
 * It is CARTO Positron (same tiles, sprites, glyphs and attribution) with its
 * colours repainted by layer type. The repaint keys off OpenMapTiles
 * source-layer names rather than CARTO's layer ids, so a CARTO style update
 * does not break it. Until the style has loaded (or if loading fails) the
 * plain Positron URL is used.
 */
import { useEffect, useState } from 'react';
import { MapStyleUrl } from './maps';

export const RunivoMapColors = {
  ground:   '#F1F0EC',
  landuse:  '#ECEAE4',
  building: '#E6E4DE',
  park:     '#DCEAD3',
  water:    '#D3E2EE',
  road:     '#FFFFFF',
  casing:   '#E2DFD7',
  rail:     '#DDDAD2',
  boundary: '#CFCBC2',
  label:    '#9C9990',
  waterLabel: '#8FA9BF',
} as const;

type Layer = {
  id: string;
  type: string;
  'source-layer'?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};
type Style = { layers?: Layer[] } & Record<string, unknown>;

const GREEN = /park|grass|wood|forest|garden|meadow|cemetery|pitch|golf|recreation|nature|landcover/i;

// CARTO's vector tiles name their source-layers differently from OpenMapTiles
// (roads/buildings/boundaries/places vs transportation/building/boundary/place).
// Both are handled, so either flavour of basemap repaints correctly.
const WATER  = new Set(['water', 'waterway', 'water_name']);
const ROADS  = new Set(['roads', 'transportation', 'transportation_name', 'aeroway']);
const BUILD  = new Set(['buildings', 'building']);
const LAND   = new Set(['landuse', 'landcover', 'park']);
const BOUNDS = new Set(['boundaries', 'boundary']);

/** Repaint a Positron-style JSON in the Runivo palette. Pure; returns a copy. */
export function recolorToRunivo(style: Style): Style {
  const C = RunivoMapColors;
  const layers = (style.layers ?? []).map((l): Layer => {
    const paint = { ...(l.paint ?? {}) };
    const sl = l['source-layer'] ?? '';
    const id = l.id.toLowerCase();

    switch (l.type) {
      case 'background':
        paint['background-color'] = C.ground;
        break;
      case 'fill': {
        if (id.includes('shadow')) break;
        let c: string | null = null;
        if (WATER.has(sl)) c = C.water;
        else if (BUILD.has(sl)) c = C.building;
        else if (LAND.has(sl)) c = /residential/.test(id) ? C.landuse : GREEN.test(id) || sl !== 'landuse' ? C.park : C.landuse;
        if (c) {
          paint['fill-color'] = c;
          if ('fill-outline-color' in paint) paint['fill-outline-color'] = c;
          if (c === C.park) paint['fill-opacity'] = 1;
        }
        break;
      }
      case 'line': {
        if (WATER.has(sl)) paint['line-color'] = C.water;
        else if (ROADS.has(sl)) {
          if (/rail/.test(id)) paint['line-color'] = /dash/.test(id) ? C.ground : C.rail;
          else if (/path/.test(id) || /case|casing|outline/.test(id)) paint['line-color'] = C.casing;
          else paint['line-color'] = C.road;
        } else if (BOUNDS.has(sl)) paint['line-color'] = C.boundary;
        else if (LAND.has(sl)) paint['line-color'] = C.casing;
        break;
      }
      case 'symbol': {
        if ('text-color' in paint || l.layout?.['text-field']) {
          if (paint['text-color'] !== 'transparent') {
            paint['text-color'] = WATER.has(sl) || /water/.test(id) ? C.waterLabel : C.label;
            paint['text-halo-color'] = C.ground;
          }
        }
        break;
      }
    }
    return { ...l, paint };
  });
  return { ...style, layers };
}

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

/** Fetch and repaint once per app session. Safe to call early (e.g. at launch). */
export function loadRunivoMapStyle(): Promise<string | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch(MapStyleUrl.positron)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`style ${r.status}`))))
      .then((json: Style) => { cached = JSON.stringify(recolorToRunivo(json)); return cached; })
      .catch(() => { inflight = null; return null; });
  }
  return inflight;
}

/**
 * Pass any style URL or JSON. The default light style (Positron) comes back
 * as the Runivo-coloured JSON; dark, terrain and satellite pass through.
 */
export function useRunivoMapStyle(style: string): string {
  const isDefault = style === MapStyleUrl.positron;
  const [json, setJson] = useState<string | null>(cached);
  useEffect(() => {
    if (!isDefault || json) return;
    let alive = true;
    loadRunivoMapStyle().then(s => { if (alive && s) setJson(s); });
    return () => { alive = false; };
  }, [isDefault, json]);
  return isDefault && json ? json : style;
}
