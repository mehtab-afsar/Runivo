import { supabase } from '@shared/services/supabase';
import { getPlayer, initializePlayer, savePlayer, getSettings, saveSettings } from '@shared/services/store';
import { saveProfile } from '@shared/services/profile';
import { pushProfile } from '@shared/services/sync';
import { track } from '@shared/services/analytics';
import type { OnboardingData } from '../types';

export async function saveOnboardingData(
  data: OnboardingData,
  weeklyGoalKm: number,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const username = user?.user_metadata?.username || user?.user_metadata?.name || 'Runner';

  // Sign-out now clears all local data itself (see settingsService.signOut), so
  // there's no longer a "previous account's stale data" to defensively wipe here —
  // and wiping unconditionally was actively harmful: if onboarding is re-entered
  // for an ALREADY-authenticated user (e.g. the server's onboarding_completed_at
  // push failed silently on a prior attempt — see App.tsx's onboarding gate), this
  // deleted their real local runs/territories that were never wrong in the first
  // place.
  //
  // initializePlayer() always mints a brand-new player row (new id, zeroed PACE/
  // streak/distance) — reuse the existing local player if one is already there so
  // re-entering onboarding can't silently reset a returning user's progress.
  const existingPlayer = await getPlayer();
  const player = existingPlayer ?? await initializePlayer(username);

  // Persist the location captured during CityMapPreviewStep's permission grant, if
  // the user granted it — local save first (offline-first), pushed below via the
  // existing pushProfile() call at the end of this function.
  if (data.lastKnownLocation) {
    await savePlayer({
      ...player,
      lastKnownLocation: data.lastKnownLocation,
      country: data.country ?? null,
    });
  }

  const missionDifficulty =
    data.experienceLevel === 'new' ? 'easy' :
    data.experienceLevel === 'competitive' ? 'hard' : 'mixed';

  await saveProfile({
    playerId: player.id,
    age: data.age,
    gender: data.gender as 'male' | 'female' | 'other',
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    experienceLevel: data.experienceLevel,
    weeklyFrequency: data.weeklyFrequency,
    primaryGoal: data.primaryGoal,
    preferredDistance: data.preferredDistance,
    distanceUnit: data.distanceUnit,
    notificationsEnabled: data.notificationsEnabled,
    weeklyGoalKm,
    missionDifficulty,
    onboardingCompletedAt: Date.now(),
  });

  const currentSettings = await getSettings();
  await saveSettings({
    ...currentSettings,
    weeklyGoalKm,
    distanceUnit: data.distanceUnit,
    missionDifficulty,
  });

  await pushProfile().catch(() => {});
  track('onboarding_complete', { primaryGoal: data.primaryGoal, experienceLevel: data.experienceLevel });
}
