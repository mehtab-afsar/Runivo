/**
 * The in-run crash checkpoint: every 30 s the GPS trace is written to AsyncStorage, so a
 * crash or force-kill doesn't lose the run. The row layout (a meta row plus compact
 * 4,000-point parts, only changed parts rewritten) lives in services/runCheckpoint.ts.
 * Recovery reads it back in recovery.ts.
 */
import { useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GPS_CHECKPOINT_PREFIX } from '../../services/locationTask';
import { checkpointWrites } from '../../services/runCheckpoint';
import type { RunSession } from './types';
import { captureHandledError } from '@shared/services/errorReporting';

const GPS_CHECKPOINT_INTERVAL_MS = 30_000;

export function useRunCheckpoint(s: RunSession) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCheckpoint = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const startCheckpoint = useCallback((activityType: string) => {
    const cpKey = `${GPS_CHECKPOINT_PREFIX}${s.runId}`;
    stopCheckpoint();
    let savedFullParts = 0;
    // The meta row is written now, before any live point: with the screen off straight
    // away (Android) there may never be one, and recovery must still find the run (its
    // points are in the background buffer).
    AsyncStorage.multiSet(checkpointWrites(cpKey, s.startTime, activityType, [], 0).rows)
      .catch(err => captureHandledError(err, { domain: 'checkpoint', operation: 'write-initial-checkpoint' }));
    intervalRef.current = setInterval(async () => {
      if (s.gpsPoints.length === 0) return;
      const w = checkpointWrites(cpKey, s.startTime, activityType, s.gpsPoints, savedFullParts, s.mocked);
      try {
        await AsyncStorage.multiSet(w.rows);
        savedFullParts = w.fullParts;
      } catch (err) {
        // Next tick tries again; reported (throttled) so a storage that stops accepting writes is visible.
        captureHandledError(err, { domain: 'checkpoint', operation: 'write-checkpoint', extra: { pointCount: s.gpsPoints.length } });
      }
    }, GPS_CHECKPOINT_INTERVAL_MS);
  }, [s, stopCheckpoint]);

  /** Drops a finished run's checkpoint (meta row and parts). Call only after the run is saved. */
  const clearCheckpoint = useCallback(async (runId: string) => {
    const cpKey = `${GPS_CHECKPOINT_PREFIX}${runId}`;
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter(k => k === cpKey || k.startsWith(`${cpKey}#`));
      if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    } catch (err) {
      // A leftover checkpoint is offered for recovery next launch, then cleared.
      captureHandledError(err, { domain: 'checkpoint', operation: 'clear-checkpoint' });
    }
  }, []);

  useEffect(() => stopCheckpoint, [stopCheckpoint]);

  return { startCheckpoint, stopCheckpoint, clearCheckpoint };
}
