/**
 * Cheers arriving while you run (20261115000025). Each one is said out loud
 * (when voice cues are on) and shown as a card for a few seconds. Thank sends
 * a thank-you back; Mute stops cheers for the rest of this run.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeCheers, thankCheer, cheerText, type Cheer } from '@features/cheers/cheerService';
import { say } from './useVoiceCues';

const SHOW_MS = 9000;

export function useIncomingCheers(active: boolean, playerId: string | null | undefined, runnerName: string) {
  const [current, setCurrent] = useState<Cheer | null>(null);
  const [count, setCount] = useState(0);
  const muted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameRef = useRef(runnerName);
  nameRef.current = runnerName;

  useEffect(() => {
    if (!active || !playerId) return;
    muted.current = false;
    setCount(0);
    const stop = subscribeCheers(playerId, cheer => {
      if (muted.current) return;
      setCount(n => n + 1);
      setCurrent(cheer);
      say(`${cheer.fromName} cheered you on. ${cheerText(cheer.message, nameRef.current)}`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCurrent(null), SHOW_MS);
    });
    return () => {
      stop();
      if (timer.current) clearTimeout(timer.current);
      setCurrent(null);
    };
  }, [active, playerId]);

  const dismiss = useCallback(() => setCurrent(null), []);
  const thank = useCallback(() => {
    if (current) thankCheer(current.id).catch(() => {});
    setCurrent(null);
  }, [current]);
  const mute = useCallback(() => { muted.current = true; setCurrent(null); }, []);

  return { current, count, dismiss, thank, mute };
}
