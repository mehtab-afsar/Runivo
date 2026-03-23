import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'runivo';
const DB_VERSION = 10;

/**
 * Returns the current date as a 'YYYY-MM-DD' string in the device's LOCAL timezone.
 * Using toISOString() produces UTC midnight, which causes the date to flip at midnight
 * UTC even when the device timezone is behind UTC (e.g. a user in UTC-5 would get
 * tomorrow's date from 19:00 local time onwards).
 */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Wraps every IndexedDB operation so a QuotaExceededError (mobile storage full)
 * or an AbortError (transaction forcibly aborted) never crashes the app.
 *
 * - QuotaExceededError → dispatches 'runivo:storage-full' so the UI can warn.
 * - AbortError         → retries once, then gives up.
 * - All other errors   → logs and returns the fallback value.
 */
async function idbSafe<T>(
  operation: () => Promise<T>,
  fallback: T,
  context: string,
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'QuotaExceededError') {
        console.error(`[IDB] Storage full during ${context}`);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('runivo:storage-full'));
      } else if (err.name === 'AbortError') {
        console.warn(`[IDB] Transaction aborted during ${context} — retrying`);
        try { return await operation(); } catch { /* give up */ }
      }
    }
    console.error(`[IDB] ${context} failed:`, err);
    return fallback;
  }
}

// ── Settings ────────────────────────────────────────────────────────────────

export interface StoredSettings {
  id: 'settings'; // singleton key
  // Appearance
  distanceUnit: 'km' | 'mi';
  darkMode: boolean;
  // Notifications
  notificationsEnabled: boolean;
  announceAchievements: boolean;
  weeklySummary: boolean;
  // Sound & Haptics
  soundEnabled: boolean;
  hapticEnabled: boolean;
  // Run
  autoPause: boolean;
  gpsAccuracy: 'standard' | 'high';
  countdownSeconds: 0 | 3 | 5;
  // Missions
  dailyMissionsEnabled: boolean;
  missionDifficulty: 'easy' | 'mixed' | 'hard';
  weeklyGoalKm: number;
  // Profile
  privacy: 'public' | 'followers' | 'private';
  avatarColorId: string;
  // Beat Pacer
  beatPacerEnabled: boolean;
  beatPacerPace: string;
  beatPacerSound: 'click' | 'woodblock' | 'hihat';
  beatPacerAccent: boolean;
}

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
};

export interface StoredRun {
  id: string;
  activityType: string;
  startTime: number;
  endTime: number;
  distanceMeters: number;
  durationSec: number;
  avgPace: string;
  gpsPoints: {
    lat: number;
    lng: number;
    timestamp: number;
    speed: number;
    accuracy: number;
  }[];
  territoriesClaimed: string[];
  territoriesFortified: string[];
  xpEarned: number;
  coinsEarned: number;
  enemyCaptured: number;
  preRunLevel: number;
  synced: boolean;
  shoeId?: string;
  heartRateAvg?: number;     // bpm, from wearable
  caloriesBurned?: number;   // kcal, from wearable
  importSource?: string;     // 'apple_health' | 'garmin' | 'coros' | 'polar'
  externalId?: string;       // platform workout ID, prevents duplicate imports
}

export interface StoredTerritory {
  id: string;                    // UUID, primary key
  polygon: [number, number][];   // GeoJSON [lng, lat] closed ring
  areaM2: number;                // approximate area in square metres
  runId: string;                 // which run created this territory
  ownerId: string | null;
  ownerName: string | null;
  defense: number;
  tier: string;
  claimedAt: number | null;
  lastFortifiedAt: number | null;
}

export interface StoredPlayer {
  id: string;
  username: string;
  level: number;
  xp: number;
  coins: number;
  energy: number;
  lastEnergyRegen: number;
  totalDistanceKm: number;
  totalRuns: number;
  totalTerritoriesClaimed: number;
  totalEnemyCaptured: number;
  streakDays: number;
  lastRunDate: string | null;
  lastLoginBonusDate: string | null; // YYYY-MM-DD of last daily login bonus collection
  unlockedAchievements: string[];
  createdAt: number;
}

export interface StoredSavedRoute {
  id: string;
  name: string;
  emoji: string;
  distanceM: number;
  durationSec: number | null;
  gpsPoints: { lat: number; lng: number }[];
  isPublic: boolean;
  sourceRunId: string | null;
  synced: boolean;
  createdAt: number;
}

// ── Shoes ─────────────────────────────────────────────────────────────────────

export interface StoredShoe {
  id: string;                                          // UUID
  brand: string;
  model: string;
  nickname: string | null;
  category: 'road' | 'trail' | 'track' | 'casual';
  maxKm: number;
  isRetired: boolean;
  isDefault: boolean;
  color: string | null;                                // hex, e.g. '#FF6B35'
  notes: string | null;
  purchasedAt: string | null;                          // 'YYYY-MM-DD'
  createdAt: number;
  synced: boolean;
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export interface NutritionProfile {
  id: 'profile';
  goal: 'lose' | 'maintain' | 'gain';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  diet: 'everything' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'halal';
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  dailyGoalKcal: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
}

export interface NutritionEntry {
  id?: number;
  date: string;            // 'YYYY-MM-DD'
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingSize: string;
  source: 'search' | 'run' | 'manual';
  runId?: string;
  xpAwarded: boolean;
  loggedAt: number;
  synced?: boolean;        // true once pushed to Supabase nutrition_logs
}

// ── Pending Actions ───────────────────────────────────────────────────────────

export interface PendingAction {
  id:          number;
  type:        'claim' | 'fortify';
  territoryId: string;
  timestamp:   number;
  gpsProof:    { lat: number; lng: number; timestamp: number }[];
}

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    // Check if connection is still usable
    try {
      dbInstance.transaction(dbInstance.objectStoreNames[0] || 'player', 'readonly');
      return dbInstance;
    } catch {
      // Connection was closed — reopen
      dbInstance = null;
    }
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const runStore = db.createObjectStore('runs', { keyPath: 'id' });
        runStore.createIndex('startTime', 'startTime');
        runStore.createIndex('synced', 'synced');
        db.createObjectStore('territories', { keyPath: 'hexId' });
        db.createObjectStore('player', { keyPath: 'id' });
        db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
      }
      if (oldVersion < 2) {
        db.createObjectStore('missions', { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'playerId' });
        }
      }
      if (oldVersion < 4) {
        // Fix: missionStore.ts previously created profile store with wrong keyPath 'id'
        if (db.objectStoreNames.contains('profile')) {
          db.deleteObjectStore('profile');
        }
        db.createObjectStore('profile', { keyPath: 'playerId' });
      }
      if (oldVersion < 5) {
        // INTENTIONAL: v1-4 stored hex-based territories (keyPath: 'hexId').
        // v5+ uses polygon-based territories (keyPath: 'id') derived from run GPS data.
        // Old hex territories cannot be migrated — they are re-derived from
        // pushUnsyncedRuns() on the next sync. Data loss is expected and documented.
        if (db.objectStoreNames.contains('territories')) {
          db.deleteObjectStore('territories');
        }
        db.createObjectStore('territories', { keyPath: 'id' });
      }
      if (oldVersion < 6) {
        // Persist app settings to IDB
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (oldVersion < 7) {
        db.createObjectStore('savedRoutes', { keyPath: 'id' });
      }
      if (oldVersion < 8) {
        db.createObjectStore('nutritionProfile', { keyPath: 'id' });
        db.createObjectStore('nutritionLog', { autoIncrement: true, keyPath: 'id' });
      }
      if (oldVersion < 9) {
        // Add byDate index for O(1) nutrition lookups per day.
        // Entries written before this upgrade won't have synced=true; they'll be pushed
        // on next pushNutritionLogs() call which filters on !e.synced.
        const nutritionStore = tx.objectStore('nutritionLog');
        if (!nutritionStore.indexNames.contains('byDate')) {
          nutritionStore.createIndex('byDate', 'date', { unique: false });
        }
      }
      if (oldVersion < 10) {
        db.createObjectStore('shoes', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

export async function getPlayer(): Promise<StoredPlayer | null> {
  const db = await getDB();
  const all = await idbSafe(() => db.getAll('player'), [], 'getPlayer');
  const p = all[0] || null;
  if (!p) return null;
  // Backfill new fields for records created before schema v5/v6
  return {
    totalEnemyCaptured: 0,
    unlockedAchievements: [],
    lastLoginBonusDate: null,
    ...p,
  };
}

export async function savePlayer(player: StoredPlayer): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.put('player', player), undefined, 'savePlayer');
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

export async function saveRun(run: StoredRun): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.put('runs', run), undefined, 'saveRun');
}

export async function getRuns(limit?: number): Promise<StoredRun[]> {
  const db = await getDB();
  const all = await idbSafe(
    () => db.getAllFromIndex('runs', 'startTime'),
    [] as StoredRun[],
    'getRuns',
  );
  const sorted = all.reverse();
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Returns runs whose startTime >= sinceMs (epoch milliseconds). Much cheaper than
 *  fetching all runs when you only need today's or this-week's data. */
export async function getRunsSince(sinceMs: number): Promise<StoredRun[]> {
  const db = await getDB();
  const range = IDBKeyRange.lowerBound(sinceMs);
  const all = await idbSafe(
    () => db.getAllFromIndex('runs', 'startTime', range),
    [] as StoredRun[],
    'getRunsSince',
  );
  return all.reverse();
}

export async function getRunById(id: string): Promise<StoredRun | undefined> {
  const db = await getDB();
  return idbSafe(() => db.get('runs', id), undefined, 'getRunById');
}

export async function saveTerritories(territories: StoredTerritory[]): Promise<void> {
  const db = await getDB();
  await idbSafe(async () => {
    const tx = db.transaction('territories', 'readwrite');
    await Promise.all(territories.map(t => tx.store.put(t)));
    await tx.done;
  }, undefined, 'saveTerritories');
}

export async function getTerritory(id: string): Promise<StoredTerritory | undefined> {
  const db = await getDB();
  return idbSafe(() => db.get('territories', id), undefined, 'getTerritory');
}

export async function getAllTerritories(): Promise<StoredTerritory[]> {
  const db = await getDB();
  return idbSafe(
    () => db.getAll('territories') as Promise<StoredTerritory[]>,
    [],
    'getAllTerritories',
  );
}

export async function getPlayerTerritoryIds(playerId: string): Promise<string[]> {
  const all = await getAllTerritories();
  return all.filter(t => t.ownerId === playerId).map(t => t.id);
}

export async function queueAction(action: {
  type: 'claim' | 'fortify';
  territoryId: string;
  timestamp: number;
  gpsProof: { lat: number; lng: number; timestamp: number }[];
}): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.add('pendingActions', action), undefined, 'queueAction');
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await getDB();
  return idbSafe(
    () => db.getAll('pendingActions') as Promise<PendingAction[]>,
    [],
    'getPendingActions',
  );
}

export async function clearPendingAction(id: number): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.delete('pendingActions', id), undefined, 'clearPendingAction');
}

// ── App Settings ─────────────────────────────────────────────────────────────

export async function getSettings(): Promise<StoredSettings> {
  const db = await getDB();
  const stored = await idbSafe(
    () => db.get('settings', 'settings'),
    undefined as StoredSettings | undefined,
    'getSettings',
  );
  // Backfill any new fields added after the record was first saved
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.put('settings', settings), undefined, 'saveSettings');
}

// ── Saved Routes ──────────────────────────────────────────────────────────────

export async function getSavedRoutes(): Promise<StoredSavedRoute[]> {
  const db = await getDB();
  const all = await idbSafe(
    () => db.getAll('savedRoutes') as Promise<StoredSavedRoute[]>,
    [],
    'getSavedRoutes',
  );
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveSavedRoute(route: StoredSavedRoute): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.put('savedRoutes', route), undefined, 'saveSavedRoute');
}

export async function deleteSavedRoute(id: string): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.delete('savedRoutes', id), undefined, 'deleteSavedRoute');
}

// ── Nutrition helpers ─────────────────────────────────────────────────────────

export async function getNutritionProfile(): Promise<NutritionProfile | undefined> {
  const db = await getDB();
  const stored = await idbSafe(
    () => db.get('nutritionProfile', 'profile'),
    undefined as NutritionProfile | undefined,
    'getNutritionProfile',
  );
  if (!stored) return undefined;
  // Backfill fields added after initial release so old profiles keep working
  return { diet: 'everything', ...stored } as NutritionProfile;
}

export async function saveNutritionProfile(p: NutritionProfile): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.put('nutritionProfile', p), undefined, 'saveNutritionProfile');
}

export async function getNutritionEntries(date: string): Promise<NutritionEntry[]> {
  const db = await getDB();
  // Use the byDate index (added in DB v9) for O(1) lookup instead of O(n) full scan.
  // Fall back to full scan for DBs that haven't been upgraded yet (shouldn't happen in prod).
  if (db.objectStoreNames.contains('nutritionLog')) {
    try {
      return (await db.getAllFromIndex('nutritionLog', 'byDate', date)) as NutritionEntry[];
    } catch {
      const all = await db.getAll('nutritionLog') as NutritionEntry[];
      return all.filter(e => e.date === date);
    }
  }
  return [];
}

export async function addNutritionEntry(e: NutritionEntry): Promise<number> {
  const db = await getDB();
  return idbSafe(
    () => db.add('nutritionLog', e) as Promise<number>,
    0,
    'addNutritionEntry',
  );
}

export async function deleteNutritionEntry(id: number): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.delete('nutritionLog', id), undefined, 'deleteNutritionEntry');
}

export async function getNutritionEntriesRange(from: string, to: string): Promise<NutritionEntry[]> {
  const db = await getDB();
  const all = await idbSafe(
    () => db.getAll('nutritionLog') as Promise<NutritionEntry[]>,
    [],
    'getNutritionEntriesRange',
  );
  return all.filter(e => e.date >= from && e.date <= to);
}

/** Returns all nutrition entries that haven't been synced to Supabase yet. */
export async function getUnsyncedNutritionEntries(): Promise<NutritionEntry[]> {
  const db = await getDB();
  const all = await idbSafe(
    () => db.getAll('nutritionLog') as Promise<NutritionEntry[]>,
    [],
    'getUnsyncedNutritionEntries',
  );
  return all.filter(e => !e.synced && e.id !== undefined);
}

/** Mark a single nutrition entry as synced. */
export async function markNutritionEntrySynced(id: number): Promise<void> {
  const db = await getDB();
  const existing = await idbSafe(
    () => db.get('nutritionLog', id) as Promise<NutritionEntry | undefined>,
    undefined,
    'markNutritionEntrySynced-get',
  );
  if (!existing) return;
  await idbSafe(
    () => db.put('nutritionLog', { ...existing, synced: true }),
    undefined,
    'markNutritionEntrySynced-put',
  );
}

/** Returns the last N unique food entries (by name) for the recent-foods list. */
export async function getRecentFoods(limit = 10): Promise<NutritionEntry[]> {
  const db = await getDB();
  const all = (await idbSafe(
    () => db.getAll('nutritionLog') as Promise<NutritionEntry[]>,
    [],
    'getRecentFoods',
  ))
    .filter(e => e.source !== 'run')
    .sort((a, b) => b.loggedAt - a.loggedAt);
  const seen = new Set<string>();
  const result: NutritionEntry[] = [];
  for (const e of all) {
    if (!seen.has(e.name)) {
      seen.add(e.name);
      result.push(e);
    }
    if (result.length >= limit) break;
  }
  return result;
}

// ── Shoes ─────────────────────────────────────────────────────────────────────

export async function getShoes(): Promise<StoredShoe[]> {
  const db = await getDB();
  return idbSafe(() => db.getAll('shoes'), [], 'getShoes');
}

export async function getShoe(id: string): Promise<StoredShoe | undefined> {
  const db = await getDB();
  return idbSafe(() => db.get('shoes', id), undefined, 'getShoe');
}

export async function saveShoe(shoe: StoredShoe): Promise<void> {
  const db = await getDB();
  // If this shoe is being set as default, clear isDefault on all others first
  if (shoe.isDefault) {
    const tx = db.transaction('shoes', 'readwrite');
    const all = await tx.store.getAll();
    await Promise.all(
      all
        .filter(s => s.id !== shoe.id && s.isDefault)
        .map(s => tx.store.put({ ...s, isDefault: false }))
    );
    await tx.store.put(shoe);
    await tx.done;
  } else {
    await idbSafe(() => db.put('shoes', shoe), undefined, 'saveShoe');
  }
}

export async function deleteShoe(id: string): Promise<void> {
  const db = await getDB();
  await idbSafe(() => db.delete('shoes', id), undefined, 'deleteShoe');
}

export async function getDefaultShoe(): Promise<StoredShoe | undefined> {
  const shoes = await getShoes();
  return shoes.find(s => s.isDefault && !s.isRetired) ?? shoes.find(s => !s.isRetired);
}

// ── Device import helpers ─────────────────────────────────────────────────────

/**
 * Given an imported workout (from Apple Health, Garmin, etc.), checks whether a
 * locally-recorded run overlaps the same time window (±2 min tolerance). If a
 * match is found, the existing run is enriched with any missing fields and the
 * source tag is added. If no match is found, a new run is saved from the import.
 *
 * Returns: { action: 'matched' | 'created', run: StoredRun }
 */
export async function matchOrCreateRun(imported: {
  startTime: number;   // ms
  endTime: number;     // ms
  distanceMeters: number;
  durationSec: number;
  avgPace: string;
  source: string;      // e.g. 'apple_health', 'garmin'
  externalId?: string; // platform-specific workout ID to prevent re-imports
  heartRateAvg?: number;
  caloriesBurned?: number;
}): Promise<{ action: 'matched' | 'created'; run: StoredRun }> {
  const OVERLAP_TOLERANCE_MS = 2 * 60 * 1000; // 2 minutes

  const existing = await getRuns(200);
  const match = existing.find(r => {
    const startClose = Math.abs(r.startTime - imported.startTime) < OVERLAP_TOLERANCE_MS;
    const endClose   = Math.abs(r.endTime   - imported.endTime)   < OVERLAP_TOLERANCE_MS;
    return startClose && endClose;
  });

  if (match) {
    // Enrich existing run with data from device (heart rate, calories, etc.)
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

  // No match — create a new run from the imported data
  const defaultShoe = await getDefaultShoe();
  const newRun: StoredRun = {
    id:                    crypto.randomUUID(),
    activityType:          'run',
    startTime:             imported.startTime,
    endTime:               imported.endTime,
    distanceMeters:        imported.distanceMeters,
    durationSec:           imported.durationSec,
    avgPace:               imported.avgPace,
    gpsPoints:             [],
    territoriesClaimed:    [],
    territoriesFortified:  [],
    xpEarned:              0,
    coinsEarned:           0,
    enemyCaptured:         0,
    preRunLevel:           0,
    synced:                false,
    shoeId:                defaultShoe?.id,
    heartRateAvg:          imported.heartRateAvg,
    caloriesBurned:        imported.caloriesBurned,
    importSource:          imported.source,
    externalId:            imported.externalId,
  };
  await saveRun(newRun);
  return { action: 'created', run: newRun };
}
