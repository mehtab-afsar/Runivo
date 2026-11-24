import { describe, it, expect } from 'vitest';
import { haversineM } from '../../engine/runEngine';
import { uploadTrace } from './uploadTrace';

const pt = (lat: number, lng: number, i: number) => ({ lat, lng, timestamp: 1_000_000 + i * 1000, speed: 3, accuracy: 5, altitude: 0 });
// A dead-straight road north: one fix every ~10 m.
const straight = (n: number) => Array.from({ length: n }, (_, i) => pt(51 + i * 0.00009, 0, i));

describe('uploadTrace', () => {
  it('returns traces of two points or fewer untouched', () => {
    const two = straight(2);
    expect(uploadTrace(two)).toBe(two);
    expect(uploadTrace([])).toEqual([]);
  });

  it('keeps the first and last fix', () => {
    const t = straight(60);
    const out = uploadTrace(t);
    expect(out[0]).toBe(t[0]);
    expect(out[out.length - 1]).toBe(t[t.length - 1]);
  });

  it('keeps a point at least every 100 m on a straight road (the server needs 10 points per km)', () => {
    const t = straight(101);   // ~1 km
    const out = uploadTrace(t);
    expect(out.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < out.length; i++) {
      expect(haversineM(out[i - 1], out[i])).toBeLessThanOrEqual(110);
    }
  });

  it('keeps the corner of an L-shaped route', () => {
    const leg1 = Array.from({ length: 10 }, (_, i) => pt(51 + i * 0.00002, 0, i));
    const corner = leg1[leg1.length - 1];
    const leg2 = Array.from({ length: 10 }, (_, i) => pt(corner.lat, (i + 1) * 0.00002, 10 + i));
    const out = uploadTrace([...leg1, ...leg2]);
    expect(out.some(p => p.timestamp === corner.timestamp)).toBe(true);
  });
});
