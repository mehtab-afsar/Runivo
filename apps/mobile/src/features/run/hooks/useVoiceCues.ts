/**
 * Voice coach during a run (PRD L1): every kilometre (distance, split, time),
 * the loop closing, live game banners ("Entering Ana's zone"), workout steps
 * and reaching a target zone. Off in Settings → Run → Voice cues; silent on
 * builds without expo-speech.
 */
import { useEffect, useRef } from 'react';
import { getSettings } from '@shared/services/store';
import { kmCue, loopCue, stepCue } from '@shared/engine/voiceCues';
import { getSpeech } from '@mobile/shared/lib/optionalNative';
import type { WorkoutView } from '@features/training/hooks/useWorkoutMode';

let enabledCache: boolean | null = null;
/** Settings → Voice cues changed: forget the cached value. */
export const resetVoiceCuesSetting = () => { enabledCache = null; };

export function say(text: string): void {
  const speech = getSpeech();
  if (!speech) return;
  const go = () => { try { speech.speak(text, { language: 'en', rate: 1.0 }); } catch { /* ignore */ } };
  if (enabledCache != null) { if (enabledCache) go(); return; }
  getSettings().then(s => { enabledCache = s.voiceCues !== false; if (enabledCache) go(); }).catch(() => {});
}

interface Args {
  running: boolean;
  ride: boolean;
  distanceKm: number;
  elapsedSec: number;
  /** Metres back to the start, once the run can claim (null otherwise). */
  toStartM: number | null;
  farthestM: number;
  banner: string | null;
  workout: WorkoutView | null;
  targetInside: boolean | null;
}

export function useVoiceCues(a: Args): void {
  const lastKm = useRef(0);
  const lastKmAt = useRef(0);
  const lastSplit = useRef<number | undefined>(undefined);
  const loopSaid = useRef(false);
  const lastBanner = useRef<string | null>(null);
  const lastBannerAt = useRef(0);
  const lastStep = useRef<number | null>(null);
  const wasInside = useRef(false);

  useEffect(() => { enabledCache = null; }, []);

  // Every whole kilometre.
  useEffect(() => {
    if (!a.running) return;
    const km = Math.floor(a.distanceKm);
    if (km > lastKm.current && km >= 1) {
      const split = a.elapsedSec - lastKmAt.current;
      say(kmCue(km, split, a.elapsedSec, a.ride, lastSplit.current));
      lastSplit.current = split;
      lastKm.current = km;
      lastKmAt.current = a.elapsedSec;
    }
  }, [a.running, a.distanceKm, a.elapsedSec, a.ride]);

  // Loop closing: heading back within 100 m after going at least 300 m out.
  useEffect(() => {
    if (!a.running || a.toStartM == null) return;
    if (!loopSaid.current && a.farthestM >= 300 && a.toStartM <= 100) { say(loopCue(a.toStartM)); loopSaid.current = true; }
    if (a.toStartM > 250) loopSaid.current = false;
  }, [a.running, a.toStartM, a.farthestM]);

  // Live game banners, at most one every 20 s.
  useEffect(() => {
    if (!a.running || !a.banner || a.banner === lastBanner.current) return;
    if (a.elapsedSec - lastBannerAt.current < 20 && lastBanner.current) return;
    lastBanner.current = a.banner;
    lastBannerAt.current = a.elapsedSec;
    say(a.banner);
  }, [a.running, a.banner, a.elapsedSec]);

  // Workout steps.
  useEffect(() => {
    const w = a.workout;
    if (!a.running || !w) return;
    if (w.progress.done) { if (lastStep.current !== -1) { say('Session complete.'); lastStep.current = -1; } return; }
    if (lastStep.current === w.progress.index) return;
    lastStep.current = w.progress.index;
    const st = w.progress.step;
    say(stepCue(st.label, st.distanceM, st.durationSec, st.pace));
  }, [a.running, a.workout]);

  // Target zone reached.
  useEffect(() => {
    if (a.targetInside == null || !a.running) return;
    if (a.targetInside && !wasInside.current) say("You're in the zone.");
    wasInside.current = a.targetInside;
  }, [a.targetInside, a.running]);
}
