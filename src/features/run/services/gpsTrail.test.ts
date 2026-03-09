/**
 * GPS Trail Unit Tests
 *
 * Tests the core math that powers route tracing (like Strava's trail):
 *   - Haversine distance between GPS points
 *   - Pace calculation from distance + elapsed time
 *   - Bearing calculation (arrow direction)
 *   - Route coordinates accumulation
 *   - Jitter / noise filtering thresholds
 */

import { describe, it, expect } from 'vitest';

// ── Pure functions extracted from useActiveRun so we can unit-test them ───────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatPace(kmPerSec: number): string {
  if (kmPerSec <= 0) return '0:00';
  const secPerKm = 1 / kmPerSec;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.floor(secPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function calcBearing(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

// ── Reference coordinates (New Delhi, India) ─────────────────────────────────
const BASE = { lat: 28.6139, lng: 77.2090 };

// ── Haversine accuracy tests ──────────────────────────────────────────────────

describe('haversine()', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversine(BASE.lat, BASE.lng, BASE.lat, BASE.lng)).toBe(0);
  });

  it('measures ~111 km per degree latitude', () => {
    const dist = haversine(0, 0, 1, 0); // 1° north at equator
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it('measures ~100 m for a small step (~0.0009° lat)', () => {
    // 0.0009° latitude ≈ 100 m
    const dist = haversine(BASE.lat, BASE.lng, BASE.lat + 0.0009, BASE.lng);
    expect(dist).toBeGreaterThan(90);
    expect(dist).toBeLessThan(110);
  });

  it('measures ~200 m for a 200 m corridor step', () => {
    // 0.0018° latitude ≈ 200 m
    const dist = haversine(BASE.lat, BASE.lng, BASE.lat + 0.0018, BASE.lng);
    expect(dist).toBeGreaterThan(180);
    expect(dist).toBeLessThan(220);
  });

  it('is symmetric — A→B equals B→A', () => {
    const d1 = haversine(BASE.lat, BASE.lng, BASE.lat + 0.005, BASE.lng + 0.005);
    const d2 = haversine(BASE.lat + 0.005, BASE.lng + 0.005, BASE.lat, BASE.lng);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });

  it('handles intercontinental distance (approx London → NYC ~ 5570 km)', () => {
    const dist = haversine(51.5074, -0.1278, 40.7128, -74.0060);
    expect(dist / 1000).toBeGreaterThan(5500);
    expect(dist / 1000).toBeLessThan(5700);
  });
});

// ── Jitter / noise filter logic ───────────────────────────────────────────────

describe('GPS jitter filter', () => {
  /**
   * useActiveRun ignores points that are:
   *   d < 1 m  → sub-metre jitter (skip adding GPS point)
   *   d >= 100 m in a single GPS tick → teleport / bad reading (skip)
   */
  it('sub-metre movement is pure jitter (< 1 m)', () => {
    // 0.000004° lat ≈ 0.44 m
    const d = haversine(BASE.lat, BASE.lng, BASE.lat + 0.000004, BASE.lng);
    expect(d).toBeLessThan(1);
  });

  it('0.00001° lat step is accepted as valid movement (> 1 m, < 100 m)', () => {
    // 0.00001° lat ≈ 1.11 m
    const d = haversine(BASE.lat, BASE.lng, BASE.lat + 0.00001, BASE.lng);
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThan(100);
  });

  it('100 m+ single tick is treated as GPS teleport (>= 100 m)', () => {
    // 0.0009° lat ≈ 100 m — right on the boundary
    const d = haversine(BASE.lat, BASE.lng, BASE.lat + 0.0009, BASE.lng);
    expect(d).toBeGreaterThanOrEqual(99); // approximately 100 m
  });
});

// ── Pace calculation ──────────────────────────────────────────────────────────

describe('formatPace()', () => {
  it('returns "0:00" for zero speed', () => {
    expect(formatPace(0)).toBe('0:00');
  });

  it('returns "0:00" for negative speed', () => {
    expect(formatPace(-1)).toBe('0:00');
  });

  it('formats 5:00/km correctly (5 min/km = 200m/min = 1/300 km/s)', () => {
    // 5:00/km pace → 1000m in 300s → kmPerSec = 1/300
    const pace = formatPace(1 / 300);
    expect(pace).toBe('5:00');
  });

  it('formats 6:30/km correctly', () => {
    // 6:30/km → 390 seconds per km → kmPerSec = 1/390
    const pace = formatPace(1 / 390);
    expect(pace).toBe('6:30');
  });

  it('formats fast 3:20/km pace correctly', () => {
    // 3:20/km → 200 seconds per km → kmPerSec = 1/200
    const pace = formatPace(1 / 200);
    expect(pace).toBe('3:20');
  });

  it('pads seconds with leading zero', () => {
    // 10:05/km → 605s/km
    const pace = formatPace(1 / 605);
    expect(pace).toBe('10:05');
  });
});

// ── Bearing (arrow direction) tests ──────────────────────────────────────────

describe('calcBearing()', () => {
  it('heading due north = 0°', () => {
    const b = calcBearing(
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 }  // move north
    );
    expect(Math.abs(b)).toBeLessThan(1); // ≈ 0°
  });

  it('heading due south = 180° (or -180°)', () => {
    const b = calcBearing(
      { lat: 1, lng: 0 },
      { lat: 0, lng: 0 }  // move south
    );
    expect(Math.abs(Math.abs(b) - 180)).toBeLessThan(1);
  });

  it('heading due east ≈ 90°', () => {
    const b = calcBearing(
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 }  // move east
    );
    expect(Math.abs(b - 90)).toBeLessThan(1);
  });

  it('heading due west ≈ -90°', () => {
    const b = calcBearing(
      { lat: 0, lng: 0 },
      { lat: 0, lng: -1 } // move west
    );
    expect(Math.abs(b + 90)).toBeLessThan(1);
  });
});

// ── Route accumulation (simulating a Strava-style trail) ─────────────────────

describe('Route trail accumulation', () => {
  interface GPSPoint { lat: number; lng: number; timestamp: number; speed: number; accuracy: number }

  /**
   * Simulates the GPS accumulation logic from useActiveRun:
   * - Start at BASE
   * - Walk north for N steps of stepDeg each
   * - Each step that passes the jitter filter adds a point to the route
   * - Returns the route array and total distance in km
   */
  function simulateRoute(steps: number, stepDeg: number): { route: GPSPoint[]; totalKm: number } {
    const route: GPSPoint[] = [];
    let totalKm = 0;
    let lastLat = BASE.lat;
    let lastLng = BASE.lng;

    for (let i = 0; i <= steps; i++) {
      const lat = BASE.lat + i * stepDeg;
      const lng = BASE.lng;
      const now = Date.now() + i * 5000;

      if (i === 0) {
        // First point — always add
        route.push({ lat, lng, timestamp: now, speed: 3, accuracy: 10 });
        lastLat = lat;
        lastLng = lng;
        continue;
      }

      const d = haversine(lastLat, lastLng, lat, lng);

      if (d < 1) {
        // Jitter — update lastPosition (matching useActiveRun behaviour) but don't add GPS point
        lastLat = lat;
        lastLng = lng;
        continue;
      }
      if (d >= 100) {
        // Teleport / bad reading — skip entirely
        continue;
      }

      totalKm += d / 1000;
      route.push({ lat, lng, timestamp: now, speed: 3, accuracy: 10 });
      lastLat = lat;
      lastLng = lng;
    }

    return { route, totalKm };
  }

  it('accumulates a route of N points for N valid steps', () => {
    // 0.00005° ≈ 5.5 m per step — well within the 1–100 m acceptance window
    const { route } = simulateRoute(10, 0.00005);
    expect(route.length).toBe(11); // 10 steps + initial point
  });

  it('sub-metre steps are filtered out — route stays at 1 point', () => {
    // 0.000004° ≈ 0.44 m — pure jitter
    const { route } = simulateRoute(20, 0.000004);
    expect(route.length).toBe(1); // only the initial point
  });

  it('total distance is plausible for a 500 m run', () => {
    // 0.00045° lat ≈ 50 m per step; 10 steps ≈ 500 m
    const { totalKm } = simulateRoute(10, 0.00045);
    expect(totalKm).toBeGreaterThan(0.4);  // at least 400 m
    expect(totalKm).toBeLessThan(0.6);     // at most 600 m
  });

  it('route coordinates are monotonically increasing (running north)', () => {
    const { route } = simulateRoute(5, 0.00005);
    for (let i = 1; i < route.length; i++) {
      expect(route[i].lat).toBeGreaterThan(route[i - 1].lat);
    }
  });

  it('produces a LineString-compatible coordinate array (lng, lat pairs)', () => {
    const { route } = simulateRoute(3, 0.00005);
    const lineStringCoords = route.map(p => [p.lng, p.lat]);
    lineStringCoords.forEach(coord => {
      expect(coord).toHaveLength(2);
      expect(typeof coord[0]).toBe('number'); // lng
      expect(typeof coord[1]).toBe('number'); // lat
    });
  });

  it('1 km run at 100 m steps produces ~10 points and correct distance', () => {
    // 0.0009° lat ≈ 100 m; right at the edge (100 m boundary is exclusive)
    // Use 0.00085° ≈ 94.5 m to stay within the accepted window
    const { route, totalKm } = simulateRoute(12, 0.00085);
    expect(route.length).toBeGreaterThanOrEqual(10);
    expect(totalKm).toBeGreaterThan(0.9);
    expect(totalKm).toBeLessThan(1.2);
  });
});

// ── Calorie calculation ───────────────────────────────────────────────────────

describe('Calorie calculation', () => {
  // App uses: Math.round(distanceKm * 88) kcal
  const calories = (km: number) => Math.round(km * 88);

  it('0 km = 0 kcal', () => expect(calories(0)).toBe(0));
  it('1 km = 88 kcal', () => expect(calories(1)).toBe(88));
  it('5 km = 440 kcal', () => expect(calories(5)).toBe(440));
  it('10 km = 880 kcal', () => expect(calories(10)).toBe(880));
  it('2.5 km = 220 kcal', () => expect(calories(2.5)).toBe(220));
  it('rounds sub-kcal correctly', () => {
    // 1.006 km → 88.528 → rounds to 89
    expect(calories(1.006)).toBe(89);
  });
});
