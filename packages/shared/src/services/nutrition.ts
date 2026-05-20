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

export function computeNutritionTargets(p: NutritionTargetParams): NutritionTargets {
  const bmr = p.sex === 'male'
    ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5
    : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;

  const dailyKcal = Math.max(
    1200,
    Math.round(bmr * ACTIVITY_MULTIPLIERS[p.activityLevel]) + GOAL_OFFSETS[p.goal],
  );

  return {
    dailyKcal,
    proteinG: Math.round((dailyKcal * 0.30) / 4),
    carbsG:   Math.round((dailyKcal * 0.45) / 4),
    fatG:     Math.round((dailyKcal * 0.25) / 9),
  };
}
