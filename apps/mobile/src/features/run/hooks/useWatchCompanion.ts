/**
 * L4: keeps the Runivo watch app in step with the run on the phone, and turns
 * its taps into Start / Pause / Resume / End. No-op without the native module
 * or a paired watch with the app installed.
 */
import { useEffect, useRef } from 'react';
import { getWatch, type WatchCommand } from '../../../../modules/runivo-watch';
import { convertKm, convertPaceStringPerKm } from '@mobile/shared/lib/formatters';
import { formatArea } from '@shared/constants/territory';

function clock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function useWatchCompanion(p: {
  isRunning: boolean; isPaused: boolean; finished: boolean;
  distanceKm: number; elapsed: number; pace: string; unit: 'km' | 'mi'; metric: 'pace' | 'speed'; liveAreaM2?: number;
  onCommand: (c: WatchCommand) => void;
}) {
  const watch = getWatch();
  const cmd = useRef(p.onCommand);
  cmd.current = p.onCommand;

  useEffect(() => {
    if (!watch) return;
    const sub = watch.addListener('onCommand', e => cmd.current(e.command));
    return () => sub.remove();
  }, [watch]);

  // Throttled to every 2 s by the elapsed tick; phase changes go at once.
  const last = useRef({ at: 0, phase: '' });
  useEffect(() => {
    if (!watch) return;
    const phase = p.finished ? 'done' : !p.isRunning ? 'ready' : p.isPaused ? 'paused' : 'running';
    const now = Date.now();
    if (phase === last.current.phase && now - last.current.at < 2000) return;
    last.current = { at: now, phase };
    const d = convertKm(p.distanceKm, p.unit);
    const speed = p.elapsed > 0 ? d / (p.elapsed / 3600) : 0;
    try {
      if (!watch.isAvailable()) return;
      watch.sendState({
        phase,
        distance: d.toFixed(2), unit: p.unit, time: clock(p.elapsed),
        pace: p.metric === 'speed' ? speed.toFixed(1) : convertPaceStringPerKm(p.pace, p.unit),
        paceLabel: p.metric === 'speed' ? `${p.unit}/h` : `Pace /${p.unit}`,
        zone: p.liveAreaM2 && p.liveAreaM2 > 0 ? `Zone ${formatArea(p.liveAreaM2)}` : undefined,
      });
    } catch { /* watch gone */ }
  }, [watch, p.isRunning, p.isPaused, p.finished, p.distanceKm, p.elapsed, p.pace, p.unit, p.metric, p.liveAreaM2]);
}
