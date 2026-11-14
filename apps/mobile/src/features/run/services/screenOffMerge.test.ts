import { describe, it, expect } from 'vitest';
import { screenOffAdditions, type BufferedFix } from './screenOffMerge';

// 10 fixes, 10 m apart going north, one per 3 s.
const track = (startTs: number, startLat = 12.97): BufferedFix[] =>
  Array.from({ length: 10 }, (_, i) => ({ lat: startLat + i * 0.00009, lng: 77.59, speed: 3, accuracy: 5, timestamp: startTs + i * 3000 }));

describe('screenOffAdditions', () => {
  it('adds nothing the live watcher already recorded (iOS: both saw the same fixes)', () => {
    const fixes = track(1000);
    const last = fixes[fixes.length - 1];
    const r = screenOffAdditions(last.timestamp, { lat: last.lat, lng: last.lng }, fixes);
    expect(r.fresh).toHaveLength(0);
    expect(r.addedKm).toBe(0);
  });

  it('adds every fix after the last recorded one (Android: watcher stopped in the background)', () => {
    const fixes = track(10_000);
    const r = screenOffAdditions(9_000, { lat: 12.97 - 0.00009, lng: 77.59 }, fixes);
    expect(r.fresh).toHaveLength(10);
    expect(r.addedKm).toBeCloseTo(0.1, 2); // 10 steps of ~10 m
    expect(r.lastPos).toEqual({ lat: fixes[9].lat, lng: fixes[9].lng });
  });

  it('adds only the tail when the watcher stopped part-way', () => {
    const fixes = track(1000);
    const r = screenOffAdditions(fixes[5].timestamp, { lat: fixes[5].lat, lng: fixes[5].lng }, fixes);
    expect(r.fresh.map(f => f.timestamp)).toEqual(fixes.slice(6).map(f => f.timestamp));
    expect(r.addedKm).toBeCloseTo(0.04, 2);
  });

  it('skips a 100 m+ jump but keeps going from it', () => {
    const fixes = track(1000);
    fixes[3] = { ...fixes[3], lat: fixes[3].lat + 0.01 }; // ~1 km off
    const r = screenOffAdditions(0, null, fixes);
    expect(r.addedKm).toBeLessThan(0.08);
  });
});
