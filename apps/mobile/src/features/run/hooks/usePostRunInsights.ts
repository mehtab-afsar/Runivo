import { useState, useEffect } from 'react';
import { supabase } from '@shared/services/supabase';

export interface PostRunInsights {
  praise: string;
  analysis: string;
  suggestion: string;
  recovery?: string;
}

/** `enabled` is false for free runners: the AI debrief is a Plus feature and the server refuses it (402). */
export function usePostRunInsights(runId: string | null | undefined, enabled = true) {
  const [insights, setInsights] = useState<PostRunInsights | null>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!runId || !enabled) return;
    let cancelled = false;
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) { setLoading(false); return; }
      supabase.functions
        .invoke('ai-coach', {
          body: { feature: 'post_run', runId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (!error && data) setInsights(data as PostRunInsights);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, [runId, enabled]);

  return { insights, loading };
}
