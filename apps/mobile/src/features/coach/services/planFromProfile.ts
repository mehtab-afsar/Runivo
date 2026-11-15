/**
 * "Approve this plan" (PaceX): the plan PaceX proposes from what the runner
 * told it in onboarding (race, date, goal time, run days, long-run day,
 * niggles) and their running (5K time, weekly distance). Built with the same
 * engine as the plan builder, so PaceX can only propose a plan the safety
 * rules allow. The pure part is unit-tested; loading reads the runner's own
 * profile row.
 */
import { supabase } from '@shared/services/supabase';
import { buildPlan, pickPlanDays, type TrainingPlanV2, type RaceDistance } from '@shared/engine/training';

export interface PlanAnswers {
  raceDistance: RaceDistance | null;
  raceDate: string | null;
  raceGoalSeconds: number | null;
  fiveKSeconds: number | null;
  weeklyKm: number | null;
  runDays: number[] | null;
  longRunDay: number | null;
  niggles: string[];
  returning: boolean;
}

export type PlanProposal =
  | { kind: 'plan'; plan: TrainingPlanV2; cautious: boolean }
  /** What's missing, said as what to do next. */
  | { kind: 'needs'; reason: 'race' | 'five_k' | 'days' | 'too_soon' | 'past'; minWeeks?: number };

export function proposePlan(a: PlanAnswers, today: string): PlanProposal {
  if (!a.raceDistance || !a.raceDate) return { kind: 'needs', reason: 'race' };
  if (a.raceDate <= today) return { kind: 'needs', reason: 'past' };
  if (!a.fiveKSeconds) return { kind: 'needs', reason: 'five_k' };
  const longRunDay = a.longRunDay ?? 6;
  const days = pickPlanDays(a.runDays?.length ? a.runDays : [1, 3, longRunDay], longRunDay);
  if (days.length < 3 || !days.includes(longRunDay)) return { kind: 'needs', reason: 'days' };
  const cautious = a.niggles.length > 0 || a.returning;
  const result = buildPlan({
    race: a.raceDistance, raceDate: a.raceDate, fiveKSec: a.fiveKSeconds, goalSec: a.raceGoalSeconds,
    runDays: days, longRunDay, currentWeeklyKm: a.weeklyKm, today, cautious,
  });
  if ('error' in result) {
    return result.error === 'too_soon' ? { kind: 'needs', reason: 'too_soon', minWeeks: result.minWeeks } : { kind: 'needs', reason: result.error === 'bad_days' ? 'days' : 'five_k' };
  }
  return { kind: 'plan', plan: result, cautious };
}

export async function loadPlanAnswers(): Promise<PlanAnswers | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('race_distance, race_date, race_goal_seconds, recent_5k_seconds, weekly_goal_km, run_days, long_run_day, niggles, returning_from_break')
    .eq('id', user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    raceDistance: (data.race_distance as RaceDistance | null) ?? null,
    raceDate: (data.race_date as string | null) ?? null,
    raceGoalSeconds: (data.race_goal_seconds as number | null) ?? null,
    fiveKSeconds: (data.recent_5k_seconds as number | null) ?? null,
    weeklyKm: (data.weekly_goal_km as number | null) ?? null,
    runDays: (data.run_days as number[] | null) ?? null,
    longRunDay: (data.long_run_day as number | null) ?? null,
    niggles: (data.niggles as string[] | null) ?? [],
    returning: !!data.returning_from_break,
  };
}
