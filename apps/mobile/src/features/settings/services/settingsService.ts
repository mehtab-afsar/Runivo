import { getSettings, saveSettings, clearAllLocalData, getRuns } from '@shared/services/store';
import { pushUnsyncedRuns } from '@shared/services/sync';
import type { StoredSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { resetAnalytics } from '@shared/services/analytics';
import { unsubscribeFromPush } from '@shared/services/pushNotificationService';
import { stopBackgroundTracking, wipeRunTrackingState } from '@features/run/services/locationTask';
import { clearCachedPlan } from '@features/training/services/planService';
import { logOutRevenueCat } from '@features/subscription/services/purchaseService';

export async function loadSettings(): Promise<StoredSettings> {
  return getSettings();
}

/** Settings that live on the server profile as well as on the phone. */
export const SERVER_SYNCED_SETTINGS: ReadonlySet<keyof StoredSettings> = new Set([
  'distanceUnit', 'notificationsEnabled', 'missionDifficulty', 'runReminders', 'territoryAlerts',
  'announceAchievements', 'weeklySummary', 'offersEnabled', 'privacy', 'liveRunSharingEnabled',
]);

/**
 * Saves locally (always), then mirrors to the server profile. Resolves `{ synced: false }`
 * when the server rejected or couldn't be reached, so callers can tell the user instead of
 * showing a privacy toggle as saved when the server never got it. Signed-out = nothing to sync.
 */
export async function persistSettings(settings: StoredSettings): Promise<{ synced: boolean }> {
  await saveSettings(settings);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { synced: true };
    const { error } = await supabase.from('profiles').update({
      distance_unit: settings.distanceUnit,
      notifications_enabled: settings.notificationsEnabled,
      mission_difficulty: settings.missionDifficulty,
      run_reminders_enabled: settings.runReminders,
      territory_alerts_enabled: settings.territoryAlerts,
      announce_achievements_enabled: settings.announceAchievements,
      weekly_summary_enabled: settings.weeklySummary,
      offers_enabled: settings.offersEnabled ?? false,
      profile_visibility: settings.privacy,
      live_run_sharing_enabled: settings.liveRunSharingEnabled,
    }).eq('id', session.user.id);
    return { synced: !error };
  } catch {
    return { synced: false };
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
/**
 * Sign-out wipes every run kept on this phone, so try to upload the ones that
 * haven't reached the server first. Returns how many are still only on the
 * phone (offline, or the upload failed); the caller warns before losing them.
 */
export async function runsOnlyOnThisPhone(): Promise<number> {
  await pushUnsyncedRuns().catch(() => {});
  const runs = await getRuns().catch(() => []);
  return runs.filter(r => !r.synced).length;
}

export async function signOut(): Promise<{ ok: boolean }> {
  await unsubscribeFromPush().catch(() => {});

  // scope: 'global' revokes every refresh token for this user, not just this
  // device's. A local-only sign-out leaves a stolen session usable — which is
  // exactly the situation someone is in when they reach for "sign out".
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) return { ok: false };

  await clearAllLocalData();
  // Everything else this phone kept for the runner who just left: the screen-off
  // GPS buffer, an unfinished-run checkpoint (which the next account would be
  // offered to "recover" into its own history), the cached training plan, and
  // the RevenueCat identity.
  await stopBackgroundTracking().catch(() => {});
  await wipeRunTrackingState();
  await clearCachedPlan().catch(() => {});
  await logOutRevenueCat();
  resetAnalytics();
  return { ok: true };
}


/** Whether the runner has agreed to share imported health-app data (profiles.health_consent_at). */
export async function hasHealthConsent(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data } = await supabase.from('profiles').select('health_consent_at').eq('id', session.user.id).maybeSingle();
    return !!(data as { health_consent_at: string | null } | null)?.health_consent_at;
  } catch {
    return false;
  }
}

/**
 * Take back the consent given during onboarding. Clearing health_consent_at is
 * the whole server-side action: a database trigger then deletes the imported
 * baseline, so what the onboarding screen promised ("switching it off deletes
 * what we imported") is true. Nothing health-related is kept on the phone.
 */
export async function withdrawHealthConsent(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ health_consent_at: null, health_consent_version: null })
      .eq('id', session.user.id);
    return !error;
  } catch {
    return false;
  }
}
