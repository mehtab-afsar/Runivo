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
    const { data } = await supabase
      .from('nutrition_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    if (data) {
      return {
        id: 'profile',
        goal: data.goal,
        activityLevel: data.activity_level,
        diet: data.diet,
        weightKg: data.weight_kg,
        heightCm: data.height_cm,
        age: data.age,
        sex: data.sex,
        dailyGoalKcal: data.daily_goal_kcal,
        proteinGoalG: data.protein_goal_g,
        carbsGoalG: data.carbs_goal_g,
        fatGoalG: data.fat_goal_g,
      } as NutritionProfile;
    }
  }
  return getNutritionProfile();
}
