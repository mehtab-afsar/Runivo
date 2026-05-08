import {
  saveNutritionProfile,
  getNutritionProfile,
  type NutritionProfile,
} from '@shared/services/store';
import { supabase } from '@shared/services/supabase';

export async function saveNutritionProfileService(profile: NutritionProfile): Promise<void> {
  await saveNutritionProfile(profile);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('nutrition_profiles').upsert({
      user_id: session.user.id,
      goal: profile.goal,
      activity_level: profile.activityLevel,
      diet: profile.diet,
      weight_kg: profile.weightKg,
      height_cm: profile.heightCm,
      age: profile.age,
      sex: profile.sex,
      daily_goal_kcal: profile.dailyGoalKcal,
      protein_goal_g: profile.proteinGoalG,
      carbs_goal_g: profile.carbsGoalG,
      fat_goal_g: profile.fatGoalG,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function fetchExistingProfile(): Promise<NutritionProfile | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // Try saved nutrition profile first
    const { data: np } = await supabase
      .from('nutrition_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    if (np) {
      return {
        id: 'profile',
        goal: np.goal,
        activityLevel: np.activity_level,
        diet: np.diet,
        weightKg: np.weight_kg,
        heightCm: np.height_cm,
        age: np.age,
        sex: np.sex,
        dailyGoalKcal: np.daily_goal_kcal,
        proteinGoalG: np.protein_goal_g,
        carbsGoalG: np.carbs_goal_g,
        fatGoalG: np.fat_goal_g,
      } as NutritionProfile;
    }

    // Fall back to onboarding body stats stored in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('age, height_cm, weight_kg')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profile?.weight_kg || profile?.height_cm || profile?.age) {
      return {
        id: 'profile',
        goal: 'maintain',
        activityLevel: 'moderate',
        diet: 'everything',
        sex: 'male',
        weightKg: profile.weight_kg ?? 70,
        heightCm: profile.height_cm ?? 170,
        age: profile.age ?? 25,
        dailyGoalKcal: 0,
        proteinGoalG: 0,
        carbsGoalG: 0,
        fatGoalG: 0,
      } as NutritionProfile;
    }
  }
  return getNutritionProfile();
}
