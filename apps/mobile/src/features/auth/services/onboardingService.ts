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
import { HEALTH_CONSENT_VERSION, type OnboardingData } from '../types';

/** What the answers turn into: the runner's starting setup. */
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
    paceXTone: paceXToneFor(goal),
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

/**
 * DEV ONLY (callers gate on __DEV__): finish onboarding with default answers so a
 * freshly signed-up test account lands straight in the app. Creates the same local
 * player/profile and server completion marker the real flow does.
 */
export async function completeOnboardingWithDefaults(): Promise<void> {
  await saveOnboardingData({
    lastKnownLocation: null, country: null,
    goal: 'get_fit',
    runsPerWeek: 3, usualKm: 5, fiveKInput: '',
    healthConsent: false, healthBaseline: null,
    ageRange: null, gender: null, heightCm: null, weightKg: null,
    username: '', avatarUri: null,
    notificationsEnabled: false,
    distanceUnit: 'km',
  });
}

export async function saveOnboardingData(data: OnboardingData): Promise<void> {
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
      usual_distance_km: data.usualKm,
      recent_5k_seconds: setup.fiveKSeconds,
      pacex_tone: setup.paceXTone,
      age_range: data.ageRange,
      health_consent_at: data.healthConsent ? new Date().toISOString() : null,
      health_consent_version: data.healthConsent ? HEALTH_CONSENT_VERSION : null,
      health_baseline: data.healthConsent ? data.healthBaseline : null,
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
