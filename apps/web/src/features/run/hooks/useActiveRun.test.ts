/**
 * useActiveRun — integration tests
 *
 * Covers:
 *  - Initial state
 *  - startRun() registers GPS watcher
 *  - GPS points accumulate in state
 *  - Distance increases as positions arrive
 *  - Pace formatted correctly (non-zero after movement)
 *  - Teleport filter (>100m jump skipped)
 *  - Sub-metre jitter still recorded (trail density)
 *  - pauseRun / resumeRun toggle isPaused
 *  - finishRun returns gpsPoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveRun } from './useActiveRun';

// ── Mock useGameEngine so the hook doesn't need IndexedDB / Supabase ──────────
vi.mock('@shared/hooks/useGameEngine', () => ({
  useGameEngine: () => ({
    player: {
      id: 'player-1',
      username: 'TestRunner',
      level: 1,
      xp: 0,
      coins: 100,
      diamonds: 5,
      energy: 100,
      lastEnergyRegen: Date.now(),
      totalDistanceKm: 0,
      totalRuns: 0,
      totalTerritoriesClaimed: 0,
      totalEnemyCaptured: 0,
      streakDays: 0,
      lastRunDate: null,
      lastIncomeCollection: Date.now(),
      unlockedAchievements: [],
      createdAt: Date.now(),
    },
    loading: false,
    playerTerritoryCount: 0,
    claimState: null,
    sessionStats: { claimed: 0, xp: 0, coins: 0 },
    sessionEnergy: 100,
    startClaimEngine: vi.fn().mockResolvedValue(undefined),
    updateClaim: vi.fn(),
    onClaimEvent: vi.fn().mockReturnValue(() => {}),
    endRunSession: vi.fn().mockResolvedValue({
      territoriesClaimed: 0,
      xpEarned: 10,
      coinsEarned: 5,
      diamondsEarned: 0,
      leveledUp: false,
      preRunLevel: 1,
      newLevel: 1,
      newStreak: 1,
      completedMissions: [],
    }),
  }),
}));

// ── GPS helpers ───────────────────────────────────────────────────────────────

/** ~111m per 0.001 degree latitude at equator */
function latOffset(metres: number) {
  return metres / 111320;
}

interface FakeCoords {
  latitude: number;
  longitude: number;
  speed?: number;
  accuracy?: number;
}

function makePosition(coords: FakeCoords): GeolocationPosition {
  return {
    coords: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: null,
      accuracy: coords.accuracy ?? 10,
      altitudeAccuracy: null,
      heading: null,
      speed: coords.speed ?? 2.5,
    },
    timestamp: Date.now(),
  } as unknown as GeolocationPosition;
}

/** Fire successive GPS positions through the watchPosition success callback. */
async function firePositions(positions: FakeCoords[]) {
  const calls = (navigator.geolocation.watchPosition as ReturnType<typeof vi.fn>).mock.calls;
  const successCb = calls[calls.length - 1]?.[0] as ((p: GeolocationPosition) => void) | undefined;
  if (!successCb) throw new Error('watchPosition not called yet');
  for (const pos of positions) {
    await act(async () => { successCb(makePosition(pos)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

const BASE_LAT = 28.6139;
const BASE_LNG = 77.2090;

describe('useActiveRun', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date() });
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Initial state ────────────────────────────────────────────────────────
  it('has correct initial state', () => {
    const { result } = renderHook(() => useActiveRun());
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.distance).toBe(0);
    expect(result.current.pace).toBe('0:00');
    expect(result.current.gpsPoints).toHaveLength(0);
    expect(result.current.elapsed).toBe(0);
  });

  // ── 2. startRun registers GPS watcher ──────────────────────────────────────
  it('registers a GPS watcher after startRun()', async () => {
    const { result } = renderHook(() => useActiveRun());
    await act(async () => { await result.current.startRun(); });
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning).toBe(true);
  });

  // ── 3. GPS points accumulate ────────────────────────────────────────────────
  it('accumulates GPS points as positions arrive', async () => {
    const { result } = renderHook(() => useActiveRun());
    await act(async () => { await result.current.startRun(); });

    await firePositions([
      { latitude: BASE_LAT,                          longitude: BASE_LNG },
      { latitude: BASE_LAT + latOffset(50),          longitude: BASE_LNG },
      { latitude: BASE_LAT + latOffset(100),         longitude: BASE_LNG },
    ]);

    expect(result.current.gpsPoints.length).toBe(3);
  });

  // ── 4. Distance increases ───────────────────────────────────────────────────
  it('increments distance as the runner moves', async () => {
    const { result } = renderHook(() => useActiveRun());
    await act(async () => { await result.current.startRun(); });

    // Fire 3 positions ~50 m apart (< 100 m teleport filter, >= 1 m distance threshold)
    await firePositions([
      { latitude: BASE_LAT,                   longitude: BASE_LNG },
      { latitude: BASE_LAT + latOffset(50),   longitude: BASE_LNG },
      { latitude: BASE_LAT + latOffset(100),  longitude: BASE_LNG },
    ]);

    expect(result.current.distance).toBeGreaterThan(0);
  });

  // ── 5. Pace is formatted correctly ─────────────────────────────────────────
  it('computes a non-zero pace in MM:SS format after movement', async () => {
    const { result } = renderHook(() => useActiveRun());
    await act(async () => { await result.current.startRun(); });

    // Advance timer so elapsed > 0
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

    await firePositions([
      { latitude: BASE_LAT,                  longitude: BASE_LNG },
      { latitude: BASE_LAT + latOffset(50),  longitude: BASE_LNG },
      { latitude: BASE_LAT + latOffset(100), longitude: BASE_LNG },
    ]);

    expect(result.current.pace).not.toBe('0:00');
    expect(result.current.pace).toMatch(/^\d+:\d{2}$/);
  });

  // ── 6. Teleport filter (>100m jump dropped) ─────────────────────────────────
  it('drops a GPS teleport (>100m jump) and keeps only valid points', async () => {
    const { result } = renderHook(() => useActiveRun());
    await act(async () => { await result.current.startRun(); });

    await firePositions([
      { latitude: BASE_LAT,                     longitude: BASE_LNG },          // valid
      { latitude: BASE_LAT + latOffset(50),     longitude: BASE_LNG },          // valid
      { latitude: BASE_LAT + latOffset(50000),  longitude: BASE_LNG },          // teleport — dropped
    ]);

    // Teleport point should be absent from gpsPoints
    expect(result.current.gpsPoints.length).toBe(2);
  });

  // ── 7. Sub-metre jitter still recorded (trail density) ─────────────────────
  it('records sub-metre jitter points for trail density', async () => {
    const { result } = renderHook(() => useActiveRun());
    await act(async () => { await result.current.startRun(); });

    await firePositions([
      { latitude: BASE_LAT,             longitude: BASE_LNG },
      { latitude: BASE_LAT + 0.000001, longitude: BASE_LNG }, // ~0.11m
    ]);

    expect(result.current.gpsPoints.length).toBe(2);
  });

  // ── 8. pauseRun / resumeRun ─────────────────────────────────────────────────
  it('toggles isPaused correctly', async () => {
    const { result } = renderHook(() => useActiveRun());
    await act(async () => { await result.current.startRun(); });

    act(() => result.current.pauseRun());
    expect(result.current.isPaused).toBe(true);

    act(() => result.current.resumeRun());
    expect(result.current.isPaused).toBe(false);
  });

  // ── 9. finishRun returns gpsPoints ─────────────────────────────────────────
  it('finishRun() returns an object with gpsPoints', async () => {
    const { result } = renderHook(() => useActiveRun());
    await act(async () => { await result.current.startRun(); });

    await firePositions([
      { latitude: BASE_LAT,                  longitude: BASE_LNG },
      { latitude: BASE_LAT + latOffset(100), longitude: BASE_LNG },
    ]);

    let finishResult: Awaited<ReturnType<typeof result.current.finishRun>>;
    await act(async () => {
      finishResult = await result.current.finishRun();
    });

    expect(finishResult!).toBeDefined();
    expect(Array.isArray(finishResult!.gpsPoints)).toBe(true);
    expect(finishResult!.gpsPoints.length).toBeGreaterThan(0);
  });
});
