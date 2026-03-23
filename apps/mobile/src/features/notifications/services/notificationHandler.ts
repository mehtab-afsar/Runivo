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
import type { RootStackParamList } from '@navigation/AppNavigator';

type NavRef = NavigationContainerRef<RootStackParamList>;

function navigate(navRef: NavRef, actionUrl: string): void {
  if (!navRef.isReady()) return;

  const url = actionUrl ?? '/';

  if (url.startsWith('/run/summary/')) {
    const runId = url.split('/')[3];
    // RunSummary expects a result object; navigate to History instead for
    // notification-triggered deep links (full result data not available here)
    navRef.navigate('History');
    return;
  }

  if (url === '/notifications') { navRef.navigate('Notifications'); return; }
  if (url === '/missions')      { navRef.navigate('Missions');      return; }
  if (url === '/leaderboard')   { navRef.navigate('Leaderboard');   return; }
  if (url === '/profile')       { navRef.navigate('Main');          return; } // Profile is a tab
  if (url === '/events')        { navRef.navigate('Events');        return; }
  if (url === '/clubs')         { navRef.navigate('Club');          return; }
  if (url === '/feed')          { navRef.navigate('Main');          return; } // Feed is a tab
  if (url === '/lobby')         { navRef.navigate('Lobby');         return; }
  if (url === '/history')       { navRef.navigate('History');       return; }
  // /territory/:hexId and unknown paths — no navigation
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
