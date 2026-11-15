import { describe, it, expect } from 'vitest';
import { safeRing, safeCenter, safeLine } from './geo';

describe('map guards', () => {
  it('closes an open ring and keeps a valid one', () => {
    expect(safeRing([[0, 0], [1, 0], [1, 1]])).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]]);
    expect(safeRing([[0, 0], [1, 0], [1, 1], [0, 0]])).toHaveLength(4);
  });
  it('drops NaN and out-of-range points, and rejects too-small rings', () => {
    expect(safeRing([[0, 0], [NaN, 1], [1, 1]])).toBeNull();
    expect(safeRing([[0, 0], [200, 1], [1, 1], [2, 2]])).toEqual([[0, 0], [1, 1], [2, 2], [0, 0]]);
    expect(safeRing(null)).toBeNull();
  });
  it('treats 0,0 and bad numbers as no camera position', () => {
    expect(safeCenter([0, 0])).toBeUndefined();
    expect(safeCenter([NaN, 12])).toBeUndefined();
    expect(safeCenter([77.6, 12.97])).toEqual([77.6, 12.97]);
  });
  it('needs two good points for a line', () => {
    expect(safeLine([[1, 1], [NaN, 2]])).toBeNull();
    expect(safeLine([[1, 1], [2, 2]])).toHaveLength(2);
  });
});
