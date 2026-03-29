import { getSettings, saveSettings } from '@shared/services/store';
import type { StoredSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';

export async function loadSettings(): Promise<StoredSettings> {
  return getSettings();
}

export async function persistSettings(settings: StoredSettings): Promise<void> {
  await saveSettings(settings);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('profiles').update({
      distance_unit: settings.distanceUnit,
      notifications_enabled: settings.notificationsEnabled,
      mission_difficulty: settings.missionDifficulty,
    }).eq('id', session.user.id);
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
