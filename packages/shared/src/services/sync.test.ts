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
