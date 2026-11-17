import type { AppColors } from '@theme';
import type { Session, SessionKind } from '@shared/engine/training';

/** One colour per session kind, used on the week strip, calendar and session page. */
export function kindColor(C: AppColors, kind: SessionKind): string {
  switch (kind) {
    case 'easy': case 'recovery': return C.mint2;
    case 'long': return C.brandGreen;
    case 'tempo': return C.rivalAmber;
    case 'intervals': return C.orange;
    case 'race': return C.t1;
  }
}

export const KIND_LABEL: Record<SessionKind, string> = {
  easy: 'Easy', recovery: 'Recovery', long: 'Long run', tempo: 'Tempo', intervals: 'Intervals', race: 'Race',
};

/** What a session is like to run, in one plain line. */
export const KIND_FEEL: Record<SessionKind, string> = {
  easy: 'Relaxed. You can hold a conversation the whole way.',
  recovery: 'Very easy. Slower than you think; it helps you recover.',
  long: 'Steady and relaxed. Time on your feet matters more than pace.',
  tempo: 'Steady and controlled. You can say a few words, not sentences.',
  intervals: 'Hard reps with easy jogs between. Hold the target pace on every rep.',
  race: 'Race day. Start steady and finish strong.',
};

/** "2 km", "400 m", "90 s", "5 min" */
export function stepAmount(st: Session['steps'][number]): string {
  if (st.distanceM) return st.distanceM >= 1000 ? `${+(st.distanceM / 1000).toFixed(st.distanceM % 1000 ? 1 : 0)} km` : `${st.distanceM} m`;
  if (st.durationSec) return st.durationSec >= 120 && st.durationSec % 60 === 0 ? `${st.durationSec / 60} min` : `${st.durationSec} s`;
  return '';
}
