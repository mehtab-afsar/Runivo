import { describe, it, expect, vi } from 'vitest';
vi.mock('@shared/services/supabase', () => ({ supabase: {} }));
import { proposePlan, type PlanAnswers } from './planFromProfile';

const TODAY = '2026-11-15';
const answers: PlanAnswers = {
  raceDistance: 'half', raceDate: '2027-01-24', raceGoalSeconds: 7140, fiveKSeconds: 27 * 60 + 30,
  weeklyKm: 22, runDays: [1, 3, 5, 6], longRunDay: 6, niggles: [], returning: false,
};

describe('PaceX plan proposal', () => {
  it('proposes the real plan from onboarding answers', () => {
    const p = proposePlan(answers, TODAY);
    expect(p.kind).toBe('plan');
    if (p.kind !== 'plan') return;
    expect(p.plan.race).toBe('half');
    expect(p.plan.raceDate).toBe('2027-01-24');
    expect(p.plan.runDays).toEqual([1, 3, 5, 6]);
    expect(p.cautious).toBe(false);
  });

  it('goes cautious for a niggle or a comeback', () => {
    const p = proposePlan({ ...answers, niggles: ['knee'] }, TODAY);
    expect(p.kind === 'plan' && p.cautious).toBe(true);
    expect(proposePlan({ ...answers, returning: true }, TODAY)).toMatchObject({ cautious: true });
  });

  it('says what is missing instead of guessing', () => {
    expect(proposePlan({ ...answers, raceDistance: null }, TODAY)).toEqual({ kind: 'needs', reason: 'race' });
    expect(proposePlan({ ...answers, raceDate: '2026-11-01' }, TODAY)).toEqual({ kind: 'needs', reason: 'past' });
    expect(proposePlan({ ...answers, fiveKSeconds: null }, TODAY)).toEqual({ kind: 'needs', reason: 'five_k' });
    expect(proposePlan({ ...answers, runDays: [6], longRunDay: 6 }, TODAY)).toEqual({ kind: 'needs', reason: 'days' });
    expect(proposePlan({ ...answers, raceDistance: 'marathon', raceDate: '2026-12-06' }, TODAY)).toMatchObject({ kind: 'needs', reason: 'too_soon' });
  });
});
