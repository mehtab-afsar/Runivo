import { describe, it, expect } from 'vitest';
import { loopAt } from '@shared/engine/planLoop';
import { parseOrs, parseOsrm, streetLoop, waypointsFor } from './loopRouting';

const start = { lat: 12.9716, lng: 77.5946 };
const circle = { points: loopAt(start, 3000, 90), heading: 90, lengthM: 3000, refreshes: 0, newShare: 1 };
const line = (n: number, scale = 0.01) => Array.from({ length: n }, (_, i) => [start.lng + scale * Math.cos(i), start.lat + scale * Math.sin(i)] as [number, number]);

describe('loopRouting', () => {
  it('spreads waypoints round the circle and closes at the start', () => {
    const w = waypointsFor(circle.points, 6);
    expect(w).toHaveLength(7);
    expect(w[0]).toEqual(w[6]);
  });

  it('reads OSRM and ORS responses, and rejects bad ones', () => {
    expect(parseOsrm({ code: 'Ok', routes: [{ distance: 3120, geometry: { coordinates: line(20) } }] })?.lengthM).toBe(3120);
    expect(parseOsrm({ code: 'NoRoute', routes: [] })).toBeNull();
    expect(parseOrs({ features: [{ geometry: { coordinates: line(30) }, properties: { summary: { distance: 2980 } } }] })?.points).toHaveLength(30);
    expect(parseOrs({ error: 'quota' })).toBeNull();
  });

  it('follows the streets the router returns, resizing once when the first try is too long', async () => {
    const lengths = [4200, 3100];
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: lengths.shift(), geometry: { coordinates: line(40) } }] }) };
    };
    const r = await streetLoop(circle, [], { fetchImpl });
    expect(calls).toHaveLength(2);
    expect(r?.lengthM).toBe(3100);
    expect(r?.points).toHaveLength(40);
  });

  it('uses the round-trip router when there is a key', async () => {
    let body = '';
    const fetchImpl = async (_url: string, init?: { body?: string }) => {
      body = init?.body ?? '';
      return { ok: true, json: async () => ({ features: [{ geometry: { coordinates: line(30) }, properties: { summary: { distance: 3010 } } }] }) };
    };
    const r = await streetLoop(circle, [], { orsKey: 'k', fetchImpl });
    expect(JSON.parse(body).options.round_trip.length).toBe(3000);
    expect(r?.lengthM).toBe(3010);
  });

  it('gives up quietly when the router is unreachable, so the circle stays', async () => {
    const r = await streetLoop(circle, [], { fetchImpl: async () => { throw new Error('offline'); } });
    expect(r).toBeNull();
  });
});
