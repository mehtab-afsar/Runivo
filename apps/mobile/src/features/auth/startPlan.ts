/**
 * The end of onboarding: turn the answers into the runner's start. For the
 * race goal that is the real plan (the same engine as the plan builder);
 * otherwise a simple first week of easy runs on the days they picked.
 * Pure, so it's unit-tested.
 */
import { buildPlan, pickPlanDays, type TrainingPlanV2, type RaceDistance, type PlanError } from '@shared/engine/training';
import { parseFiveKTime } from '@shared/engine/onboarding';
import { parseGoalTime, raceDateForWeeks, type OnboardingData } from './types';

export interface StartDay { day: number; label: string; detail: string; kind: 'easy' | 'long' | 'hard' }

export type StartPreview =
  | { kind: 'plan'; plan: TrainingPlanV2; week1: StartDay[]; cautious: boolean }
  | { kind: 'week'; week1: StartDay[]; cautious: boolean; planNote: string | null };

/** Up to five run days, always keeping the long-run day (the plan engine's rule). */
export const planDays = pickPlanDays;

export function startPreview(data: OnboardingData, weeklyTargetKm: number, today: string): StartPreview {
  const cautious = data.niggles.length > 0 || data.returning;
  const days = planDays(data.runDays.length ? data.runDays : [1, 3, 6], data.longRunDay);
  const longDay = days.includes(data.longRunDay) ? data.longRunDay : days[days.length - 1];
  const fiveK = parseFiveKTime(data.fiveKInput);
  const fiveKSec = fiveK.ok ? fiveK.seconds : null;

  let planNote: string | null = null;
  if (data.goal === 'race' && data.raceDistance) {
    if (!fiveKSec) planNote = 'Add a recent 5K time and PaceX can build your race plan.';
    else if (days.length < 3) planNote = 'Pick at least 3 run days for a race plan.';
    else {
      const goal = parseGoalTime(data.raceGoalInput);
      const result = buildPlan({
        race: data.raceDistance as RaceDistance,
        raceDate: raceDateForWeeks(today, data.raceWeeks),
        fiveKSec, goalSec: goal.ok ? goal.seconds : null,
        runDays: days, longRunDay: longDay, currentWeeklyKm: weeklyTargetKm, today, cautious,
      });
      if (!('error' in result)) {
        const w = result.weeks[0];
        const week1: StartDay[] = w.sessions.map(se => {
          const d = (new Date(`${se.date}T00:00:00Z`).getUTCDay() + 6) % 7;
          const hard = se.kind === 'tempo' || se.kind === 'intervals';
          return { day: d, label: se.title, detail: se.summary || `${se.distanceKm} km`, kind: se.kind === 'long' ? 'long' : hard ? 'hard' : 'easy' };
        });
        return { kind: 'plan', plan: result, week1, cautious };
      }
      planNote = tooSoonNote(result.error, result.minWeeks);
    }
  }

  // No race plan: easy runs on their days, the long one on the long-run day.
  const target = Math.max(days.length * 2, Math.round(weeklyTargetKm * (cautious ? 0.8 : 1)));
  const longKm = Math.max(3, Math.round(target * (days.length <= 3 ? 0.4 : 0.32)));
  const easyKm = Math.max(2, Math.round((target - longKm) / Math.max(1, days.length - 1)));
  const week1: StartDay[] = days.map(d => d === longDay
    ? { day: d, label: 'Long easy run', detail: `${longKm} km, chatty pace`, kind: 'long' }
    : { day: d, label: 'Easy run', detail: `${easyKm} km${d === days[0] ? ' · claims your first zone' : ''}`, kind: 'easy' });
  return { kind: 'week', week1, cautious, planNote };
}

function tooSoonNote(error: PlanError, minWeeks?: number): string {
  if (error === 'too_soon') return `That race needs at least ${minWeeks ?? 4} weeks of training. PaceX starts you on easy runs; build the plan once you pick a later race.`;
  if (error === 'bad_days') return 'Pick 3 to 5 run days, including your long-run day, for a race plan.';
  return 'Check your 5K time and PaceX can build your race plan.';
}
