/**
 * The weekly distance goal (H4): kept in local settings for Home and in the
 * profile row so it follows the runner across devices.
 */
import { getSettings, saveSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';

export const GOAL_CHOICES_KM = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80] as const;

export async function saveWeeklyGoal(km: number): Promise<void> {
  const goal = Math.max(1, Math.min(300, Math.round(km)));
  const settings = await getSettings();
  await saveSettings({ ...settings, weeklyGoalKm: goal });
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await supabase.from('profiles').update({ weekly_goal_km: goal }).eq('id', session.user.id);
}
