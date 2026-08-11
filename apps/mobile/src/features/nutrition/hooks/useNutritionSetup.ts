import { useState, useEffect, useCallback } from 'react';
import type { NutritionProfile } from '@shared/services/store';
import { computeNutritionTargets, type NutritionGoal, type ActivityLevel, type DietType } from '@shared/services/nutrition';
import {
  saveNutritionProfileService,
  fetchExistingProfile,
} from '@features/nutrition/services/nutritionSetupService';

type Goal = NutritionGoal;
type Diet = DietType;

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

  const targets = computeNutritionTargets({ weightKg, heightCm, age, sex, activityLevel, goal });
  const dailyKcal = targets.dailyKcal;
  const macros = { proteinG: targets.proteinG, carbsG: targets.carbsG, fatG: targets.fatG };

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

  useEffect(() => {
    loadExisting();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
