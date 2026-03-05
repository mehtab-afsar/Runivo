import { openDB } from 'idb';
import { Mission, generateDailyMissions, updateMissionProgress } from './missions';

const DB_NAME = 'runivo';
const STORE_NAME = 'missions';

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
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }
      }
    },
  });
}

export async function getTodaysMissions(): Promise<Mission[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME) as Mission[];

  const now = Date.now();
  const today = new Date();
  const todayKey = `daily-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const todayMissions = all.filter(
    m => m.id.startsWith(todayKey) && m.expiresAt > now
  );

  if (todayMissions.length === 0) {
    const newMissions = generateDailyMissions(today);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all(newMissions.map(m => tx.store.put(m)));
    await tx.done;
    return newMissions;
  }

  return todayMissions;
}

export async function saveMissions(missions: Mission[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(missions.map(m => tx.store.put(m)));
  await tx.done;
}

export async function updateMissionsAfterRun(runResult: {
  distanceKm: number;
  territoriesClaimed: string[];
  territoriesFortified: string[];
  enemyCaptured: number;
  hexesVisited: number;
  enemyZoneDistanceKm: number;
  fastKmCount: number;
}): Promise<{ missions: Mission[]; newlyCompleted: Mission[] }> {
  const current = await getTodaysMissions();
  const previouslyCompleted = current.filter(m => m.completed).map(m => m.id);

  const updated = updateMissionProgress(current, runResult);
  await saveMissions(updated);

  const newlyCompleted = updated.filter(
    m => m.completed && !previouslyCompleted.includes(m.id)
  );

  return { missions: updated, newlyCompleted };
}

export async function claimMissionReward(missionId: string): Promise<Mission | null> {
  const db = await getDB();
  const mission = await db.get(STORE_NAME, missionId) as Mission | undefined;
  if (!mission || !mission.completed || mission.claimed) return null;

  mission.claimed = true;
  await db.put(STORE_NAME, mission);
  return mission;
}
