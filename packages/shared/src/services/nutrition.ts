export type NutritionGoal = 'lose' | 'maintain' | 'gain';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType      = 'everything' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'halal';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:  1.2,
  light:      1.375,
  moderate:   1.55,
  active:     1.725,
  very_active: 1.9,
};

const GOAL_OFFSETS: Record<NutritionGoal, number> = {
  lose:     -400,
  maintain:    0,
  gain:      300,
};

// Endurance athletes need materially more protein per kg than a sedentary
// person — 1.6-2.2 g/kg is the range cited for runners in the sports-
// nutrition literature, vs. ~0.8 g/kg for general health. Scaling by
// activity level approximates training load until we have real session data.
const PROTEIN_G_PER_KG: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.4,
  moderate:    1.6,
  active:      1.8,
  very_active: 2.0,
};

// Sex-differentiated — a flat 1200 floor under-fuels most men at any
// activity level. 1500/1200 are the commonly-cited clinical minimums.
const KCAL_FLOOR: Record<'male' | 'female', number> = {
  male:   1500,
  female: 1200,
};

export interface NutritionTargetParams {
  weightKg:      number;
  heightCm:      number;
  age:           number;
  sex:           'male' | 'female';
  goal:          NutritionGoal;
  activityLevel: ActivityLevel;
}

export interface NutritionTargets {
  dailyKcal: number;
  proteinG:  number;
  carbsG:    number;
  fatG:      number;
}

// Net running expenditure ≈ 1.036 kcal per kg of bodyweight per km — the
// single source of truth for run-calorie estimates app-wide. Previously each
// surface (tracker chip, dashboard, run summary, AI coach) computed its own
// figure with a different constant, some ignoring bodyweight entirely,
// producing a ~27% spread for the same run.
export function estimateRunCalories(distanceM: number, weightKg: number): number {
  return Math.round((distanceM / 1000) * weightKg * 1.036);
}

export function computeNutritionTargets(p: NutritionTargetParams): NutritionTargets {
  const bmr = p.sex === 'male'
    ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5
    : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;

  const dailyKcal = Math.max(
    KCAL_FLOOR[p.sex],
    Math.round(bmr * ACTIVITY_MULTIPLIERS[p.activityLevel]) + GOAL_OFFSETS[p.goal],
  );

  // Protein is set from bodyweight and training load first — not sliced off
  // total calories, which under-serves light runners and over-serves heavy
  // sedentary ones eating the same kcal target.
  const proteinG   = Math.round(p.weightKg * PROTEIN_G_PER_KG[p.activityLevel]);
  const proteinKcal = proteinG * 4;

  // Fat: 25% of total calories, covers essential fatty acids regardless of
  // the protein target.
  const fatG    = Math.round((dailyKcal * 0.25) / 9);
  const fatKcal = fatG * 9;

  // Carbs take whatever's left once protein and fat are covered.
  const carbsG = Math.round(Math.max(0, dailyKcal - proteinKcal - fatKcal) / 4);

  return { dailyKcal, proteinG, carbsG, fatG };
}
