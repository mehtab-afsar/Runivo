import {
  getNutritionEntries,
  getNutritionEntriesRange,
  saveNutritionProfile,
  addNutritionEntry,
  deleteNutritionEntry,
  type NutritionEntry,
  type NutritionProfile,
} from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { fetchExistingProfile } from './nutritionSetupService';

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Fetch today's nutrition entries.
 * Tries Supabase first, falls back to local SQLite.
 */
export async function fetchTodayEntries(date: string): Promise<NutritionEntry[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('log_date', date)
      .order('logged_at', { ascending: true });
    if (data && data.length > 0) {
      return data.map((row: any): NutritionEntry => ({
        id: row.id,
        date: row.log_date,
        meal: row.meal,
        name: row.name,
        kcal: row.kcal,
        proteinG: row.protein_g,
        carbsG: row.carbs_g,
        fatG: row.fat_g,
        servingSize: row.serving_size,
        source: row.source,
        xpAwarded: row.xp_awarded ?? false,
        loggedAt: new Date(row.logged_at).getTime(),
        synced: true,
      }));
    }
  }
  return getNutritionEntries(date);
}

/**
 * Fetch the nutrition profile.
 * Tries Supabase first (cross-device), caches locally, falls back to SQLite.
 */
export async function fetchNutritionProfile(): Promise<NutritionProfile | undefined> {
  try {
    const profile = await fetchExistingProfile();
    if (profile) {
      // Cache it locally so the app works offline
      await saveNutritionProfile(profile);
      return profile;
    }
  } catch { /* offline — fall through */ }
  return undefined;
}

/**
 * Fetch this week's entries for the chart.
 * Tries Supabase for the full range, falls back to local SQLite per day.
 */
export async function fetchWeekEntries(from: string, to: string): Promise<NutritionEntry[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('log_date', from)
      .lte('log_date', to)
      .order('logged_at', { ascending: true });
    if (data) {
      return data.map((row: any): NutritionEntry => ({
        id: row.id,
        date: row.log_date,
        meal: row.meal,
        name: row.name,
        kcal: row.kcal,
        proteinG: row.protein_g,
        carbsG: row.carbs_g,
        fatG: row.fat_g,
        servingSize: row.serving_size,
        source: row.source,
        xpAwarded: row.xp_awarded ?? false,
        loggedAt: new Date(row.logged_at).getTime(),
        synced: true,
      }));
    }
  }
  return getNutritionEntriesRange(from, to);
}

export async function addEntry(
  entry: Omit<NutritionEntry, 'id'>,
): Promise<number> {
  const localId = await addNutritionEntry(entry as NutritionEntry);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('nutrition_logs').upsert({
      user_id: session.user.id,
      log_date: entry.date,
      meal: entry.meal,
      name: entry.name,
      kcal: entry.kcal,
      protein_g: entry.proteinG,
      carbs_g: entry.carbsG,
      fat_g: entry.fatG,
      serving_size: entry.servingSize,
      source: entry.source,
      xp_awarded: entry.xpAwarded,
      logged_at: new Date(entry.loggedAt).toISOString(),
    });
  }
  return localId;
}

export async function deleteEntry(id: number): Promise<void> {
  await deleteNutritionEntry(id);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('nutrition_logs').delete().eq('id', id).eq('user_id', session.user.id);
  }
}
