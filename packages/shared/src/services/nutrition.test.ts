/**
 * nutrition.test.ts — daily calorie/macro targets and run-calorie estimation.
 *
 * computeNutritionTargets shipped with zero test coverage despite being the
 * single most consequential function in the nutrition feature: it sets the
 * daily kcal/protein/carb/fat goal every user sees. These tests pin the
 * Mifflin-St Jeor BMR math, the activity/goal adjustments, and the 1200 kcal
 * floor so a sign error or dropped multiplier can't regress silently.
 *
 * estimateRunCalories used to be four different formulas across the app
 * (some ignoring bodyweight entirely) with a ~27% spread for the same run —
 * these tests pin the single formula now shared by every call site.
 */

import { describe, it, expect } from 'vitest';
import { computeNutritionTargets, estimateRunCalories } from './nutrition';

describe('computeNutritionTargets', () => {
  it('computes Mifflin-St Jeor BMR for a male, moderate activity, maintain goal', () => {
    // BMR = 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    // TDEE = 1648.75 * 1.55 = 2555.5625 -> round 2556, + 0 offset
    const t = computeNutritionTargets({
      weightKg: 70, heightCm: 175, age: 30, sex: 'male',
      goal: 'maintain', activityLevel: 'moderate',
    });
    expect(t.dailyKcal).toBe(2556);
  });

  it('computes Mifflin-St Jeor BMR for a female, sedentary, lose goal', () => {
    // BMR = 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25
    // TDEE = 1330.25 * 1.2 = 1596.3 -> round 1596, - 400 offset = 1196 -> floored to 1200
    const t = computeNutritionTargets({
      weightKg: 60, heightCm: 165, age: 28, sex: 'female',
      goal: 'lose', activityLevel: 'sedentary',
    });
    expect(t.dailyKcal).toBe(1200);
  });

  it('applies the gain offset on top of TDEE', () => {
    // BMR = 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    // TDEE = 1805 * 1.725 = 3113.625 -> round 3114, + 300 = 3414
    const t = computeNutritionTargets({
      weightKg: 80, heightCm: 180, age: 25, sex: 'male',
      goal: 'gain', activityLevel: 'active',
    });
    expect(t.dailyKcal).toBe(3414);
  });

  it('never returns below the 1200 kcal floor for a small, sedentary, cutting female', () => {
    const t = computeNutritionTargets({
      weightKg: 45, heightCm: 150, age: 20, sex: 'female',
      goal: 'lose', activityLevel: 'sedentary',
    });
    expect(t.dailyKcal).toBeGreaterThanOrEqual(1200);
  });

  it('never returns below the 1500 kcal floor for a small, sedentary, cutting male', () => {
    const t = computeNutritionTargets({
      weightKg: 50, heightCm: 160, age: 20, sex: 'male',
      goal: 'lose', activityLevel: 'sedentary',
    });
    expect(t.dailyKcal).toBeGreaterThanOrEqual(1500);
  });

  it('sets protein from bodyweight × activity-level g/kg, not a flat % of calories', () => {
    // moderate activity -> 1.6 g/kg
    const t = computeNutritionTargets({
      weightKg: 70, heightCm: 175, age: 30, sex: 'male',
      goal: 'maintain', activityLevel: 'moderate',
    });
    expect(t.proteinG).toBe(Math.round(70 * 1.6));
  });

  it('gives a heavier training load more protein per kg for the same bodyweight', () => {
    const sedentary = computeNutritionTargets({
      weightKg: 70, heightCm: 175, age: 30, sex: 'male',
      goal: 'maintain', activityLevel: 'sedentary',
    });
    const veryActive = computeNutritionTargets({
      weightKg: 70, heightCm: 175, age: 30, sex: 'male',
      goal: 'maintain', activityLevel: 'very_active',
    });
    expect(veryActive.proteinG).toBeGreaterThan(sedentary.proteinG);
  });

  it('allocates fat as 25% of dailyKcal and lets carbs absorb the remainder', () => {
    const t = computeNutritionTargets({
      weightKg: 70, heightCm: 175, age: 30, sex: 'male',
      goal: 'maintain', activityLevel: 'moderate',
    });
    expect(t.fatG).toBe(Math.round((t.dailyKcal * 0.25) / 9));
    const remainderKcal = t.dailyKcal - t.proteinG * 4 - t.fatG * 9;
    expect(t.carbsG).toBe(Math.round(remainderKcal / 4));
  });

  it('scales monotonically with each activity level', () => {
    const levels = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
    const kcals = levels.map(activityLevel =>
      computeNutritionTargets({
        weightKg: 70, heightCm: 175, age: 30, sex: 'male',
        goal: 'maintain', activityLevel,
      }).dailyKcal,
    );
    for (let i = 1; i < kcals.length; i++) {
      expect(kcals[i]).toBeGreaterThan(kcals[i - 1]);
    }
  });
});

describe('estimateRunCalories', () => {
  it('is proportional to both distance and bodyweight', () => {
    // 10km at 70kg = 10 * 70 * 1.036 = 725.2 -> round 725
    expect(estimateRunCalories(10_000, 70)).toBe(725);
  });

  it('scales linearly with distance for a fixed weight, up to rounding', () => {
    const per5k = estimateRunCalories(5_000, 70);
    const per10k = estimateRunCalories(10_000, 70);
    expect(per10k).toBeCloseTo(per5k * 2, -1); // within a few kcal of double
  });

  it('is weight-aware — a heavier runner burns more for the same distance', () => {
    const lighter = estimateRunCalories(5_000, 55);
    const heavier = estimateRunCalories(5_000, 95);
    expect(heavier).toBeGreaterThan(lighter);
  });

  it('returns 0 for a zero-distance run', () => {
    expect(estimateRunCalories(0, 70)).toBe(0);
  });
});
