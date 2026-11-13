import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@shared/services/supabase';
import { getRuns } from '@shared/services/store';
import { rescheduleSessionReminders } from './sessionReminders';
import {
  RACE_LABEL, matchRun, weekOf, type TrainingPlanV2, type Session, updatePacesFromRun, addDays,
} from '@shared/engine/training';

/**
 * Structured training plans (packages/shared/src/engine/training.ts), stored in
 * training_plans.plan_data with version 2 (owner-only by RLS). A copy is
 * cached on the device so Home and the live screen work offline.
 */
export interface ActivePlan { id: string; plan: TrainingPlanV2 }

const CACHE = 'runivo.activePlan.v2';

/** Today in the runner's local calendar, as YYYY-MM-DD. */
export function localToday(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

async function cache(ap: ActivePlan | null): Promise<void> {
  try {
    if (ap) await AsyncStorage.setItem(CACHE, JSON.stringify(ap));
    else await AsyncStorage.removeItem(CACHE);
  } catch { /* best effort */ }
  // Every plan change passes through here, so reminders follow moves and skips.
  void rescheduleSessionReminders(ap?.plan ?? null);
}

export async function getCachedPlan(): Promise<ActivePlan | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as ActivePlan) : null;
  } catch { return null; }
}

export async function fetchActivePlan(): Promise<ActivePlan | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getCachedPlan();
  const { data, error } = await supabase
    .from('training_plans')
    .select('id, plan_data')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return getCachedPlan();
  const plan = data?.plan_data as TrainingPlanV2 | undefined;
  const ap = data && plan?.version === 2 ? { id: data.id as string, plan } : null;
  await cache(ap);
  return ap;
}

/** Starts a new plan; any other active plan is ended. */
export async function createPlan(plan: TrainingPlanV2): Promise<ActivePlan> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  await supabase.from('training_plans').update({ status: 'abandoned' }).eq('user_id', user.id).eq('status', 'active');
  const { data, error } = await supabase.from('training_plans').insert({
    user_id: user.id,
    goal: `${RACE_LABEL[plan.race]} on ${plan.raceDate}`,
    goal_race_date: plan.raceDate,
    weeks_total: plan.weeks.length,
    week_current: 1,
    status: 'active',
    plan_data: plan,
  }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'could not save plan');
  const ap = { id: data.id as string, plan };
  await cache(ap);
  return ap;
}

/** Saves a changed plan (moved, eased, ticked). Cached first so it is never lost offline. */
export async function savePlan(ap: ActivePlan): Promise<void> {
  await cache(ap);
  const week = weekOf(ap.plan, localToday())?.index ?? 1;
  const finished = localToday() > ap.plan.raceDate;
  await supabase.from('training_plans')
    .update({ plan_data: ap.plan, week_current: week, status: finished ? 'completed' : 'active', updated_at: new Date().toISOString() })
    .eq('id', ap.id);
}

export async function endPlan(ap: ActivePlan): Promise<void> {
  await cache(null);
  await supabase.from('training_plans').update({ status: 'abandoned' }).eq('id', ap.id);
}

/** Starting values for the builder: the 5K time from onboarding and recent weekly distance. */
export async function fetchPlanDefaults(): Promise<{ fiveKSec: number | null; weeklyKm: number | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  let fiveKSec: number | null = null;
  let goalKm: number | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('recent_5k_seconds, weekly_goal_km').eq('id', user.id).maybeSingle();
    fiveKSec = (data?.recent_5k_seconds as number | null) ?? null;
    goalKm = (data?.weekly_goal_km as number | null) ?? null;
  }
  // Average of the last 4 weeks of on-foot running, when there is any.
  const since = Date.now() - 28 * 86_400_000;
  const runs = (await getRuns(200)).filter(r => r.startTime >= since && !['cycle'].includes(r.activityType));
  const km = runs.reduce((t, r) => t + r.distanceMeters / 1000, 0) / 4;
  return { fiveKSec, weeklyKm: km >= 3 ? Math.round(km) : goalKm };
}

/**
 * After an on-foot activity: tick the planned session it fulfils.
 * Returns that session, or null when nothing matched (or there is no plan).
 */
export async function recordRunAgainstPlan(run: { runId: string; startTime: number; distanceKm: number; durationSec?: number }): Promise<{ session: Session | null; fasterFiveK: number | null }> {
  const ap = (await getCachedPlan()) ?? (await fetchActivePlan().catch(() => null));
  if (!ap) return { session: null, fasterFiveK: null };
  const today = localToday(new Date(run.startTime));
  const { plan: matched, sessionId } = matchRun(ap.plan, { date: today, km: run.distanceKm, runId: run.runId });
  // A run that shows you're fitter speeds up the sessions still ahead.
  const faster = run.durationSec ? updatePacesFromRun(matched, { distanceKm: run.distanceKm, durationSec: run.durationSec }, addDays(today, 1)) : null;
  const plan = faster?.plan ?? matched;
  if (!sessionId && !faster) return { session: null, fasterFiveK: null };
  const next = { ...ap, plan };
  await savePlan(next).catch(() => cache(next));
  return {
    session: sessionId ? plan.weeks.flatMap(w => w.sessions).find(s => s.id === sessionId) ?? null : null,
    fasterFiveK: faster?.fiveKSec ?? null,
  };
}
