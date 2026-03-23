import type { NutritionInsights } from '../services/intelligenceService';

export function useNutritionInsights() {
  return {
    insights: null as NutritionInsights | null,
    loading: false,
    error: null,
    refresh: () => {},
  };
}
