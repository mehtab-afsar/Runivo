/**
 * store.test.ts — Unit tests for IndexedDB helpers.
 *
 * Each test suite resets the module so a fresh IDBFactory + fresh dbInstance
 * is created per suite, giving proper isolation without polluting global state.
 */

import { describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// Reset IDB + module cache before every suite block
async function freshStore() {
  // Point the global indexedDB at a brand-new in-memory factory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  // Force vitest to re-import the module so `dbInstance` is null again
  vi.resetModules();
  return import('./store');
}

// ── localDateString ───────────────────────────────────────────────────────────

describe('localDateString', async () => {
  const { localDateString } = await freshStore();

  it('formats a date as YYYY-MM-DD', () => {
    expect(localDateString(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(localDateString(new Date(2024, 8, 3))).toBe('2024-09-03');
  });
});

// ── runs ──────────────────────────────────────────────────────────────────────

describe('store — runs', async () => {
  const { saveRun, getRuns, getRunsSince, getRunById } = await freshStore();

  function makeRun(overrides = {}) {
    return {
      id: crypto.randomUUID(), activityType: 'run', startTime: Date.now(),
      endTime: Date.now() + 1800_000, distanceMeters: 5000, durationSec: 1800,
      avgPace: '6:00', gpsPoints: [], territoriesClaimed: [], territoriesFortified: [],
      xpEarned: 150, coinsEarned: 25, diamondsEarned: 0, enemyCaptured: 0,
      preRunLevel: 1, synced: false, ...overrides,
    };
  }

  it('saves and retrieves a run by id', async () => {
    const run = makeRun();
    await saveRun(run as never);
    const found = await getRunById(run.id);
    expect(found?.id).toBe(run.id);
    expect(found?.distanceMeters).toBe(5000);
  });

  it('returns undefined for non-existent run id', async () => {
    expect(await getRunById('no-such-id')).toBeUndefined();
  });

  it('getRuns returns newest first', async () => {
    const older = makeRun({ id: 'older', startTime: 1_000 });
    const newer = makeRun({ id: 'newer', startTime: 2_000 });
    await saveRun(older as never);
    await saveRun(newer as never);
    const runs = await getRuns();
    // Use findIndex to handle other runs already saved in this suite
    const newerIdx = runs.findIndex(r => r.id === 'newer');
    const olderIdx = runs.findIndex(r => r.id === 'older');
    expect(newerIdx).toBeGreaterThanOrEqual(0);
    expect(olderIdx).toBeGreaterThanOrEqual(0);
    expect(newerIdx).toBeLessThan(olderIdx);
  });

  it('getRuns respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await saveRun(makeRun({ startTime: i }) as never);
    }
    expect(await getRuns(3)).toHaveLength(3);
  });

  it('getRunsSince returns only runs after the given timestamp', async () => {
    await saveRun(makeRun({ id: 'old-r',  startTime: 1000 }) as never);
    await saveRun(makeRun({ id: 'new-r',  startTime: 9000 }) as never);
    const runs = await getRunsSince(5000);
    expect(runs.map(r => r.id)).toContain('new-r');
    expect(runs.map(r => r.id)).not.toContain('old-r');
  });
});

// ── player ────────────────────────────────────────────────────────────────────

describe('store — player (empty DB)', async () => {
  const { getPlayer } = await freshStore();

  it('getPlayer returns null when no player exists', async () => {
    expect(await getPlayer()).toBeNull();
  });
});

describe('store — player (with data)', async () => {
  const { savePlayer, getPlayer, initializePlayer } = await freshStore();

  it('savePlayer → getPlayer round-trips correctly', async () => {
    const player = {
      id: crypto.randomUUID(), username: 'Alice', level: 3, xp: 500,
      coins: 200, energy: 8, lastEnergyRegen: Date.now(),
      totalDistanceKm: 42, totalRuns: 5, totalTerritoriesClaimed: 3,
      totalEnemyCaptured: 1, streakDays: 7, lastRunDate: '2024-01-01',
      lastLoginBonusDate: null, unlockedAchievements: [], createdAt: Date.now(),
    };
    await savePlayer(player);
    const loaded = await getPlayer();
    expect(loaded?.username).toBe('Alice');
    expect(loaded?.level).toBe(3);
  });

  it('getPlayer backfills missing fields from old records', async () => {
    // A record missing the newer fields (simulate old schema).
    // id '!sparse' sorts before all UUID hex strings so getPlayer() returns it first.
    const sparse = {
      id: '!sparse', username: 'OldUser', level: 1, xp: 0, coins: 0,
      diamonds: 0, energy: 100, lastEnergyRegen: 0, totalDistanceKm: 0,
      totalRuns: 0, totalTerritoriesClaimed: 0, streakDays: 0,
      lastRunDate: null, createdAt: 0,
    };
    await savePlayer(sparse as never);
    const p = await getPlayer();
    expect(p?.totalEnemyCaptured).toBe(0);
    expect(p?.unlockedAchievements).toEqual([]);
    expect(p?.lastLoginBonusDate === null || typeof p?.lastLoginBonusDate === 'string').toBe(true);
  });

  it('initializePlayer creates a player with the given username', async () => {
    const p = await initializePlayer('Bob');
    expect(p.username).toBe('Bob');
    expect(p.level).toBe(1);
    expect(p.coins).toBe(100);
  });
});

// ── pending actions ───────────────────────────────────────────────────────────

describe('store — pending actions', async () => {
  const { queueAction, getPendingActions, clearPendingAction } = await freshStore();

  it('queueAction → getPendingActions returns the action', async () => {
    await queueAction({
      type: 'claim', territoryId: 'hex-abc',
      timestamp: 1000, gpsProof: [{ lat: 51.5, lng: -0.1, timestamp: 1000 }],
    });
    const actions = await getPendingActions();
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions.some(a => a.territoryId === 'hex-abc')).toBe(true);
  });

  it('clearPendingAction removes the specific action', async () => {
    await queueAction({
      type: 'fortify', territoryId: 'hex-xyz', timestamp: 2000, gpsProof: [],
    });
    const before = await getPendingActions();
    const target = before.find(a => a.territoryId === 'hex-xyz')!;
    expect(target).toBeDefined();
    await clearPendingAction(target.id);
    const after = await getPendingActions();
    expect(after.some(a => a.territoryId === 'hex-xyz')).toBe(false);
  });
});

// ── settings ──────────────────────────────────────────────────────────────────

describe('store — settings', async () => {
  const { getSettings, saveSettings, DEFAULT_SETTINGS } = await freshStore();

  it('returns DEFAULT_SETTINGS when nothing has been saved', async () => {
    const s = await getSettings();
    expect(s.distanceUnit).toBe(DEFAULT_SETTINGS.distanceUnit);
    expect(s.darkMode).toBe(DEFAULT_SETTINGS.darkMode);
  });

  it('saveSettings → getSettings round-trips', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, distanceUnit: 'mi', darkMode: true });
    const s = await getSettings();
    expect(s.distanceUnit).toBe('mi');
    expect(s.darkMode).toBe(true);
  });
});

// ── nutrition ─────────────────────────────────────────────────────────────────

describe('store — nutrition', async () => {
  const {
    addNutritionEntry, getNutritionEntries,
    saveNutritionProfile, getNutritionProfile,
    localDateString,
  } = await freshStore();

  it('addNutritionEntry → getNutritionEntries returns the entry', async () => {
    const today = localDateString();
    const id = await addNutritionEntry({
      date: today, meal: 'lunch', name: 'Banana',
      kcal: 90, proteinG: 1, carbsG: 23, fatG: 0,
      servingSize: '1 medium', source: 'manual',
      xpAwarded: false, loggedAt: Date.now(),
    });
    expect(id).toBeGreaterThan(0);
    const entries = await getNutritionEntries(today);
    expect(entries.some(e => e.name === 'Banana')).toBe(true);
  });

  it('getNutritionEntries returns empty array for a date with no entries', async () => {
    expect(await getNutritionEntries('2000-01-01')).toEqual([]);
  });

  it('saveNutritionProfile → getNutritionProfile round-trips', async () => {
    await saveNutritionProfile({
      id: 'profile', goal: 'maintain', activityLevel: 'moderate',
      diet: 'everything', weightKg: 75, heightCm: 175, age: 30,
      sex: 'male', dailyGoalKcal: 2400, proteinGoalG: 150,
      carbsGoalG: 300, fatGoalG: 80,
    });
    const p = await getNutritionProfile();
    expect(p?.dailyGoalKcal).toBe(2400);
  });
});

// ── idbSafe — QuotaExceededError recovery ────────────────────────────────────

describe('store — idbSafe quota error recovery', async () => {
  const { getDB, savePlayer, initializePlayer } = await freshStore();

  it('dispatches runivo:storage-full without throwing on QuotaExceededError', async () => {
    const player = await initializePlayer('QuotaTest');
    const db = await getDB();

    const quota = new DOMException('Storage full', 'QuotaExceededError');
    const origPut = db.put.bind(db);
    vi.spyOn(db, 'put').mockRejectedValueOnce(quota);

    const eventSpy = vi.fn();
    window.addEventListener('runivo:storage-full', eventSpy);

    await expect(savePlayer(player)).resolves.not.toThrow();

    window.removeEventListener('runivo:storage-full', eventSpy);
    expect(eventSpy).toHaveBeenCalled();

    db.put = origPut;
    vi.restoreAllMocks();
  });
});
