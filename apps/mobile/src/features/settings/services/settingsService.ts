import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { getSettings, saveSettings, clearAllLocalData, getRuns } from '@shared/services/store';
import { pushUnsyncedRuns } from '@shared/services/sync';
import type { StoredSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { SERVER_SETTING_COLUMNS, profileColumnsFor, settingsFromProfileRow } from '@shared/services/accountSettings';
import { resetAnalytics } from '@shared/services/analytics';
import { unsubscribeFromPush } from '@shared/services/pushNotificationService';
import { stopBackgroundTracking, wipeRunTrackingState } from '@features/run/services/locationTask';
import { clearCachedPlan } from '@features/training/services/planService';
import { logOutRevenueCat } from '@features/subscription/services/purchaseService';

export async function loadSettings(): Promise<StoredSettings> {
  return getSettings();
}

/** Settings that live on the server profile as well as on the phone. */
export const SERVER_SYNCED_SETTINGS: ReadonlySet<keyof StoredSettings> = new Set(
  Object.keys(SERVER_SETTING_COLUMNS) as (keyof StoredSettings)[],
);

/**
 * Saves locally (always), then mirrors the CHANGED server-side keys to the profile.
 * Only `changed` is sent: sending every column on every toggle wrote stale phone
 * values over the server (B02). Resolves `{ synced: false }` when the server rejected
 * or couldn't be reached. Signed-out, or nothing server-side changed = nothing to sync.
 */
export async function persistSettings(
  settings: StoredSettings,
  changed: readonly (keyof StoredSettings)[],
): Promise<{ synced: boolean }> {
  await saveSettings(settings);
  const columns = profileColumnsFor(settings, changed);
  if (Object.keys(columns).length === 0) return { synced: true };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { synced: true };
    const { error } = await supabase.from('profiles').update(columns).eq('id', session.user.id);
    return { synced: !error };
  } catch {
    // Unreachable: reported to the caller as not synced; retried on the next change.
    return { synced: false };
  }
}

/**
 * The server's copy of the account settings for the signed-in runner, merged into
 * the phone's settings and saved. Returns null when signed out or unreachable
 * (the phone keeps what it has).
 */
export async function pullServerSettings(): Promise<StoredSettings | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select(Object.values(SERVER_SETTING_COLUMNS).join(', '))
      .eq('id', session.user.id)
      .maybeSingle();
    if (error || !data) return null;
    const next = { ...(await getSettings()), ...settingsFromProfileRow(data as unknown as Record<string, unknown>) };
    await saveSettings(next);
    return next;
  } catch {
    // Unreachable or signed out: null means "nothing from the server", so local settings stay as they are.
    return null;
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
  if (error) {
    // Offline: the global revoke can't reach the server, which left the runner
    // unable to sign out at all. End this phone's session instead (B18).
    if (!isAuthRetryableFetchError(error)) return { ok: false };
    const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
    if (localError) return { ok: false };
  }

  await wipeThisPhone();
  return { ok: true };
}

/**
 * Everything this phone kept for the runner who just left (signed out or
 * deleted): local data, the screen-off GPS buffer, an unfinished-run checkpoint
 * (which the next account would be offered to "recover" into its own history),
 * the cached training plan, the RevenueCat identity and the analytics id.
 */
export async function wipeThisPhone(): Promise<void> {
  await clearAllLocalData();
  await stopBackgroundTracking().catch(() => {});
  await wipeRunTrackingState();
  await clearCachedPlan().catch(() => {});
  await logOutRevenueCat();
  resetAnalytics();
}


/** Whether the runner has agreed to share imported health-app data (profiles.health_consent_at). */
export async function hasHealthConsent(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data } = await supabase.from('profiles').select('health_consent_at').eq('id', session.user.id).maybeSingle();
    return !!(data as { health_consent_at: string | null } | null)?.health_consent_at;
  } catch {
    // Cannot confirm consent: report none, so nothing health-related is sent (fails closed).
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
    // Unreachable: return false so the caller tells the user the withdrawal did not go through.
    return false;
  }
}
