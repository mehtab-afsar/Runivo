import { describe, it, expect } from 'vitest';
import {
  fiveKFromRun, updatePacesFromRun, fmtBand,
  buildPlan, weekday, mondayOf, addDays, predictSec, pacesFrom, fmtPace, hardKm, allSessions,
  sessionOn, nextSession, moveSession, easeNextDays, matchRun, advance, startState, paceStatus,
  isMissed, PLAN_WEEKS, type TrainingPlanV2, type RaceDistance, type Step,
} from './training';

const TODAY = '2026-11-12'; // a Thursday
const plan = (race: RaceDistance, raceDate: string, extra: Partial<Parameters<typeof buildPlan>[0]> = {}) => {
  const p = buildPlan({ race, raceDate, fiveKSec: 25 * 60, runDays: [1, 3, 6], longRunDay: 6, today: TODAY, ...extra });
  if ('error' in p) throw new Error(p.error);
  return p as TrainingPlanV2;
};

describe('dates', () => {
  it('weeks start on Monday', () => {
    expect(weekday('2026-11-09')).toBe(0);
    expect(weekday('2026-11-15')).toBe(6);
    expect(mondayOf('2026-11-12')).toBe('2026-11-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('paces', () => {
  it('predicts race times from a 5K (Riegel)', () => {
    expect(Math.round(predictSec(1500, 10) / 60)).toBe(52); // 25:00 5K → ~52 min 10K
    expect(Math.round(predictSec(1500, 42.195) / 60)).toBe(240); // → ~4 h marathon
  });
  it('orders the zones from easy to fast', () => {
    const p = pacesFrom(1500, 330);
    expect(p.recovery.slow).toBeGreaterThan(p.easy.slow);
    expect(p.easy.fast).toBeGreaterThan(p.tempo.slow);
    expect(p.tempo.fast).toBeGreaterThan(p.interval.slow);
    expect(fmtPace(p.tempo.fast)).toBe('5:18');
  });
});

describe('building a plan', () => {
  const races: [RaceDistance, string][] = [['5k', '2027-01-17'], ['10k', '2027-02-14'], ['half', '2027-03-14'], ['marathon', '2027-04-25']];

  for (const [race, date] of races) {
    describe(race, () => {
      const p = plan(race, date, { runDays: [0, 2, 3, 5, 6], longRunDay: 6, currentWeeklyKm: 20 });

      it('ends with the race on race day', () => {
        const last = p.weeks[p.weeks.length - 1];
        expect(last.focus).toBe('race');
        expect(last.sessions.find(s => s.kind === 'race')?.date).toBe(date);
        expect(p.weeks.length).toBeLessThanOrEqual(PLAN_WEEKS[race].max);
      });
      it('never grows a week more than 10% over the last full week', () => {
        let lastFull = p.weeks[0].km;
        for (const w of p.weeks.slice(1)) {
          if (w.focus === 'base' || w.focus === 'build') {
            expect(w.km).toBeLessThanOrEqual(lastFull * 1.1 + 0.6); // rounding of single sessions
            lastFull = w.km;
          }
        }
      });
      it('makes every 4th week a recovery week (outside the taper)', () => {
        p.weeks.filter(w => w.index % 4 === 0 && w.focus !== 'taper' && w.focus !== 'race')
          .forEach(w => expect(w.focus).toBe('recovery'));
      });
      it('keeps hard running at or under 25% of each training week', () => {
        p.weeks.filter(w => w.focus !== 'race').forEach(w => {
          const hard = w.sessions.reduce((t, s) => t + hardKm(s), 0);
          expect(hard).toBeLessThanOrEqual(w.km * 0.25 + 0.5);
        });
      });
      it('tapers before the race', () => {
        const n = p.weeks.length;
        expect(p.weeks[n - 2].km).toBeLessThan(Math.max(...p.weeks.slice(0, n - 2).map(w => w.km)));
      });
      it('only schedules on the chosen days, long run on the long-run day', () => {
        allSessions(p).filter(s => s.kind !== 'race').forEach(s => expect([0, 2, 3, 5, 6]).toContain(weekday(s.date)));
        p.weeks.filter(w => w.focus !== 'race').forEach(w =>
          expect(weekday(w.sessions.find(s => s.kind === 'long')!.date)).toBe(6));
      });
    });
  }

  it('starts gently: no hard session in week 1', () => {
    const p = plan('10k', '2027-02-14');
    expect(p.weeks[0].sessions.every(s => hardKm(s) === 0)).toBe(true);
  });
  it('refuses a race too soon for the distance', () => {
    expect(buildPlan({ race: 'marathon', raceDate: '2026-12-20', fiveKSec: 1500, runDays: [1, 3, 6], longRunDay: 6, today: TODAY }))
      .toEqual({ error: 'too_soon', minWeeks: 12 });
  });
  it('refuses fewer than 3 or more than 5 run days, or a long run off them', () => {
    expect(buildPlan({ race: '5k', raceDate: '2027-01-17', fiveKSec: 1500, runDays: [1, 6], longRunDay: 6, today: TODAY })).toEqual({ error: 'bad_days' });
    expect(buildPlan({ race: '5k', raceDate: '2027-01-17', fiveKSec: 1500, runDays: [1, 3, 5], longRunDay: 6, today: TODAY })).toEqual({ error: 'bad_days' });
  });
  it('caps a goal more than 5% faster than the 5K predicts, and says so', () => {
    const p = plan('10k', '2027-02-14', { goalSec: 40 * 60 });
    expect(p.goalCapped).toBe(true);
    expect(p.targetSec).toBe(Math.round(predictSec(1500, 10) * 0.95));
    const ok = plan('10k', '2027-02-14', { goalSec: 51 * 60 });
    expect(ok.goalCapped).toBe(false);
    expect(ok.targetSec).toBe(51 * 60);
  });
  it('only plans the last weeks of a far-off race', () => {
    const p = plan('5k', '2027-09-05');
    expect(p.weeks).toHaveLength(12);
  });
});

describe('using a plan', () => {
  const p = plan('10k', '2027-02-14');
  const first = allSessions(p)[0];

  it('finds the session on a day and the next one to do', () => {
    expect(sessionOn(p, first.date)?.id).toBe(first.id);
    expect(nextSession(p, TODAY)?.id).toBe(first.id);
  });
  it('moves a session within its week, swapping with whatever was there', () => {
    const w = p.weeks[1];
    const [a, b] = w.sessions;
    const moved = moveSession(p, a.id, b.date);
    expect(allSessions(moved).find(s => s.id === a.id)!.date).toBe(b.date);
    expect(allSessions(moved).find(s => s.id === b.id)!.date).toBe(a.date);
    expect(moveSession(p, a.id, addDays(w.startDate, 9))).toBe(p); // outside the week: unchanged
  });
  it('eases the next 7 days when not feeling 100%', () => {
    const start = p.weeks[2].startDate;
    const eased = easeNextDays(p, start);
    const week = eased.weeks[2].sessions;
    expect(week.every(s => s.eased && s.kind === 'recovery' && hardKm(s) === 0)).toBe(true);
    expect(eased.weeks[3]).toEqual(p.weeks[3]);
  });
  it('ticks the session a run fulfils, the same day or one day either side', () => {
    const { plan: after, sessionId } = matchRun(p, { date: addDays(first.date, 1), km: first.distanceKm, runId: 'r1' });
    expect(sessionId).toBe(first.id);
    expect(allSessions(after).find(s => s.id === first.id)).toMatchObject({ status: 'done', runId: 'r1' });
    expect(matchRun(p, { date: first.date, km: first.distanceKm * 0.3, runId: 'r2' }).sessionId).toBeNull();
  });
  it('knows a past planned session was missed', () => {
    expect(isMissed(first, addDays(first.date, 1))).toBe(true);
    expect(isMissed(first, first.date)).toBe(false);
  });
});

describe('live workout tracking', () => {
  const steps: Step[] = [
    { kind: 'warmup', label: 'Warm up', distanceM: 1000 },
    { kind: 'run', label: 'Rep 1 of 2', distanceM: 400, pace: { fast: 280, slow: 295 } },
    { kind: 'recover', label: 'Jog', durationSec: 90 },
    { kind: 'run', label: 'Rep 2 of 2', distanceM: 400 },
  ];
  it('walks through distance and time steps', () => {
    let s = startState();
    let r = advance(steps, s, 300, 600);
    expect(r.progress).toMatchObject({ index: 0, changed: false, remaining: { metres: 400 } });
    r = advance(steps, r.state, 360, 1010); s = r.state;
    expect(r.progress).toMatchObject({ index: 1, changed: true });
    r = advance(steps, s, 450, 1420); s = r.state;
    expect(r.progress.index).toBe(2);
    r = advance(steps, s, 500, 1500);
    expect(r.progress.remaining.seconds).toBe(40);
    r = advance(steps, s, 545, 1560); s = r.state;
    expect(r.progress.index).toBe(3);
    r = advance(steps, s, 700, 1990);
    expect(r.progress.done).toBe(true);
  });
  it('judges pace against the band with a little slack', () => {
    const band = { fast: 280, slow: 295 };
    expect(paceStatus(310, band)).toBe('slow');
    expect(paceStatus(290, band)).toBe('on');
    expect(paceStatus(270, band)).toBe('fast');
    expect(paceStatus(null, band)).toBeNull();
  });
});

describe('updatePacesFromRun', () => {
  const base = () => {
    const r = buildPlan({ race: '10k', raceDate: '2027-02-28', today: '2026-11-12', fiveKSec: 1500, goalSec: null, runDays: [1, 3, 5, 6], longRunDay: 6, currentWeeklyKm: 20 });
    if ('error' in r) throw new Error(r.error);
    return r;
  };

  it('estimates a 5K from longer runs and ignores short or silly ones', () => {
    expect(fiveKFromRun(5, 1500)).toBe(1500);
    expect(fiveKFromRun(10, 3120)).toBeGreaterThan(1400);
    expect(fiveKFromRun(2, 500)).toBeNull();
    expect(fiveKFromRun(10, 600)).toBeNull();
  });

  it('leaves the plan alone for a normal or slow run', () => {
    const p = base();
    expect(updatePacesFromRun(p, { distanceKm: 8, durationSec: 8 * 380 }, '2026-11-20')).toBeNull();
    expect(updatePacesFromRun(p, { distanceKm: 5, durationSec: 1490 }, '2026-11-20')).toBeNull();
  });

  it('speeds up future sessions by at most 5%, keeps race pace and past sessions', () => {
    const p = base();
    const today = p.weeks[1].startDate;
    const out = updatePacesFromRun(p, { distanceKm: 5, durationSec: 1200 }, today)!;
    expect(out.fiveKSec).toBe(1425);
    expect(out.plan.paces.tempo.fast).toBeLessThan(p.paces.tempo.fast);
    expect(out.plan.paces.race).toEqual(p.paces.race);
    const before = p.weeks[0].sessions[0];
    expect(out.plan.weeks[0].sessions[0]).toEqual(before);
    const future = out.plan.weeks[2].sessions.find(s => s.kind === 'tempo' || s.kind === 'easy')!;
    const step = future.steps.find(st => st.pace)!;
    expect(Object.values(out.plan.paces).some(b => b.fast === step.pace!.fast && b.slow === step.pace!.slow)).toBe(true);
    expect(future.summary).not.toContain(fmtBand(p.paces.tempo));
  });
});
