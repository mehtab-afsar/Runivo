import { describe, it, expect } from 'vitest';
import { hrZones, estimateMaxHr } from './hrZones';

describe('heart-rate zones', () => {
  it('estimates max from what was seen, with a fallback', () => {
    expect(estimateMaxHr([null, 172, 188, 250])).toBe(188);
    expect(estimateMaxHr([])).toBe(190);
  });
  it('puts time into zones by % of max', () => {
    // 10 min at 130 bpm (Z2 of 190: 68%), 5 min at 165 (Z4: 87%), sampled every 10 s.
    const pts = [
      ...Array.from({ length: 61 }, (_, i) => ({ timestamp: i * 10_000, hr: 130 })),
      ...Array.from({ length: 30 }, (_, i) => ({ timestamp: 610_000 + i * 10_000, hr: 165 })),
    ];
    const z = hrZones(pts, 190)!;
    expect(z[1].seconds).toBe(600);
    expect(z[3].seconds).toBeGreaterThanOrEqual(290);
    expect(z[0].seconds + z[2].seconds + z[4].seconds).toBe(0);
    expect(z[1].fromBpm).toBe(114);
    expect(z[4].toBpm).toBeNull();
  });
  it('returns nothing without heart rate', () => {
    expect(hrZones(Array.from({ length: 20 }, (_, i) => ({ timestamp: i * 1000 })), 190)).toBeNull();
  });
});
