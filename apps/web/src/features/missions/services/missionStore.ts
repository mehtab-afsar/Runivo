import { getDB } from '@shared/services/store';
import { Mission, MISSION_TEMPLATES, updateMissionProgress } from './missions';

const STORE_NAME = 'missions';

export async function getTodaysMissions(): Promise<Mission[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME) as Mission[];

  const now = Date.now();
  const today = new Date();
  const todayKey = `daily-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const todayMissions = all.filter(
    m => m.id.startsWith(todayKey) && m.expiresAt > now
  );

  return todayMissions;
}

// Save a user-chosen set of mission templates as today's missions
export async function setDailyMissions(templateTitles: string[]): Promise<Mission[]> {
  const today = new Date();
  const todayKey = `daily-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  const expiresAt = endOfDay.getTime();

  const missions: Mission[] = templateTitles.map((title, i) => {
    const template = MISSION_TEMPLATES.find(t => t.title === title) ?? MISSION_TEMPLATES[0];
    return {
      ...template,
      id: `${todayKey}-${i}`,
      current: 0,
      completed: false,
      claimed: false,
      expiresAt,
    };
  });

  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(missions.map(m => tx.store.put(m)));
  await tx.done;
  return missions;
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
