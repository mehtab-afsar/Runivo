import { getRuns, getSettings } from '@shared/services/store';
import { readCleanImage } from '@mobile/shared/lib/cleanImageUpload';
import { calculatePersonalRecords, formatRecordValue, getRecordLabel } from '@shared/services/personalRecords';
import { supabase } from '@shared/services/supabase';

export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: followersCount ?? 0, following: followingCount ?? 0 };
}

export async function fetchProfileData() {
  const [runs, settings] = await Promise.all([
    getRuns(200),
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
  let profileVisibility: string | null = null;
  let gender: string | null = null;
  let age: number | null = null;
  let heightCm: number | null = null;
  let weightKg: number | null = null;

  if (session) {
    const { data } = await supabase
      .from('profiles')
      .select('bio, avatar_color, display_name, location, instagram, strava, avatar_url, weekly_goal_km, primary_goal, experience_level, weekly_frequency, distance_unit, notifications_enabled, mission_difficulty, profile_visibility, gender, age, height_cm, weight_kg')
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
      profileVisibility = data.profile_visibility ?? null;
      gender = data.gender ?? null;
      age = data.age ?? null;
      heightCm = data.height_cm ?? null;
      weightKg = data.weight_kg != null ? Number(data.weight_kg) : null;
    }
  }

  const { followers, following } = session
    ? await fetchFollowCounts(session.user.id)
    : { followers: 0, following: 0 };

  return {
    runs,
    weeklyGoalKm: weeklyGoalKmFromDb ?? settings.weeklyGoalKm,
    personalRecords, avatarColor, displayName, bio, location, instagram, strava, avatarUrl,
    primaryGoal, experienceLevel, weeklyFrequency, distanceUnit, notificationsEnabled, missionDifficulty,
    profileVisibility,
    gender, age, heightCm, weightKg,
    followers, following,
  };
}

export async function updateProfile(
  userId: string,
  patch: {
    display_name?: string | null; bio?: string | null; avatar_color?: string;
    location?: string | null; instagram?: string | null; strava?: string | null; avatar_url?: string | null;
    gender?: string | null; age?: number | null; height_cm?: number | null; weight_kg?: number | null;
    weekly_goal_km?: number; primary_goal?: string; experience_level?: string;
    weekly_frequency?: number; distance_unit?: string;
    notifications_enabled?: boolean; mission_difficulty?: string;
  },
): Promise<void> {
  // Throws so the editor can say it didn't save, rather than closing as if it had.
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error("Couldn't save your profile. Check your connection and try again.");
}

export async function uploadAvatar(userId: string, uri: string): Promise<string | null> {
  try {
    const img = await readCleanImage(uri);
    const path = `${userId}/avatar.${img.ext}`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, img.body, { upsert: true, contentType: img.contentType });
    if (error) return null;
    // A photo in another format would stay public under the old name.
    const stale = ['jpg', 'png', 'webp', 'gif'].filter(e => e !== img.ext).map(e => `${userId}/avatar.${e}`);
    supabase.storage.from('avatars').remove(stale).catch(() => {});
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
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

export async function setPinnedRun(userId: string, runId: string | null): Promise<void> {
  await supabase.from('profiles').update({ pinned_run_id: runId }).eq('id', userId);
}
