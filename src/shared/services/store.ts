import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'runivo';
const DB_VERSION = 3;

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
  synced: boolean;
}

export interface StoredTerritory {
  hexId: string;
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
  gems: number;
  energy: number;
  lastEnergyRegen: number;
  totalDistanceKm: number;
  totalRuns: number;
  totalTerritoriesClaimed: number;
  streakDays: number;
  lastRunDate: string | null;
  createdAt: number;
}

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

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
        db.createObjectStore('profile', { keyPath: 'playerId' });
      }
    },
  });

  return dbInstance;
}

export async function getPlayer(): Promise<StoredPlayer | null> {
  const db = await getDB();
  const all = await db.getAll('player');
  return all[0] || null;
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
    gems: 5,
    energy: 100,
    lastEnergyRegen: Date.now(),
    totalDistanceKm: 0,
    totalRuns: 0,
    totalTerritoriesClaimed: 0,
    streakDays: 0,
    lastRunDate: null,
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

export async function getTerritory(hexId: string): Promise<StoredTerritory | undefined> {
  const db = await getDB();
  return db.get('territories', hexId);
}

export async function getAllTerritories(): Promise<StoredTerritory[]> {
  const db = await getDB();
  return db.getAll('territories');
}

export async function getPlayerTerritoryIds(playerId: string): Promise<string[]> {
  const all = await getAllTerritories();
  return all.filter(t => t.ownerId === playerId).map(t => t.hexId);
}

export async function queueAction(action: {
  type: 'claim' | 'fortify';
  hexId: string;
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
