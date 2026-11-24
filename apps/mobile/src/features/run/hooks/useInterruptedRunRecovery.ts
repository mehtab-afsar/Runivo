/**
 * After a crash or force-quit mid-run, offers to recover the run as soon as the
 * app is on screen (it used to wait until the Run tab was opened, with GPS still
 * running in the background the whole time). Mounted once, in the main tabs.
 * Never acts while the app is in the background: iOS can relaunch it there to
 * keep a screen-off run recording, and that run must not be cut off.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { saveRun, type StoredRun } from '@shared/services/store';
import { postRunSync } from '@shared/services/sync';
import { haversineM } from '@shared/services/claimEngine';
import { formatPace } from '@shared/lib/paceFormat';
import { captureHandledError } from '@shared/services/errorReporting';
import { findInterruptedRunCheckpoint, clearInterruptedRunCheckpoint, type GPSPoint } from './useActiveRun';
import { stopBackgroundTracking, drainBgGpsBuffer, clearBgGpsBuffer, countBgGpsBuffer, cleanupOrphanedBackgroundTask } from '../services/locationTask';
import { freshScreenOffFixes } from '../services/screenOffMerge';

/**
 * Reconstructs a full run from a crash checkpoint's raw GPS points and saves it
 * locally so postRunSync() has something to actually push. Previously "Recover"
 * only called postRunSync() (which just pushes already-saved runs) and then
 * deleted the checkpoint — the interrupted run's data was silently lost on the
 * exact path meant to restore it.
 */
async function recoverRunFromCheckpoint(
  runId: string,
  startTime: number,
  points: GPSPoint[],
  activityType: string,
  mocked = false,
): Promise<void> {
  // Stop the background task first so nothing new lands, then take what it
  // buffered. On Android the live watcher stops with the screen off, so the
  // checkpoint (written from that watcher) is missing every screen-off stretch;
  // the buffer is the only copy. This used to clear it unread.
  await stopBackgroundTracking().catch(err => captureHandledError(err, { domain: 'gps', operation: 'stop-background-tracking-before-recovery' }));
  const lastTs = points.length ? points[points.length - 1].timestamp : 0;
  const buffered = freshScreenOffFixes(lastTs, drainBgGpsBuffer(runId));
  if (buffered.some(p => p.mocked)) mocked = true;
  const bgFixes = buffered
    .map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp, speed: p.speed, accuracy: p.accuracy, altitude: 0 }));
  points = [...points, ...bgFixes];
  if (points.length < 2) throw new Error('nothing to recover');

  let distanceM = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversineM(points[i - 1], points[i]);
    if (d >= 1 && d < 100) distanceM += d;
  }
  const endTime = points[points.length - 1]?.timestamp ?? Date.now();
  const durationSec = Math.max(1, Math.round((endTime - startTime) / 1000));
  const avgPace = formatPace((distanceM / 1000) / durationSec);

  const run: StoredRun = {
    id: runId,
    activityType,
    startTime,
    endTime,
    distanceMeters: distanceM,
    durationSec,
    avgPace,
    gpsPoints: points,
    territoriesClaimed: [],
    territoriesFortified: [],
    enemyCaptured: 0,
    preRunLevel: 0,
    synced: false,
    // A mock-location run stays flagged after recovery (the server pays nothing for it).
    ...(mocked && { mockedLocation: true }),
  };
  await saveRun(run);

  // Only now is the buffer safe to drop: the run, with its points, is on disk.
  clearBgGpsBuffer(runId);
}

export function useInterruptedRunRecovery(): void {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    let done = false;
    const check = () => {
      if (done) return;
      done = true;
    findInterruptedRunCheckpoint().then(cp => {
        // The background buffer counts: on Android a screen-off run has no live
        // points, and the buffer is the whole run. It used to be deleted here.
        const buffered = cp ? countBgGpsBuffer(cp.runId) : 0;
        if (!cp || cp.points.length + buffered < 2) {
          if (cp) clearInterruptedRunCheckpoint();
          // No recoverable run — if a background task is still registered (e.g. the
          // app was killed before a clean stop), it's orphaned; stop it so it doesn't
          // keep tracking under a dead run id forever.
          cleanupOrphanedBackgroundTask(false).catch(err => captureHandledError(err, { domain: 'gps', operation: 'cleanup-orphaned-background-task' }));
          return;
        }
        let m = 0;
        for (let i = 1; i < cp.points.length; i++) { const d = haversineM(cp.points[i - 1], cp.points[i]); if (d >= 1 && d < 100) m += d; }
        const km = (m / 1000).toFixed(1);
        appAlert(
          'Interrupted run found',
          cp.points.length >= 2
            ? `A run was interrupted (~${km} km of GPS data). Recover it?`
            : 'A run was interrupted while the screen was off. Recover it?',
          [
            { text: 'Discard', style: 'destructive', onPress: () => {
              clearInterruptedRunCheckpoint();
              cleanupOrphanedBackgroundTask(false).catch(err => captureHandledError(err, { domain: 'gps', operation: 'cleanup-orphaned-background-task' }));
            } },
            { text: 'Recover', onPress: async () => {
              try {
                await recoverRunFromCheckpoint(cp.runId, cp.startTime, cp.points, cp.activityType, cp.mocked);
              } catch (err) {
                captureHandledError(err, { domain: 'run', operation: 'recover-run-from-checkpoint' });
                // Keep the checkpoint: the GPS data is still on the phone and the
                // prompt will offer recovery again next time.
                appAlert("Couldn't recover the run", 'Your GPS data is still on this phone. Try again from the Run screen.');
                return;
              }
              clearInterruptedRunCheckpoint();
              // The run is saved locally; a failed upload retries on the next sync.
              postRunSync().catch(err => captureHandledError(err, { domain: 'sync', operation: 'post-run-sync-after-recovery' }));
              // Show the result. Recovering used to end silently, so nobody could tell it worked.
              navigation.navigate('RunSummary', { runId: cp.runId, activityType: cp.activityType });
            } },
          ],
        );
      });
   

    };
    if (AppState.currentState === 'active') { check(); return; }
    const sub = AppState.addEventListener('change', st => { if (st === 'active') { sub.remove(); check(); } });
    return () => sub.remove();
    // Once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
