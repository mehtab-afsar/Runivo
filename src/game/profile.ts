import { openDB } from 'idb';

export interface PlayerProfile {
  playerId: string;
  experienceLevel: 'new' | 'casual' | 'regular' | 'competitive';
  weeklyFrequency: number;
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  playstyle: 'conqueror' | 'defender' | 'explorer' | 'social';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
  weeklyGoalKm: number;
  missionDifficulty: 'easy' | 'mixed' | 'hard';
  onboardingCompletedAt: number;
}

const DB_NAME = 'runivo';
const STORE_NAME = 'profile';

async function getDB() {
  return openDB(DB_NAME, 3, {
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
        db.createObjectStore(STORE_NAME, { keyPath: 'playerId' });
      }
    },
  });
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, profile);
}

export async function getProfile(): Promise<PlayerProfile | undefined> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all[0] as PlayerProfile | undefined;
}

export function computeWeeklyGoal(frequency: number, distance: PlayerProfile['preferredDistance']): number {
  const distMap: Record<string, number> = { short: 2, '5k': 4, '10k': 7.5, long: 12 };
  return Math.round(frequency * (distMap[distance] || 4));
}
