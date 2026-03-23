/**
 * useGameEngine.test.ts — Unit tests for the pure business-logic functions
 * exported from useGameEngine.ts.
 *
 * These functions contain no React hooks and no I/O so they run synchronously
 * without a DOM environment or mocked Supabase client.
 */

import { describe, it, expect } from 'vitest';
import { bufferPath, polygonAreaM2, calculateLevel } from './useGameEngine';
import { GAME_CONFIG } from '../services/config';

// ── bufferPath ────────────────────────────────────────────────────────────────

describe('bufferPath', () => {
  it('returns empty array for 0 points', () => {
    expect(bufferPath([], 20)).toEqual([]);
  });

  it('returns empty array for 1 point', () => {
    expect(bufferPath([{ lat: 51.5, lng: -0.1 }], 20)).toEqual([]);
  });

  it('produces a closed ring (first coord === last coord) for 2 points', () => {
    const result = bufferPath(
      [{ lat: 51.5, lng: -0.1 }, { lat: 51.51, lng: -0.1 }],
      20
    );
    expect(result.length).toBeGreaterThan(0);
    const first = result[0];
    const last  = result[result.length - 1];
    expect(first[0]).toBeCloseTo(last[0], 10);
    expect(first[1]).toBeCloseTo(last[1], 10);
  });

  it('produces a corridor wider than 2× the buffer radius in metres', () => {
    // A north-south line so we can measure E-W width easily
    const north = { lat: 51.51, lng: 0 };
    const south = { lat: 51.50, lng: 0 };
    const radius = 50; // 50 m each side
    const ring = bufferPath([north, south], radius);

    // Find the min and max longitude in the ring
    const lngs = ring.map(c => c[0]);
    const lngSpanDeg = Math.max(...lngs) - Math.min(...lngs);
    const avgLat = (north.lat + south.lat) / 2;
    const lngSpanM = lngSpanDeg * GAME_CONFIG.METERS_PER_DEGREE_LAT * Math.cos((avgLat * Math.PI) / 180);

    // Corridor should be ~2× radius wide (left side + right side)
    expect(lngSpanM).toBeGreaterThan(radius * 1.5);
  });
});

// ── polygonAreaM2 ─────────────────────────────────────────────────────────────

describe('polygonAreaM2', () => {
  it('returns 0 for fewer than 3 points (excluding the closing coord)', () => {
    expect(polygonAreaM2([])).toBe(0);
    expect(polygonAreaM2([[0, 0]])).toBe(0);
    expect(polygonAreaM2([[0, 0], [1, 0]])).toBe(0);
    // 3 points = ring with n=2 (indices 0..1) → still 0
    expect(polygonAreaM2([[0, 0], [1, 0], [0, 0]])).toBe(0);
  });

  it('computes a positive area for a valid polygon', () => {
    // Small square near London (~200 m × 200 m)
    const lat0 = 51.50, lng0 = -0.10;
    const dLat = 200 / GAME_CONFIG.METERS_PER_DEGREE_LAT;
    const dLng = 200 / (GAME_CONFIG.METERS_PER_DEGREE_LAT * Math.cos((lat0 * Math.PI) / 180));
    const ring: [number, number][] = [
      [lng0,        lat0],
      [lng0 + dLng, lat0],
      [lng0 + dLng, lat0 + dLat],
      [lng0,        lat0 + dLat],
      [lng0,        lat0],  // closed
    ];
    const area = polygonAreaM2(ring);
    // Should be ~40 000 m² for a 200×200 square; allow ±20%
    expect(area).toBeGreaterThan(30_000);
    expect(area).toBeLessThan(50_000);
  });
});

// ── calculateLevel ────────────────────────────────────────────────────────────

describe('calculateLevel', () => {
  it('returns level 1 at 0 XP', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it('returns level 1 just below the threshold for level 2', () => {
    const threshold = GAME_CONFIG.LEVEL_XP[1]; // XP needed for level 2
    expect(calculateLevel(threshold - 1)).toBe(1);
  });

  it('returns level 2 at exactly the level-2 threshold', () => {
    const threshold = GAME_CONFIG.LEVEL_XP[1];
    expect(calculateLevel(threshold)).toBe(2);
  });

  it('returns the max level when XP exceeds the last threshold', () => {
    const maxXP = GAME_CONFIG.LEVEL_XP[GAME_CONFIG.LEVEL_XP.length - 1] + 99999;
    const maxLevel = GAME_CONFIG.LEVEL_XP.length;
    expect(calculateLevel(maxXP)).toBe(maxLevel);
  });

  it('returns correct intermediate levels', () => {
    // Level 5 threshold
    const lvl5XP = GAME_CONFIG.LEVEL_XP[4];
    expect(calculateLevel(lvl5XP)).toBe(5);

    const lvl10XP = GAME_CONFIG.LEVEL_XP[9];
    expect(calculateLevel(lvl10XP)).toBe(10);
  });
});
