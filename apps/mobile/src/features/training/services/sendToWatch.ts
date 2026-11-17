/**
 * Put a planned session on the runner's watch: Apple Watch (WorkoutKit, iOS 17+,
 * via the runivo-workouts module) or Garmin (export-workout function, which
 * reads the session from the active plan by id). Used by the plan screen and
 * PaceX's session card, so both say the same thing.
 */
import { supabase } from '@shared/services/supabase';
import type { Session } from '@shared/engine/training';
import { getWatchWorkouts } from '../../../../modules/runivo-workouts';

export interface WatchResult { ok: boolean; title: string; message: string }

export async function appleWatchSupported(): Promise<boolean> {
  return (await getWatchWorkouts()?.isSupported().catch(() => false)) === true;
}

export async function sendToAppleWatch(session: Pick<Session, 'title' | 'date' | 'steps'>): Promise<WatchResult> {
  const ok = await getWatchWorkouts()?.schedule({
    title: session.title, date: session.date,
    steps: session.steps.map(st => ({ kind: st.kind, distanceM: st.distanceM, durationSec: st.durationSec })),
  }).catch(() => false);
  return ok
    ? { ok: true, title: 'On your Apple Watch', message: `Open the Workout app on ${session.date} and it's under Custom.` }
    : { ok: false, title: "Couldn't add it", message: 'Allow Runivo to add workouts when asked, and check your watch runs watchOS 10 or later.' };
}

/** The session must already be in the active plan (it's read there by id). */
export async function sendToGarmin(session: Pick<Session, 'id' | 'date'>): Promise<WatchResult & { notConnected: boolean }> {
  const { data, error } = await supabase.functions.invoke('export-workout', { body: { sessionId: session.id } });
  const code = (data as { error?: string } | null)?.error ?? (error ? 'failed' : null);
  if (!code) return { ok: true, notConnected: false, title: 'Sent to Garmin', message: `It's on your Garmin calendar for ${session.date}. Sync your watch to see it.` };
  return {
    ok: false, notConnected: code === 'garmin_not_connected', title: "Couldn't send it",
    message: code === 'garmin_not_connected' ? 'Connect Garmin in Connected apps and devices first.'
      : code === 'garmin_permission' ? 'Reconnect Garmin and allow workout import.'
      : 'Try again in a moment.',
  };
}
