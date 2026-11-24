/** Everything startRun needs before the clock and the GPS watcher begin. */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import { track } from '@shared/services/analytics';
import { getSettings } from '@shared/services/store';
import { resolveGpsAccuracy } from './gpsConfig';
import type { RunSession, RunUi } from './types';

/**
 * Asks for location permission, reads the run settings into the session and keeps the
 * screen awake. Resolves the GPS accuracy to use, or null when foreground permission was
 * refused (the error is already on screen).
 */
export async function prepareRunStart(s: RunSession, ui: RunUi, activityType: string): Promise<Location.Accuracy | null> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    ui.setState(prev => ({ ...prev, gpsError: 'Permission denied — enable location in Settings' }));
    return null;
  }

  // iOS tracks with the screen locked on "While Using" (background mode + the blue
  // indicator), so it never asks for "Always". Android needs background location for
  // that; if refused, foreground tracking still works and the runner is told.
  if (Platform.OS === 'android') {
    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    ui.setBackgroundWarning(bg?.status === 'granted' ? null
      : "Screen-off tracking is off. Keep Runivo open, or allow location 'All the time' in Settings.");
  } else {
    ui.setBackgroundWarning(null);
  }

  const settings = await getSettings().catch(() => null);
  const gpsAccuracy = resolveGpsAccuracy(settings?.gpsAccuracy ?? 'high');
  s.autoPauseEnabled = settings?.autoPause ?? false;
  s.liveSharingEnabled = settings?.liveRunSharingEnabled ?? false;
  s.lastLiveBroadcast = 0;
  s.manualPause = false;
  s.autoPaused = false;
  s.stoppedSince = null;
  s.lastMovingFixAt = Date.now();

  // Keeping the screen awake is a nicety; failing to get it must not stop the run starting.
  await activateKeepAwakeAsync().catch(() => {});

  // Fire-and-forget funnel event, no GPS in properties; track() never throws.
  track('run_started', { activityType });
  return gpsAccuracy;
}
