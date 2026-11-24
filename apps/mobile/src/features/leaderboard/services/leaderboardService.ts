import { supabase } from '@shared/services/supabase';
import { getPlayer } from '@shared/services/store';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';
import type { LeaderboardEntry, LeaderboardTab, LeaderboardTimeFrame, LeaderboardScope } from '../types';

const PAGE_LIMIT = 100;

/**
 * Every board comes from one server function (20261112000002_leaderboards.sql),
 * so all metrics share the same rules:
 *   - periods are calendar periods in UTC (week from Monday, month from the 1st);
 *   - distance counts on-foot activities only, never rides;
 *   - PACE for a week or month is what the ledger credited in it;
 *   - territory for a week or month is the ground claimed in it (m²); all time is the territory score;
 *   - National ranks, including your own, are counted inside your country.
 */
const METRIC: Record<LeaderboardTab, 'distance' | 'pace' | 'territory'> = {
  distance: 'distance',
  weekly_pace: 'pace',
  territory_score: 'territory',
};

/** What the numbers on a board mean, for display. */
export function unitFor(tab: LeaderboardTab, timeFrame: LeaderboardTimeFrame): 'km' | 'PACE' | 'm2' | 'TS' {
  if (tab === 'distance') return 'km';
  if (tab === 'weekly_pace') return 'PACE';
  return timeFrame === 'all' ? 'TS' : 'm2';
}

interface Row { user_id: string; username: string | null; runner_rank: string | null; value: number | string; rank: number }

export async function fetchLeaderboard(
  tab: LeaderboardTab,
  timeFrame: LeaderboardTimeFrame,
  scope: LeaderboardScope = 'global',
): Promise<LeaderboardEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const country = scope === 'national' ? (await getPlayer())?.country ?? null : null;
  const args = { p_metric: METRIC[tab], p_period: timeFrame, p_country: country };

  // Following and My clubs rank you among people you know (20261113000002).
  // Near you (10 km) and Neighbourhood (2 km) rank around your last known location (20261113000007).
  const circle = scope === 'following' || scope === 'clubs' || scope === 'city' || scope === 'area';
  const { data, error } = scope === 'following' || scope === 'clubs'
    ? await supabase.rpc('get_circle_leaderboard', { p_metric: METRIC[tab], p_period: timeFrame, p_circle: scope, p_limit: PAGE_LIMIT })
    : scope === 'city' || scope === 'area'
      ? await supabase.rpc('get_local_leaderboard', { p_metric: METRIC[tab], p_period: timeFrame, p_radius_km: scope === 'city' ? 10 : 2, p_limit: PAGE_LIMIT })
      : await supabase.rpc('get_leaderboard', { ...args, p_limit: PAGE_LIMIT });
  // A failed request is an error the screen can show with a retry, not an empty board.
  if (error) throw new Error(`leaderboard: ${error.message}`);

  const entries: LeaderboardEntry[] = ((data ?? []) as Row[]).map(r => ({
    rank:       r.rank,
    userId:     r.user_id,
    name:       r.username ?? 'Runner',
    runnerRank: r.runner_rank ?? 'pacer',
    value:      Number(r.value),
    isPlayer:   user?.id === r.user_id,
  }));

  // Outside the top page: append the runner's own row so the "You" footer stays.
  if (user && !circle && !entries.some(e => e.isPlayer)) {
    const [{ data: mine }, { data: me }] = await Promise.all([
      supabase.rpc('get_my_leaderboard_rank', args),
      supabase.from('profiles_public').select('username, runner_rank').eq('id', user.id).maybeSingle(),
    ]);
    const own = ((mine ?? []) as { value: number | string; rank: number | null }[])[0];
    if (own && own.rank != null && me) {
      entries.push({
        rank:       own.rank,
        userId:     user.id,
        name:       me.username ?? 'Runner',
        runnerRank: me.runner_rank ?? 'pacer',
        value:      Number(own.value),
        isPlayer:   true,
      });
    }
  }
  // The board functions carry no photo column; the public profiles do.
  const photos = await fetchPublicProfiles(entries.map(e => e.userId)).catch(() => new Map());
  return entries.map(e => ({ ...e, avatarUrl: photos.get(e.userId)?.avatar_url ?? null }));
}
