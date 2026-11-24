/**
 * Keeps distance, time and pace on the lock screen during a run (PRD L2).
 *  - iOS: a Live Activity (expo-widgets), when the build includes it.
 *  - Android: an ongoing, silent notification, updated in place.
 * Safe on any build: without the native side it does nothing.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { hasWidgets } from '@mobile/shared/lib/optionalNative';
import type { RunActivityProps } from './RunActivityWidget';
import { captureHandledError } from '@shared/services/errorReporting';

const ANDROID_ID = 'runivo-live-run';
const MIN_GAP_MS = 5000;

type Handle = { update: (p: RunActivityProps) => Promise<void>; end: (p?: RunActivityProps) => Promise<void> };

let current: Handle | null = null;
let lastAt = 0;
let lastKey = '';

async function startIos(p: RunActivityProps): Promise<Handle | null> {
  if (!hasWidgets()) return null;
   
  const { runActivity } = require('./RunActivityWidget') as typeof import('./RunActivityWidget');
  const la = runActivity.start(p, 'runivo://run');
  return {
    update: q => la.update(q),
    end: q => la.end('default', q),
  };
}

async function showAndroid(p: RunActivityProps): Promise<void> {
  await Notifications.setNotificationChannelAsync('live-run', {
    name: 'Run in progress',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: null,
    showBadge: false,
  });
  await Notifications.scheduleNotificationAsync({
    identifier: ANDROID_ID,
    content: {
      title: `${p.sport} · ${p.distance} ${p.unit} · ${p.time}`,
      body: `${p.pace} · ${p.status}`,
      sticky: true,
      autoDismiss: false,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      data: { actionUrl: '/run' },
    },
    trigger: { channelId: 'live-run' } as Notifications.NotificationTriggerInput,
  });
}

async function startAndroid(p: RunActivityProps): Promise<Handle> {
  await showAndroid(p);
  return {
    update: q => showAndroid(q),
    end: async () => { await Notifications.dismissNotificationAsync(ANDROID_ID).catch(() => {}); },
  };
}

export async function startRunActivity(p: RunActivityProps): Promise<void> {
  if (current) return;
  try {
    current = Platform.OS === 'ios' ? await startIos(p) : Platform.OS === 'android' ? await startAndroid(p) : null;
    lastAt = Date.now();
  } catch (err) {
    captureHandledError(err, { domain: 'native', operation: 'start-live-activity' });
    current = null;
  }
}

/** Throttled: at most every 5 s, and only when something visible changed. */
export function updateRunActivity(p: RunActivityProps, force = false): void {
  if (!current) return;
  const key = `${p.distance}|${p.time}|${p.pace}|${p.status}`;
  if (!force && (key === lastKey || Date.now() - lastAt < MIN_GAP_MS)) return;
  lastKey = key;
  lastAt = Date.now();
  current.update(p).catch(() => {});
}

export async function endRunActivity(p?: RunActivityProps): Promise<void> {
  const h = current;
  current = null;
  lastKey = '';
  if (h) await h.end(p).catch(() => {});
}
