/**
 * Native (expo-sqlite) implementation of missionStore.
 * Metro automatically picks this file on iOS/Android.
 */
import * as SQLite from 'expo-sqlite';
import { Mission, generateDailyMissions, updateMissionProgress, MISSION_TEMPLATES } from './missions';
import { getPlayer, savePlayer, getSettings } from './store';
import { computeRunnerRank } from './claimEngine';

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

  // Server-authoritative credit: the claim_mission_reward RPC looks up the
  // mission's PACE reward from its own canonical title→reward table and
  // enforces the weekly cap itself — pace_balance/pace_total_earned/
  // pace_weekly_earned are never client-writable (profiles_column_protection),
  // so crediting them locally without this round-trip only produced a number
  // that reverted on the next pullProfile(). If offline or the call fails, the
  // mission still shows claimed (matches this store's offline-first design
  // elsewhere) but no PACE is credited until a future successful claim.
  let credited = 0;
  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.rpc('claim_mission_reward', {
      p_mission_id: missionId,
      p_title:      mission.title,
    });
    if (!error && typeof data === 'number') credited = data;
  } catch { /* offline — not credited this attempt */ }

  if (credited > 0) {
    const player = await getPlayer();
    if (player) {
      const newTotal = (player.paceTotalEarned ?? 0) + credited;
      await savePlayer({
        ...player,
        paceBalance:      (player.paceBalance ?? 0) + credited,
        paceTotalEarned:  newTotal,
        paceWeeklyEarned: (player.paceWeeklyEarned ?? 0) + credited,
        runnerRank:       computeRunnerRank(newTotal),
      });
    }
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
  await saveMissions(missions);
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
