/**
 * Web (IDB) implementation of missionStore.
 * Metro automatically picks missionStore.native.ts on iOS/Android.
 */
import { getDB, getPlayer, savePlayer, getSettings } from './store';
import { Mission, MISSION_TEMPLATES, updateMissionProgress, generateDailyMissions } from './missions';
import { GAME_CONFIG } from './config';
import { computeRunnerRank } from './claimEngine';

const STORE_NAME = 'missions';

export async function getTodaysMissions(): Promise<Mission[]> {
  const db  = await getDB();
  const all = await db.getAll(STORE_NAME) as Mission[];

  const now      = Date.now();
  const today    = new Date();
  const todayKey = `daily-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  return all.filter(m => m.id.startsWith(todayKey) && m.expiresAt > now);
}

export async function saveMissions(missions: Mission[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(missions.map(m => tx.store.put(m)));
  await tx.done;
}

export async function updateMissionsAfterRun(runResult: {
  distanceKm:          number;
  territoriesClaimed:  string[];
  enemyCaptured:       number;
  fastKmCount:         number;
  defendedZonesCount:  number;
  rivalZonesStolen:    number;
}): Promise<{ missions: Mission[]; newlyCompleted: Mission[] }> {
  const current             = await getTodaysMissions();
  const previouslyCompleted = current.filter(m => m.completed).map(m => m.id);
  const updated             = updateMissionProgress(current, runResult);
  await saveMissions(updated);
  const newlyCompleted = updated.filter(m => m.completed && !previouslyCompleted.includes(m.id));
  return { missions: updated, newlyCompleted };
}

export async function claimMissionReward(missionId: string): Promise<Mission | null> {
  const db      = await getDB();
  const mission = await db.get(STORE_NAME, missionId) as Mission | undefined;
  if (!mission || !mission.completed || mission.claimed) return null;
  mission.claimed = true;
  await db.put(STORE_NAME, mission);

  const player = await getPlayer();
  if (player) {
    const paceReward = mission.rewards.pace ?? 0;
    const cap = GAME_CONFIG.PACE_WEEKLY_CAP_FREE;
    const remaining = cap - (player.paceWeeklyEarned ?? 0);
    const credited = Math.min(paceReward, Math.max(0, remaining));
    const newTotal = (player.paceTotalEarned ?? 0) + credited;
    await savePlayer({
      ...player,
      paceBalance:      (player.paceBalance ?? 0) + credited,
      paceTotalEarned:  newTotal,
      paceWeeklyEarned: (player.paceWeeklyEarned ?? 0) + credited,
      runnerRank:       computeRunnerRank(newTotal),
    });
  }

  return mission;
}

export async function setDailyMissions(templateTitles: string[]): Promise<Mission[]> {
  const today    = new Date();
  const todayKey = `daily-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  const expiresAt = endOfDay.getTime();

  const missions: Mission[] = templateTitles.map((title, i) => {
    const template = MISSION_TEMPLATES.find(t => t.title === title) ?? MISSION_TEMPLATES[0];
    return { ...template, id: `${todayKey}-${i}`, current: 0, completed: false, claimed: false, expiresAt };
  });

  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(missions.map(m => tx.store.put(m)));
  await tx.done;
  return missions;
}

export async function updateMissionsAfterNutritionLog(
  { streakDays }: { streakDays: number },
): Promise<{ missions: Mission[]; newlyCompleted: Mission[] }> {
  const current             = await getTodaysMissions();
  const previouslyCompleted = current.filter(m => m.completed).map(m => m.id);
  const updated             = current.map(mission => {
    if (mission.type !== 'nutrition_streak' || mission.completed) return mission;
    const newCurrent = Math.min(streakDays, mission.target);
    const completed  = newCurrent >= mission.target;
    return { ...mission, current: newCurrent, completed };
  });
  await saveMissions(updated);
  const newlyCompleted = updated.filter(m => m.completed && !previouslyCompleted.includes(m.id));
  return { missions: updated, newlyCompleted };
}

export async function ensureTodaysMissions(): Promise<Mission[]> {
  const existing = await getTodaysMissions();
  if (existing.length > 0) return existing;
  const settings   = await getSettings();
  const difficulty = (settings?.missionDifficulty ?? 'mixed') as 'easy' | 'mixed' | 'hard';
  const missions   = generateDailyMissions(new Date(), difficulty);
  await saveMissions(missions);
  return missions;
}
