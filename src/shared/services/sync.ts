/**
 * Sync service — bridges the local IndexedDB cache with Supabase.
 *
 * Strategy:
 *  - Local IndexedDB is the source of truth while offline.
 *  - On network restore, unsynced runs are pushed to Supabase.
 *  - Territories are pulled from Supabase on app launch and after each run.
 *  - Profile stats are upserted to Supabase whenever they change locally.
 *
 * Reads flow:  Supabase → IndexedDB (local cache)
 * Writes flow: IndexedDB (optimistic) → Supabase (confirmed)
 */

import { supabase } from './supabase';
import {
  getDB,
  getPlayer,
  savePlayer,
  getRuns,
  saveRun,
  getRunById,
  getSavedRoutes,
  saveSavedRoute,
  type StoredRun,
  type StoredTerritory,
  type StoredPlayer,
} from './store';
import { getProfile } from './profile';

/**
 * Returns the current user only if a valid local session exists.
 * Uses getSession() (no network call) then getUser() to validate.
 * Silently returns null when not logged in — avoids 403 console noise.
 */
async function getAuthenticatedUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

// ----------------------------------------------------------------
// PROFILE SYNC
// ----------------------------------------------------------------

/** Push local player data to Supabase profiles table. */
export async function pushProfile(): Promise<void> {
  const [player, profile] = await Promise.all([getPlayer(), getProfile()]);
  if (!player) return;

  const user = await getAuthenticatedUser();
  if (!user) return;

  await supabase.from('profiles').upsert({
    id: user.id,
    username: player.username,
    level: player.level,
    xp: player.xp,
    coins: player.coins,
    diamonds: player.diamonds,
    energy: player.energy,
    last_energy_regen: new Date(player.lastEnergyRegen).toISOString(),
    total_distance_km: player.totalDistanceKm,
    total_runs: player.totalRuns,
    total_territories_claimed: player.totalTerritoriesClaimed,
    streak_days: player.streakDays,
    last_run_date: player.lastRunDate,
    // Onboarding prefs + biometrics
    ...(profile && {
      // Biometrics (migration 013)
      age:       profile.age       || null,
      gender:    profile.gender    || null,
      height_cm: profile.heightCm  || null,
      weight_kg: profile.weightKg  || null,
      // Training preferences
      experience_level: profile.experienceLevel,
      weekly_frequency: profile.weeklyFrequency,
      primary_goal: profile.primaryGoal,
      preferred_distance: profile.preferredDistance,
      playstyle: profile.playstyle ?? null,
      distance_unit: profile.distanceUnit,
      notifications_enabled: profile.notificationsEnabled,
      weekly_goal_km: profile.weeklyGoalKm,
      mission_difficulty: profile.missionDifficulty,
      onboarding_completed_at: new Date(profile.onboardingCompletedAt).toISOString(),
      phone: profile.phone ?? null,
    }),
    // Achievements (migration 019) — pushed with every profile sync
    unlocked_achievements: player.unlockedAchievements ?? [],
  }, { onConflict: 'id' });
}

/** Pull profile from Supabase and update local player record. */
export async function pullProfile(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return;

  const existing = await getPlayer();
  await savePlayer({
    id: existing?.id ?? user.id,
    username: data.username,
    level: data.level,
    xp: data.xp,
    coins: data.coins,
    diamonds: data.diamonds,
    energy: data.energy,
    lastEnergyRegen: new Date(data.last_energy_regen).getTime(),
    totalDistanceKm: Number(data.total_distance_km),
    totalRuns: data.total_runs,
    totalTerritoriesClaimed: data.total_territories_claimed,
    totalEnemyCaptured: data.total_enemy_captured ?? 0,
    streakDays: data.streak_days,
    lastRunDate: data.last_run_date,
    lastIncomeCollection: existing?.lastIncomeCollection ?? Date.now(),
    // Union-merge: achievements from DB + local — never remove earned badges
    unlockedAchievements: Array.from(new Set([
      ...(existing?.unlockedAchievements ?? []),
      ...((data.unlocked_achievements as string[]) ?? []),
    ])),
    createdAt: new Date(data.created_at).getTime(),
  } satisfies StoredPlayer);
}

// ----------------------------------------------------------------
// RUNS SYNC
// ----------------------------------------------------------------

/**
 * Ramer-Douglas-Peucker path simplification.
 * Reduces GPS point count before cloud upload while preserving route shape.
 * epsilon is in degrees (~0.00005 ≈ 5 m at equator — keeps ~50-150 points per run).
 */
function rdpSimplify(
  points: StoredRun['gpsPoints'],
  epsilon = 0.00005
): StoredRun['gpsPoints'] {
  if (points.length <= 2) return points;

  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const lineLen = Math.sqrt(dx * dx + dy * dy);

  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dist = lineLen === 0
      ? Math.sqrt((p.lng - start.lng) ** 2 + (p.lat - start.lat) ** 2)
      : Math.abs(dy * p.lng - dx * p.lat + end.lng * start.lat - end.lat * start.lng) / lineLen;
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }

  if (maxDist > epsilon) {
    const left  = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

/** Push all locally unsynced runs to Supabase. */
export async function pushUnsyncedRuns(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const allRuns = await getRuns();
  const unsynced = allRuns.filter(r => !r.synced);
  if (unsynced.length === 0) return;

  for (const run of unsynced) {
    // Simplify GPS track before upload: keeps route shape but drops redundant
    // intermediate points (1800-point run → ~60-120 points, ~95% size reduction).
    const simplifiedPoints = rdpSimplify(run.gpsPoints);

    const { error } = await supabase.from('runs').upsert({
      id: run.id,
      user_id: user.id,
      activity_type: run.activityType,
      started_at: new Date(run.startTime).toISOString(),
      finished_at: new Date(run.endTime).toISOString(),
      distance_m: run.distanceMeters,
      duration_sec: run.durationSec,
      avg_pace: run.avgPace,
      gps_points: simplifiedPoints,
      territories_claimed: run.territoriesClaimed,
      territories_fortified: run.territoriesFortified,
      xp_earned: run.xpEarned,
      coins_earned: run.coinsEarned,
      diamonds_earned: run.diamondsEarned ?? 0,
      enemy_captured: run.enemyCaptured ?? 0,
      pre_run_level: run.preRunLevel ?? 1,
    }, { onConflict: 'id' });

    if (!error) {
      await saveRun({ ...run, synced: true });
    } else {
      console.warn('[sync] Failed to push run', run.id, error.message);
    }
  }
}

/** Pull runs for the current user and cache locally (for history page). */
export async function pullRuns(limit = 50): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error || !data) return;

  for (const row of data) {
    // Guard: never overwrite a locally-stored GPS trace with empty remote GPS.
    // This prevents a race condition where the Supabase row exists (default gps_points=[])
    // but the background push hasn't completed yet, causing the local trace to be lost.
    const local = await getRunById(row.id);
    const remoteGps = (row.gps_points as StoredRun['gpsPoints']) ?? [];
    const localGps = local?.gpsPoints ?? [];
    const gpsPoints = remoteGps.length >= 2 ? remoteGps : (localGps.length >= 2 ? localGps : remoteGps);

    await saveRun({
      id: row.id,
      activityType: row.activity_type,
      startTime: new Date(row.started_at).getTime(),
      endTime: new Date(row.finished_at).getTime(),
      distanceMeters: Number(row.distance_m),
      durationSec: row.duration_sec,
      avgPace: row.avg_pace,
      gpsPoints,
      territoriesClaimed: row.territories_claimed,
      territoriesFortified: row.territories_fortified,
      xpEarned: row.xp_earned,
      coinsEarned: row.coins_earned,
      diamondsEarned: row.diamonds_earned ?? 0,
      enemyCaptured: row.enemy_captured ?? 0,
      preRunLevel: row.pre_run_level ?? 1,
      synced: true,
    });
  }
}

// ----------------------------------------------------------------
// TERRITORY SYNC
// ----------------------------------------------------------------

/**
 * Pull all territories from Supabase and cache in IndexedDB.
 * Called on app launch and after a run finishes.
 */
export async function pullTerritories(): Promise<void> {
  const { data, error } = await supabase
    .from('territories')
    .select('*');

  if (error || !data) return;

  // Territories are now polygon corridors created locally from run GPS paths.
  // Remote hex-based territory rows are no longer imported.
  void data;
}

/**
 * Claim a territory via the server-side RPC function.
 * The server validates GPS proof and writes the territory row.
 * Returns {success, reason}.
 */
export async function claimTerritoryRemote(
  h3Index: string,
  gpsProof: { lat: number; lng: number; timestamp: number }[]
): Promise<{ success: boolean; reason: string | null }> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, reason: 'not_authenticated' };

  const player = await getPlayer();

  const { data, error } = await supabase.rpc('claim_territory', {
    p_h3_index: h3Index,
    p_owner_id: user.id,
    p_owner_name: player?.username ?? 'Runner',
    p_gps_proof: gpsProof,
  });

  if (error) return { success: false, reason: error.message };
  return data as { success: boolean; reason: string | null };
}

// ----------------------------------------------------------------
// REALTIME SUBSCRIPTIONS
// ----------------------------------------------------------------

/**
 * Subscribe to live territory updates.
 * Territories are now polygon corridors stored locally; remote hex sync is disabled.
 */
export function subscribeTerritories(
  _onUpdate: (territory: StoredTerritory) => void
): () => void {
  return () => {};
}

/**
 * Subscribe to lobby messages for a given lobby ID.
 * Returns unsubscribe function.
 */
export function subscribeLobbyMessages(
  lobbyId: string,
  onMessage: (msg: { id: string; userId: string; content: string; createdAt: string }) => void
): () => void {
  const channel = supabase
    .channel(`lobby-${lobbyId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'lobby_messages',
        filter: `lobby_id=eq.${lobbyId}`,
      },
      (payload) => {
        const row = payload.new as { id: string; user_id: string; content: string; created_at: string };
        onMessage({ id: row.id, userId: row.user_id, content: row.content, createdAt: row.created_at });
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ----------------------------------------------------------------
// SAVED ROUTES SYNC
// ----------------------------------------------------------------

/** Push unsynced saved routes to Supabase. */
export async function pushSavedRoutes(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const all = await getSavedRoutes();
  const unsynced = all.filter(r => !r.synced);
  if (unsynced.length === 0) return;

  for (const route of unsynced) {
    const { error } = await supabase.from('saved_routes').upsert({
      id: route.id,
      user_id: user.id,
      name: route.name,
      emoji: route.emoji,
      distance_m: route.distanceM,
      duration_sec: route.durationSec,
      gps_points: route.gpsPoints,
      is_public: route.isPublic,
      source_run_id: route.sourceRunId,
    }, { onConflict: 'id' });

    if (!error) {
      await saveSavedRoute({ ...route, synced: true });
    } else {
      console.warn('[sync] Failed to push saved route', route.id, error.message);
    }
  }
}

/** Pull user's saved routes from Supabase. */
export async function pullSavedRoutes(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('saved_routes')
    .select('id, name, emoji, distance_m, duration_sec, gps_points, is_public, source_run_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return;

  for (const row of data) {
    await saveSavedRoute({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      distanceM: Number(row.distance_m),
      durationSec: row.duration_sec,
      gpsPoints: (row.gps_points as { lat: number; lng: number }[]) ?? [],
      isPublic: row.is_public,
      sourceRunId: row.source_run_id,
      synced: true,
      createdAt: new Date(row.created_at).getTime(),
    });
  }
}

/** Find public routes near a position via PostGIS RPC. */
export async function findRoutesNearby(
  lng: number,
  lat: number,
  radiusM = 5000
): Promise<{ id: string; name: string; emoji: string; distanceM: number; durationSec: number | null; gpsPoints: { lat: number; lng: number }[]; username: string; distM: number }[]> {
  const { data, error } = await supabase.rpc('find_routes_nearby', {
    p_lng: lng,
    p_lat: lat,
    p_radius_m: radiusM,
  });

  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    distanceM: Number(r.distance_m),
    durationSec: r.duration_sec,
    gpsPoints: (r.gps_points as { lat: number; lng: number }[]) ?? [],
    username: r.username,
    distM: r.dist_m,
  }));
}

// ----------------------------------------------------------------
// FULL SYNC — call on app boot after auth
// ----------------------------------------------------------------

/** Run all pulls on startup. Non-fatal — individual failures are swallowed. */
export async function initialSync(): Promise<void> {
  await Promise.allSettled([
    pullProfile(),
    pullRuns(),
    pullTerritories(),
    pullSavedRoutes(),
  ]);
  // Push any runs/routes recorded offline
  await Promise.allSettled([pushUnsyncedRuns(), pushSavedRoutes()]);
}

/** Call after finishing a run to persist everything. */
export async function postRunSync(): Promise<void> {
  await Promise.allSettled([
    pushUnsyncedRuns(),
    pushSavedRoutes(),
    pushProfile(),
    pullTerritories(),
  ]);
}

// ----------------------------------------------------------------
// FEED
// ----------------------------------------------------------------

export async function createFeedPost(runId: string, distanceKm: number, territoriesClaimed: number, content?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('feed_posts').insert({
    user_id: user.id,
    run_id: runId,
    distance_km: distanceKm,
    territories_claimed: territoriesClaimed,
    content: content ?? null,
  });
}

export async function fetchFeed(limit = 20, offset = 0) {
  const { data, error } = await supabase.rpc('get_feed', {
    lim: limit,
    off_set: offset,
  });

  if (error) throw error;
  return data;
}

export async function toggleLike(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('toggle_like', {
    p_post_id: postId,
    p_user_id: user.id,
  });

  if (error) throw error;
  return data as boolean;
}

// ----------------------------------------------------------------
// LEADERBOARD
// ----------------------------------------------------------------

export async function fetchLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard_weekly')
    .select('*')
    .order('rank', { ascending: true })
    .limit(100);

  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------
// MISSIONS
// ----------------------------------------------------------------

export async function upsertMissionProgress(
  missionId: string,
  missionType: string,
  currentValue: number,
  completed: boolean,
  claimed: boolean,
  expiresAt: number
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('mission_progress').upsert({
    id: missionId,
    user_id: user.id,
    mission_type: missionType,
    current_value: currentValue,
    completed,
    claimed,
    expires_at: new Date(expiresAt).toISOString(),
  }, { onConflict: 'id,user_id' });
}

export async function fetchMissionProgress(missionIds: string[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('mission_progress')
    .select('*')
    .eq('user_id', user.id)
    .in('id', missionIds);

  if (error) return [];
  return data;
}

// ----------------------------------------------------------------
// DATABASE helper — safe select from IndexedDB for offline reads
// ----------------------------------------------------------------
export { getDB };
