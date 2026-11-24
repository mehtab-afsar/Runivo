/**
 * useBeatPacer — metronome hook for the Beat Pacer feature.
 * Plays a click sound at a BPM derived from the target pace.
 *
 * The beat comes from a 25 ms JS setInterval, and iOS does not promise to run JS
 * timers for a backgrounded app (the audio background mode keeps the process alive
 * only while audio is actually playing, and a click every 350 ms is not that). So
 * the pacer is a foreground feature: it stops when the app leaves the foreground
 * and, when the app returns, restarts from "now" at the current BPM, with no
 * catch-up burst (see beatClock.ts). Spoken km cues, which do not need a timer,
 * are what keeps working with the screen locked.
 *
 * It does not touch the audio session: shared/services/audioSession.ts owns that
 * (the run screen switches it to the run mode, which plays on silent).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getSettings, saveSettings } from '@shared/services/store';
import { advanceBeat, shouldTick } from './beatClock';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Audio: any = null;
try { Audio = require('expo-audio'); } catch { /* native module not available */ }

// ── BPM table (pace string → BPM) ─────────────────────────────────────────────
const BPM_TABLE: [string, number][] = [
  ['2:30', 200],
  ['3:00', 192],
  ['3:30', 185],
  ['4:00', 180],
  ['4:30', 176],
  ['5:00', 172],
  ['5:30', 167],
  ['6:00', 163],
  ['6:30', 159],
  ['7:00', 155],
  ['7:30', 150],
  ['8:00', 145],
  ['9:00', 138],
  ['10:00', 130],
];
const PACE_OPTIONS = BPM_TABLE.map(([pace]) => pace);

const toSec = (s: string) => { const [m, sc] = s.split(':').map(Number); return m * 60 + (sc || 0); };
const TABLE_MIN_SEC = toSec(BPM_TABLE[0][0]);
const TABLE_MAX_SEC = toSec(BPM_TABLE[BPM_TABLE.length - 1][0]);

export function isOutOfRange(pace: string): boolean {
  const s = toSec(pace);
  return s < TABLE_MIN_SEC || s > TABLE_MAX_SEC;
}

export function paceToBpm(pace: string): number {
  const exact = BPM_TABLE.find(([p]) => p === pace);
  if (exact) return exact[1];
  const s = toSec(pace);
  // Clamp to edges rather than returning a default
  if (s < TABLE_MIN_SEC) return BPM_TABLE[0][1];
  if (s > TABLE_MAX_SEC) return BPM_TABLE[BPM_TABLE.length - 1][1];
  // Interpolate between nearest entries
  for (let i = 0; i < BPM_TABLE.length - 1; i++) {
    const [p1, b1] = BPM_TABLE[i];
    const [p2, b2] = BPM_TABLE[i + 1];
    const t1 = toSec(p1);
    const t2 = toSec(p2);
    if (s >= t1 && s <= t2) {
      return Math.round(b1 + (b2 - b1) * ((s - t1) / (t2 - t1)));
    }
  }
  return BPM_TABLE[BPM_TABLE.length - 1][1];
}

interface BeatPacerState {
  enabled: boolean;
  pace: string;
  bpm: number;
}

/**
 * `initial` lets a caller seed the very first render's state synchronously
 * (e.g. the setup screen's already-resolved pacer choice, handed to the live
 * run screen via nav params) instead of the hardcoded default. Without it,
 * this hook's own instance always starts disabled and waits on an async
 * getSettings() round-trip before its ticker can start — on ActiveRunScreen
 * that's a second, independent instance from the one on RunScreen, so that
 * gap is a real, audible silence/restart right as the run begins.
 */
export function useBeatPacer(initial?: {
  enabled?: boolean;
  pace?: string;
  /**
   * Whether clicks may play right now. The active run screen passes "the run is going
   * and not paused"; omit it (the setup screen's preview) to click whenever enabled.
   */
  running?: boolean;
}) {
  const initialPace = initial?.pace ?? '5:00';
  const initialBpm  = paceToBpm(initialPace);
  const [state, setState] = useState<BeatPacerState>({
    enabled: initial?.enabled ?? false,
    pace: initialPace,
    bpm: initialBpm,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soundRef      = useRef<any | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBeatRef   = useRef<number>(0);
  const enabledRef    = useRef(initial?.enabled ?? false);
  const bpmRef        = useRef(initialBpm);
  const runningRef    = useRef(initial?.running ?? true);
  const foregroundRef = useRef(AppState.currentState === 'active');

  // Load persisted settings on mount — confirms/reconciles the seeded initial
  // state above (harmless no-op if they already agree) and is still the only
  // source of truth when no `initial` is passed in (e.g. RunScreen's own instance).
  useEffect(() => {
    getSettings().then(s => {
      const bpm = paceToBpm(s.beatPacerPace);
      enabledRef.current = s.beatPacerEnabled;
      bpmRef.current = bpm;
      setState({ enabled: s.beatPacerEnabled, pace: s.beatPacerPace, bpm });
    }).catch(() => {});
  }, []);

  // Load sound
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sound: any | null = null;
    (async () => {
      try {
        if (!Audio) return;
        const s = Audio.createAudioPlayer(require('../../../shared/audio/files/click.wav'));
        sound = s;
        soundRef.current = s;
      } catch {
        // Sound file not present — pacer still schedules but plays nothing
      }
    })();
    return () => { try { sound?.remove(); } catch { /* ignore */ } };
  }, []);

  const playClick = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      await s.seekTo(0);
      s.play();
    } catch { /* ignore */ }
  }, []);

  const stopTicker = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTicker = useCallback(() => {
    if (timerRef.current) return; // already ticking: never run two intervals
    nextBeatRef.current = Date.now(); // fresh phase; the BPM is read live on every tick
    timerRef.current = setInterval(() => {
      const ok = shouldTick({ enabled: enabledRef.current, running: runningRef.current, foreground: foregroundRef.current });
      if (!ok) return;
      const step = advanceBeat(nextBeatRef.current, Date.now(), 60_000 / bpmRef.current);
      nextBeatRef.current = step.next;
      if (step.fire) playClick();
    }, 25);
  }, [playClick]);

  // One place decides whether the ticker should exist.
  const syncTicker = useCallback(() => {
    if (shouldTick({ enabled: enabledRef.current, running: runningRef.current, foreground: foregroundRef.current })) startTicker();
    else stopTicker();
  }, [startTicker, stopTicker]);

  // AppState: no ticks unless foregrounded. Anything but 'active' (inactive,
  // background) stops it, 'active' restarts it from now.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      foregroundRef.current = next === 'active';
      syncTicker();
    });
    return () => sub.remove();
  }, [syncTicker]);

  // The run pausing/resuming or ending.
  const runningProp = initial?.running;
  useEffect(() => {
    if (runningProp === undefined) return;
    runningRef.current = runningProp;
    syncTicker();
  }, [runningProp, syncTicker]);

  // Start/stop ticker based on enabled
  useEffect(() => {
    enabledRef.current = state.enabled;
    syncTicker();
    return stopTicker;
  }, [state.enabled, syncTicker, stopTicker]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    enabledRef.current = enabled;
    setState(prev => ({ ...prev, enabled }));
    const s = await getSettings();
    await saveSettings({ ...s, beatPacerEnabled: enabled });
  }, []);

  const setPace = useCallback(async (pace: string) => {
    const bpm = paceToBpm(pace);
    bpmRef.current = bpm;
    setState(prev => ({ ...prev, pace, bpm }));
    const s = await getSettings();
    await saveSettings({ ...s, beatPacerPace: pace });
  }, []);

  return {
    enabled: state.enabled,
    pace: state.pace,
    bpm: state.bpm,
    outOfRange: isOutOfRange(state.pace),
    paceOptions: PACE_OPTIONS,
    setEnabled,
    setPace,
  };
}
