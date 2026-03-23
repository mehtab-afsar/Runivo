import {
  getNutritionEntries,
  getNutritionProfile,
  addNutritionEntry,
  deleteNutritionEntry,
  type NutritionEntry,
  type NutritionProfile,
} from '@shared/services/store';

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function fetchTodayEntries(date: string): Promise<NutritionEntry[]> {
  return getNutritionEntries(date);
}

export async function fetchNutritionProfile(): Promise<NutritionProfile | undefined> {
  return getNutritionProfile();
}

export async function addEntry(
  entry: Omit<NutritionEntry, 'id'>,
): Promise<number> {
  return addNutritionEntry(entry as NutritionEntry);
}

export async function deleteEntry(id: number): Promise<void> {
  return deleteNutritionEntry(id);
}
