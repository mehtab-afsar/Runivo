import { supabase } from '@shared/services/supabase';
import type { LeaderboardEntry, LeaderboardTab, LeaderboardTimeFrame, LeaderboardScope } from '../types';

export async function fetchLeaderboard(
  tab: LeaderboardTab,
  timeFrame: LeaderboardTimeFrame,
  _scope: LeaderboardScope = 'global',
): Promise<LeaderboardEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (timeFrame === 'week') {
    const query = supabase
      .from('leaderboard_weekly')
      .select('id, username, runner_rank, territory_score, weekly_pace, weekly_km, weekly_territories, rank')
      .order('rank', { ascending: true })
      .limit(50);
    const { data } = await query;

    if (!data) return [];

    const mapped: LeaderboardEntry[] = data.map(row => ({
      rank:       row.rank,
      userId:     row.id,
      name:       row.username,
      runnerRank: row.runner_rank ?? 'pacer',
      value:
        tab === 'distance'       ? Math.round(Number(row.weekly_km) * 10) / 10
        : tab === 'weekly_pace'  ? Number(row.weekly_pace)
        : Math.round(Number(row.territory_score)),
      isPlayer: user?.id === row.id,
    }));
    mapped.sort((a, b) => b.value - a.value);
    mapped.forEach((e, i) => { e.rank = i + 1; });
    return mapped;
  }

  const cutoff =
    timeFrame === 'month'
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(0).toISOString();

  const profilesQuery = supabase
    .from('profiles')
    .select('id, username, runner_rank, territory_score, pace_total_earned');

  const profilesResp = await profilesQuery;
  const scopedProfileIds = new Set((profilesResp.data ?? []).map((p: { id: string }) => p.id));

  const runsResp = await supabase
    .from('runs')
    .select('user_id, distance_m, territories_claimed')
    .gte('started_at', cutoff);
  const runs = (runsResp.data ?? []).filter(r => scopedProfileIds.has(r.user_id));
  const profiles = profilesResp.data ?? [];

  if (!profiles.length) return [];

  const kmTotals = new Map<string, number>();

  for (const run of runs) {
    kmTotals.set(run.user_id, (kmTotals.get(run.user_id) ?? 0) + run.distance_m / 1000);
  }

  const mapped: LeaderboardEntry[] = profiles.map(p => {
    const km = kmTotals.get(p.id) ?? 0;
    const ts = Math.round(Number(p.territory_score ?? 0));
    const pace = Number(p.pace_total_earned ?? 0);
    return {
      rank:       0,
      userId:     p.id,
      name:       p.username ?? 'Runner',
      runnerRank: p.runner_rank ?? 'pacer',
      value:
        tab === 'distance'      ? Math.round(km * 10) / 10
        : tab === 'weekly_pace' ? pace
        : ts,
      isPlayer: user?.id === p.id,
    };
  });
  mapped.sort((a, b) => b.value - a.value);
  mapped.forEach((e, i) => { e.rank = i + 1; });
  return mapped.slice(0, 100);
}
