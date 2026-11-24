/**
 * The runner's profile row: push local player/profile data up, pull the server's
 * authoritative values back. Server-owned columns (PACE, streak, rank, distance totals)
 * are never pushed; see the notes inside pushProfile.
 */
import { supabase } from '../supabase';
import { weeklyPaceNow } from '../../engine/runEngine';
import { getPlayer, savePlayer, type StoredPlayer } from '../store';
import type { RunnerRank } from '../../types/game';
import { getProfile } from '../profile';
import { getAuthenticatedUser } from './syncAuth';

function deviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.includes('/') ? tz : null;
  } catch {
    // Intl is unavailable on this runtime: the profile just goes up without a time zone.
    return null;
  }
}

/** Push local player data to Supabase profiles table. */
export async function pushProfile(): Promise<void> {
  const [player, profile] = await Promise.all([getPlayer(), getProfile()]);
  if (!player) return;

  const user = await getAuthenticatedUser();
  if (!user) return;

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    username: player.username,
    level: player.level,
    xp: player.xp,
    coins: player.coins,
    energy: player.energy,
    last_energy_regen: player.lastEnergyRegen ? new Date(player.lastEnergyRegen).toISOString() : new Date().toISOString(),
    total_territories_claimed: player.totalTerritoriesClaimed,
    // total_distance_km / total_runs deliberately NOT pushed (as of
    // lock_run_stat_columns.sql) — clubService.ts ranks club leaderboards on
    // total_distance_km with no other server recomputation, so a client-pushed
    // absolute value here was a direct leaderboard spoof. process-run-territory's
    // increment_run_stats RPC (service_role only) is now the sole writer, using its
    // own GPS-derived distance for each run. Pushing here would just be ignored by
    // protect_profile_columns, same as pace_*/streak_days below — not pushing at all
    // avoids the client ever reconstructing a stale value.
    // streak_days / last_run_date deliberately NOT pushed — streak_days feeds
    // process-run-territory's PACE streak bonus directly, so (like the pace_*
    // fields below) it's computed and persisted server-side from the profile's
    // own prior last_run_date, not trusted from the client. The client still
    // computes an optimistic streak locally for immediate UI feedback; pullProfile()
    // reads the authoritative value back. Pushing here would just be ignored by
    // the protect_profile_columns trigger, but not pushing at all matches the
    // pace_* precedent below and avoids the client ever reconstructing a stale value.
    // CRITICAL PATH: pace_balance / pace_total_earned / pace_weekly_earned are NEVER
    // pushed from the client. credit_pace_capped (called from process-run-territory
    // after every run) is the only thing allowed to modify them server-side — it does
    // an atomic, capped increment. A client upsert of an
    // absolute value here would silently overwrite that atomic increment with a
    // client-reconstructed number — this was the actual mechanism behind the PACE
    // balance corruption a prior session's pullProfile() fix and diagnose_pace_ledger()
    // migration addressed. The client still computes and stores these locally (for the
    // offline-friendly immediate post-run UI) and PULLS the server's authoritative value
    // via pullProfile() — it must just never push them.
    // pace_weekly_reset_at and runner_rank are server-owned too: credit_pace_capped
    // resets the week and sets the rank. Pushing them let a client reset its own cap.
    // City rank / rival proximity — only sent once a location has actually been
    // captured (onboarding grant or post-run); never overwrites with an empty value.
    ...(player.lastKnownLocation && {
      last_known_location: `SRID=4326;POINT(${player.lastKnownLocation.lng} ${player.lastKnownLocation.lat})`,
    }),
    ...(player.country && { country: player.country }),
    // IANA zone so reminders, fading-zone alerts and campaigns arrive at the
    // runner's local hour (run_hourly_notifications). The server falls back
    // to UTC for anything it doesn't recognise.
    ...(deviceTimeZone() && { timezone: deviceTimeZone() }),
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

  if (error) throw new Error(error.message);
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
    // level / xp / coins / energy are legacy game stats the server no longer lets
    // clients write (20261123000004) and never computes, so its copy stays at the
    // defaults: keep this phone's values instead of resetting them after every run.
    level: existing?.level ?? data.level,
    xp: existing?.xp ?? data.xp,
    coins: existing?.coins ?? data.coins,
    energy: existing?.energy ?? data.energy,
    lastEnergyRegen: (() => {
      const ms = new Date(data.last_energy_regen).getTime();
      // Guard against epoch-seconds values (would resolve to ~1970)
      return ms > 1e12 ? ms : ms * 1000;
    })(),
    totalDistanceKm: Number(data.total_distance_km),
    totalRuns: data.total_runs,
    totalTerritoriesClaimed: data.total_territories_claimed,
    totalEnemyCaptured: data.total_enemy_captured ?? 0,
    streakDays: data.streak_days,
    lastRunDate: data.last_run_date,
    lastLoginBonusDate: existing?.lastLoginBonusDate ?? null,
    // Union-merge: achievements from DB + local — never remove earned badges
    unlockedAchievements: Array.from(new Set([
      ...(existing?.unlockedAchievements ?? []),
      ...((data.unlocked_achievements as string[]) ?? []),
    ])),
    createdAt: new Date(data.created_at).getTime(),
    // CRITICAL: savePlayer() fully replaces the local record (IndexedDB/SQLite put,
    // not a partial merge) — any field left out here is silently wiped to undefined
    // on every pull. The PACE/rank fields below ARE pushed by pushProfile() above,
    // so they must be read back here or a login/postRunSync pull resets a player's
    // real balance to 0. Fields never pushed to the server (territoryScore,
    // largestTierAchieved, earnedAwardIds, pinnedRunId, lastKnownLocation) are kept
    // from the existing local record — the server has no authoritative value for them.
    paceBalance:        typeof data.pace_balance       === 'number' ? data.pace_balance       : (existing?.paceBalance       ?? 0),
    paceTotalEarned:    typeof data.pace_total_earned  === 'number' ? data.pace_total_earned   : (existing?.paceTotalEarned   ?? 0),
    paceWeeklyEarned:   typeof data.pace_weekly_earned === 'number'
      ? weeklyPaceNow(data.pace_weekly_earned, data.pace_weekly_reset_at)
      : (existing?.paceWeeklyEarned ?? 0),
    paceWeeklyResetAt:  data.pace_weekly_reset_at ?? existing?.paceWeeklyResetAt ?? new Date().toISOString(),
    runnerRank:         (data.runner_rank as RunnerRank | undefined) ?? existing?.runnerRank ?? 'pacer',
    subscriptionTier:   typeof data.subscription_tier === 'string' ? data.subscription_tier : (existing?.subscriptionTier ?? 'free'),
    territoryScore:     existing?.territoryScore ?? 0,
    largestTierAchieved: existing?.largestTierAchieved,
    earnedAwardIds:      existing?.earnedAwardIds,
    pinnedRunId:         existing?.pinnedRunId,
    country:            (typeof data.country === 'string' ? data.country : null) ?? existing?.country ?? null,
    lastKnownLocation:   existing?.lastKnownLocation ?? null,
  } satisfies StoredPlayer);
}
