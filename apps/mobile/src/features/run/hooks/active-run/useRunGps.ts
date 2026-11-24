/**
 * GPS for the active run: the foreground watchPositionAsync subscription, the
 * background task that keeps recording with the screen off, and the merge of what that
 * task buffered (on foreground resume and when the run finishes).
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync } from 'expo-keep-awake';
import {
  startBackgroundTracking, stopBackgroundTracking, drainBgGpsBuffer, clearBgGpsBuffer,
} from '../../services/locationTask';
import { mergeBgFixes } from './bgMerge';
import { handleAppStateChange, type ResumeDeps } from './appStateResume';
import { createFixHandler } from './fixHandler';
import { maxSpeedFor } from './gpsConfig';
import { clearLiveShare } from './liveShare';
import type { RunSession, RunUi } from './types';
import { captureHandledError } from '@shared/services/errorReporting';

export function useRunGps(s: RunSession, ui: RunUi, activityType: string) {
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const appStateSubRef = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);

  const detachAppState = useCallback(() => {
    appStateSubRef.current?.remove();
    appStateSubRef.current = null;
  }, []);

  /** On foreground resume: keep-awake back on and the screen-off GPS points merged (see appStateResume). */
  const attachAppState = useCallback(() => {
    detachAppState();
    const deps: ResumeDeps = {
      activateKeepAwake: activateKeepAwakeAsync,
      drainBuffer: drainBgGpsBuffer,
      reportError: err => captureHandledError(err, { domain: 'native', operation: 'keep-awake-resume' }),
    };
    appStateSubRef.current = AppState.addEventListener('change', (nextState: AppStateStatus) =>
      handleAppStateChange(s, ui, nextState, maxSpeedFor(activityType), deps));
  }, [s, ui, activityType, detachAppState]);

  /**
   * Starts the foreground watcher and the background task. Resolves false when the
   * watcher can't start (Location Services off, or permission revoked in between), so
   * the caller can undo the start.
   */
  const startWatching = useCallback(async (accuracy: Location.Accuracy): Promise<boolean> => {
    const sub = await Location.watchPositionAsync(
      { accuracy, timeInterval: 1000, distanceInterval: 3 },
      createFixHandler(s, ui, activityType),
    ).catch((err: unknown) => {
      captureHandledError(err, { domain: 'gps', operation: 'watch-position-start' });
      return null;
    });
    if (!sub) return false;
    locationSubRef.current = sub;

    // The background task records with the screen off.
    startBackgroundTracking(s.runId, accuracy).catch(err => {
      captureHandledError(err, { domain: 'gps', operation: 'background-tracking-start' });
      ui.setBackgroundWarning("Screen-off tracking couldn't start. Keep Runivo open until you finish.");
    });
    return true;
  }, [s, ui, activityType]);

  const stopWatching = useCallback(() => {
    locationSubRef.current?.remove();
    locationSubRef.current = null;
    detachAppState();
  }, [detachAppState]);

  /**
   * Finish: stops the background task, then merges whatever it still holds. A run
   * finished while paused drops that tail (it was spent paused/backgrounded).
   */
  const stopAndMergeTail = useCallback(async () => {
    await stopBackgroundTracking();
    mergeBgFixes(s, drainBgGpsBuffer(s.runId), maxSpeedFor(activityType));
  }, [s, activityType]);

  useEffect(() => () => {
    locationSubRef.current?.remove();
    appStateSubRef.current?.remove();
    stopBackgroundTracking().catch(err => captureHandledError(err, { domain: 'gps', operation: 'background-tracking-stop' }));
    clearBgGpsBuffer(s.runId);
    clearLiveShare(s);
  }, [s]);

  return { attachAppState, detachAppState, startWatching, stopWatching, stopAndMergeTail };
}
