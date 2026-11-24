/** Crash recovery: finding and discarding the run an interrupted session left behind. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bufferedActiveRun, GPS_CHECKPOINT_PREFIX } from '../../services/locationTask';
import { readCheckpoint, isPartKey, partKey } from '../../services/runCheckpoint';
import type { GPSPoint } from './types';
import { captureHandledError } from '@shared/services/errorReporting';

/**
 * Returns the run an interrupted session left behind: its checkpoint, or, when there is
 * none, the background buffer alone. On Android a run recorded with the screen off has
 * no live points (so no checkpoint parts); the buffer is the whole run.
 */
export async function findInterruptedRunCheckpoint(): Promise<{ runId: string; startTime: number; points: GPSPoint[]; activityType: string; mocked: boolean } | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const checkpointKey = keys.find(k => k.startsWith(GPS_CHECKPOINT_PREFIX) && !isPartKey(k));
    const raw = checkpointKey ? await AsyncStorage.getItem(checkpointKey) : null;
    if (checkpointKey && raw) {
      const cp = await readCheckpoint(raw, n => AsyncStorage.getItem(partKey(checkpointKey, n)));
      const runId = checkpointKey.slice(GPS_CHECKPOINT_PREFIX.length);
      return { runId, ...cp };
    }
    const buffered = bufferedActiveRun();
    if (!buffered) return null;
    return { runId: buffered.runId, startTime: buffered.firstTs, points: [], activityType: 'run', mocked: false };
  } catch (err) {
    // Reported: a checkpoint we can't read is a run the runner won't be offered to recover.
    captureHandledError(err, { domain: 'checkpoint', operation: 'find-interrupted-run' });
    return null;
  }
}

/** Discard any lingering checkpoint (called when the user dismisses recovery). */
export async function clearInterruptedRunCheckpoint(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const checkpointKeys = keys.filter(k => k.startsWith(GPS_CHECKPOINT_PREFIX));
    if (checkpointKeys.length > 0) await AsyncStorage.multiRemove(checkpointKeys);
  } catch (err) { captureHandledError(err, { domain: 'checkpoint', operation: 'clear-interrupted-run' }); }
}
