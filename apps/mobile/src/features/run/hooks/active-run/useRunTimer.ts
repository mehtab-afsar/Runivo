/**
 * The run clock: wall-clock elapsed time (Date.now() minus start minus paused time, so
 * it stays right when the app is suspended), manual pause/resume bookkeeping, and the
 * 1 s watchdog that also drives GPS signal-loss detection and auto-pause.
 */
import { useCallback, useEffect, useRef } from 'react';
import { feedback } from '@theme';
import { autoPauseFromTimer, dropStaleGpsLock } from './autoPause';
import { clearLiveShare } from './liveShare';
import type { RunSession, RunUi } from './types';

export function useRunTimer(s: RunSession, ui: RunUi) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now();
      if (dropStaleGpsLock(s, now)) ui.setGpsLocked(false);
      if (autoPauseFromTimer(s, now)) {
        ui.setState(prev => ({ ...prev, isPaused: true }));
        feedback.runPause();
      }
      // Work out values outside the setState updater: React may run an updater twice
      // (Strict Mode), so updaters must not touch refs or play feedback.
      if (s.isPaused) return;
      const totalElapsed = Math.floor((Date.now() - s.startTime - s.totalPausedMs) / 1000);
      s.elapsed = totalElapsed;
      ui.setState(prev => (prev.isPaused ? prev : { ...prev, elapsed: totalElapsed }));
    }, 1000);
  }, [s, ui]);

  const pauseRun = useCallback(() => {
    s.manualPause = true;
    s.autoPaused = false;
    s.isPaused = true;
    ui.setState(prev => ({ ...prev, isPaused: true }));
    s.pauseStart = Date.now();
    feedback.runPause();
    clearLiveShare(s);
  }, [s, ui]);

  const resumeRun = useCallback(() => {
    s.totalPausedMs += Date.now() - s.pauseStart;
    // Reset the last position so the first point after resume doesn't create a large delta.
    s.filter = { base: null, outliers: 0 };
    s.manualPause = false;
    s.stoppedSince = null;
    s.lastMovingFixAt = Date.now();
    s.isPaused = false;
    ui.setState(prev => ({ ...prev, isPaused: false }));
    feedback.runStart();
  }, [s, ui]);

  useEffect(() => stopTimer, [stopTimer]);

  return { startTimer, stopTimer, pauseRun, resumeRun };
}
