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
 *   /run                     → Run tab (streak at risk, run reminder)
 *   /territory-map[?filter=stale] → Map, optionally on fading zones
 *   /store                   → PACE Store (cap alerts, campaigns)
 *   /history                 → History (weekly summary)
 *   / or unknown             → no-op (app opens to current screen)
 */

import * as Notifications from 'expo-notifications';
import { resolveNotificationRoute } from './notificationRoutes';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';

type NavRef = NavigationContainerRef<RootStackParamList>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

type AnyNav = { navigate: (screen: string, params?: unknown) => void };

function applyRoute(nav: AnyNav, actionUrl: string): void {
  const route = resolveNotificationRoute(actionUrl);
  if (route) nav.navigate(route.screen, route.params);
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
