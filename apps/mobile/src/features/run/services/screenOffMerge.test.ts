import { describe, it, expect } from 'vitest';
import { freshScreenOffFixes, type BufferedFix } from './screenOffMerge';

const track = (startTs: number): BufferedFix[] =>
  Array.from({ length: 10 }, (_, i) => ({ lat: 12.97 + i * 0.00009, lng: 77.59, speed: 3, accuracy: 5, timestamp: startTs + i * 3000 }));

describe('freshScreenOffFixes', () => {
  it('drops what the live watcher already recorded (iOS: both saw the same fixes)', () => {
    const fixes = track(1000);
    expect(freshScreenOffFixes(fixes[9].timestamp, fixes)).toHaveLength(0);
  });
  it('keeps every fix after the last recorded one (Android)', () => {
    expect(freshScreenOffFixes(9_000, track(10_000))).toHaveLength(10);
  });
  it('keeps only the tail when the watcher stopped part-way, in time order', () => {
    const fixes = track(1000);
    const out = freshScreenOffFixes(fixes[5].timestamp, [...fixes].reverse());
    expect(out.map(f => f.timestamp)).toEqual(fixes.slice(6).map(f => f.timestamp));
  });
});
