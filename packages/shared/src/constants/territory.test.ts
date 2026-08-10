/**
 * territory.test.ts — formatArea threshold guard.
 *
 * The audit found TerritoryStats.tsx reimplementing area formatting inline
 * with a 1,000 m² threshold, while every other screen used this function's
 * 10,000 m² threshold — the same territory rendered "5.0k m²" on the
 * dashboard and "5,000 m²" everywhere else. TerritoryStats.tsx now imports
 * this function instead; these tests pin its exact thresholds so a future
 * change can't silently reintroduce that kind of cross-screen drift.
 */

import { describe, it, expect } from 'vitest';
import { formatArea } from './territory';

describe('formatArea', () => {
  it('shows raw m² under 10,000', () => {
    expect(formatArea(5000)).toBe('5,000 m²');
    expect(formatArea(9999)).toBe('9,999 m²');
  });

  it('switches to k m² at 10,000', () => {
    expect(formatArea(10_000)).toBe('10k m²');
    expect(formatArea(250_000)).toBe('250k m²');
  });

  it('switches to km² at 1,000,000', () => {
    expect(formatArea(1_000_000)).toBe('1.00 km²');
    expect(formatArea(2_500_000)).toBe('2.50 km²');
  });
});
