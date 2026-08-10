/**
 * missions.test.ts — daily mission generation and progress tracking.
 *
 * `generateDailyMissions` / `generateBlueprint` are seeded from the calendar
 * date, which makes them fully deterministic and therefore worth pinning: the
 * whole mission system assumes every device generates the SAME three missions
 * for the same day, and a change to the seeding or the template list silently
 * breaks that agreement between a user's phone and anything server-side that
 * reasons about mission ids.
 */

import { describe, it, expect } from 'vitest';
import {
  MISSION_TEMPLATES,
  GOAL_TO_CATEGORY,
  generateDailyMissions,
  generateBlueprint,
  updateMissionProgress,
  type Mission,
} from './missions';

const FIXED_DATE = new Date(2026, 6, 22); // 22 Jul 2026 — arbitrary but fixed

const emptyRun = {
  distanceKm: 0,
  territoriesClaimed: [] as string[],
  enemyCaptured: 0,
  fastKmCount: 0,
  defendedZonesCount: 0,
  rivalZonesStolen: 0,
};

// ── Template catalogue ────────────────────────────────────────────────────────

describe('MISSION_TEMPLATES', () => {
  it('has a template for every difficulty tier', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(MISSION_TEMPLATES.filter(t => t.difficulty === d).length).toBeGreaterThan(0);
    }
  });

  it('gives every template a positive PACE reward and target', () => {
    for (const t of MISSION_TEMPLATES) {
      expect(t.rewards.pace).toBeGreaterThan(0);
      expect(t.target).toBeGreaterThan(0);
    }
  });

  it('uses unique titles — titles are the identity key for saved selections', () => {
    // MissionsScreen restores a user's selection by title, so duplicates would
    // make two different missions indistinguishable when reloading.
    const titles = MISSION_TEMPLATES.map(t => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('gives every onboarding goal at least one template of its own', () => {
    // Previously "explore" was orphaned — GOAL_TO_CATEGORY mapped it to the
    // `explorer` category but no template carried that category, so
    // generateBlueprint's 70% goal bias silently fell back to the generic
    // pool for those users. Fixed by adding explorer-tagged templates; this
    // is the stronger assertion the old "KNOWN GAP" test said should replace
    // it once that happened.
    const categories = new Set(MISSION_TEMPLATES.map(t => t.goalCategory));
    for (const [goal, category] of Object.entries(GOAL_TO_CATEGORY)) {
      expect(categories.has(category), `goal "${goal}" has no missions`).toBe(true);
    }
  });
});

// ── generateDailyMissions ─────────────────────────────────────────────────────

describe('generateDailyMissions', () => {
  it('always returns exactly 3 missions', () => {
    expect(generateDailyMissions(FIXED_DATE, 'mixed')).toHaveLength(3);
  });

  it('is deterministic for the same date and difficulty', () => {
    const a = generateDailyMissions(FIXED_DATE, 'mixed');
    const b = generateDailyMissions(FIXED_DATE, 'mixed');
    expect(a.map(m => m.title)).toEqual(b.map(m => m.title));
    expect(a.map(m => m.id)).toEqual(b.map(m => m.id));
  });

  it('produces a different set on a different day', () => {
    const day1 = generateDailyMissions(new Date(2026, 6, 22), 'mixed');
    const day2 = generateDailyMissions(new Date(2026, 6, 23), 'mixed');
    expect(day1.map(m => m.id)).not.toEqual(day2.map(m => m.id));
  });

  it('starts every mission unclaimed, incomplete and at zero progress', () => {
    for (const m of generateDailyMissions(FIXED_DATE)) {
      expect(m.current).toBe(0);
      expect(m.completed).toBe(false);
      expect(m.claimed).toBe(false);
    }
  });

  it('expires missions at the end of the given day', () => {
    const [m] = generateDailyMissions(FIXED_DATE);
    const expiry = new Date(m.expiresAt);
    expect(expiry.getHours()).toBe(23);
    expect(expiry.getMinutes()).toBe(59);
    expect(expiry.getDate()).toBe(FIXED_DATE.getDate());
  });

  it('keeps easy difficulty free of hard missions', () => {
    const easy = generateDailyMissions(FIXED_DATE, 'easy');
    expect(easy.some(m => m.difficulty === 'hard')).toBe(false);
  });

  it('keeps hard difficulty free of easy missions', () => {
    const hard = generateDailyMissions(FIXED_DATE, 'hard');
    expect(hard.some(m => m.difficulty === 'easy')).toBe(false);
  });

  it('namespaces ids by day so two days never collide', () => {
    const [m] = generateDailyMissions(FIXED_DATE);
    expect(m.id).toMatch(/^daily-2026-6-22-\d+$/);
  });
});

// ── generateBlueprint ─────────────────────────────────────────────────────────

describe('generateBlueprint', () => {
  it('returns 3 distinct missions', () => {
    const bp = generateBlueprint('compete', 'mixed', FIXED_DATE);
    expect(bp).toHaveLength(3);
    expect(new Set(bp.map(m => m.title)).size).toBe(3);
  });

  it('is deterministic for the same goal and date', () => {
    const a = generateBlueprint('get_fit', 'mixed', FIXED_DATE);
    const b = generateBlueprint('get_fit', 'mixed', FIXED_DATE);
    expect(a.map(m => m.title)).toEqual(b.map(m => m.title));
  });

  it('biases toward the category matching the chosen goal', () => {
    // 70% bias per slot — over several days at least one territory mission
    // should surface for a "compete" runner.
    const days = [20, 21, 22, 23, 24].map(d =>
      generateBlueprint('compete', 'mixed', new Date(2026, 6, d)));
    const anyTerritory = days.flat().some(m => m.goalCategory === 'territory');
    expect(anyTerritory).toBe(true);
  });

  it('produces different sets for different goals', () => {
    const compete = generateBlueprint('compete', 'mixed', FIXED_DATE).map(m => m.title);
    const lose    = generateBlueprint('lose_weight', 'mixed', FIXED_DATE).map(m => m.title);
    expect(compete).not.toEqual(lose);
  });

  it('namespaces blueprint ids separately from daily ids', () => {
    expect(generateBlueprint('explore', 'mixed', FIXED_DATE)[0].id).toMatch(/^blueprint-/);
  });
});

// ── updateMissionProgress ─────────────────────────────────────────────────────

describe('updateMissionProgress', () => {
  const mission = (over: Partial<Mission>): Mission => ({
    id: 'm1', type: 'run_distance', title: 'T', description: 'd', icon: '🏃',
    target: 5, current: 0, completed: false, claimed: false,
    rewards: { pace: 10 }, expiresAt: Date.now() + 3_600_000, difficulty: 'easy',
    ...over,
  });

  it('advances a distance mission by the run distance', () => {
    const [m] = updateMissionProgress([mission({ target: 5 })], { ...emptyRun, distanceKm: 3 });
    expect(m.current).toBe(3);
    expect(m.completed).toBe(false);
  });

  it('completes a mission when the target is reached', () => {
    const [m] = updateMissionProgress([mission({ target: 5 })], { ...emptyRun, distanceKm: 5 });
    expect(m.completed).toBe(true);
  });

  it('clamps progress to the target rather than overshooting', () => {
    const [m] = updateMissionProgress([mission({ target: 5 })], { ...emptyRun, distanceKm: 42 });
    expect(m.current).toBe(5);
    expect(m.completed).toBe(true);
  });

  it('accumulates across multiple runs', () => {
    let missions = updateMissionProgress([mission({ target: 5 })], { ...emptyRun, distanceKm: 2 });
    missions = updateMissionProgress(missions, { ...emptyRun, distanceKm: 2 });
    expect(missions[0].current).toBe(4);
    expect(missions[0].completed).toBe(false);
  });

  it('leaves an already-completed mission untouched', () => {
    const done = mission({ target: 5, current: 5, completed: true });
    const [m] = updateMissionProgress([done], { ...emptyRun, distanceKm: 10 });
    expect(m).toEqual(done);
  });

  it.each([
    ['claim_territories', { territoriesClaimed: ['block', 'patch'] }, 2],
    ['capture_enemy',     { enemyCaptured: 1 },                       1],
    ['speed_run',         { fastKmCount: 3 },                         3],
    ['defend_zone',       { defendedZonesCount: 2 },                  2],
    ['steal_rival',       { rivalZonesStolen: 1 },                    1],
  ] as const)('advances a %s mission from the matching run field', (type, patch, expected) => {
    const [m] = updateMissionProgress(
      [mission({ type: type as Mission['type'], target: 10 })],
      { ...emptyRun, ...patch },
    );
    expect(m.current).toBe(expected);
  });

  it('does not advance a nutrition_streak mission from run data', () => {
    // Nutrition streaks are advanced by updateMissionsAfterNutritionLog instead.
    const [m] = updateMissionProgress(
      [mission({ type: 'nutrition_streak', target: 5 })],
      { ...emptyRun, distanceKm: 10, enemyCaptured: 3 },
    );
    expect(m.current).toBe(0);
  });

  it('advances only the missions whose type matches', () => {
    const missions = [
      mission({ id: 'a', type: 'run_distance', target: 10 }),
      mission({ id: 'b', type: 'capture_enemy', target: 10 }),
    ];
    const [dist, enemy] = updateMissionProgress(missions, { ...emptyRun, distanceKm: 4 });
    expect(dist.current).toBe(4);
    expect(enemy.current).toBe(0);
  });

  it('returns an empty list unchanged', () => {
    expect(updateMissionProgress([], emptyRun)).toEqual([]);
  });
});
