/**
 * notificationHandler — wires up deep link navigation from push notification taps.
 *
 * Call `registerNotificationHandler(navigationRef)` once in App.tsx after the
 * NavigationContainer mounts. Uses a NavigationContainerRef so we can navigate
 * from outside the component tree.
 *
 * action_url conventions (sent from the edge function):
 *   /run/summary/:runId      → RunSummary screen
 *   /territory/:hexId        → TerritoryMap (focus hex)
 *   /notifications           → Notifications screen
 *   /missions                → Missions screen
 *   /leaderboard             → Leaderboard screen
 *   /profile                 → Profile screen
 *   /events                  → Events screen
 *   /clubs                   → Clubs screen
 *   /feed                    → Feed screen
 *   /lobby                   → Lobby screen
 *   / or unknown             → no-op (app opens to current screen)
 */

import * as Notifications from 'expo-notifications';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';

type NavRef = NavigationContainerRef<RootStackParamList>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

type AnyNav = { navigate: (screen: string, params?: unknown) => void };

function applyRoute(nav: AnyNav, actionUrl: string): void {
  const url = actionUrl ?? '/';

  if (url.startsWith('/run/summary/')) { nav.navigate('History'); return; }
  if (url === '/notifications') { nav.navigate('Notifications'); return; }
  if (url === '/missions')      { nav.navigate('Missions');      return; }
  if (url === '/leaderboard')   { nav.navigate('Leaderboard');   return; }
  if (url === '/profile')       { nav.navigate('Main');          return; }
  if (url === '/events')        { nav.navigate('Events');        return; }
  if (url === '/clubs')         { nav.navigate('Club');          return; }
  if (url === '/feed')          { nav.navigate('Main');          return; }
  if (url === '/lobby')         { nav.navigate('Lobby');         return; }
  if (url === '/history')       { nav.navigate('History');       return; }
  // /territory/:hexId and unknown paths — no navigation
}

/** Navigate from a notification action_url using a screen navigation prop. */
export function routeNotificationUrl(url: string | undefined, navigation: NavProp): void {
  if (!url) return;
  applyRoute(navigation as AnyNav, url);
}

function navigate(navRef: NavRef, actionUrl: string): void {
  if (!navRef.isReady()) return;
  applyRoute(navRef as AnyNav, actionUrl);
}

let _cleanup: (() => void) | null = null;

/**
 * Register notification tap listener. Safe to call multiple times —
 * cleans up the previous listener before registering a new one.
 */
export function registerNotificationHandler(navRef: NavRef): void {
  if (_cleanup) {
    _cleanup();
    _cleanup = null;
  }

  // Tapped while app was in foreground or background (app already open)
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { actionUrl?: string };
    if (data?.actionUrl) {
      navigate(navRef, data.actionUrl);
    }
  });

  _cleanup = () => responseSub.remove();
}

/**
 * Call once at startup to handle the notification that launched the app from
 * a killed state (last notification the user tapped before app was opened).
 */
export async function handleLaunchNotification(navRef: NavRef): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;

  const data = response.notification.request.content.data as { actionUrl?: string };
  if (data?.actionUrl) {
    // Delay slightly to let the navigator mount fully
    setTimeout(() => navigate(navRef, data.actionUrl!), 500);
  }
}
