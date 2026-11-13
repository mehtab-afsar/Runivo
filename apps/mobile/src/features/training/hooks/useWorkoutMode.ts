import { useEffect, useRef, useState } from 'react';
import { feedback } from '@theme';
import { advance, paceStatus, startState, type Session, type StepProgress, type StepState } from '@shared/engine/training';
import { getCachedPlan, fetchActivePlan } from '../services/planService';

export interface WorkoutView {
  session: Session;
  progress: StepProgress;
  /** Average pace within the current step, sec/km (null until 100 m in). */
  stepPace: number | null;
  status: 'slow' | 'on' | 'fast' | null;
}

/**
 * Follows a planned session while recording: which step you are on, what is
 * left, and whether you are on the target pace. Cues with a haptic and sound
 * on each new step, and a haptic when you drift off pace (at most every 30 s).
 */
export function useWorkoutMode(sessionId: string | undefined, running: boolean, elapsedSec: number, distanceKm: number): WorkoutView | null {
  const [session, setSession] = useState<Session | null>(null);
  const state = useRef<StepState>(startState());
  const lastStatus = useRef<string | null>(null);
  const lastPaceCue = useRef(0);
  const [view, setView] = useState<WorkoutView | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const find = (ap: Awaited<ReturnType<typeof getCachedPlan>>) =>
      ap?.plan.weeks.flatMap(w => w.sessions).find(s => s.id === sessionId) ?? null;
    getCachedPlan().then(ap => {
      const s = find(ap);
      if (s) setSession(s);
      else fetchActivePlan().then(a => setSession(find(a))).catch(() => {});
    });
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    const metres = distanceKm * 1000;
    const { state: next, progress } = advance(session.steps, state.current, elapsedSec, metres);
    state.current = next;

    const inStepM = metres - next.startM;
    const inStepS = elapsedSec - next.startSec;
    const stepPace = inStepM >= 100 ? inStepS / (inStepM / 1000) : null;
    const status = progress.done ? null : paceStatus(stepPace, progress.step.pace);

    if (running && progress.changed) feedback.workoutStep();
    if (running && status && status !== 'on' && status !== lastStatus.current && elapsedSec - lastPaceCue.current > 30) {
      feedback.workoutPace();
      lastPaceCue.current = elapsedSec;
    }
    lastStatus.current = status;
    setView({ session, progress, stepPace, status });
  }, [session, running, elapsedSec, distanceKm]);

  return view;
}
