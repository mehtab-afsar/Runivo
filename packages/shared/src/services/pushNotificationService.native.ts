/**
 * pushNotificationService — Expo Push Notifications (native iOS/Android).
 *
 * Metro resolves this file over pushNotificationService.ts on mobile via the
 * `.native.ts` extension convention.
 *
 * Handles:
 *  1. Permission request via expo-notifications
 *  2. Expo push token retrieval (projectId from app.config.ts)
 *  3. Saving the token to Supabase `expo_push_tokens` table
 *  4. Foreground notification display handler
 *
 * Required env var (mobile app):
 *   EXPO_PUBLIC_EAS_PROJECT_ID — the EAS project UUID from app.json / eas.json
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Show banners + play sound when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// ── Capability check ───────────────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return Device.isDevice; // simulators can't receive push
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  // Synchronous check not available on native; always return 'default' to
  // trigger the async subscribe path. Callers that need accuracy should
  // await Notifications.getPermissionsAsync().
  if (!isPushSupported()) return 'unsupported';
  return 'default';
}

// ── Token retrieval ────────────────────────────────────────────────────────────

async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data;
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

// ── Android notification channel ──────────────────────────────────────────────

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name:       'Runivo',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#D93518',
  });
}

// ── Subscribe ──────────────────────────────────────────────────────────────────

/**
 * Requests notification permission, retrieves the Expo push token, and saves
 * it to Supabase `expo_push_tokens` so the edge function can fan out.
 *
 * Returns 'granted' | 'denied' | 'unsupported' | 'error'
 */
export async function subscribeToPush(): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
  if (!isPushSupported()) return 'unsupported';

  await ensureAndroidChannel();

  // 1. Check / request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return 'denied';

  // 2. Get Expo push token
  const token = await getExpoPushToken();
  if (!token) return 'error';

  // 3. Save to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'error';

    await supabase.from('expo_push_tokens').upsert(
      { user_id: user.id, token, platform: Platform.OS },
      { onConflict: 'user_id,token' }
    );
  } catch (err) {
    console.warn('[push] Failed to save Expo push token:', err);
    // Permission granted even if DB write fails
  }

  return 'granted';
}

// ── Unsubscribe ────────────────────────────────────────────────────────────────

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const token = await getExpoPushToken();
  if (!token) return;

  try {
    await supabase.from('expo_push_tokens').delete().eq('token', token);
  } catch { /* non-critical */ }
}

// ── Sync on app open ───────────────────────────────────────────────────────────

/**
 * Called once on app load. If permission was already granted, silently
 * re-upserts the token (handles token rotation after app reinstall).
 */
export async function syncPushSubscriptionOnLoad(): Promise<void> {
  if (!isPushSupported()) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await ensureAndroidChannel();

  const token = await getExpoPushToken();
  if (!token) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('expo_push_tokens').upsert(
      { user_id: user.id, token, platform: Platform.OS },
      { onConflict: 'user_id,token' }
    );
  } catch { /* silent — don't disrupt app load */ }
}
