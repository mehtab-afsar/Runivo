import { describe, it, expect } from 'vitest';
import { startPreview, planDays } from './startPlan';
import { parseGoalTime, raceDateForWeeks, stepsFor, type OnboardingData } from './types';

const base: OnboardingData = {
  lastKnownLocation: null, country: null, goal: 'get_fit',
  runsPerWeek: 3, usualKm: 5, fiveKInput: '27:30',
  healthConsent: false, healthBaseline: null, ageRange: null, gender: null, heightCm: null, weightKg: null,
  username: 'aanya', avatarUri: null, notificationsEnabled: false, distanceUnit: 'km',
  raceDistance: null, raceWeeks: 10, raceGoalInput: '',
  runDays: [1, 3, 5, 6], longRunDay: 6, usualTime: 'early', weekdayMinutes: 45,
  niggles: [], returning: false, paceXTone: null,
};
const TODAY = '2026-11-15'; // a Sunday

describe('onboarding start', () => {
  it('builds the real race plan for the race goal', () => {
    const p = startPreview({ ...base, goal: 'race', raceDistance: 'half', raceGoalInput: '1:59:00' }, 22, TODAY);
    expect(p.kind).toBe('plan');
    if (p.kind !== 'plan') return;
    expect(p.plan.race).toBe('half');
    expect(p.plan.goalSec).toBe(7140);
    expect(p.week1.length).toBe(4);
    expect(p.week1.find(d => d.kind === 'long')?.day).toBe(6);
  });

  it('goes cautious with a niggle', () => {
    const normal = startPreview({ ...base, goal: 'race', raceDistance: 'half' }, 22, TODAY);
    const sore = startPreview({ ...base, goal: 'race', raceDistance: 'half', niggles: ['knee'] }, 22, TODAY);
    expect(sore.cautious).toBe(true);
    if (normal.kind !== 'plan' || sore.kind !== 'plan') throw new Error('expected plans');
    expect(sore.plan.weeks[0].km).toBeLessThan(normal.plan.weeks[0].km);
  });

  it('falls back to an easy week, with a reason, when a plan cannot be built', () => {
    const noFiveK = startPreview({ ...base, goal: 'race', raceDistance: '10k', fiveKInput: '' }, 20, TODAY);
    expect(noFiveK.kind).toBe('week');
    if (noFiveK.kind === 'week') expect(noFiveK.planNote).toMatch(/5K/);
    const tooSoon = startPreview({ ...base, goal: 'race', raceDistance: 'marathon', raceWeeks: 4 }, 20, TODAY);
    expect(tooSoon.kind).toBe('week');
  });

  it('gives non-racers easy runs on their days, the long one on the long-run day', () => {
    const p = startPreview(base, 20, TODAY);
    expect(p.kind).toBe('week');
    expect(p.week1.map(d => d.day)).toEqual([1, 3, 5, 6]);
    expect(p.week1.find(d => d.day === 6)?.kind).toBe('long');
  });

  it('keeps at most five days and always the long-run day', () => {
    expect(planDays([0, 1, 2, 3, 4, 5, 6], 6)).toHaveLength(5);
    expect(planDays([0, 1, 2, 3, 4, 5, 6], 6)).toContain(6);
    expect(planDays([2, 0, 4], 4)).toEqual([0, 2, 4]);
  });
});

describe('goal time and race date', () => {
  it('parses goal times for long races too', () => {
    expect(parseGoalTime('1:59:00')).toEqual({ ok: true, seconds: 7140 });
    expect(parseGoalTime('52:30')).toEqual({ ok: true, seconds: 3150 });
    expect(parseGoalTime('')).toEqual({ ok: true, seconds: null });
    expect(parseGoalTime('5:00').ok).toBe(false);
    expect(parseGoalTime('1:75:00').ok).toBe(false);
    expect(parseGoalTime('abc').ok).toBe(false);
  });
  it('puts race day on the Sunday of the last week, counted from the coming Monday', () => {
    expect(raceDateForWeeks('2026-11-15', 1)).toBe('2026-11-22');
    expect(raceDateForWeeks('2026-11-16', 1)).toBe('2026-11-22');
    expect(raceDateForWeeks('2026-11-15', 10)).toBe('2027-01-24');
  });
});

describe('steps', () => {
  it('only asks about a race for the race goal', () => {
    expect(stepsFor('full', 'race').some(s => s.key === 'race')).toBe(true);
    expect(stepsFor('full', 'get_fit').some(s => s.key === 'race')).toBe(false);
    expect(stepsFor('short', 'race').some(s => s.key === 'health')).toBe(false);
  });
});
