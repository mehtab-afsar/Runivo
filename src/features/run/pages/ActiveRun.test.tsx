/**
 * ActiveRun — component integration tests
 *
 * Covers:
 *  - Map is instantiated
 *  - Ghost trail layer rendered when ghostRoute passed in state
 *  - Ghost trail NOT rendered without ghostRoute
 *  - Calories display (distance * 88 kcal)
 *  - Finish confirm dialog: open, cancel, and confirm flow
 *  - Start dot + route line layer creation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import ActiveRun from './ActiveRun';

// ── Mock useActiveRun ─────────────────────────────────────────────────────────
const mockStartRun = vi.fn().mockResolvedValue(undefined);
const mockPauseRun = vi.fn();
const mockResumeRun = vi.fn();
const mockFinishRun = vi.fn();

let mockIsRunning = false;
let mockDistance = 0;
let mockGpsPoints: { lat: number; lng: number; timestamp: number; speed: number; accuracy: number }[] = [];

vi.mock('@features/run/hooks/useActiveRun', () => ({
  useActiveRun: () => ({
    isRunning: mockIsRunning,
    isPaused: false,
    elapsed: 30,
    distance: mockDistance,
    pace: '5:00',
    currentSpeed: 2,
    gpsPoints: mockGpsPoints,
    claimProgress: 0,
    territoriesClaimed: 0,
    lastClaimEvent: null,
    energyBlocked: false,
    startRun: mockStartRun,
    pauseRun: mockPauseRun,
    resumeRun: mockResumeRun,
    finishRun: mockFinishRun,
    player: null,
    sessionStats: { claimed: 0, xp: 0, coins: 0 },
    sessionEnergy: 100,
  }),
}));

// ── Mock dependencies ─────────────────────────────────────────────────────────
vi.mock('@shared/services/sync', () => ({
  postRunSync: vi.fn().mockResolvedValue(undefined),
  createFeedPost: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@shared/services/store', () => ({
  getAllTerritories: vi.fn().mockResolvedValue([]),
}));
vi.mock('@features/territory/services/territoryLayer', () => ({
  addTerritoryOverlay: vi.fn(),
  updateTerritoryData: vi.fn(),
}));
vi.mock('@features/run/components/FirstRunGuide', () => ({
  FirstRunGuide: () => null,
}));
vi.mock('@shared/ui/AnimatedCounter', () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderActiveRun(state: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/active-run', state }]}>
      <Routes>
        <Route path="/active-run" element={<ActiveRun />} />
        <Route path="/run-summary/:runId" element={<div>Summary</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Get the most recently created MapLibre Map mock instance.
 * The Map constructor is a vi.fn() in setup.ts — its return values
 * are stored in .mock.results.
 */
function getLastMapInstance() {
  // maplibregl is the default export { Map, Marker, ... }
  const MapCtor = (maplibregl as unknown as { Map: { mock: { results: { value: unknown }[] } } }).Map;
  if (!MapCtor) throw new Error('maplibregl.Map mock not found');
  const results = MapCtor.mock.results;
  if (results.length === 0) throw new Error('maplibregl.Map not called');
  return results[results.length - 1].value as {
    on: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    addLayer: ReturnType<typeof vi.fn>;
    getSource: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
  };
}

/** Fire the map 'load' callback and flush all resulting state updates. */
async function fireMapLoad() {
  const map = getLastMapInstance();
  const loadCb = map.on.mock.calls.find((c: unknown[]) => c[0] === 'load');
  if (!loadCb) throw new Error("map.on('load') not registered");
  await act(async () => { await loadCb[1](); });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ActiveRun', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIsRunning = false;
    mockDistance = 0;
    mockGpsPoints = [];
    mockFinishRun.mockResolvedValue({
      runId: 'run-abc',
      distance: 1,
      elapsed: 600,
      pace: '10:00',
      gpsPoints: [{ lat: 28.6139, lng: 77.209, timestamp: Date.now(), speed: 2, accuracy: 10 }],
      territoriesClaimed: 0,
      xpEarned: 10,
      coinsEarned: 5,
      diamondsEarned: 0,
      leveledUp: false,
      preRunLevel: 1,
      newLevel: 1,
      newStreak: 1,
      completedMissions: [],
    });
  });
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  // ── 1. Map instantiated ────────────────────────────────────────────────────
  it('creates a MapLibre Map on mount', async () => {
    renderActiveRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const map = getLastMapInstance();
    expect(map).toBeDefined();
    expect(map.on).toHaveBeenCalledWith('load', expect.any(Function));
  });

  // ── 2. Ghost trail rendered when ghostRoute provided ──────────────────────
  it('adds ghost-route source and layer after map load when ghostRoute is in state', async () => {
    const ghostRoute = [
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.6200, lng: 77.2090 },
    ];

    renderActiveRun({ ghostRoute });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    await fireMapLoad();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    const map = getLastMapInstance();
    const sourceCalls = map.addSource.mock.calls.map((c: unknown[]) => c[0]);
    expect(sourceCalls).toContain('ghost-route');

    const layerIds = map.addLayer.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(layerIds).toContain('ghost-route-line');
  });

  // ── 3. Ghost trail NOT rendered without ghostRoute ────────────────────────
  it('does NOT add ghost-route layers when ghostRoute is absent', async () => {
    renderActiveRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    await fireMapLoad();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    const map = getLastMapInstance();
    const sourceCalls = map.addSource.mock.calls.map((c: unknown[]) => c[0]);
    expect(sourceCalls).not.toContain('ghost-route');
  });

  // ── 4. Start dot after first GPS point ────────────────────────────────────
  it('adds start-point source and start-dot layer once gpsPoints has >= 1 point', async () => {
    mockGpsPoints = [
      { lat: 28.6139, lng: 77.2090, timestamp: Date.now(), speed: 2, accuracy: 10 },
    ];

    renderActiveRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    await fireMapLoad();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });

    const map = getLastMapInstance();
    const sourceCalls = map.addSource.mock.calls.map((c: unknown[]) => c[0]);
    expect(sourceCalls).toContain('start-point');

    const layerIds = map.addLayer.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(layerIds).toContain('start-dot');
  });

  // ── 5. Route line after second GPS point ──────────────────────────────────
  it('adds route source and route-line layer once gpsPoints has >= 2 points', async () => {
    mockGpsPoints = [
      { lat: 28.6139, lng: 77.2090, timestamp: Date.now(), speed: 2, accuracy: 10 },
      { lat: 28.6149, lng: 77.2090, timestamp: Date.now() + 1000, speed: 2, accuracy: 10 },
    ];

    renderActiveRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    await fireMapLoad();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });

    const map = getLastMapInstance();
    const sourceCalls = map.addSource.mock.calls.map((c: unknown[]) => c[0]);
    expect(sourceCalls).toContain('route');

    const layerIds = map.addLayer.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(layerIds).toContain('route-line');
    expect(layerIds).toContain('route-glow');
  });

  // ── 6. Route NOT created with only 1 GPS point ────────────────────────────
  it('does NOT add route source with only 1 GPS point', async () => {
    mockGpsPoints = [
      { lat: 28.6139, lng: 77.2090, timestamp: Date.now(), speed: 2, accuracy: 10 },
    ];

    renderActiveRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    await fireMapLoad();
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });

    const map = getLastMapInstance();
    const sourceCalls = map.addSource.mock.calls.map((c: unknown[]) => c[0]);
    expect(sourceCalls).not.toContain('route');
  });

  // ── 7. Calories display ───────────────────────────────────────────────────
  it('displays calories as Math.round(distance * 88) kcal', () => {
    mockDistance = 2;
    renderActiveRun();
    const expected = Math.round(2 * 88); // 176
    expect(screen.getByText(expected.toString())).toBeInTheDocument();
  });

  // ── 8. Finish confirm dialog — open and cancel ────────────────────────────
  it('shows finish dialog on stop press, closes on Continue', async () => {
    mockIsRunning = true;
    renderActiveRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    // The red stop square button
    const stopBtn = document.querySelector('[class*="bg-red-50"]') as HTMLElement;
    expect(stopBtn).toBeTruthy();
    await act(async () => { fireEvent.click(stopBtn); });

    expect(screen.getByText('Finish Run?')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });

    expect(screen.queryByText('Finish Run?')).not.toBeInTheDocument();
  });

  // ── 9. Confirm finish calls finishRun ─────────────────────────────────────
  it('calls finishRun() when Finish is confirmed', async () => {
    mockIsRunning = true;
    renderActiveRun();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    const stopBtn = document.querySelector('[class*="bg-red-50"]') as HTMLElement;
    expect(stopBtn).toBeTruthy();
    await act(async () => { fireEvent.click(stopBtn); });

    expect(screen.getByText('Finish Run?')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^finish$/i }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });

    expect(mockFinishRun).toHaveBeenCalledOnce();
  });
});
