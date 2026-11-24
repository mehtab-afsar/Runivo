import { useState, useEffect } from 'react';
import { getNutritionProfile, getRunById, getPlayer, getRuns, type StoredRun } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import type { RunPost } from '../../utils/runSummaryTypes';

/** Who is looking at this run: plan tier, history, stored copy, feed post, recent pace, weight. */
export function useRunPlayerContext(runId: string) {
  const [weightKg, setWeightKg]           = useState<number | null>(null);
  const [tier, setTier]                   = useState<string>('free');
  const [runsCompleted, setRunsCompleted] = useState(0);
  const [recentAvgPace, setRecentAvgPace] = useState<number | null>(null);
  const [authorName, setAuthorName]       = useState('');
  const [stored, setStored]               = useState<StoredRun | null>(null);
  const [post, setPost]                   = useState<RunPost | null>(null);

  useEffect(() => {
    getPlayer().then(p => {
      if (!p) return;
      setTier(p.subscriptionTier ?? 'free');
      setRunsCompleted(p.totalRuns ?? 0);
      setAuthorName(p.username ?? '');
    }).catch(() => {});
    getRunById(runId).then(r => setStored(r ?? null)).catch(() => {});
    // Kudos and comments live on this run's feed post (mock: kudos · comments · story).
    supabase.from('feed_posts').select('id, likes, comment_count').eq('run_id', runId).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setPost({ id: data.id, likes: data.likes ?? 0, comments: data.comment_count ?? 0 }); })
      .then(undefined, () => {});
    // Recent average pace (s/km) for the free summary, excluding this run.
    getRuns(20).then(rs => {
      const prior = rs.filter(r => r.id !== runId && r.distanceMeters >= 1000 && r.durationSec > 0);
      if (prior.length === 0) return;
      const km = prior.reduce((a, r) => a + r.distanceMeters / 1000, 0);
      const sec = prior.reduce((a, r) => a + r.durationSec, 0);
      setRecentAvgPace(sec / km);
    }).catch(() => {});
  }, [runId]);

  useEffect(() => {
    getNutritionProfile().then(p => {
      if (p?.weightKg) setWeightKg(p.weightKg);
    }).catch(() => {});
  }, []);

  return { weightKg, tier, runsCompleted, recentAvgPace, authorName, stored, post, setPost };
}
