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

  // Server-authoritative credit: the claim_mission_reward RPC verifies the
  // mission was actually completed (mission_completed_today), looks up its
  // PACE reward from its own canonical title→reward table, and enforces the
  // weekly cap — pace_balance/pace_total_earned/pace_weekly_earned are never
  // client-writable (profiles_column_protection), so crediting them locally
  // without this round-trip only produced a number that reverted on the next
  // pullProfile(). `claimed` is deliberately NOT set until this succeeds: if
  // it were set unconditionally (as it once was here), a claim attempted
  // before this run/log has finished syncing to the server would verify-fail,
  // credit 0, and then permanently hide the claim button behind a
  // `claimed: true` that never actually paid out. Leaving it false lets the
  // same tap be retried once the underlying activity has synced.
  let credited = 0;
  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.rpc('claim_mission_reward', {
      p_mission_id: missionId,
      p_title:      mission.title,
    });
    if (!error && typeof data === 'number') credited = data;
  } catch { /* offline — not credited this attempt */ }

  if (credited <= 0) return null;

  mission.claimed = true;
  _db.runSync(
    'INSERT OR REPLACE INTO missions (id, data, expires_at) VALUES (?, ?, ?)',
    [mission.id, JSON.stringify(mission), mission.expiresAt],
  );

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

// Replaces exactly one of today's missions with a fresh mission built from
// `newTitle`, keeping the other slots (and their progress) untouched —
// unlike setDailyMissions, which regenerates the whole set from scratch and
// would silently wipe progress on the two missions the user didn't ask to
// change. Reuses the swapped-out mission's id so its position in the list
// stays stable.
export async function swapMission(missionId: string, newTitle: string): Promise<Mission[]> {
  const current = await getTodaysMissions();
  const today    = new Date();
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  const expiresAt = endOfDay.getTime();
  const template  = MISSION_TEMPLATES.find(t => t.title === newTitle) ?? MISSION_TEMPLATES[0];

  const updated = current.map(m => m.id !== missionId ? m : {
    ...template, id: missionId, current: 0, completed: false, claimed: false, expiresAt,
  });
  await saveMissions(updated);
  return updated;
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
