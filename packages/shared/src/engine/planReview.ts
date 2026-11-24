/**
 * PaceX's weekly check-in on a training plan.
 *
 * The plan engine stays in charge: this looks at last week's sessions and
 * proposes one of a small set of changes the runner approves (nothing changes
 * the plan on its own). PaceX's weekly brief explains it in words.
 */
import { addDays, allSessions, mondayOf, matchRun, type TrainingPlanV2 } from './training';

export type ReviewSuggestion = 'ease' | 'keep';

export interface WeekReview {
  /** Monday of the week that was reviewed (last week). */
  weekStart: string;
  planned: number;
  done: number;
  skipped: number;
  missed: number;
  plannedKm: number;
  doneKm: number;
  suggestion: ReviewSuggestion;
  /** One line for the runner, in plain words. */
  reason: string;
}

/**
 * Review the week before `today`'s week. Null when there is nothing to review:
 * the plan hasn't run a full week yet, or the race has passed.
 */
export function reviewLastWeek(p: TrainingPlanV2, today: string): WeekReview | null {
  if (today > p.raceDate) return null;
  const weekStart = addDays(mondayOf(today), -7);
  const week = p.weeks.find(w => w.startDate === weekStart);
  if (!week) return null;
  const sessions = week.sessions.filter(s => s.kind !== 'race');
  if (sessions.length === 0) return null;

  const done = sessions.filter(s => s.status === 'done');
  const skipped = sessions.filter(s => s.status === 'skipped').length;
  const missed = sessions.filter(s => s.status === 'planned').length;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const plannedKm = round1(sessions.reduce((t, s) => t + s.distanceKm, 0));
  const doneKm = round1(done.reduce((t, s) => t + s.distanceKm, 0));

  // Already eased this week (by hand or an earlier check-in): don't stack it.
  const thisWeekEased = allSessions(p).some(s => s.eased && s.date >= mondayOf(today) && s.date <= addDays(mondayOf(today), 6));
  const behind = (sessions.length >= 2 && done.length / sessions.length < 0.5) || missed + skipped >= 2;
  const of = `${done.length} of ${sessions.length} session${sessions.length === 1 ? '' : 's'}`;

  if (behind && !thisWeekEased) {
    return {
      weekStart, planned: sessions.length, done: done.length, skipped, missed, plannedKm, doneKm,
      suggestion: 'ease',
      reason: `You did ${of} last week. Easing this week's hard sessions gets you back on track without piling on load.`,
    };
  }
  return {
    weekStart, planned: sessions.length, done: done.length, skipped, missed, plannedKm, doneKm,
    suggestion: 'keep',
    reason: done.length === sessions.length
      ? `All ${sessions.length} sessions done last week. This week stays as planned.`
      : `You did ${of} last week. Keep going: this week stays as planned.`,
  };
}

/**
 * Tick sessions for runs the plan never saw (a watch or Apple Health import,
 * or a run recorded before the plan loaded). Each run is used once: runs
 * already linked to a session are skipped. Returns the plan unchanged when
 * nothing new matched.
 */
export function matchUnseenRuns(
  p: TrainingPlanV2,
  runs: { runId: string; date: string; km: number }[],
): { plan: TrainingPlanV2; matched: number } {
  const linked = new Set(allSessions(p).map(s => s.runId).filter(Boolean));
  const first = p.weeks[0]?.startDate ?? p.raceDate;
  let plan = p;
  let matched = 0;
  for (const r of [...runs].sort((a, b) => a.date.localeCompare(b.date))) {
    if (linked.has(r.runId) || r.date < first || r.date > p.raceDate) continue;
    const res = matchRun(plan, r);
    if (res.sessionId) { plan = res.plan; matched += 1; linked.add(r.runId); }
  }
  return { plan, matched };
}
