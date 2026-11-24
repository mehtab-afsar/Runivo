/** Posting a finished run to the feed. */
import { supabase } from '../supabase';

export async function createFeedPost(
  runId: string,
  distanceKm: number,
  territoriesClaimed: number,
  opts?: {
    paceEarned?: number;
    territoryTier?: string | null;
    territoryAreaM2?: number | null;
    runnerRank?: string;
    content?: string;
    durationSec?: number;
    avgPace?: string;
    activityType?: string;
    routePoints?: { lat: number; lng: number }[];
  },
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // The full route goes to the server, which trims it to the runner's map
  // visibility before storing (feed_posts_blur_route). Trimming here as well
  // would trim twice: the server measures from whatever ends it receives.
  const { error } = await supabase.from('feed_posts').insert({
    user_id:             user.id,
    run_id:              runId,
    distance_km:         distanceKm,
    territories_claimed: territoriesClaimed,
    content:             opts?.content ?? null,
    pace_earned:         opts?.paceEarned ?? 0,
    territory_tier:      opts?.territoryTier ?? null,
    territory_area_m2:   opts?.territoryAreaM2 ?? null,
    runner_rank:         opts?.runnerRank ?? 'pacer',
    duration_sec:        opts?.durationSec ?? 0,
    avg_pace:            opts?.avgPace ?? '',
    activity_type:       opts?.activityType ?? 'run',
    route_points:        opts?.routePoints ?? null,
  });
  if (error) console.warn('[sync] feed post failed:', error.message);
}
