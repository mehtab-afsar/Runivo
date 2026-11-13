import { getSettings, saveSettings, clearAllLocalData } from '@shared/services/store';
import type { StoredSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { resetAnalytics } from '@shared/services/analytics';
import { unsubscribeFromPush } from '@shared/services/pushNotificationService';

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
      run_reminders_enabled: settings.runReminders,
      territory_alerts_enabled: settings.territoryAlerts,
      announce_achievements_enabled: settings.announceAchievements,
      weekly_summary_enabled: settings.weeklySummary,
      offers_enabled: settings.offersEnabled ?? true,
      profile_visibility: settings.privacy,
      live_run_sharing_enabled: settings.liveRunSharingEnabled,
    }).eq('id', session.user.id);
  }
}

/**
 * Sign-out must clear this device's local data before the next account signs in —
 * otherwise the next user inherits (and initialSync() uploads into their own account)
 * whatever runs/territories/PACE the previous user left cached locally. Order matters:
 * unsubscribe the push token while still authenticated (RLS needs auth.uid()), then
 * confirm the server-side sign-out actually succeeded before wiping anything local —
 * supabase-js keeps the local session alive on a network failure, so clearing local
 * data in that case would strand the still-signed-in user with no data.
 */
export async function signOut(): Promise<{ ok: boolean }> {
  await unsubscribeFromPush().catch(() => {});

  // scope: 'global' revokes every refresh token for this user, not just this
  // device's. A local-only sign-out leaves a stolen session usable — which is
  // exactly the situation someone is in when they reach for "sign out".
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) return { ok: false };

  await clearAllLocalData();
  resetAnalytics();
  return { ok: true };
}
