/** Nutrition: push unsynced log entries and the setup profile. */
import { supabase } from '../supabase';
import {
  getNutritionProfile, getUnsyncedNutritionEntries, markNutritionEntrySynced,
} from '../store';
import { getAuthenticatedUser } from './syncAuth';

/** Push unsynced local nutrition log entries to Supabase. */
export async function pushNutritionLogs(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const unsynced = await getUnsyncedNutritionEntries();
  if (unsynced.length === 0) return;

  // Each entry gets a stable remote UUID the first time it syncs (reused on retry) —
  // using the local autoincrement id directly as the remote PK let two devices that
  // both start counting from 1 collide and silently drop each other's entries.
  const withRemoteId = unsynced.map(e => ({ entry: e, remoteId: e.remoteId ?? crypto.randomUUID() }));

  const { error } = await supabase.from('nutrition_logs').upsert(
    withRemoteId.map(({ entry: e, remoteId }) => ({
      id: remoteId,
      user_id: user.id,
      log_date: e.date,
      meal: e.meal,
      name: e.name,
      kcal: e.kcal,
      protein_g: e.proteinG,
      carbs_g: e.carbsG,
      fat_g: e.fatG,
      serving_size: e.servingSize,
      source: e.source,
      logged_at: new Date(e.loggedAt).toISOString(),
      xp_awarded: e.xpAwarded,
    })),
    { onConflict: 'id' }
  );

  if (!error) {
    for (const { entry: e, remoteId } of withRemoteId) {
      if (e.id !== undefined) await markNutritionEntrySynced(e.id as number, remoteId);
    }
  } else {
    console.warn('[sync] pushNutritionLogs failed:', error.message);
  }
}

/** Push the local nutrition profile (setup data) to Supabase. */
export async function pushNutritionProfile(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const np = await getNutritionProfile();
  if (!np) return;

  const { error } = await supabase.from('nutrition_profiles').upsert({
    user_id: user.id,
    goal: np.goal,
    activity_level: np.activityLevel,
    diet: np.diet,
    weight_kg: np.weightKg,
    height_cm: np.heightCm,
    age: np.age,
    sex: np.sex,
    daily_goal_kcal: np.dailyGoalKcal,
    protein_goal_g: np.proteinGoalG,
    carbs_goal_g: np.carbsGoalG,
    fat_goal_g: np.fatGoalG,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) console.warn('[sync] pushNutritionProfile failed:', error.message);
}
