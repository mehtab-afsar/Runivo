import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@shared/services/supabase';
import { getRuns } from '@shared/services/store';
import { rescheduleSessionReminders } from './sessionReminders';
import {
  RACE_LABEL, matchRun, weekOf, type TrainingPlanV2, type Session, updatePacesFromRun, addDays, estimateFiveK,
} from '@shared/engine/training';
import { sessionFromCoach, type CoachSession } from '@shared/engine/coachSession';
import { leaveRace } from './raceService';

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

/** Forget the cached plan and its reminders (sign-out: the next account must not see it). */
export async function clearCachedPlan(): Promise<void> {
  await cache(null);
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
    goal: plan.raceRef ? `${plan.raceRef.name} (${RACE_LABEL[plan.race]})` : `${RACE_LABEL[plan.race]} on ${plan.raceDate}`,
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
  // A plan built for a race entered the runner in it ("42 training"). Ending
  // the plan takes them back out, or they stayed counted for a race they dropped.
  if (ap.plan.raceRef && localToday() <= ap.plan.raceDate) await leaveRace(ap.plan.raceRef.distanceId).catch(() => {});
}

/**
 * Starting values for plan setup: the 5K time from onboarding, recent weekly
 * distance, and a 5K estimate from the best recent run (for "I don't know").
 */
export async function fetchPlanDefaults(): Promise<{
  fiveKSec: number | null; weeklyKm: number | null; runsKm: number | null; estimate: { fiveKSec: number; runs: number } | null;
  /** The week the runner gave in onboarding, so the plan setup doesn't ask again from scratch. */
  runDays: number[] | null; longRunDay: number | null; cautious: boolean;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  let fiveKSec: number | null = null;
  let goalKm: number | null = null;
  let runDays: number[] | null = null;
  let longRunDay: number | null = null;
  let cautious = false;
  if (user) {
    const { data } = await supabase.from('profiles')
      .select('recent_5k_seconds, weekly_goal_km, run_days, long_run_day, niggles, returning_from_break')
      .eq('id', user.id).maybeSingle();
    fiveKSec = (data?.recent_5k_seconds as number | null) ?? null;
    goalKm = (data?.weekly_goal_km as number | null) ?? null;
    const days = data?.run_days as number[] | null | undefined;
    runDays = Array.isArray(days) && days.length >= 3 ? days.filter(d => d >= 0 && d <= 6).slice(0, 5) : null;
    longRunDay = typeof data?.long_run_day === 'number' ? data.long_run_day : null;
    const niggles = data?.niggles as string[] | null | undefined;
    cautious = !!data?.returning_from_break || (Array.isArray(niggles) && niggles.length > 0);
  }
  // Average of the last 4 weeks of on-foot running, when there is any.
  const since = Date.now() - 28 * 86_400_000;
  const recent = await getRuns(200);
  const runs = recent.filter(r => r.startTime >= since && !['cycle'].includes(r.activityType));
  const km = runs.reduce((t, r) => t + r.distanceMeters / 1000, 0) / 4;
  const running = recent.filter(r => r.activityType === 'run' || !r.activityType);
  const estimate = estimateFiveK(running.map(r => ({ distanceKm: r.distanceMeters / 1000, durationSec: r.durationSec, startTime: r.startTime })), Date.now());
  return { fiveKSec, weeklyKm: km >= 3 ? Math.round(km) : goalKm, runsKm: km >= 3 ? Math.round(km) : null, estimate, runDays, longRunDay, cautious };
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

/**
 * PaceX "Add to my plan": puts a coach session card on its date in the active
 * plan. A planned session already on that date is replaced (done or skipped
 * ones are kept). Returns 'no_plan' when there's no plan, 'outside' when the
 * date isn't in the plan's weeks.
 */
export async function addCoachSessionToPlan(cs: CoachSession): Promise<{ status: 'added'; session: Session } | { status: 'no_plan' | 'outside' }> {
  const ap = (await fetchActivePlan().catch(() => null)) ?? (await getCachedPlan());
  if (!ap) return { status: 'no_plan' };
  const wk = ap.plan.weeks.find(w => cs.date >= w.startDate && cs.date <= addDays(w.startDate, 6));
  if (!wk) return { status: 'outside' };
  const id = `pacex-${cs.date}-${Date.now().toString(36)}`;
  const kept = wk.sessions.filter(s => !(s.date === cs.date && s.status === 'planned'));
  const added = sessionFromCoach(cs, id);
  const sessions = [...kept, added].sort((a, b) => a.date.localeCompare(b.date));
  const plan: TrainingPlanV2 = {
    ...ap.plan,
    weeks: ap.plan.weeks.map(w => (w === wk ? { ...w, sessions, km: Math.round(sessions.reduce((t, s) => t + s.distanceKm, 0) * 10) / 10 } : w)),
  };
  await savePlan({ id: ap.id, plan });
  await rescheduleSessionReminders(plan).catch(() => {});
  return { status: 'added', session: added };
}
