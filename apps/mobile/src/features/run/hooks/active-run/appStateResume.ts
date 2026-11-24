/**
 * What happens when the app changes state during a run. Pulled out of useRunGps, with its
 * native calls injected, so the ordering guarantees below can be unit-tested.
 */
import type { BufferedFix } from '../../services/screenOffMerge';
import { mergeBgFixes } from './bgMerge';
import type { RunSession, RunUi } from './types';
import type { AppStateStatus } from 'react-native';

export interface ResumeDeps {
  /** Re-acquires keep-awake. May reject; that must not affect anything else here. */
  activateKeepAwake: () => Promise<void>;
  /** Takes everything the background task buffered for this run. */
  drainBuffer: (runId: string) => BufferedFix[];
  /** Records a failure that was handled and moved past. */
  reportError: (error: unknown) => void;
}

/**
 * Handles one AppState change. Coming back to the foreground (from inactive or background):
 * re-acquire keep-awake, then merge the GPS points collected while the screen was off.
 *
 * Keep-awake is a nicety, so a failure there is reported and ignored. It used to reject
 * out of this handler, which skipped both the buffer merge (screen-off distance lost until
 * finish) and the `appState` update below (so the next resume was judged against stale state).
 */
export async function handleAppStateChange(
  s: RunSession, ui: RunUi, nextState: AppStateStatus, maxSpeedMs: number, deps: ResumeDeps,
): Promise<void> {
  if (s.appState.match(/inactive|background/) && nextState === 'active') {
    await deps.activateKeepAwake().catch(deps.reportError);
    if (mergeBgFixes(s, deps.drainBuffer(s.runId), maxSpeedMs)) {
      // The live state's distance lags the running total by whatever is pending.
      s.pendingDistance = 0;
      ui.setState(prev => ({
        ...prev,
        distance: Math.round(s.totalDistance * 1000) / 1000,
        gpsPoints: [...s.gpsPoints],
      }));
    }
  }
  s.appState = nextState;
}
