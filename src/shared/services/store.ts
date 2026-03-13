import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'runivo';
const DB_VERSION = 7;

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
  diamondsEarned: number;
  enemyCaptured: number;
  preRunLevel: number;
  synced: boolean;
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
  diamonds: number;
  energy: number;
  lastEnergyRegen: number;
  totalDistanceKm: number;
  totalRuns: number;
  totalTerritoriesClaimed: number;
  totalEnemyCaptured: number;
  streakDays: number;
  lastRunDate: string | null;
  lastIncomeCollection: number;  // timestamp of last passive income payout
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
    upgrade(db, oldVersion) {
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
        // Replace hex-based territories store with polygon-based store
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
    },
  });

  return dbInstance;
}

export async function getPlayer(): Promise<StoredPlayer | null> {
  const db = await getDB();
  const all = await db.getAll('player');
  const p = all[0] || null;
  if (!p) return null;
  // Backfill new fields for records created before schema v5/v6
  return {
    totalEnemyCaptured: 0,
    unlockedAchievements: [],
    lastIncomeCollection: Date.now(),
    ...p,
  };
}

export async function savePlayer(player: StoredPlayer): Promise<void> {
  const db = await getDB();
  await db.put('player', player);
}

export async function initializePlayer(username: string): Promise<StoredPlayer> {
  const player: StoredPlayer = {
    id: crypto.randomUUID(),
    username,
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
  };
  await savePlayer(player);
  return player;
}

export async function saveRun(run: StoredRun): Promise<void> {
  const db = await getDB();
  await db.put('runs', run);
}

export async function getRuns(limit?: number): Promise<StoredRun[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('runs', 'startTime');
  const sorted = all.reverse();
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function getRunById(id: string): Promise<StoredRun | undefined> {
  const db = await getDB();
  return db.get('runs', id);
}

export async function saveTerritories(territories: StoredTerritory[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('territories', 'readwrite');
  await Promise.all(territories.map(t => tx.store.put(t)));
  await tx.done;
}

export async function getTerritory(id: string): Promise<StoredTerritory | undefined> {
  const db = await getDB();
  return db.get('territories', id);
}

export async function getAllTerritories(): Promise<StoredTerritory[]> {
  const db = await getDB();
  return db.getAll('territories');
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
  await db.add('pendingActions', action);
}

export async function getPendingActions(): Promise<unknown[]> {
  const db = await getDB();
  return db.getAll('pendingActions');
}

export async function clearPendingAction(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('pendingActions', id);
}

// ── App Settings ─────────────────────────────────────────────────────────────

export async function getSettings(): Promise<StoredSettings> {
  const db = await getDB();
  const stored = await db.get('settings', 'settings');
  // Backfill any new fields added after the record was first saved
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings);
}

// ── Saved Routes ──────────────────────────────────────────────────────────────

export async function getSavedRoutes(): Promise<StoredSavedRoute[]> {
  const db = await getDB();
  const all = await db.getAll('savedRoutes');
  return (all as StoredSavedRoute[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveSavedRoute(route: StoredSavedRoute): Promise<void> {
  const db = await getDB();
  await db.put('savedRoutes', route);
}

export async function deleteSavedRoute(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('savedRoutes', id);
}
