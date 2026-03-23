/**
 * Native (expo-sqlite) implementation of missionStore.
 * Metro automatically picks this file on iOS/Android.
 */
import * as SQLite from 'expo-sqlite';
import { Mission, generateDailyMissions, updateMissionProgress, MISSION_TEMPLATES } from './missions';
import { getSettings } from './store';

const _db = SQLite.openDatabaseSync('runivo.db');

async function ensureTable(): Promise<void> {
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_missions_expires ON missions(expires_at);
  `);
}

export async function getTodaysMissions(): Promise<Mission[]> {
  await ensureTable();
  const now      = Date.now();
  const today    = new Date();
  const todayKey = `daily-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const rows = _db.getAllSync<{ data: string }>(
    'SELECT data FROM missions WHERE expires_at > ? ORDER BY rowid',
    [now],
  );
  return rows.map(r => JSON.parse(r.data) as Mission).filter(m => m.id.startsWith(todayKey));
}

export async function saveMissions(missions: Mission[]): Promise<void> {
  await ensureTable();
  await _db.withTransactionAsync(async () => {
    for (const m of missions) {
      _db.runSync(
        'INSERT OR REPLACE INTO missions (id, data, expires_at) VALUES (?, ?, ?)',
        [m.id, JSON.stringify(m), m.expiresAt],
      );
    }
  });
}

export async function updateMissionsAfterRun(runResult: {
  distanceKm:           number;
  territoriesClaimed:   string[];
  territoriesFortified: string[];
  enemyCaptured:        number;
  hexesVisited:         number;
  enemyZoneDistanceKm:  number;
  fastKmCount:          number;
}): Promise<{ missions: Mission[]; newlyCompleted: Mission[] }> {
  const current             = await getTodaysMissions();
  const previouslyCompleted = current.filter(m => m.completed).map(m => m.id);
  const updated             = updateMissionProgress(current, runResult);
  await saveMissions(updated);
  const newlyCompleted = updated.filter(m => m.completed && !previouslyCompleted.includes(m.id));
  return { missions: updated, newlyCompleted };
}

export async function claimMissionReward(missionId: string): Promise<Mission | null> {
  await ensureTable();
  const row = _db.getFirstSync<{ data: string }>(
    'SELECT data FROM missions WHERE id = ?',
    [missionId],
  );
  if (!row) return null;
  const mission = JSON.parse(row.data) as Mission;
  if (!mission.completed || mission.claimed) return null;
  mission.claimed = true;
  _db.runSync(
    'INSERT OR REPLACE INTO missions (id, data, expires_at) VALUES (?, ?, ?)',
    [mission.id, JSON.stringify(mission), mission.expiresAt],
  );
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
  await saveMissions(missions);
  return missions;
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
