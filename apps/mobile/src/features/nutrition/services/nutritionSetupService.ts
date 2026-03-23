import {
  saveNutritionProfile,
  getNutritionProfile,
  type NutritionProfile,
} from '@shared/services/store';

export async function saveNutritionProfileService(profile: NutritionProfile): Promise<void> {
  await saveNutritionProfile(profile);
}

export async function fetchExistingProfile(): Promise<NutritionProfile | undefined> {
  return getNutritionProfile();
}
