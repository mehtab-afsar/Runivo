import { describe, it, expect } from 'vitest';
import { insideRing, ringCentroid, bearingDeg, compass, targetProgress, type TargetZone } from './targetZone';

// ~110 m square around (12.9005, 77.6005).
const ring: [number, number][] = [[77.6, 12.9], [77.601, 12.9], [77.601, 12.901], [77.6, 12.901], [77.6, 12.9]];
const zone: TargetZone = { id: 'z', name: 'Park', ring, mode: 'defend' };

describe('target zone', () => {
  it('finds the centre and tests inside', () => {
    expect(ringCentroid(ring).lat).toBeCloseTo(12.9005, 6);
    expect(insideRing({ lat: 12.9005, lng: 77.6005 }, ring)).toBe(true);
    expect(insideRing({ lat: 12.902, lng: 77.6005 }, ring)).toBe(false);
  });

  it('gives bearings as compass points', () => {
    expect(compass(bearingDeg({ lat: 12.9, lng: 77.6 }, { lat: 12.91, lng: 77.6 }))).toBe('N');
    expect(compass(bearingDeg({ lat: 12.9, lng: 77.6 }, { lat: 12.9, lng: 77.61 }))).toBe('E');
  });

  it('reports distance to the zone, and zero inside', () => {
    const south = targetProgress({ lat: 12.8915, lng: 77.6005 }, zone);
    expect(south.inside).toBe(false);
    expect(south.distanceM).toBeGreaterThan(950);
    expect(south.distanceM).toBeLessThan(1050);
    expect(south.direction).toBe('N');
    expect(targetProgress({ lat: 12.9005, lng: 77.6005 }, zone)).toMatchObject({ inside: true, distanceM: 0 });
  });
});

describe('nearby zones', () => {
  const sq = (lat: number, lng: number): [number, number][] => [[lng, lat], [lng + 0.001, lat], [lng + 0.001, lat + 0.001], [lng, lat + 0.001], [lng, lat]];
  it('counts rivals and fading own zones within 1 km', async () => {
    const { nearbyZoneCounts, nearbyZonesLine } = await import('./targetZone');
    const pos = { lat: 12.9, lng: 77.6 };
    const c = nearbyZoneCounts(pos,
      [{ polygon: sq(12.9, 77.6), freshness: 20 }, { polygon: sq(12.9, 77.6), freshness: 90 }, { polygon: sq(12.95, 77.6), freshness: 10 }],
      [{ polygon: sq(12.903, 77.6) }, { polygon: sq(12.904, 77.601) }, { polygon: sq(13.0, 77.6) }],
      40);
    expect(c).toEqual({ rivals: 2, fading: 1 });
    expect(nearbyZonesLine(c)).toBe('2 rival zones and 1 fading zone of yours within 1 km');
    expect(nearbyZonesLine({ rivals: 0, fading: 0 })).toBeNull();
  });
});

describe('routeThroughZone', () => {
  it('goes out to the nearest corner, around the zone and back', async () => {
    const { routeThroughZone } = await import('./targetZone');
    const { haversineM } = await import('./runEngine');
    const start = { lat: 12.9, lng: 77.59 };
    const zone = { id: 'z', name: 'P', mode: 'attack' as const, ring: [[77.6, 12.9], [77.601, 12.9], [77.601, 12.901], [77.6, 12.901], [77.6, 12.9]] as [number, number][] };
    const r = routeThroughZone(start, zone);
    expect(r[0]).toEqual(start);
    expect(r[r.length - 1]).toEqual(start);
    // passes every corner of the zone
    for (const [lng, lat] of zone.ring) expect(r.some(p => haversineM(p, { lat, lng }) < 5)).toBe(true);
    // no gap between consecutive points over ~45 m (route following needs density)
    for (let i = 1; i < r.length; i++) expect(haversineM(r[i - 1], r[i])).toBeLessThan(45);
  });
});
