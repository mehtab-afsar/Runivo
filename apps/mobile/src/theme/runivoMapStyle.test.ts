import { describe, it, expect } from 'vitest';
import { recolorToRunivo, RunivoMapColors as C } from './runivoMapStyle';

const style = {
  version: 8,
  sources: { carto: { type: 'vector' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#fafaf8' } },
    { id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#d4dadc' } },
    { id: 'park_national_park', type: 'fill', 'source-layer': 'park', paint: { 'fill-color': '#e9ece5', 'fill-opacity': 0.4 } },
    { id: 'building', type: 'fill', 'source-layer': 'building', paint: { 'fill-color': '#ddd', 'fill-outline-color': '#ccc' } },
    { id: 'road_pri_case_noramp', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#e0e0e0' } },
    { id: 'road_pri_fill_noramp', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#fff' } },
    { id: 'rail', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#ddd' } },
    // CARTO's own source-layer names
    { id: 'landcover', type: 'fill', 'source-layer': 'landuse', paint: { 'fill-color': { stops: [[8, 'rgba(234,241,233,0.5)']] } } },
    { id: 'landuse_residential', type: 'fill', 'source-layer': 'landuse', paint: { 'fill-color': '#eee' } },
    { id: 'water_shadow', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': 'transparent' } },
    { id: 'road_minor_case', type: 'line', 'source-layer': 'roads', paint: { 'line-color': { stops: [[13, '#e6e6e6']] } } },
    { id: 'road_minor_fill', type: 'line', 'source-layer': 'roads', paint: { 'line-color': '#fdfdfd' } },
    { id: 'rail_dash', type: 'line', 'source-layer': 'roads', paint: { 'line-color': '#fff' } },
    { id: 'building-top', type: 'fill', 'source-layer': 'buildings', paint: { 'fill-color': '#ededed', 'fill-outline-color': '#dfdfdf' } },
    { id: 'roadname_minor', type: 'symbol', 'source-layer': 'roads', layout: { 'text-field': '{name}' }, paint: { 'text-color': '#838383' } },
    { id: 'housenumber', type: 'symbol', 'source-layer': 'buildings', layout: { 'text-field': '{n}' }, paint: { 'text-color': 'transparent' } },
    { id: 'waterway', type: 'line', 'source-layer': 'waterway', paint: { 'line-color': '#d4dadc' } },
    { id: 'watername_ocean', type: 'symbol', 'source-layer': 'water_name', layout: { 'text-field': '{name}' }, paint: { 'text-color': '#000' } },
    { id: 'roadname_major', type: 'symbol', 'source-layer': 'transportation_name', layout: { 'text-field': '{name}' }, paint: { 'text-color': '#666' } },
  ],
};

const paint = (s: ReturnType<typeof recolorToRunivo>, id: string) =>
  s.layers!.find(l => l.id === id)!.paint as Record<string, unknown>;

describe('recolorToRunivo', () => {
  const out = recolorToRunivo(style);

  it('paints ground, water, parks and buildings in the mock palette', () => {
    expect(paint(out, 'background')['background-color']).toBe(C.ground);
    expect(paint(out, 'water')['fill-color']).toBe(C.water);
    expect(paint(out, 'park_national_park')['fill-color']).toBe(C.park);
    expect(paint(out, 'park_national_park')['fill-opacity']).toBe(1);
    expect(paint(out, 'landuse_residential')['fill-color']).toBe(C.landuse);
    expect(paint(out, 'building')['fill-color']).toBe(C.building);
    expect(paint(out, 'building')['fill-outline-color']).toBe(C.building);
  });

  it('draws white streets with a soft casing, and keeps rail muted', () => {
    expect(paint(out, 'road_pri_case_noramp')['line-color']).toBe(C.casing);
    expect(paint(out, 'road_pri_fill_noramp')['line-color']).toBe(C.road);
    expect(paint(out, 'rail')['line-color']).toBe(C.rail);
    expect(paint(out, 'waterway')['line-color']).toBe(C.water);
  });

  it('greys labels, with blue water labels', () => {
    expect(paint(out, 'roadname_major')['text-color']).toBe(C.label);
    expect(paint(out, 'watername_ocean')['text-color']).toBe(C.waterLabel);
  });

  it("handles CARTO's own layer names", () => {
    expect(paint(out, 'landcover')['fill-color']).toBe(C.park);
    expect(paint(out, 'landuse_residential')['fill-color']).toBe(C.landuse);
    expect(paint(out, 'water_shadow')['fill-color']).toBe('transparent');
    expect(paint(out, 'road_minor_case')['line-color']).toBe(C.casing);
    expect(paint(out, 'road_minor_fill')['line-color']).toBe(C.road);
    expect(paint(out, 'rail_dash')['line-color']).toBe(C.ground);
    expect(paint(out, 'building-top')['fill-color']).toBe(C.building);
    expect(paint(out, 'roadname_minor')['text-color']).toBe(C.label);
    expect(paint(out, 'housenumber')['text-color']).toBe('transparent');
  });

  it('keeps sources and does not mutate the input', () => {
    expect(out.sources).toBe(style.sources);
    expect(style.layers[0].paint['background-color']).toBe('#fafaf8');
  });
});
