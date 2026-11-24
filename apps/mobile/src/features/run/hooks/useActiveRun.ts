/**
 * Native useActiveRun: expo-location GPS with expo-keep-awake, plus the background task
 * that keeps recording with the screen off.
 *
 * This is the orchestrator. The work lives in ./active-run/:
 *   useRunTimer       wall-clock elapsed time, pause/resume, signal-loss + auto-pause watchdog
 *   useRunGps         foreground watcher, background task, screen-off merge
 *   useRunCheckpoint  30 s crash checkpoint (rows laid out by services/runCheckpoint)
 *   recovery          finding / discarding an interrupted run
 * and they share one mutable `RunSession` (see active-run/types) so no callback ever
 * reads a stale React closure.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import { deactivateKeepAwake } from 'expo-keep-awake';
import { feedback } from '@theme';
import { useGameEngine } from '@shared/hooks/useGameEngine';
import { GPS_CHECKPOINT_PREFIX } from '../services/locationTask';
import { computeFinal } from './active-run/finalize';
import { clearLiveShare } from './active-run/liveShare';
import { beginRunSession, createRunSession } from './active-run/session';
import { prepareRunStart } from './active-run/startup';
import { useRunCheckpoint } from './active-run/useRunCheckpoint';
import { useRunGps } from './active-run/useRunGps';
import { useRunTimer } from './active-run/useRunTimer';
import { INITIAL_RUN_STATE, type ActiveRunState, type RunUi } from './active-run/types';
import { captureHandledError } from '@shared/services/errorReporting';

export { findInterruptedRunCheckpoint, clearInterruptedRunCheckpoint } from './active-run/recovery';
export type { GPSPoint } from './active-run/types';

export function useActiveRun(activityType: string = 'run') {
  const gameEngine = useGameEngine();

  const [state, setState] = useState<ActiveRunState>(() => ({ ...INITIAL_RUN_STATE, gpsPoints: [] }));
  const [gpsLocked, setGpsLocked] = useState(false);
  // Screen-off tracking isn't running (background permission refused, or the task failed
  // to start): the runner is told to keep the app open.
  const [backgroundWarning, setBackgroundWarning] = useState<string | null>(null);

  // Mutable run values shared by the GPS callback, the timer and the checkpoint.
  const [s] = useState(() => {
    const session = createRunSession();
    session.appState = AppState.currentState;
    return session;
  });
  const ui = useMemo<RunUi>(() => ({ setState, setGpsLocked, setBackgroundWarning }), []);

  const { startTimer, stopTimer, pauseRun, resumeRun } = useRunTimer(s, ui);
  const { attachAppState, detachAppState, startWatching, stopWatching, stopAndMergeTail } = useRunGps(s, ui, activityType);
  const { startCheckpoint, stopCheckpoint, clearCheckpoint } = useRunCheckpoint(s);

  const playerId = gameEngine.player?.id ?? null;
  useEffect(() => { s.playerId = playerId; }, [s, playerId]);
  useEffect(() => () => { deactivateKeepAwake(); }, []);

  // ── Start ──────────────────────────────────────────────────────────────────
  const startRun = useCallback(async () => {
    // Re-entrancy guard: a double-tap before the first await resolves would otherwise
    // create two GPS watchers and two timers and leak the first of each.
    if (s.isStarting) return;
    s.isStarting = true;

    const accuracy = await prepareRunStart(s, ui, activityType);
    if (accuracy === null) { s.isStarting = false; return; }

    attachAppState();
    beginRunSession(s, Date.now(), crypto.randomUUID());
    ui.setGpsLocked(false);
    startCheckpoint(activityType);
    ui.setState(prev => ({
      ...prev, isRunning: true, isPaused: false, elapsed: 0, distance: 0, pace: '0:00', gpsPoints: [], gpsError: null,
    }));
    startTimer();

    // watchPositionAsync rejects when Location Services are off (or the permission was
    // revoked in between). By now `isRunning` is true and the timers are ticking, and
    // isStarting would stay set forever, so Start silently did nothing until the app
    // restarted. Undo the start instead.
    if (!(await startWatching(accuracy))) {
      stopTimer();
      stopCheckpoint();
      detachAppState();
      deactivateKeepAwake();
      ui.setState(prev => ({
        ...prev, isRunning: false,
        gpsError: "Couldn't start GPS. Check that Location Services are on, then try again.",
      }));
      s.isStarting = false;
      return;
    }

    s.lastKm = 0;
    s.isStarting = false;
  }, [s, ui, activityType, attachAppState, startCheckpoint, startTimer, startWatching, stopTimer, stopCheckpoint, detachAppState]);

  // ── Finish ─────────────────────────────────────────────────────────────────
  // Reads every final value from the session (not React state), so it never goes stale
  // and doesn't need re-creating on every state update.
  const finishRun = useCallback(async () => {
    if (s.isFinishing) return null;
    s.isFinishing = true;

    stopWatching();
    stopTimer();
    stopCheckpoint();
    deactivateKeepAwake();
    clearLiveShare(s);
    await stopAndMergeTail();
    feedback.runComplete();

    const final = computeFinal(s, Date.now());
    s.elapsed = final.elapsed;
    s.pace = final.pace;
    const finalRunId = s.runId;
    ui.setState(prev => ({ ...prev, isRunning: false, isPaused: false, distance: final.distance }));

    // A throw (SQLite write failure) or an undefined result (player state not yet loaded,
    // see useGameEngine's `if (!player) return;` guard) must not leave isFinishing set:
    // every later finish would return null and the run could never be saved or retried.
    // GPS and timers are already torn down above and the crash checkpoint is left in place
    // (cleared only after a confirmed save below), so resetting the guard and returning
    // null lets the caller offer a retry instead of a frozen screen.
    let result;
    try {
      result = await gameEngine.endRunSession({
        id:             finalRunId,
        activityType,
        startTime:      s.startTime,
        endTime:        Date.now(),
        distanceMeters: final.distance * 1000,
        durationSec:    final.elapsed,
        avgPace:        final.pace,
        gpsPoints:      s.gpsPoints,
        elevationGainM: Math.round(s.elevationGain),
        ...(s.mocked && { mockedLocation: true }),
      });
    } catch (err) {
      captureHandledError(err, { domain: 'run', operation: 'end-run-session' });
      s.isFinishing = false;
      return null;
    }
    if (!result) { s.isFinishing = false; return null; }

    // The run is saved: safe to discard the crash checkpoint.
    await clearCheckpoint(finalRunId);

    const saved = result as { run?: { territoriesClaimed?: unknown[] } };
    return {
      runId:               finalRunId,
      distance:            final.distance,
      elapsed:             final.elapsed,
      pace:                final.pace,
      gpsPoints:           s.gpsPoints,
      territoriesClaimed:  saved.run?.territoriesClaimed?.length ?? 0,
      ...result,
    };
  }, [s, ui, gameEngine, activityType, stopWatching, stopTimer, stopCheckpoint, stopAndMergeTail, clearCheckpoint]);

  return {
    ...state,
    gpsLocked,
    backgroundWarning,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    activeRunId:          s.runId,
    /** L5: live climb so far, for the HUD's switchable metric. */
    elevationGainM:       Math.round(s.elevationGain),
    gpsCheckpointPrefix:  GPS_CHECKPOINT_PREFIX,
    player:               gameEngine.player,
    playerTerritoryCount: gameEngine.playerTerritoryCount,
  };
}
