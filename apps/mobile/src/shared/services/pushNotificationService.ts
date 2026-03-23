/**
 * pushNotificationService — registers the device push token with Supabase
 * and handles notification display behaviour.
 *
 * Call `syncPushSubscriptionOnLoad()` once after the user is authenticated
 * (done in AppNavigator's isAuthenticated useEffect).
 *
 * The token is stored in the `push_subscriptions` table:
 *   push_subscriptions(user_id, token, platform, updated_at)
 *
 * The `send-push-notification` Supabase edge function reads this table
 * to deliver Expo push notifications.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@shared/services/supabase';

// Show notifications as banners even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

/** Request permission and return the Expo push token string, or null. */
async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // Simulators can't receive push

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:       'Runivo',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D93518',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

/**
 * Register (or refresh) the device push token in Supabase.
 * Silent no-op if permissions are denied or the device is a simulator.
 */
export async function syncPushSubscriptionOnLoad(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const token = await getExpoPushToken();
    if (!token) return;

    await supabase.from('expo_push_tokens').upsert(
      {
        user_id:  user.id,
        token,
        platform: Platform.OS,
      },
      { onConflict: 'user_id,token' },
    );
  } catch (err) {
    // Non-fatal — push just won't work on this session
    console.warn('[push] syncPushSubscriptionOnLoad failed:', err);
  }
}
