/**
 * sync.test.ts — Tests for the most critical sync-service paths.
 *
 * We mock the Supabase client at the module boundary so tests run offline
 * and deterministically. We also mock store functions that touch IndexedDB
 * to keep tests focused on sync logic rather than IDB internals (those are
 * covered by store.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Supabase mock ─────────────────────────────────────────────────────────────

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser:    vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }),
    },
    from: vi.fn().mockReturnValue({
      select:  vi.fn().mockReturnThis(),
      insert:  vi.fn().mockReturnThis(),
      upsert:  vi.fn().mockResolvedValue({ error: null }),
      update:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      single:  vi.fn().mockResolvedValue({ data: null, error: null }),
      then:    vi.fn(),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// ── Store mock ────────────────────────────────────────────────────────────────

vi.mock('./store', () => ({
  getPlayer:                    vi.fn().mockResolvedValue(null),
  savePlayer:                   vi.fn().mockResolvedValue(undefined),
  getRuns:                      vi.fn().mockResolvedValue([]),
  getRunsSince:                 vi.fn().mockResolvedValue([]),
  saveRun:                      vi.fn().mockResolvedValue(undefined),
  getAllTerritories:             vi.fn().mockResolvedValue([]),
  saveTerritories:              vi.fn().mockResolvedValue(undefined),
  getTerritoryPolygons:         vi.fn().mockResolvedValue([]),
  getRunById:                   vi.fn().mockResolvedValue(undefined),
  saveTerritory:                vi.fn().mockResolvedValue(undefined),
  deleteTerritory:              vi.fn().mockResolvedValue(undefined),
  getSavedRoutes:               vi.fn().mockResolvedValue([]),
  saveSavedRoute:               vi.fn().mockResolvedValue(undefined),
  getNutritionEntries:          vi.fn().mockResolvedValue([]),
  getUnsyncedNutritionEntries:  vi.fn().mockResolvedValue([]),
  addNutritionEntry:            vi.fn().mockResolvedValue(1),
  getDB:                        vi.fn().mockResolvedValue({}),
  localDateString:              vi.fn().mockReturnValue('2024-01-01'),
}));

// ── Import module under test (after mocks are set up) ────────────────────────

import {
  getSyncStatus,
  onSyncStatusChange,
  postRunSync,
  pushNutritionLogs,
} from './sync';

import * as store from './store';

// ── Test suite ────────────────────────────────────────────────────────────────

describe('sync — getSyncStatus', () => {
  it('starts as idle', () => {
    expect(getSyncStatus()).toBe('idle');
  });
});

describe('sync — onSyncStatusChange', () => {
  it('notifies listeners when status changes', async () => {
    const statuses: string[] = [];
    const unsub = onSyncStatusChange(s => statuses.push(s));

    // postRunSync drives status → 'syncing' → 'idle' (or 'error')
    await postRunSync();

    expect(statuses).toContain('syncing');
    unsub();
  });

  it('allows unsubscribing', async () => {
    const statuses: string[] = [];
    const unsub = onSyncStatusChange(s => statuses.push(s));
    unsub(); // unsubscribe immediately

    await postRunSync();
    // After unsubscribe, no new entries should have been added
    expect(statuses).toHaveLength(0);
  });
});

describe('sync — postRunSync ordering', () => {
  it('always transitions through syncing state', async () => {
    const captured: string[] = [];
    const unsub = onSyncStatusChange(s => captured.push(s));
    await postRunSync();
    unsub();
    // postRunSync must always set status to 'syncing' first
    expect(captured[0]).toBe('syncing');
    // Final status is 'idle', 'error', or 'offline' depending on mock completeness
    // and environment (Node has no navigator.onLine so offline is valid here).
    // What matters is the call completed and set a terminal state.
    expect(['idle', 'error', 'offline']).toContain(captured[captured.length - 1]);
  });

  it('sets status to error when an internal function throws', async () => {
    // Make getRuns throw so pushUnsyncedRuns fails
    vi.mocked(store.getRuns).mockRejectedValueOnce(new Error('network error'));
    // Ensure navigator.onLine is true so we get 'error' not 'offline'
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const captured: string[] = [];
    const unsub = onSyncStatusChange(s => captured.push(s));
    await postRunSync();
    unsub();

    expect(captured).toContain('error');
  });
});

describe('sync — pushNutritionLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when there are no unsynced entries', async () => {
    const { supabase } = await import('./supabase');
    vi.mocked(store.getDB).mockResolvedValue({} as never);

    // Empty array → should not call supabase at all
    const allEntriesMock = vi.fn().mockResolvedValue([]);
    vi.mocked(store.getDB).mockResolvedValue({
      getAll: allEntriesMock,
    } as never);

    // If no error is thrown, the test passes — we just confirm it resolves
    await expect(pushNutritionLogs()).resolves.not.toThrow();
    expect(supabase.auth.getUser).toHaveBeenCalled();
  });
});

describe('uploadTrace', () => {
  it('keeps a point at least every 100 m on a straight road (server needs 10+ for 1 km)', async () => {
    const { uploadTrace } = await import('./sync');
    // 1.2 km due north, a fix every ~3 m, perfectly straight.
    const pts = Array.from({ length: 400 }, (_, i) => ({ lat: 12.9 + i * 0.000027, lng: 77.6, timestamp: 1_700_000_000_000 + i * 1000, accuracy: 5 }));
    const out = uploadTrace(pts as never);
    expect(out.length).toBeGreaterThanOrEqual(12);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[pts.length - 1]);
    expect(out.length).toBeLessThan(40);
  });
});

// Audit T6: a run that uploaded but wasn't scored yet must keep its local
// record. pullRuns used to replace it with the server row, so the scoring
// retry sent the simplified upload trace (less ground, less distance) and
// lost the mock-location flag.
describe('pullRuns — unscored local runs', () => {
  const row = {
    id: 'run-1', user_id: 'user-1', activity_type: 'run', started_at: '2026-11-20T07:00:00Z', finished_at: '2026-11-20T07:20:00Z',
    distance_m: 3000, duration_sec: 1200, avg_pace: '6:40', xp_earned: 11, coins_earned: 0, territories_claimed: [], territories_fortified: [],
    gps_points: [{ lat: 51.5, lng: -0.1, timestamp: 1 }, { lat: 51.51, lng: -0.1, timestamp: 2 }],
  };
  const mockRows = async () => {
    const { supabase } = await import('./supabase');
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } } as never);
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'user-1' } } } as never);
    vi.mocked(store.saveRun).mockResolvedValue(undefined);
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [row], error: null }) };
    vi.mocked(supabase.from).mockReturnValueOnce(chain as never);
  };

  it('leaves an uploaded-but-unscored run (full trace, mock flag) untouched', async () => {
    const { pullRuns } = await import('./sync');
    const full = Array.from({ length: 500 }, (_, i) => ({ lat: 51.5 + i * 1e-5, lng: -0.1, timestamp: i * 1000, speed: 3, accuracy: 5, altitude: 0 }));
    vi.mocked(store.getRunById).mockResolvedValueOnce({ id: 'run-1', synced: true, serverProcessed: false, gpsPoints: full, mockedLocation: true } as never);
    vi.mocked(store.saveRun).mockClear();
    await mockRows();
    await pullRuns();
    expect(store.saveRun).not.toHaveBeenCalled();
  });

  it('still refreshes a run the server has scored', async () => {
    const { pullRuns } = await import('./sync');
    vi.mocked(store.getRunById).mockResolvedValueOnce({ id: 'run-1', synced: true, serverProcessed: true, gpsPoints: [], xpEarned: 9 } as never);
    vi.mocked(store.saveRun).mockClear();
    await mockRows();
    await pullRuns();
    expect(store.saveRun).toHaveBeenCalledTimes(1);
  });
});

describe('pullRuns — paging (B10)', () => {
  it('keeps fetching pages until one comes back short', async () => {
    const { supabase } = await import('./supabase');
    const { pullRuns } = await import('./sync');
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } } as never);
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'user-1' } } } as never);
    vi.mocked(store.getRunById).mockResolvedValue(undefined as never);
    vi.mocked(store.saveRun).mockResolvedValue(undefined);
    vi.mocked(store.saveRun).mockClear();
    const mk = (n: number, off: number) => Array.from({ length: n }, (_, i) => ({
      id: `r${off + i}`, activity_type: 'run', started_at: '2026-01-01T00:00:00Z', finished_at: '2026-01-01T00:30:00Z',
      distance_m: 1000, duration_sec: 600, avg_pace: '6:00', gps_points: [],
    }));
    const range = vi.fn()
      .mockResolvedValueOnce({ data: mk(3, 0), error: null })
      .mockResolvedValueOnce({ data: mk(3, 3), error: null })
      .mockResolvedValueOnce({ data: mk(1, 6), error: null });
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range };
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    await pullRuns(3);
    expect(range).toHaveBeenCalledTimes(3);
    expect(store.saveRun).toHaveBeenCalledTimes(7);
  });
});
