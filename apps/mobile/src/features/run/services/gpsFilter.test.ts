import { describe, it, expect } from 'vitest';
import { addFixes, stepFor, MAX_FOOT_SPEED_MS, type Fix } from './gpsFilter';

const M = 1 / 111_320; // degrees latitude per metre
const at = (northM: number, t: number, accuracy = 5): Fix => ({ lat: 12.97 + northM * M, lng: 77.59, timestamp: t * 1000, accuracy });

describe('gpsFilter', () => {
  it('counts a steady run', () => {
    const fixes = Array.from({ length: 101 }, (_, i) => at(i * 3, i)); // 3 m/s for 100 s
    expect(addFixes({ base: null, outliers: 0 }, fixes, MAX_FOOT_SPEED_MS).addedM).toBeCloseTo(300, 0);
  });

  it('ignores a one-fix spike and measures on from the last good fix', () => {
    const fixes = [at(0, 0), at(3, 1), at(203, 2), at(9, 3), at(12, 4)];
    expect(addFixes({ base: null, outliers: 0 }, fixes, MAX_FOOT_SPEED_MS).addedM).toBeCloseTo(12, 0);
  });

  it('adds nothing for drift while standing still', () => {
    const fixes = Array.from({ length: 60 }, (_, i) => at(i % 2 ? 2.5 : 0, i, 8)); // ±2.5 m wander, 8 m accuracy
    expect(addFixes({ base: null, outliers: 0 }, fixes, MAX_FOOT_SPEED_MS).addedM).toBe(0);
  });

  it('still adds up a slow walk', () => {
    const fixes = Array.from({ length: 101 }, (_, i) => at(i * 1.2, i, 10)); // 1.2 m/s, 10 m accuracy
    const added = addFixes({ base: null, outliers: 0 }, fixes, MAX_FOOT_SPEED_MS).addedM;
    expect(added).toBeGreaterThan(110);
    expect(added).toBeLessThanOrEqual(121);
  });

  it('keeps the distance across a tunnel gap', () => {
    const fixes = [at(0, 0), at(3, 1), at(303, 61), at(306, 62)]; // 300 m over 60 s
    expect(addFixes({ base: null, outliers: 0 }, fixes, MAX_FOOT_SPEED_MS).addedM).toBeCloseTo(306, 0);
  });

  it('re-bases after three impossible jumps in a row (a real relocation)', () => {
    const fixes = [at(0, 0), at(5000, 1), at(5003, 2), at(5006, 3), at(5009, 4)];
    const r = addFixes({ base: null, outliers: 0 }, fixes, MAX_FOOT_SPEED_MS);
    expect(r.addedM).toBeCloseTo(3, 0);
    expect(stepFor(null, at(0, 0), MAX_FOOT_SPEED_MS).action).toBe('base');
  });
});
