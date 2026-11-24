// Unit tests for the pure ai-coach modules (no Deno APIs, no network): the safety
// pre-check, signal ranking, run/territory metrics, plan compliance, prompt
// guardrails and request validation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectRedFlag } from './redFlags.ts';
import { rankSignals } from './signals.ts';
import { computeRunMetrics, computeTerritory } from './contextMetrics.ts';
import { computePlanCompliance } from './planCompliance.ts';
import { withGuardrails } from './prompts.ts';
import { parseFoodScanInput, parseRequest } from './requestValidation.ts';
import { handleQuickPrompts } from './handlers/quickPrompts.ts';
import { fmtPaceSec, fmtTime } from './format.ts';
import type { RunRecord, UserContext } from './types.ts';

const NOW = new Date('2026-11-24T12:00:00.000Z'); // a Tuesday
const DAY = 86_400_000;

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

function run(daysAgo: number, km: number, paceSec: number, id = `r${daysAgo}`): RunRecord {
  return {
    id, distance_m: km * 1000, duration_sec: Math.round(km * paceSec), avg_pace: fmtPaceSec(paceSec),
    started_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(), territories_claimed: [],
  };
}

function ctxWith(overrides: Partial<UserContext> = {}): UserContext {
  return {
    runs90d: [run(1, 5, 330)], totalKm90d: 5, weeklyKm: 4, trend: 'stable',
    paceZones: { easy: 0, moderate: 100, tempo: 0, hard: 0 }, easyPace: '6:30', tempoPace: '4:45',
    prs: { fastestPace: '5:30', longestRun: 5, best5kPace: null }, racePredictions: null,
    staleZoneCount: 0, avgFreshness: 100, totalAreaM2: 0, largestTierHeld: 'patch', territoryScore: 0,
    runnerRank: 'pacer', paceWeeklyEarned: 0, paceWeeklyCapLimit: 150,
    runner: {
      goal: null, tone: 'encouraging', experience: null, weeklyRuns: null, declaredWeeklyKm: null, usualDistanceKm: null,
      recent5kSeconds: null, ageRange: null, healthBaseline: null, raceDistance: null, raceDate: null, raceGoalSeconds: null,
      runDays: null, longRunDay: null, usualRunTime: null, weekdayMinutes: null, niggles: [], returningFromBreak: false,
    },
    planCompliance: null, nutrition: null, shoes: [],
    ...overrides,
  };
}

describe('detectRedFlag', () => {
  it.each([
    'I have chest pain when I run', "I can't breathe properly", 'I fainted after my long run',
    "haven't eaten in 3 days", 'I keep purging after dinner',
  ])('flags %s', (text) => expect(detectRedFlag(text)).toBe(true));

  it.each(['My legs feel tight after tempo', 'is pain normal in a marathon block?', '', null, undefined])(
    'leaves %s alone', (text) => expect(detectRedFlag(text)).toBe(false));
});

describe('rankSignals', () => {
  it('ranks inactivity above lower-priority signals', () => {
    const ctx = ctxWith({ runs90d: [run(9, 5, 330)], staleZoneCount: 1, avgFreshness: 30 });
    const signals = rankSignals(ctx);
    expect(signals[0].key).toBe('inactivity');
    expect(signals.map(s => s.priority)).toEqual([...signals.map(s => s.priority)].sort(
      (a, b) => ({ high: 3, medium: 2, low: 1 })[b] - ({ high: 3, medium: 2, low: 1 })[a]));
  });

  it('escalates stale territory to high at 3 zones', () => {
    const two = rankSignals(ctxWith({ staleZoneCount: 2 })).find(s => s.key === 'stale_territory');
    const three = rankSignals(ctxWith({ staleZoneCount: 3 })).find(s => s.key === 'stale_territory');
    expect([two?.priority, three?.priority]).toEqual(['medium', 'high']);
  });

  it('has nothing to say about a calm runner', () => {
    expect(rankSignals(ctxWith())).toEqual([]);
  });
});

describe('handleQuickPrompts', () => {
  it('always returns four prompts, topping up with fallbacks', () => {
    const prompts = handleQuickPrompts(ctxWith());
    expect(prompts).toHaveLength(4);
    expect(prompts[0].label).toBe("What's my next session?");
  });
});

describe('computeRunMetrics', () => {
  it('classifies pace zones, picks PRs and predicts races from the longest run', () => {
    const runs = [run(2, 10, 300), run(5, 5, 270), run(9, 8, 420), run(12, 3, 360)];
    const m = computeRunMetrics(runs);
    expect(m.paceZones).toEqual({ easy: 25, moderate: 25, tempo: 25, hard: 25 });
    expect(m.prs).toEqual({ fastestPace: '4:30', longestRun: 10, best5kPace: '4:30' });
    expect(m.racePredictions?.tenK).toBe(fmtTime(10 * 300));
  });

  it('reports a building base when there is nothing to compare', () => {
    expect(computeRunMetrics([]).trend).toBe('building base');
    expect(computeRunMetrics([]).racePredictions).toBeNull();
  });

  it('flags a declining trend when the last 4 weeks are slower', () => {
    const runs = [run(3, 5, 360), run(10, 5, 360), run(35, 5, 300), run(42, 5, 300)];
    expect(computeRunMetrics(runs).trend).toBe('declining');
  });
});

describe('computeTerritory', () => {
  it('decays freshness by 10 per day and counts stale zones', () => {
    const t = computeTerritory([
      { area_m2: 100, freshness: 100, last_defended_at: new Date(NOW.getTime() - 7 * DAY).toISOString(), tier: 'district' },
      { area_m2: 100, freshness: 90, last_defended_at: new Date(NOW.getTime() - 1 * DAY).toISOString(), tier: 'patch' },
    ]);
    expect(t).toEqual({ staleZoneCount: 1, totalArea: 200, avgFreshness: 55, largestTierHeld: 'district' });
  });

  it('is fully fresh with no zones', () => {
    expect(computeTerritory([]).avgFreshness).toBe(100);
  });
});

describe('computePlanCompliance', () => {
  const plan = {
    version: 2 as const, race: '10K', raceDate: '2027-01-18', targetSec: 3150, goal: 'race',
    weeks: [
      { index: 1, startDate: '2026-11-16', focus: 'Base', sessions: [
        { date: '2026-11-17', kind: 'easy', title: 'Easy', distanceKm: 5, status: 'done' },
        { date: '2026-11-19', kind: 'tempo', title: 'Tempo', distanceKm: 6, status: 'skipped' },
      ] },
      { index: 2, startDate: '2026-11-23', focus: 'Build', sessions: [
        { date: '2026-11-23', kind: 'easy', title: 'Missed', distanceKm: 5, status: 'planned' },
        { date: '2026-11-26', kind: 'tempo', title: 'Tempo', distanceKm: 6, status: 'planned', steps: [{ pace: { fast: 285, slow: 295 } }] },
      ] },
    ],
  };
  const row = { id: 'p', goal: 'race', week_current: 2, weeks_total: 2, plan_data: plan };

  it('counts this week, last week and upcoming sessions', () => {
    const pc = computePlanCompliance(row, [run(1, 5, 330)], 6, [{ consistency_score: 70 }, { consistency_score: 90 }]);
    expect(pc).toMatchObject({
      weekCurrent: 2, sessionsPlannedThisWeek: 2, sessionsCompletedThisWeek: 0, sessionsMissedThisWeek: 1,
      lastWeek: { planned: 2, done: 1 }, streakDays: 6, avgConsistencyLast8Weeks: 80, consistencyLast8Weeks: [90, 70],
    });
    expect(pc?.upcoming).toEqual(['2026-11-26 (Thu): Tempo, 6 km at 4:45–4:55/km']);
    expect(pc?.race).toBe('10K on 2027-01-18, target 52:30 · this week: Build');
  });

  it('ignores missing and pre-v2 plans', () => {
    expect(computePlanCompliance(null, [], 0, [])).toBeNull();
    expect(computePlanCompliance({ ...row, plan_data: { weeks: [] } }, [], 0, [])).toBeNull();
  });
});

describe('withGuardrails', () => {
  it('appends the shared safety and value rules to a persona', () => {
    const prompt = withGuardrails('You are a coach.');
    expect(prompt.startsWith('You are a coach.')).toBe(true);
    expect(prompt).toContain('SAFETY RULES');
    expect(prompt).toContain('COACHING VALUE RULES');
  });
});

describe('request validation', () => {
  const req = (body: string) => new Request('http://x', { method: 'POST', body });
  const refusal = async (p: Promise<unknown> | (() => unknown)) => {
    try { await (typeof p === 'function' ? p() : p); } catch (e) {
      if (e instanceof Response) return { status: e.status, text: await e.text() };
      throw e;
    }
    return null;
  };

  it('accepts a normal request', async () => {
    expect(await parseRequest(req('{"feature":"quick_prompts"}'))).toEqual({ feature: 'quick_prompts' });
  });

  it.each([
    ['{bad', 'Invalid JSON'], ['null', 'Invalid JSON'], ['{}', 'Missing feature'],
    ['{"feature":"dance"}', 'Unknown feature'], ['{"feature":"coach_chat","message":5}', 'Invalid message'],
    [`{"feature":"coach_chat","message":"${'x'.repeat(4001)}"}`, 'Invalid message'],
    ['{"feature":"weekly_brief","goal":5}', 'Invalid goal'], ['{"feature":"post_run","runId":7}', 'Invalid runId'],
  ])('refuses %s with 400 %s', async (body, text) => {
    expect(await refusal(parseRequest(req(body)))).toEqual({ status: 400, text });
  });

  it('checks food_scan input', async () => {
    expect(parseFoodScanInput({ feature: 'food_scan', imageBase64: 'AAAA' })).toEqual({ imageBase64: 'AAAA', mediaType: 'image/jpeg' });
    expect(await refusal(() => parseFoodScanInput({ feature: 'food_scan' }))).toEqual({ status: 400, text: 'Missing imageBase64' });
    expect(await refusal(() => parseFoodScanInput({ feature: 'food_scan', imageBase64: 'A', mediaType: 'image/tiff' })))
      .toEqual({ status: 400, text: 'Unsupported mediaType' });
    expect(await refusal(() => parseFoodScanInput({ feature: 'food_scan', imageBase64: 'a'.repeat(7_000_001) })))
      .toEqual({ status: 413, text: 'Image too large' });
  });
});
