/**
 * useBeatPacer — metronome hook for the Beat Pacer feature.
 * Plays a click sound at a BPM derived from the target pace.
 * Uses a 25ms scheduler loop with 100ms lookahead (Web Audio style).
 * expo-av handles sound playback; AppState pauses/resumes on background.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import { getSettings, saveSettings } from '@shared/services/store';

// ── BPM table (pace string → BPM) ─────────────────────────────────────────────
const BPM_TABLE: [string, number][] = [
  ['3:30', 185],
  ['4:00', 180],
  ['4:30', 176],
  ['5:00', 172],
  ['5:30', 167],
  ['6:00', 163],
  ['6:30', 159],
  ['7:00', 155],
];
const PACE_OPTIONS = BPM_TABLE.map(([pace]) => pace);

export function paceToBpm(pace: string): number {
  const exact = BPM_TABLE.find(([p]) => p === pace);
  if (exact) return exact[1];
  // Interpolate between nearest entries
  for (let i = 0; i < BPM_TABLE.length - 1; i++) {
    const [p1, b1] = BPM_TABLE[i];
    const [p2, b2] = BPM_TABLE[i + 1];
    const toSec = (s: string) => { const [m, sc] = s.split(':').map(Number); return m * 60 + sc; };
    const t = toSec(pace);
    const t1 = toSec(p1);
    const t2 = toSec(p2);
    if (t >= t1 && t <= t2) {
      return Math.round(b1 + (b2 - b1) * ((t - t1) / (t2 - t1)));
    }
  }
  return 172;
}

interface BeatPacerState {
  enabled: boolean;
  pace: string;
  bpm: number;
}

export function useBeatPacer() {
  const [state, setState] = useState<BeatPacerState>({
    enabled: false,
    pace: '5:00',
    bpm: 172,
  });

  const soundRef      = useRef<Audio.Sound | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBeatRef   = useRef<number>(0);
  const enabledRef    = useRef(false);
  const bpmRef        = useRef(172);

  // Load persisted settings on mount
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
    let sound: Audio.Sound | null = null;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { sound: s } = await Audio.Sound.createAsync(require('../../../shared/audio/files/click.wav'));
        sound = s;
        soundRef.current = s;
      } catch {
        // Sound file not present — pacer still schedules but plays nothing
      }
    })();
    return () => { sound?.unloadAsync().catch(() => {}); };
  }, []);

  // AppState: stop ticks when backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        if (enabledRef.current) startTicker();
      } else {
        stopTicker();
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playClick = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      await s.setPositionAsync(0);
      await s.playAsync();
    } catch { /* ignore */ }
  }, []);

  const startTicker = useCallback(() => {
    if (timerRef.current) return;
    nextBeatRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (!enabledRef.current) return;
      const now = Date.now();
      const intervalMs = 60_000 / bpmRef.current;
      // Lookahead: schedule any beats that fall within next 100ms
      while (nextBeatRef.current <= now + 100) {
        if (nextBeatRef.current <= now) {
          playClick();
        }
        nextBeatRef.current += intervalMs;
      }
    }, 25);
  }, [playClick]);

  const stopTicker = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start/stop ticker based on enabled
  useEffect(() => {
    if (state.enabled) {
      startTicker();
    } else {
      stopTicker();
    }
    return stopTicker;
  }, [state.enabled, startTicker, stopTicker]);

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
    paceOptions: PACE_OPTIONS,
    setEnabled,
    setPace,
  };
}
