import { useState, useEffect } from 'react';
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

  const refresh = () => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      supabase.functions
        .invoke('ai-coach', {
          body: { feature: 'nutrition_insights' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        .then(({ data, error }) => {
          if (!error && data) setInsights(data as NutritionInsights);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  };

  useEffect(() => { refresh(); }, []);

  return { insights, loading, refresh };
}
