/**
 * T7: a Runivo plan session as a Garmin Training API workout (running).
 * Distance steps end on distance, timed steps on time; a pace band becomes a
 * speed target (m/s), Garmin's unit for pace zones.
 */
export interface Step { kind: 'warmup' | 'run' | 'recover' | 'cooldown'; label: string; distanceM?: number; durationSec?: number; pace?: { fast: number; slow: number } }
export interface Session { id: string; title: string; summary: string; date: string; steps: Step[] }

const INTENSITY: Record<Step['kind'], string> = { warmup: 'WARMUP', run: 'INTERVAL', recover: 'RECOVERY', cooldown: 'COOLDOWN' };

export function toGarminWorkout(s: Session) {
  return {
    workoutName: s.title.slice(0, 50),
    description: `${s.summary} (from Runivo)`.slice(0, 1024),
    sport: 'RUNNING',
    workoutProvider: 'Runivo',
    workoutSourceId: 'Runivo',
    steps: s.steps.map((st, i) => ({
      type: 'WorkoutStep',
      stepOrder: i + 1,
      intensity: INTENSITY[st.kind],
      description: st.label.slice(0, 512),
      durationType: st.distanceM ? 'DISTANCE' : st.durationSec ? 'TIME' : 'OPEN',
      durationValue: st.distanceM ?? st.durationSec ?? null,
      durationValueType: st.distanceM ? 'METER' : null,
      targetType: st.pace ? 'SPEED' : 'OPEN',
      // fast pace = higher speed: low bound from the slow pace, high from the fast.
      targetValueLow: st.pace ? +(1000 / st.pace.slow).toFixed(3) : null,
      targetValueHigh: st.pace ? +(1000 / st.pace.fast).toFixed(3) : null,
    })),
  };
}
