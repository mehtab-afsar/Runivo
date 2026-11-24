import { useState, useEffect } from 'react';
import { supabase } from '@shared/services/supabase';

export interface PostRunInsights {
  praise: string;
  analysis: string;
  suggestion: string;
  recovery?: string;
}

/** `enabled` is false until the runner has agreed to the AI. The function wraps
 *  results as { data: payload }; a 404 run_not_synced means the run is still
 *  uploading, so it asks again a few times. */
export function usePostRunInsights(runId: string | null | undefined, enabled = true) {
  const [insights, setInsights] = useState<PostRunInsights | null>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!runId || !enabled) return;
    let cancelled = false;
    setLoading(true);
    const attempt = async (n: number): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: { feature: 'post_run', runId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (cancelled) return;
      const p = ((data as { data?: unknown } | null)?.data ?? null) as PostRunInsights | null;
      if (!error && p && typeof p.praise === 'string') { setInsights(p); return; }
      const status = (error as { context?: Response } | null)?.context?.status;
      if (status === 404 && n < 4) {
        await new Promise(r => setTimeout(r, 4000));
        return attempt(n + 1);
      }
    };
    attempt(0).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId, enabled]);

  return { insights, loading };
}
