import { getRuns, getShoes, getSettings } from '@shared/services/store';
import { calculatePersonalRecords, formatRecordValue, getRecordLabel } from '@shared/services/personalRecords';
import { supabase } from '@shared/services/supabase';

export async function fetchProfileData() {
  const [runs, shoes, settings] = await Promise.all([
    getRuns(200),
    getShoes(),
    getSettings(),
  ]);

  const records = await calculatePersonalRecords();
  const personalRecords = records
    .slice(0, 6)
    .map((r: any) => ({ label: getRecordLabel(r.type), value: formatRecordValue(r) }));

  const { data: { session } } = await supabase.auth.getSession();
  let avatarColor: string | null = null;
  let displayName: string | null = null;
  let bio: string | null = null;

  let location: string | null = null;
  let instagram: string | null = null;
  let strava: string | null = null;
  let avatarUrl: string | null = null;
  let weeklyGoalKmFromDb: number | null = null;
  let primaryGoal: string | null = null;
  let experienceLevel: string | null = null;
  let weeklyFrequency: number | null = null;
  let distanceUnit: string | null = null;
  let notificationsEnabled: boolean | null = null;
  let missionDifficulty: string | null = null;

  if (session) {
    const { data } = await supabase
      .from('profiles')
      .select('bio, avatar_color, display_name, location, instagram, strava, avatar_url, weekly_goal_km, primary_goal, experience_level, weekly_frequency, distance_unit, notifications_enabled, mission_difficulty')
      .eq('id', session.user.id)
      .single();
    if (data) {
      avatarColor = data.avatar_color ?? null;
      displayName = data.display_name ?? null;
      bio = data.bio ?? null;
      location = data.location ?? null;
      instagram = data.instagram ?? null;
      strava = data.strava ?? null;
      avatarUrl = data.avatar_url ?? null;
      weeklyGoalKmFromDb = data.weekly_goal_km ?? null;
      primaryGoal = data.primary_goal ?? null;
      experienceLevel = data.experience_level ?? null;
      weeklyFrequency = data.weekly_frequency ?? null;
      distanceUnit = data.distance_unit ?? null;
      notificationsEnabled = data.notifications_enabled ?? null;
      missionDifficulty = data.mission_difficulty ?? null;
    }
  }

  let followers = 0;
  let following = 0;
  if (session) {
    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', session.user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', session.user.id),
    ]);
    followers = followersCount ?? 0;
    following = followingCount ?? 0;
  }

  return {
    runs, shoes,
    weeklyGoalKm: weeklyGoalKmFromDb ?? settings.weeklyGoalKm,
    personalRecords, avatarColor, displayName, bio, location, instagram, strava, avatarUrl,
    primaryGoal, experienceLevel, weeklyFrequency, distanceUnit, notificationsEnabled, missionDifficulty,
    followers, following,
  };
}

export async function updateProfile(
  userId: string,
  patch: {
    display_name?: string; bio?: string; avatar_color?: string;
    location?: string; instagram?: string; strava?: string; avatar_url?: string;
    weekly_goal_km?: number; primary_goal?: string; experience_level?: string;
    weekly_frequency?: number; distance_unit?: string;
    notifications_enabled?: boolean; mission_difficulty?: string;
  },
): Promise<void> {
  await supabase.from('profiles').update(patch).eq('id', userId);
}

export async function uploadAvatar(userId: string, uri: string): Promise<string | null> {
  try {
    const cleanUri = uri.split('?')[0];
    const rawExt = cleanUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
    const path = `${userId}/avatar.${ext}`;
    const arrayBuffer = await fetch(uri).then(r => r.arrayBuffer());
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { upsert: true, contentType: `image/${ext}` });
    if (error) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export async function updateUsername(userId: string, name: string): Promise<void> {
  await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
}

export async function updateAvatarColor(userId: string, color: string): Promise<void> {
  await supabase.from('profiles').update({ avatar_color: color }).eq('id', userId);
}

export async function fetchAwards(userId: string): Promise<{ awardId: string; unlockedAt: string }[]> {
  try {
    const { data } = await supabase
      .from('user_awards')
      .select('award_id, unlocked_at')
      .eq('user_id', userId);
    return (data ?? []).map((r: { award_id: string; unlocked_at: string }) => ({
      awardId: r.award_id,
      unlockedAt: r.unlocked_at,
    }));
  } catch {
    return [];
  }
}

export async function fetchProfileStats(userId: string, period: string): Promise<{
  totalKm: number; totalRuns: number; avgPaceSec: number; totalCalories: number; totalZones: number;
}> {
  try {
    const { data } = await supabase.rpc('get_profile_stats', { p_user_id: userId, p_period: period });
    return data as { totalKm: number; totalRuns: number; avgPaceSec: number; totalCalories: number; totalZones: number };
  } catch {
    return { totalKm: 0, totalRuns: 0, avgPaceSec: 0, totalCalories: 0, totalZones: 0 };
  }
}

export async function fetchPersonalRecordsFromDb(userId: string): Promise<{
  fastest1kSec: number | null;
  fastest5kSec: number | null;
  fastest10kSec: number | null;
  longestRunM: number | null;
  bestPaceSec: number | null;
} | null> {
  try {
    const { data } = await supabase
      .from('personal_records')
      .select('fastest_1k_sec, fastest_5k_sec, fastest_10k_sec, longest_run_m, best_pace_sec')
      .eq('user_id', userId)
      .single();
    if (!data) return null;
    return {
      fastest1kSec:  data.fastest_1k_sec  ?? null,
      fastest5kSec:  data.fastest_5k_sec  ?? null,
      fastest10kSec: data.fastest_10k_sec ?? null,
      longestRunM:   data.longest_run_m   ?? null,
      bestPaceSec:   data.best_pace_sec   ?? null,
    };
  } catch {
    return null;
  }
}

export async function setPinnedRun(userId: string, runId: string | null): Promise<void> {
  await supabase.from('profiles').update({ pinned_run_id: runId }).eq('id', userId);
}
