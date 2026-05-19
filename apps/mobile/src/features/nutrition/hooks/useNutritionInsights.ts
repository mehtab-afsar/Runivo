import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@shared/services/supabase';

export interface NutritionInsightsCard {
  icon: string;
  title: string;
  body: string;
}

export interface NutritionInsights {
  cards: NutritionInsightsCard[];
  generatedAt: string;
}

export function useNutritionInsights() {
  const [insights, setInsights] = useState<NutritionInsights | null>(null);
  const [loading, setLoading]   = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body:    { feature: 'nutrition_insights' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!error && data) setInsights(data as NutritionInsights);
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { insights, loading, refresh };
}
