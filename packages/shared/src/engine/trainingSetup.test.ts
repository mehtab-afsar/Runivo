import { describe, it, expect } from 'vitest';
import {
  buildPlan, buildStartPlan, rebuildForDate, estimateFiveK, fiveKFromTime, goalPlanShape, planEndDate, planStartMonday,
  missedKeySession, canDoMissedToday, doMissedToday, allSessions, weekday, addDays, setStatus,
  type TrainingPlanV2,
} from './training';

const TODAY = '2026-11-12'; // a Thursday
const make = (extra: Partial<Parameters<typeof buildPlan>[0]> = {}) => {
  const p = buildPlan({ race: 'half', raceDate: '2027-01-24', fiveKSec: 27 * 60, runDays: [1, 3, 5, 6], longRunDay: 6, today: TODAY, ...extra });
  if ('error' in p) throw new Error(p.error);
  return p as TrainingPlanV2;
};

describe('setup helpers', () => {
  it('starts plans next Monday and ends goal plans on a Sunday', () => {
    expect(planStartMonday(TODAY)).toBe('2026-11-16');
    expect(planStartMonday('2026-11-16')).toBe('2026-11-16');
    expect(weekday(planEndDate(TODAY, 8))).toBe(6);
    expect(planEndDate(TODAY, 1)).toBe('2026-11-22');
  });

  it('turns a 10K time into a 5K equivalent', () => {
    const fk = fiveKFromTime(10, 55 * 60);
    expect(fk).toBeGreaterThan(26 * 60);
    expect(fk).toBeLessThan(27 * 60);
    expect(fiveKFromTime(5, 1500)).toBe(1500);
  });

  it('estimates fitness from the best recent run, and needs two', () => {
    const now = Date.UTC(2026, 10, 12);
    const run = (km: number, min: number, daysAgo: number) => ({ distanceKm: km, durationSec: min * 60, startTime: now - daysAgo * 86400e3 });
    expect(estimateFiveK([run(5, 30, 2)], now)).toBeNull();
    const est = estimateFiveK([run(5, 30, 2), run(5, 28, 10), run(8, 40, 60), run(1, 4, 1)], now);
    expect(est?.fiveKSec).toBe(28 * 60);
    expect(est?.runs).toBe(2);
  });

  it('maps goals without a race to a distance and length', () => {
    expect(goalPlanShape('faster', '10k')).toEqual({ race: '10k', weeks: 10, cautious: false });
    expect(goalPlanShape('faster', 'half').race).toBe('5k');
    expect(goalPlanShape('further', 'half').weeks).toBe(10);
    expect(goalPlanShape('return', 'marathon')).toEqual({ race: '5k', weeks: 6, cautious: true });
  });
});

describe('injury history', () => {
  it('minor makes the plan cautious', () => {
    const normal = make();
    const minor = make({ injury: 'minor' });
    expect(minor.cautious).toBe(true);
    expect(minor.weeks[0].km).toBeLessThanOrEqual(normal.weeks[0].km);
  });

  it('often keeps intervals out of the first three weeks', () => {
    const p = make({ injury: 'often' });
    const early = p.weeks.slice(0, 3).flatMap(w => w.sessions);
    expect(early.some(s => s.kind === 'intervals')).toBe(false);
    expect(p.injury).toBe('often');
  });

  it('keeps the goal and race reference on the plan', () => {
    const p = make({ goal: 'race', raceRef: { raceId: 'r1', distanceId: 'd1', name: 'Lakeside Half' } });
    expect(p.raceRef?.name).toBe('Lakeside Half');
    expect(p.goal).toBe('race');
  });

  it('ends goal plans with a time trial, not a race', () => {
    const p = buildPlan({ race: '5k', raceDate: planEndDate(TODAY, 8), fiveKSec: 27 * 60, runDays: [1, 3, 6], longRunDay: 6, today: TODAY, goal: 'faster' });
    if ('error' in p) throw new Error(p.error);
    const last = allSessions(p).at(-1)!;
    expect(last.title).toBe('Time trial: 5K');
  });
});

describe('start running', () => {
  const p = buildStartPlan({ runDays: [0, 2, 4, 6], longRunDay: 6, today: TODAY });
  it('is 9 weeks of 3 days ending with a 5K', () => {
    if ('error' in p) throw new Error(p.error);
    expect(p.weeks).toHaveLength(9);
    expect(p.weeks.every(w => w.sessions.length === 3)).toBe(true);
    const last = allSessions(p).at(-1)!;
    expect(last.title).toBe('Your first 5K');
    expect(last.distanceKm).toBe(5);
    expect(p.goal).toBe('start');
  });

  it('runs get longer every week', () => {
    if ('error' in p) throw new Error(p.error);
    const runSec = (w: number) => p.weeks[w].sessions[0].steps.find(s => s.kind === 'run')!.durationSec!;
    for (let w = 1; w < 8; w++) expect(runSec(w)).toBeGreaterThan(runSec(w - 1));
  });

  it('every step has a duration the live tracker can follow', () => {
    if ('error' in p) throw new Error(p.error);
    const steps = p.weeks[0].sessions[0].steps;
    expect(steps.every(s => s.durationSec != null)).toBe(true);
  });

  it('needs 3 days including the long-run day', () => {
    expect(buildStartPlan({ runDays: [1, 3], longRunDay: 3, today: TODAY })).toEqual({ error: 'bad_days' });
  });
});

describe('race date change', () => {
  it('keeps weeks already started and rebuilds to the new date', () => {
    const p = make();
    const ticked = setStatus(p, p.weeks[0].sessions[0].id, 'done', 'run-1');
    const later = addDays(TODAY, 14); // two weeks on
    const r = rebuildForDate(ticked, '2027-02-07', later);
    if ('error' in r) throw new Error(r.error);
    expect(r.raceDate).toBe('2027-02-07');
    expect(r.weeks[0].sessions[0].status).toBe('done');
    expect(allSessions(r).at(-1)!.date).toBe('2027-02-07');
    const ids = allSessions(r).map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    r.weeks.forEach((w, i) => expect(w.index).toBe(i + 1));
  });

  it('refuses a date too close for the distance', () => {
    const r = rebuildForDate(make(), addDays(TODAY, 20), TODAY);
    expect('error' in r && r.error).toBe('too_soon');
  });
});

describe('missed sessions', () => {
  // Run days Tue (1), Thu (3), Sat (5), Sun (6); the key session is midweek.
  const p = make();
  const week1 = p.weeks[1]; // week 1 has no hard session yet
  const key = week1.sessions.find(s => s.kind === 'tempo' || s.kind === 'intervals')!;

  it('finds a key session missed this week', () => {
    const today = addDays(key.date, 1);
    expect(missedKeySession(p, today)?.id).toBe(key.id);
    expect(missedKeySession(p, key.date)).toBeNull();
  });

  it('ignores ones from earlier weeks', () => {
    expect(missedKeySession(p, addDays(key.date, 8))?.id).not.toBe(key.id);
  });

  it('moves it to today; today gives way and a hard day tomorrow becomes easy', () => {
    const tempo = key;
    const today = addDays(tempo.date, 1);
    expect(canDoMissedToday(p, tempo.id, today)).toBe(true);
    const next = doMissedToday(p, tempo.id, today);
    const moved = allSessions(next).find(s => s.id === tempo.id)!;
    expect(moved.date).toBe(today);
    const tomorrow = allSessions(next).find(s => s.date === addDays(today, 1));
    if (tomorrow) expect(['tempo', 'intervals']).not.toContain(tomorrow.kind);
  });

  it('is skipped when it cannot move', () => {
    const long = week1.sessions.find(s => s.kind === 'long')!;
    const next = doMissedToday(p, long.id, addDays(long.date, 3)); // next week
    expect(allSessions(next).find(s => s.id === long.id)!.status).toBe('skipped');
  });
});
