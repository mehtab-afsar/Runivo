import {
  getNutritionEntries,
  getNutritionEntriesRange,
  getRecentFoods,
  saveNutritionProfile,
  addNutritionEntry,
  updateNutritionEntry,
  deleteNutritionEntry,
  markNutritionEntrySynced,
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
    // A stable client-generated remote id — the local `id` is a per-device
    // autoincrement integer with no relation to the server's UUID primary key,
    // so it's stored back on the local entry (markNutritionEntrySynced) for any
    // later operation (delete) that needs to address this exact remote row.
    const remoteId = crypto.randomUUID();
    const { error } = await supabase.from('nutrition_logs').upsert({
      id: remoteId,
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
    if (!error) await markNutritionEntrySynced(localId, remoteId);
  }
  return localId;
}

/**
 * Distinct foods logged before, most recent first — local SQLite only,
 * so this stays fast and works offline.
 */
export async function fetchRecentFoods(limit = 8): Promise<NutritionEntry[]> {
  try {
    return await getRecentFoods(limit);
  } catch {
    return [];
  }
}

export async function updateEntry(
  id: number,
  patch: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded' | 'synced' | 'remoteId'>,
  remoteId?: string,
): Promise<void> {
  await updateNutritionEntry(id, patch);
  if (!remoteId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('nutrition_logs').update({
      meal: patch.meal,
      name: patch.name,
      kcal: patch.kcal,
      protein_g: patch.proteinG,
      carbs_g: patch.carbsG,
      fat_g: patch.fatG,
      serving_size: patch.servingSize,
    }).eq('id', remoteId).eq('user_id', session.user.id);
  }
}

export async function deleteEntry(id: number, remoteId?: string): Promise<void> {
  await deleteNutritionEntry(id);
  // Without remoteId, this entry was never synced (or was created before
  // remoteId existed) — there's no remote row to delete.
  if (!remoteId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('nutrition_logs').delete().eq('id', remoteId).eq('user_id', session.user.id);
  }
}
