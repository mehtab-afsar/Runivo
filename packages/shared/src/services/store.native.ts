/**
 * Native (expo-sqlite) implementation of the Runivo local data store.
 * Exports an identical API surface to store.ts (IDB/web version).
 * Metro automatically picks this file on iOS/Android; Vite picks store.ts on web.
 *
 * All imports from './store' are `import type` — erased at runtime — so there
 * is no circular dependency when Metro resolves './store' to this file.
 */
import * as SQLite from 'expo-sqlite';
import type {
  StoredPlayer,
  StoredRun,
  StoredTerritory,
  StoredSavedRoute,
  StoredShoe,
  NutritionProfile,
  NutritionEntry,
  StoredSettings,
  PendingAction,
} from './store';

// Re-export types so callers can import from either file without caring which.
export type {
  StoredPlayer,
  StoredRun,
  StoredTerritory,
  StoredSavedRoute,
  StoredShoe,
  NutritionProfile,
  NutritionEntry,
  StoredSettings,
  PendingAction,
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT_SETTINGS (duplicated to avoid a runtime import of store.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: StoredSettings = {
  id: 'settings',
  distanceUnit: 'km',
  darkMode: false,
  notificationsEnabled: true,
  announceAchievements: true,
  weeklySummary: true,
  soundEnabled: true,
  hapticEnabled: true,
  autoPause: true,
  gpsAccuracy: 'high',
  countdownSeconds: 3,
  dailyMissionsEnabled: true,
  missionDifficulty: 'mixed',
  weeklyGoalKm: 20,
  privacy: 'public',
  avatarColorId: 'teal',
  beatPacerEnabled: false,
  beatPacerPace: '5:00',
  beatPacerSound: 'click',
  beatPacerAccent: true,
  runReminders: true,
  territoryAlerts: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Date helper (identical to store.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// getDB shim — native uses SQLite directly; export so sync.ts can import it
// ─────────────────────────────────────────────────────────────────────────────

export async function getDB(): Promise<never> {
  throw new Error('[store.native] getDB() is not available on mobile — use typed helpers');
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const _db = SQLite.openDatabaseSync('runivo.db');
let _initialized = false;

export async function initDatabase(): Promise<void> {
  if (_initialized) return;
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS runs (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      synced     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs(start_time);
    CREATE INDEX IF NOT EXISTS idx_runs_synced     ON runs(synced);

    CREATE TABLE IF NOT EXISTS player (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS territories (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_actions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT NOT NULL,
      territory_id TEXT NOT NULL,
      timestamp    INTEGER NOT NULL,
      gps_proof    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_routes (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_profile (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      date      TEXT NOT NULL,
      data      TEXT NOT NULL,
      logged_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_nutrition_date ON nutrition_log(date);

    CREATE TABLE IF NOT EXISTS shoes (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS missions (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_missions_expires ON missions(expires_at);
  `);
  _initialized = true;
}

async function ready(): Promise<void> {
  if (!_initialized) await initDatabase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Player
// ─────────────────────────────────────────────────────────────────────────────

export async function getPlayer(): Promise<StoredPlayer | null> {
  await ready();
  const row = _db.getFirstSync<{ data: string }>('SELECT data FROM player LIMIT 1');
  if (!row) return null;
  const p = JSON.parse(row.data) as StoredPlayer;
  return {
    ...p,
    totalEnemyCaptured:  p.totalEnemyCaptured  ?? 0,
    unlockedAchievements: p.unlockedAchievements ?? [],
    lastLoginBonusDate:  p.lastLoginBonusDate  ?? null,
  };
}

export async function savePlayer(player: StoredPlayer): Promise<void> {
  await ready();
  _db.runSync(
    'INSERT OR REPLACE INTO player (id, data) VALUES (?, ?)',
    player.id,
    JSON.stringify(player),
  );
}

export async function initializePlayer(username: string): Promise<StoredPlayer> {
  const player: StoredPlayer = {
    id: crypto.randomUUID(),
    username,
    level: 1,
    xp: 0,
    coins: 100,
    energy: 10,
    lastEnergyRegen: Date.now(),
    totalDistanceKm: 0,
    totalRuns: 0,
    totalTerritoriesClaimed: 0,
    totalEnemyCaptured: 0,
    streakDays: 0,
    lastRunDate: null,
    lastLoginBonusDate: null,
    unlockedAchievements: [],
    createdAt: Date.now(),
  };
  await savePlayer(player);
  return player;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────────────────────

export async function saveRun(run: StoredRun): Promise<void> {
  await ready();
  _db.runSync(
    'INSERT OR REPLACE INTO runs (id, data, start_time, synced) VALUES (?, ?, ?, ?)',
    run.id,
    JSON.stringify(run),
    run.startTime,
    run.synced ? 1 : 0,
  );
}

export async function getRuns(limit?: number): Promise<StoredRun[]> {
  await ready();
  const rows = limit
    ? _db.getAllSync<{ data: string }>('SELECT data FROM runs ORDER BY start_time DESC LIMIT ?', limit)
    : _db.getAllSync<{ data: string }>('SELECT data FROM runs ORDER BY start_time DESC');
  return rows.map(r => JSON.parse(r.data) as StoredRun);
}

export async function getRunsSince(sinceMs: number): Promise<StoredRun[]> {
  await ready();
  const rows = _db.getAllSync<{ data: string }>(
    'SELECT data FROM runs WHERE start_time >= ? ORDER BY start_time DESC',
    sinceMs,
  );
  return rows.map(r => JSON.parse(r.data) as StoredRun);
}

export async function getRunById(id: string): Promise<StoredRun | undefined> {
  await ready();
  const row = _db.getFirstSync<{ data: string }>('SELECT data FROM runs WHERE id = ?', id);
  return row ? JSON.parse(row.data) as StoredRun : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Territories
// ─────────────────────────────────────────────────────────────────────────────

export async function saveTerritories(territories: StoredTerritory[]): Promise<void> {
  await ready();
  _db.withTransactionSync(() => {
    for (const t of territories) {
      _db.runSync(
        'INSERT OR REPLACE INTO territories (id, data) VALUES (?, ?)',
        t.id,
        JSON.stringify(t),
      );
    }
  });
}

export async function getTerritory(id: string): Promise<StoredTerritory | undefined> {
  await ready();
  const row = _db.getFirstSync<{ data: string }>('SELECT data FROM territories WHERE id = ?', id);
  return row ? JSON.parse(row.data) as StoredTerritory : undefined;
}

export async function getAllTerritories(): Promise<StoredTerritory[]> {
  await ready();
  const rows = _db.getAllSync<{ data: string }>('SELECT data FROM territories');
  return rows.map(r => JSON.parse(r.data) as StoredTerritory);
}

export async function getPlayerTerritoryIds(playerId: string): Promise<string[]> {
  const all = await getAllTerritories();
  return all.filter(t => t.ownerId === playerId).map(t => t.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending actions
// ─────────────────────────────────────────────────────────────────────────────

export async function queueAction(action: {
  type: 'claim' | 'fortify';
  territoryId: string;
  timestamp: number;
  gpsProof: { lat: number; lng: number; timestamp: number }[];
}): Promise<void> {
  await ready();
  _db.runSync(
    'INSERT INTO pending_actions (type, territory_id, timestamp, gps_proof) VALUES (?, ?, ?, ?)',
    action.type,
    action.territoryId,
    action.timestamp,
    JSON.stringify(action.gpsProof),
  );
}

export async function getPendingActions(): Promise<PendingAction[]> {
  await ready();
  const rows = _db.getAllSync<{
    id: number;
    type: string;
    territory_id: string;
    timestamp: number;
    gps_proof: string;
  }>('SELECT id, type, territory_id, timestamp, gps_proof FROM pending_actions ORDER BY timestamp ASC');
  return rows.map(r => ({
    id: r.id,
    type: r.type as 'claim' | 'fortify',
    territoryId: r.territory_id,
    timestamp: r.timestamp,
    gpsProof: JSON.parse(r.gps_proof),
  }));
}

export async function clearPendingAction(id: number): Promise<void> {
  await ready();
  _db.runSync('DELETE FROM pending_actions WHERE id = ?', id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<StoredSettings> {
  await ready();
  const row = _db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'app');
  const stored = row ? JSON.parse(row.value) as Partial<StoredSettings> : {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  await ready();
  _db.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'app',
    JSON.stringify(settings),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved routes
// ─────────────────────────────────────────────────────────────────────────────

export async function getSavedRoutes(): Promise<StoredSavedRoute[]> {
  await ready();
  const rows = _db.getAllSync<{ data: string }>(
    'SELECT data FROM saved_routes ORDER BY created_at DESC',
  );
  return rows.map(r => JSON.parse(r.data) as StoredSavedRoute);
}

export async function saveSavedRoute(route: StoredSavedRoute): Promise<void> {
  await ready();
  _db.runSync(
    'INSERT OR REPLACE INTO saved_routes (id, data, created_at) VALUES (?, ?, ?)',
    route.id,
    JSON.stringify(route),
    route.createdAt,
  );
}

export async function deleteSavedRoute(id: string): Promise<void> {
  await ready();
  _db.runSync('DELETE FROM saved_routes WHERE id = ?', id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Nutrition
// ─────────────────────────────────────────────────────────────────────────────

export async function getNutritionProfile(): Promise<NutritionProfile | undefined> {
  await ready();
  const row = _db.getFirstSync<{ data: string }>(
    "SELECT data FROM nutrition_profile WHERE id = 'profile'",
  );
  if (!row) return undefined;
  return { diet: 'everything', ...JSON.parse(row.data) } as NutritionProfile;
}

export async function saveNutritionProfile(p: NutritionProfile): Promise<void> {
  await ready();
  _db.runSync(
    'INSERT OR REPLACE INTO nutrition_profile (id, data) VALUES (?, ?)',
    'profile',
    JSON.stringify(p),
  );
}

export async function getNutritionEntries(date: string): Promise<NutritionEntry[]> {
  await ready();
  const rows = _db.getAllSync<{ id: number; data: string }>(
    'SELECT id, data FROM nutrition_log WHERE date = ? ORDER BY logged_at ASC',
    date,
  );
  return rows.map(r => ({ ...JSON.parse(r.data) as NutritionEntry, id: r.id }));
}

export async function addNutritionEntry(e: NutritionEntry): Promise<number> {
  await ready();
  const result = _db.runSync(
    'INSERT INTO nutrition_log (date, data, logged_at) VALUES (?, ?, ?)',
    e.date,
    JSON.stringify(e),
    e.loggedAt,
  );
  return result.lastInsertRowId;
}

export async function deleteNutritionEntry(id: number): Promise<void> {
  await ready();
  _db.runSync('DELETE FROM nutrition_log WHERE id = ?', id);
}

export async function getNutritionEntriesRange(from: string, to: string): Promise<NutritionEntry[]> {
  await ready();
  const rows = _db.getAllSync<{ id: number; data: string }>(
    'SELECT id, data FROM nutrition_log WHERE date >= ? AND date <= ? ORDER BY logged_at ASC',
    from,
    to,
  );
  return rows.map(r => ({ ...JSON.parse(r.data) as NutritionEntry, id: r.id }));
}

export async function getUnsyncedNutritionEntries(): Promise<NutritionEntry[]> {
  await ready();
  const rows = _db.getAllSync<{ id: number; data: string }>(
    "SELECT id, data FROM nutrition_log WHERE json_extract(data, '$.synced') IS NOT 1 ORDER BY logged_at ASC",
  );
  return rows.map(r => ({ ...JSON.parse(r.data) as NutritionEntry, id: r.id }));
}

export async function markNutritionEntrySynced(id: number): Promise<void> {
  await ready();
  const row = _db.getFirstSync<{ data: string }>('SELECT data FROM nutrition_log WHERE id = ?', id);
  if (!row) return;
  const updated = { ...JSON.parse(row.data) as NutritionEntry, synced: true };
  _db.runSync(
    'UPDATE nutrition_log SET data = ? WHERE id = ?',
    JSON.stringify(updated),
    id,
  );
}

export async function getRecentFoods(limit = 10): Promise<NutritionEntry[]> {
  await ready();
  const rows = _db.getAllSync<{ id: number; data: string }>(
    "SELECT id, data FROM nutrition_log WHERE json_extract(data, '$.source') != 'run' ORDER BY logged_at DESC LIMIT ?",
    limit * 5,
  );
  const seen = new Set<string>();
  const result: NutritionEntry[] = [];
  for (const r of rows) {
    const e = { ...JSON.parse(r.data) as NutritionEntry, id: r.id };
    if (!seen.has(e.name)) {
      seen.add(e.name);
      result.push(e);
    }
    if (result.length >= limit) break;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shoes
// ─────────────────────────────────────────────────────────────────────────────

export async function getShoes(): Promise<StoredShoe[]> {
  await ready();
  const rows = _db.getAllSync<{ data: string }>('SELECT data FROM shoes');
  return rows.map(r => JSON.parse(r.data) as StoredShoe);
}

export async function getShoe(id: string): Promise<StoredShoe | undefined> {
  await ready();
  const row = _db.getFirstSync<{ data: string }>('SELECT data FROM shoes WHERE id = ?', id);
  return row ? JSON.parse(row.data) as StoredShoe : undefined;
}

export async function saveShoe(shoe: StoredShoe): Promise<void> {
  await ready();
  if (shoe.isDefault) {
    _db.withTransactionSync(() => {
      _db.runSync(
        "UPDATE shoes SET data = json_patch(data, '{\"isDefault\":false}') WHERE id != ? AND json_extract(data, '$.isDefault') = 1",
        shoe.id,
      );
      _db.runSync('INSERT OR REPLACE INTO shoes (id, data) VALUES (?, ?)', shoe.id, JSON.stringify(shoe));
    });
  } else {
    _db.runSync('INSERT OR REPLACE INTO shoes (id, data) VALUES (?, ?)', shoe.id, JSON.stringify(shoe));
  }
}

export async function deleteShoe(id: string): Promise<void> {
  await ready();
  _db.runSync('DELETE FROM shoes WHERE id = ?', id);
}

export async function getDefaultShoe(): Promise<StoredShoe | undefined> {
  const shoes = await getShoes();
  return shoes.find(s => s.isDefault && !s.isRetired) ?? shoes.find(s => !s.isRetired);
}

// ─────────────────────────────────────────────────────────────────────────────
// Device import helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function matchOrCreateRun(imported: {
  startTime: number;
  endTime: number;
  distanceMeters: number;
  durationSec: number;
  avgPace: string;
  source: string;
  externalId?: string;
  heartRateAvg?: number;
  caloriesBurned?: number;
}): Promise<{ action: 'matched' | 'created'; run: StoredRun }> {
  const OVERLAP_TOLERANCE_MS = 2 * 60 * 1000;
  const existing = await getRuns(200);
  const match = existing.find(r => {
    const startClose = Math.abs(r.startTime - imported.startTime) < OVERLAP_TOLERANCE_MS;
    const endClose   = Math.abs(r.endTime   - imported.endTime)   < OVERLAP_TOLERANCE_MS;
    return startClose && endClose;
  });

  if (match) {
    const enriched: StoredRun = {
      ...match,
      heartRateAvg:   match.heartRateAvg   ?? imported.heartRateAvg,
      caloriesBurned: match.caloriesBurned ?? imported.caloriesBurned,
      importSource:   match.importSource   ?? imported.source,
      externalId:     match.externalId     ?? imported.externalId,
    };
    await saveRun(enriched);
    return { action: 'matched', run: enriched };
  }

  const defaultShoe = await getDefaultShoe();
  const newRun: StoredRun = {
    id:                   crypto.randomUUID(),
    activityType:         'run',
    startTime:            imported.startTime,
    endTime:              imported.endTime,
    distanceMeters:       imported.distanceMeters,
    durationSec:          imported.durationSec,
    avgPace:              imported.avgPace,
    gpsPoints:            [],
    territoriesClaimed:   [],
    territoriesFortified: [],
    xpEarned:             0,
    coinsEarned:          0,
    enemyCaptured:        0,
    preRunLevel:          0,
    synced:               false,
    shoeId:               defaultShoe?.id,
    heartRateAvg:         imported.heartRateAvg,
    caloriesBurned:       imported.caloriesBurned,
    importSource:         imported.source,
    externalId:           imported.externalId,
  };
  await saveRun(newRun);
  return { action: 'created', run: newRun };
}
