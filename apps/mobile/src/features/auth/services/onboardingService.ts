import { supabase } from '@shared/services/supabase';
import { initializePlayer, getSettings, saveSettings } from '@shared/services/store';
import { saveProfile, computeWeeklyGoal } from '@shared/services/profile';
import { pushProfile } from '@shared/services/sync';
import type { OnboardingData } from '../types';

export async function saveOnboardingData(
  data: OnboardingData,
  weeklyGoalKm: number,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const username = user?.user_metadata?.username || user?.user_metadata?.name || 'Runner';
  const player = await initializePlayer(username);

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
}
