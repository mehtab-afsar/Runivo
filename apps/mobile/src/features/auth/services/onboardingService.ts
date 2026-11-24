import { supabase } from '@shared/services/supabase';
import { getPlayer, initializePlayer, savePlayer, getSettings, saveSettings } from '@shared/services/store';
import { saveProfile } from '@shared/services/profile';
import { pushProfile } from '@shared/services/sync';
import { track } from '@shared/services/analytics';
import {
  parseFiveKTime, experienceLevelFor, missionDifficultyFor, preferredDistanceFor,
  startingWeeklyTargetKm, paceXToneFor, ageForRange, validateUsername,
} from '@shared/engine/onboarding';
import { uploadAvatar } from '@features/profile/services/profileService';
import { localToday } from '@features/training/services/planService';
import { HEALTH_CONSENT_VERSION, parseGoalTime, raceDateForWeeks, type OnboardingData } from '../types';

/** What the answers turn into: the runner's starting setup. */
function goalSeconds(input: string): number | null {
  const r = parseGoalTime(input);
  return r.ok ? r.seconds : null;
}

export function deriveSetup(data: OnboardingData) {
  const fiveK = parseFiveKTime(data.fiveKInput);
  const fiveKSeconds = fiveK.ok ? fiveK.seconds : null;
  const goal = data.goal ?? 'get_fit';
  const experienceLevel = experienceLevelFor(data.runsPerWeek, data.usualKm, fiveKSeconds);
  return {
    goal,
    fiveKSeconds,
    experienceLevel,
    missionDifficulty: missionDifficultyFor(experienceLevel),
    preferredDistance: preferredDistanceFor(data.usualKm),
    paceXTone: data.paceXTone ?? paceXToneFor(goal),
    weeklyGoalKm: startingWeeklyTargetKm({
      runsPerWeek: data.runsPerWeek,
      usualKm: data.usualKm,
      goal,
      healthAvgWeeklyKm: data.healthConsent ? data.healthBaseline?.avgWeeklyKm : null,
    }),
  };
}

/**
 * Sets the runner's public name (and photo). Run at the name step so a taken
 * name is caught while they're still on it.
 */
export async function saveIdentity(username: string, avatarUri: string | null): Promise<void> {
  const check = validateUsername(username);
  if (!check.ok) throw new Error(check.error);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You’re signed out. Sign in again to continue.');

  const { error } = await supabase.from('profiles').update({ username: check.value }).eq('id', user.id);
  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) throw new Error('That name is taken. Try another.');
    throw new Error('Could not save your name. Check your connection.');
  }

  if (avatarUri) {
    const url = await uploadAvatar(user.id, avatarUri);
    if (url) await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
  }

  const player = await getPlayer();
  if (player) await savePlayer({ ...player, username: check.value });
}

export async function saveOnboardingData(data: OnboardingData, variant: 'full' | 'short' = 'full'): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const username = data.username || user?.user_metadata?.username || 'Runner';
  const setup = deriveSetup(data);

  // Reuse the local player if one exists, so re-entering onboarding never
  // resets a returning runner's progress.
  const existingPlayer = await getPlayer();
  const player = existingPlayer ?? await initializePlayer(username);
  await savePlayer({
    ...player,
    username,
    ...(data.lastKnownLocation && { lastKnownLocation: data.lastKnownLocation, country: data.country ?? null }),
  });

  await saveProfile({
    playerId: player.id,
    age: ageForRange(data.ageRange) ?? 0,
    gender: data.gender ?? '',
    heightCm: data.heightCm ?? 0,
    weightKg: data.weightKg ?? 0,
    experienceLevel: setup.experienceLevel,
    weeklyFrequency: data.runsPerWeek,
    primaryGoal: setup.goal,
    preferredDistance: setup.preferredDistance,
    distanceUnit: data.distanceUnit,
    notificationsEnabled: data.notificationsEnabled,
    weeklyGoalKm: setup.weeklyGoalKm,
    missionDifficulty: setup.missionDifficulty,
    onboardingCompletedAt: Date.now(),
    usualDistanceKm: data.usualKm,
    recentFiveKSeconds: setup.fiveKSeconds,
    ageRange: data.ageRange,
    paceXTone: setup.paceXTone,
  });

  const currentSettings = await getSettings();
  await saveSettings({
    ...currentSettings,
    weeklyGoalKm: setup.weeklyGoalKm,
    distanceUnit: data.distanceUnit,
    missionDifficulty: setup.missionDifficulty,
    notificationsEnabled: data.notificationsEnabled,
  });

  // The v1 answers PaceX coaches from (migration 20261106000005). Written
  // directly: pushProfile below only carries the older profile fields.
  if (user) {
    const { error } = await supabase.from('profiles').update({
      onboarding_variant: variant,
      usual_distance_km: data.usualKm,
      recent_5k_seconds: setup.fiveKSeconds,
      pacex_tone: setup.paceXTone,
      // Only an answer is written: skipping "About you" used to send null over the
      // age screen's 'under_18' (B04). The server also keeps 'under_18' once set.
      ...(data.ageRange && { age_range: data.ageRange }),
      health_consent_at: data.healthConsent ? new Date().toISOString() : null,
      health_consent_version: data.healthConsent ? HEALTH_CONSENT_VERSION : null,
      health_baseline: data.healthConsent ? data.healthBaseline : null,
      // 20261115000026: race, week and body, for PaceX and the plan builder.
      race_distance: data.goal === 'race' ? data.raceDistance : null,
      race_date: data.goal === 'race' && data.raceDistance ? raceDateForWeeks(localToday(), data.raceWeeks) : null,
      race_goal_seconds: data.goal === 'race' ? goalSeconds(data.raceGoalInput) : null,
      run_days: data.runDays.length ? data.runDays : null,
      long_run_day: data.runDays.includes(data.longRunDay) ? data.longRunDay : null,
      usual_run_time: data.usualTime,
      weekday_minutes: data.weekdayMinutes,
      niggles: data.niggles,
      returning_from_break: data.returning,
    }).eq('id', user.id);
    if (error) console.warn('[onboarding] could not save coaching answers:', error.message);
  }

  await pushProfile().catch(() => {});
  track('onboarding_complete', {
    goal: setup.goal,
    experienceLevel: setup.experienceLevel,
    healthConnected: data.healthConsent && !!data.healthBaseline,
    gaveAboutYou: !!(data.ageRange || data.gender || data.heightCm || data.weightKg),
    hasFiveK: setup.fiveKSeconds != null,
  });
}
