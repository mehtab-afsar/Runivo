import { describe, it, expect } from 'vitest';
import { visibleRoute, visibleMask, effectiveRadius, radiusLabel } from './mapVisibility';

// 3 km due north, a point every 50 m (61 points) — the same route as
// supabase/tests/map_visibility.test.sql, so both sides must agree.
const route = Array.from({ length: 61 }, (_, i) => ({ lat: 12.9 + (i * 50) / 111320, lng: 77.6 }));

describe('map visibility', () => {
  it('hides 200 m at each end by default, as the server does', () => {
    expect(visibleRoute(route)).toHaveLength(51);
    expect(visibleRoute(route, { radiusM: 200 })[0]).toBe(route[5]);
  });
  it('follows the chosen radius', () => {
    expect(visibleRoute(route, { radiusM: 400 })).toHaveLength(43);
    expect(visibleRoute(route, { radiusM: 800 })).toHaveLength(27);
    expect(visibleRoute(route, { radiusM: 1600 })).toHaveLength(0);
  });
  it('never goes under 200 m, and ignores values the server rejects', () => {
    expect(effectiveRadius(0)).toBe(200);
    expect(effectiveRadius(300)).toBe(200);
    expect(effectiveRadius(800)).toBe(800);
    expect(visibleRoute(route, { radiusM: 50 })).toHaveLength(51);
  });
  it('shows nothing when all maps or this activity are hidden', () => {
    expect(visibleRoute(route, { hideAll: true })).toEqual([]);
    expect(visibleRoute(route, { hidden: true })).toEqual([]);
    expect(visibleMask(route, { hideAll: true }).every(v => !v)).toBe(true);
  });
  it('handles empty and tiny routes', () => {
    expect(visibleRoute([])).toEqual([]);
    expect(visibleRoute(route.slice(0, 3))).toEqual([]);
  });
  it('labels radii', () => {
    expect(radiusLabel(400)).toBe('400 m');
    expect(radiusLabel(1600)).toBe('1.6 km');
  });
});

describe('private places', () => {
  it('drops points inside a private place anywhere on the route', async () => {
    const { visibleRoute } = await import('./mapVisibility');
    const pts = Array.from({ length: 41 }, (_, i) => ({ lat: 12.9 + i * 0.001, lng: 77.6 }));
    const home = { lat: 12.92, lng: 77.6, radiusM: 300 };
    const seen = visibleRoute(pts, { places: [home] });
    expect(seen.some(p => Math.abs(p.lat - 12.92) < 0.0026)).toBe(false);
    expect(seen.length).toBeGreaterThan(20);
  });
});
