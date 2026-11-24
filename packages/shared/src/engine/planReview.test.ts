import { describe, it, expect } from 'vitest';
import { buildPlan, setStatus, easeNextDays, addDays, type TrainingPlanV2 } from './training';
import { reviewLastWeek, matchUnseenRuns } from './planReview';

const TODAY = '2026-11-12';
const make = (): TrainingPlanV2 => {
  const p = buildPlan({ race: '10k', raceDate: '2027-02-14', fiveKSec: 25 * 60, runDays: [1, 3, 6], longRunDay: 6, today: TODAY });
  if ('error' in p) throw new Error(p.error);
  return p as TrainingPlanV2;
};
const week2Monday = (p: TrainingPlanV2) => p.weeks[1].startDate;
const tickWeek = (p: TrainingPlanV2, idx: number, n: number) =>
  p.weeks[idx].sessions.filter(s => s.kind !== 'race').slice(0, n).reduce((acc, s) => setStatus(acc, s.id, 'done', `run-${s.id}`), p);

describe('reviewLastWeek', () => {
  it('has nothing to review in the first week', () => {
    const p = make();
    expect(reviewLastWeek(p, p.weeks[0].startDate)).toBeNull();
  });

  it('suggests easing when most of last week was missed', () => {
    const p = tickWeek(make(), 0, 1);
    const r = reviewLastWeek(p, week2Monday(p))!;
    expect(r.suggestion).toBe('ease');
    expect(r.done).toBe(1);
    expect(r.missed).toBe(r.planned - 1);
    expect(r.reason).toMatch(/1 of \d sessions/);
  });

  it('keeps the plan when the week was done', () => {
    const p0 = make();
    const p = tickWeek(p0, 0, p0.weeks[0].sessions.length);
    const r = reviewLastWeek(p, week2Monday(p))!;
    expect(r.suggestion).toBe('keep');
    expect(r.reason).toMatch(/^All \d sessions done/);
  });

  it('does not stack an ease on a week that is already eased', () => {
    const p0 = tickWeek(make(), 0, 0);
    const mon = week2Monday(p0);
    const eased = easeNextDays(p0, mon);
    expect(reviewLastWeek(p0, mon)!.suggestion).toBe('ease');
    expect(reviewLastWeek(eased, mon)!.suggestion).toBe('keep');
  });

  it('stops after race day', () => {
    const p = make();
    expect(reviewLastWeek(p, addDays(p.raceDate, 1))).toBeNull();
  });
});

describe('matchUnseenRuns', () => {
  it('ticks sessions for imported runs, once each', () => {
    const p = make();
    const s = p.weeks[0].sessions[0];
    const runs = [{ runId: 'watch-1', date: s.date, km: s.distanceKm }];
    const once = matchUnseenRuns(p, runs);
    expect(once.matched).toBe(1);
    expect(once.plan.weeks[0].sessions[0]).toMatchObject({ status: 'done', runId: 'watch-1' });
    const again = matchUnseenRuns(once.plan, runs);
    expect(again.matched).toBe(0);
  });

  it('ignores runs before the plan or too short to count', () => {
    const p = make();
    const s = p.weeks[0].sessions[0];
    const res = matchUnseenRuns(p, [
      { runId: 'old', date: addDays(p.weeks[0].startDate, -10), km: 10 },
      { runId: 'short', date: s.date, km: s.distanceKm * 0.2 },
    ]);
    expect(res.matched).toBe(0);
    expect(res.plan).toBe(p);
  });
});
