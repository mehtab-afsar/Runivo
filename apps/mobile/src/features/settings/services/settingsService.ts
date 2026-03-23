import { getSettings, saveSettings } from '@shared/services/store';
import type { StoredSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';

export async function loadSettings(): Promise<StoredSettings> {
  return getSettings();
}

export async function persistSettings(settings: StoredSettings): Promise<void> {
  await saveSettings(settings);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
