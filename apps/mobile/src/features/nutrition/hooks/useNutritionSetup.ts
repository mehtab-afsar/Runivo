import { useState, useCallback } from 'react';
import type { NutritionProfile } from '@shared/services/store';
import {
  saveNutritionProfileService,
  fetchExistingProfile,
} from '@features/nutrition/services/nutritionSetupService';

type Goal          = 'lose' | 'maintain' | 'gain';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Diet          = 'everything' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'halal';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};
const GOAL_OFFSETS: Record<Goal, number> = { lose: -400, maintain: 0, gain: 300 };

function calcDailyGoal(p: {
  weightKg: number; heightCm: number; age: number;
  sex: 'male' | 'female'; activityLevel: ActivityLevel; goal: Goal;
}): number {
  const bmr = p.sex === 'male'
    ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5
    : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[p.activityLevel]);
  return Math.max(1200, tdee + GOAL_OFFSETS[p.goal]);
}

export function useNutritionSetup() {
  const [saving, setSaving]           = useState(false);
  const [goal, setGoal]               = useState<Goal>('maintain');
  const [activityLevel, setActivity]  = useState<ActivityLevel>('moderate');
  const [diet, setDiet]               = useState<Diet>('everything');
  const [sex, setSex]                 = useState<'male' | 'female'>('male');
  const [ageStr, setAgeStr]           = useState('30');
  const [weightStr, setWeightStr]     = useState('70');
  const [heightStr, setHeightStr]     = useState('175');

  const age       = parseInt(ageStr) || 30;
  const weightKg  = parseFloat(weightStr) || 70;
  const heightCm  = parseFloat(heightStr) || 175;

  const dailyKcal = calcDailyGoal({ weightKg, heightCm, age, sex, activityLevel, goal });
  const macros = {
    proteinG: Math.round((dailyKcal * 0.30) / 4),
    carbsG:   Math.round((dailyKcal * 0.45) / 4),
    fatG:     Math.round((dailyKcal * 0.25) / 9),
  };

  const updateField = useCallback((field: string, value: string) => {
    switch (field) {
      case 'ageStr':    setAgeStr(value);    break;
      case 'weightStr': setWeightStr(value); break;
      case 'heightStr': setHeightStr(value); break;
    }
  }, []);

  const saveProfile = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const profile: NutritionProfile = {
        id: 'profile', goal, activityLevel, diet, sex,
        weightKg, heightCm, age,
        dailyGoalKcal: dailyKcal,
        proteinGoalG: macros.proteinG,
        carbsGoalG:   macros.carbsG,
        fatGoalG:     macros.fatG,
      };
      await saveNutritionProfileService(profile);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [goal, activityLevel, diet, sex, weightKg, heightCm, age, dailyKcal, macros.proteinG, macros.carbsG, macros.fatG]);

  const loadExisting = useCallback(async () => {
    const p = await fetchExistingProfile();
    if (!p) return;
    setGoal(p.goal);
    setActivity(p.activityLevel);
    setDiet(p.diet);
    setSex(p.sex);
    setAgeStr(String(p.age));
    setWeightStr(String(p.weightKg));
    setHeightStr(String(p.heightCm));
  }, []);

  return {
    saving,
    goal,       setGoal,
    activityLevel, setActivity,
    diet,       setDiet,
    sex,        setSex,
    ageStr,     weightStr, heightStr,
    updateField,
    dailyKcal,  macros,
    saveProfile, loadExisting,
  };
}
