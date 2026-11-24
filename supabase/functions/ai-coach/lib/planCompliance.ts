// How the runner is doing against their active training plan.
//
// Plans are the app's structured format (training_plans.plan_data.version = 2,
// packages/shared/src/engine/training.ts): sessions have real dates and a
// status the app sets when a run matches. This used to read an older format
// (day names and types), so with today's plans every session counted as
// Monday's and PaceX misreported what was done and what was next.
import { fmtPaceSec, fmtTime } from './format.ts';
import type { PlanCompliance, RunRecord } from './types.ts';

interface V2Session {
  date: string; kind: string; title: string; distanceKm: number; status: string;
  steps?: Array<{ pace?: { fast: number; slow: number } }>;
}

interface V2Plan {
  version: 2; race: string; raceDate: string; targetSec: number; goal?: string;
  raceRef?: { name: string; city?: string | null } | null;
  weeks: Array<{ index: number; startDate: string; focus: string; sessions: V2Session[] }>;
}

export interface ActivePlanRow {
  id: string; goal: string; week_current: number; weeks_total: number;
  plan_data: V2Plan | Record<string, unknown>;
}

const addDaysISO = (d: string, n: number) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().split('T')[0];
};

/** Monday (UTC) of the current week, as YYYY-MM-DD. */
function mondayISODate(): string {
  const now = new Date();
  const diff = (now.getUTCDay() + 6) % 7;
  const mon  = new Date(now);
  mon.setUTCDate(now.getUTCDate() - diff);
  return mon.toISOString().split('T')[0];
}

/** Null when there is no active plan, or it is not the v2 format. */
export function computePlanCompliance(
  activePlanRow: ActivePlanRow | null,
  runs90d: RunRecord[],
  streakDays: number,
  consistencyRows: Array<{ consistency_score: number }>,
): PlanCompliance | null {
  const plan = activePlanRow?.plan_data as V2Plan | undefined;
  if (!(activePlanRow && plan && plan.version === 2 && Array.isArray(plan.weeks))) return null;

  const todayISO = new Date().toISOString().split('T')[0];
  const week = plan.weeks.find(w => todayISO >= w.startDate && todayISO <= addDaysISO(w.startDate, 6))
    ?? (todayISO < (plan.weeks[0]?.startDate ?? todayISO) ? plan.weeks[0] : plan.weeks[plan.weeks.length - 1]);
  const sessions = week?.sessions ?? [];
  const completed = sessions.filter(x => x.status === 'done').length;
  const missed = sessions.filter(x => x.status === 'skipped' || (x.status === 'planned' && x.date < todayISO)).length;
  const horizon = addDaysISO(todayISO, 7);
  const upcoming = plan.weeks.flatMap(w => w.sessions)
    .filter(x => x.status === 'planned' && x.date >= todayISO && x.date <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)
    .map(x => {
      const paced = (x.steps ?? []).find(st => st.pace)?.pace;
      const day = new Date(x.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
      return `${x.date} (${day}${x.date === todayISO ? ', today' : ''}): ${x.title}, ${x.distanceKm} km${paced ? ` at ${fmtPaceSec(paced.fast)}–${fmtPaceSec(paced.slow)}/km` : ''}`;
    });

  const lastWeekPlan = week ? plan.weeks.find(w => w.startDate === addDaysISO(week.startDate, -7)) : undefined;
  const lastSessions = (lastWeekPlan?.sessions ?? []).filter(x => x.kind !== 'race');
  const lastWeek = lastWeekPlan ? { planned: lastSessions.length, done: lastSessions.filter(x => x.status === 'done').length } : null;

  const kmThisWeek = runs90d
    .filter(r => r.started_at >= (week?.startDate ?? mondayISODate()) + 'T00:00:00Z')
    .reduce((sum, r) => sum + (r.distance_m ?? 0) / 1000, 0);

  const scores = consistencyRows.map(w => w.consistency_score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, n) => a + n, 0) / scores.length) : null;

  return {
    goal:                      activePlanRow.goal,
    weekCurrent:               week?.index ?? activePlanRow.week_current,
    weeksTotal:                plan.weeks.length,
    sessionsPlannedThisWeek:   sessions.length,
    sessionsCompletedThisWeek: completed,
    sessionsMissedThisWeek:    missed,
    kmActualThisWeek:          parseFloat(kmThisWeek.toFixed(1)),
    streakDays,
    consistencyLast8Weeks:     scores.reverse(),
    avgConsistencyLast8Weeks:  avgScore,
    lastWeek,
    upcoming,
    race: `${plan.raceRef ? `${plan.raceRef.name}${plan.raceRef.city ? ` (${plan.raceRef.city})` : ''}, ` : plan.goal && plan.goal !== 'race' ? `goal plan (${plan.goal}) ending in a time trial, ` : ''}${plan.race} on ${plan.raceDate}${plan.targetSec ? `, target ${fmtTime(plan.targetSec)}` : ''}${week?.focus ? ` · this week: ${week.focus}` : ''}`,
  };
}
