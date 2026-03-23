export interface NutritionInsightsCard {
  icon: string;
  title: string;
  body: string;
}

export interface NutritionInsights {
  headline: string;
  tip: string;
  insights: string[];
  cards: NutritionInsightsCard[];
  generatedAt: string;
  nutrition: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

export async function getIntelligence(): Promise<null> {
  return null;
}
