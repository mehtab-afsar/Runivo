import { NutritionProfile, NutritionEntry } from '@shared/services/store';
import { FoodItem, COMMON_FOODS } from '../data/commonFoods';

// ── TDEE (Mifflin-St Jeor) ────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<NutritionProfile['activityLevel'], number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

export function calcBMR(profile: Pick<NutritionProfile, 'weightKg' | 'heightCm' | 'age' | 'sex'>): number {
  if (profile.sex === 'male') {
    return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5;
  } else {
    return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161;
  }
}

export function calcTDEE(profile: NutritionProfile): number {
  const bmr = calcBMR(profile);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel]);
}

// ── Daily goal (TDEE ± offset) ────────────────────────────────────────────────

const GOAL_OFFSETS: Record<NutritionProfile['goal'], number> = {
  lose:     -400,
  maintain:    0,
  gain:      300,
};

export function calcDailyGoal(profile: NutritionProfile): number {
  return Math.max(1200, calcTDEE(profile) + GOAL_OFFSETS[profile.goal]);
}

// ── Macro goals (protein 30%, carbs 45%, fat 25%) ─────────────────────────────

export function calcMacroGoals(kcal: number): { proteinG: number; carbsG: number; fatG: number } {
  return {
    proteinG: Math.round((kcal * 0.30) / 4),
    carbsG:   Math.round((kcal * 0.45) / 4),
    fatG:     Math.round((kcal * 0.25) / 9),
  };
}

// ── Run calorie burn ──────────────────────────────────────────────────────────

export function calcRunCalories(distanceMeters: number, weightKg: number, hasTerritory = false): number {
  const distKm = distanceMeters / 1000;
  const raw    = distKm * weightKg * 1.036;
  return Math.round(hasTerritory ? raw * 1.1 : raw);
}

// ── XP rewards ────────────────────────────────────────────────────────────────
// 50 XP for the first log of the day, 10 XP per additional entry (max 3 food entries/day = 80 XP/day)

export function calcNutritionXP(existingEntries: NutritionEntry[]): number {
  const foodEntries = existingEntries.filter(e => e.source !== 'run');
  if (foodEntries.length === 0) return 50; // first of the day
  if (foodEntries.length < 3)  return 10;
  return 0; // max reached
}

// ── Serving size helper ───────────────────────────────────────────────────────

export function calcServingNutrition(
  food: FoodItem,
  servingG: number,
): { kcal: number; proteinG: number; carbsG: number; fatG: number } {
  const ratio = servingG / 100;
  return {
    kcal:     Math.round(food.kcalPer100g    * ratio),
    proteinG: Math.round(food.proteinPer100g * ratio * 10) / 10,
    carbsG:   Math.round(food.carbsPer100g   * ratio * 10) / 10,
    fatG:     Math.round(food.fatPer100g     * ratio * 10) / 10,
  };
}

// ── Local food search ─────────────────────────────────────────────────────────

export function searchLocalFoods(query: string, category?: string): FoodItem[] {
  const q = query.toLowerCase().trim();
  return COMMON_FOODS.filter(f => {
    const matchesName = q === '' || f.name.toLowerCase().includes(q);
    const matchesCat  = !category || category === 'all' || f.category === category;
    return matchesName && matchesCat;
  });
}

// ── Open Food Facts API ───────────────────────────────────────────────────────

export async function searchOpenFoodFacts(query: string): Promise<FoodItem[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,nutriments,serving_size`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const products = (data.products || []) as Array<{
      product_name?: string;
      serving_size?: string;
      nutriments?: {
        'energy-kcal_100g'?: number;
        'proteins_100g'?: number;
        'carbohydrates_100g'?: number;
        'fat_100g'?: number;
      };
    }>;

    return products
      .filter(p => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
      .map((p, i): FoodItem => {
        const n = p.nutriments!;
        return {
          id:               `off-${query}-${i}`,
          name:             p.product_name!,
          kcalPer100g:      n['energy-kcal_100g'] ?? 0,
          proteinPer100g:   n['proteins_100g'] ?? 0,
          carbsPer100g:     n['carbohydrates_100g'] ?? 0,
          fatPer100g:       n['fat_100g'] ?? 0,
          defaultServing:   p.serving_size || '100g',
          defaultServingG:  parseServingG(p.serving_size) ?? 100,
          category:         'other',
        };
      });
  } catch {
    return [];
  }
}

function parseServingG(serving?: string): number | null {
  if (!serving) return null;
  const m = serving.match(/(\d+(\.\d+)?)\s*g/i);
  return m ? parseFloat(m[1]) : null;
}

// ── Date helper ───────────────────────────────────────────────────────────────

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekDates(): string[] {
  const today = new Date();
  const day   = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0
  const dates: string[] = [];
  for (let i = -day; i <= 6 - day; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
