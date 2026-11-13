import { describe, it, expect } from 'vitest';
import { loopAt, planLoop, type LoopZone } from './planLoop';
import { haversineM } from './runEngine';

const start = { lat: 12.97, lng: 77.59 };
const sq = (lat: number, lng: number, d = 0.002): [number, number][] => [[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]];
const perimeter = (pts: { lat: number; lng: number }[]) => pts.slice(1).reduce((s, p, i) => s + haversineM(pts[i], p), 0);

describe('planLoop', () => {
  it('builds a closed loop of about the asked length from the start', () => {
    const pts = loopAt(start, 3000, 0);
    expect(pts[0]).toEqual(start);
    expect(pts[pts.length - 1]).toEqual(start);
    expect(perimeter(pts)).toBeGreaterThan(2900);
    expect(perimeter(pts)).toBeLessThan(3050);
    // heading 0: the loop lies north of the start
    expect(Math.max(...pts.map(p => p.lat))).toBeGreaterThan(start.lat + 0.008);
  });

  it('turns toward fading zones in refresh mode', () => {
    // A fading zone ~950 m east of start: the 3 km loop's far side.
    const east: LoopZone = { ring: sq(12.969, 77.598), fading: true };
    const plan = planLoop(start, 3000, 'refresh', [east]);
    expect(plan.refreshes).toBe(1);
    expect(plan.heading).toBeGreaterThanOrEqual(60);
    expect(plan.heading).toBeLessThanOrEqual(120);
  });

  it('avoids ground you hold in new-ground mode', () => {
    // You hold a big block north of the start.
    const north: LoopZone = { ring: [[77.585, 12.97], [77.595, 12.97], [77.595, 12.985], [77.585, 12.985], [77.585, 12.97]], fading: false };
    const plan = planLoop(start, 3000, 'new', [north]);
    expect(plan.newShare).toBeGreaterThan(0.9);
    expect(plan.heading).toBeGreaterThanOrEqual(90);
    expect(plan.heading).toBeLessThanOrEqual(270);
  });
});

describe('suggestedLoopKm', () => {
  it('sizes the loop to reach the nearest fading zone', async () => {
    const { suggestedLoopKm } = await import('./planLoop');
    expect(suggestedLoopKm(null)).toBe(3);
    expect(suggestedLoopKm(300)).toBe(2);
    expect(suggestedLoopKm(1500)).toBe(4);
    expect(suggestedLoopKm(9000)).toBe(8);
  });
});
