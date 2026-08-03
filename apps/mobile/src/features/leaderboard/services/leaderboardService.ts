import { supabase } from '@shared/services/supabase';
import { getPlayer } from '@shared/services/store';
import type { LeaderboardEntry, LeaderboardTab, LeaderboardTimeFrame, LeaderboardScope } from '../types';

const PAGE_LIMIT = 100;

export async function fetchLeaderboard(
  tab: LeaderboardTab,
  timeFrame: LeaderboardTimeFrame,
  scope: LeaderboardScope = 'global',
): Promise<LeaderboardEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const country = scope === 'national' ? (await getPlayer())?.country ?? null : null;

  return timeFrame === 'week'
    ? fetchWeekly(tab, user?.id, country)
    : fetchMonthOrAll(tab, timeFrame, user?.id, country);
}

// ── Week (leaderboard_weekly view) ────────────────────────────────────────────

async function fetchWeekly(
  tab: LeaderboardTab, userId?: string, country?: string | null,
): Promise<LeaderboardEntry[]> {
  // Order server-side by the metric the selected tab actually shows — previously
  // this always ordered by the territory-score-based `rank` column and limited to
  // 50 BEFORE re-sorting by the selected tab client-side, so the Distance/PACE tabs
  // showed an arbitrary 50-user subset re-ranked among themselves once there were
  // more than 50 users.
  const orderCol = tab === 'distance' ? 'weekly_km' : tab === 'weekly_pace' ? 'weekly_pace' : 'territory_score';

  let query = supabase
    .from('leaderboard_weekly')
    .select('id, username, runner_rank, territory_score, weekly_pace, weekly_km, country')
    .order(orderCol, { ascending: false })
    .limit(PAGE_LIMIT);
  if (country) query = query.eq('country', country);

  const { data, error } = await query;
  if (error) { console.error('[leaderboard] weekly fetch:', error.message); return []; }
  if (!data) return [];

  const mapped: LeaderboardEntry[] = data.map((row, i) => ({
    rank:       i + 1,
    userId:     row.id,
    name:       row.username,
    runnerRank: row.runner_rank ?? 'pacer',
    value:
      tab === 'distance'      ? Math.round(Number(row.weekly_km) * 10) / 10
      : tab === 'weekly_pace' ? Number(row.weekly_pace)
      : Math.round(Number(row.territory_score)),
    isPlayer: userId === row.id,
  }));

  // The signed-in user fell outside the top page — fetch their own row + an
  // approximate rank so the sticky "You" footer always has something to show
  // instead of disappearing exactly when it's most useful.
  if (userId && !mapped.some(e => e.isPlayer)) {
    const own = await fetchOwnWeeklyEntry(tab, userId);
    if (own) mapped.push(own);
  }
  return mapped;
}

async function fetchOwnWeeklyEntry(tab: LeaderboardTab, userId: string): Promise<LeaderboardEntry | null> {
  const { data: own } = await supabase
    .from('leaderboard_weekly')
    .select('id, username, runner_rank, territory_score, weekly_pace, weekly_km, rank')
    .eq('id', userId)
    .maybeSingle();
  if (!own) return null;

  const value =
    tab === 'distance'      ? Math.round(Number(own.weekly_km) * 10) / 10
    : tab === 'weekly_pace' ? Number(own.weekly_pace)
    : Math.round(Number(own.territory_score));

  let rank = own.rank as number;
  if (tab !== 'territory_score') {
    const col = tab === 'distance' ? 'weekly_km' : 'weekly_pace';
    const rawValue = tab === 'distance' ? own.weekly_km : own.weekly_pace;
    const { count } = await supabase
      .from('leaderboard_weekly')
      .select('id', { count: 'exact', head: true })
      .gt(col, rawValue as number);
    rank = (count ?? 0) + 1;
  }

  return { rank, userId: own.id, name: own.username, runnerRank: own.runner_rank ?? 'pacer', value, isPlayer: true };
}

// ── Month / All-time ──────────────────────────────────────────────────────────

async function fetchMonthOrAll(
  tab: LeaderboardTab, timeFrame: LeaderboardTimeFrame, userId?: string, country?: string | null,
): Promise<LeaderboardEntry[]> {
  const cutoff = timeFrame === 'month'
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(0).toISOString();

  if (tab === 'distance') return fetchMonthOrAllDistance(cutoff, userId, country);

  // territory_score / weekly_pace: order + limit directly on profiles instead of
  // downloading the entire table (M13) and sorting client-side.
  const orderCol = tab === 'weekly_pace' ? 'pace_total_earned' : 'territory_score';
  let query = supabase
    .from('profiles_public')
    .select(`id, username, runner_rank, ${orderCol}, country`)
    .order(orderCol, { ascending: false })
    .limit(PAGE_LIMIT);
  if (country) query = query.eq('country', country);

  const { data, error } = await query;
  if (error) { console.error('[leaderboard] profiles fetch:', error.message); return []; }

  const mapped: LeaderboardEntry[] = (data ?? []).map((p, i) => ({
    rank:       i + 1,
    userId:     p.id as string,
    name:       (p.username as string | null) ?? 'Runner',
    runnerRank: (p.runner_rank as string | null) ?? 'pacer',
    value:      tab === 'weekly_pace'
                ? Number((p as Record<string, unknown>)[orderCol] ?? 0)
                : Math.round(Number((p as Record<string, unknown>)[orderCol] ?? 0)),
    isPlayer:   userId === p.id,
  }));

  if (userId && !mapped.some(e => e.isPlayer)) {
    const own = await fetchOwnProfileEntry(orderCol, tab, userId);
    if (own) mapped.push(own);
  }
  return mapped;
}

async function fetchOwnProfileEntry(
  orderCol: 'territory_score' | 'pace_total_earned', tab: LeaderboardTab, userId: string,
): Promise<LeaderboardEntry | null> {
  const { data: own } = await supabase
    .from('profiles_public')
    .select(`id, username, runner_rank, ${orderCol}`)
    .eq('id', userId)
    .maybeSingle();
  if (!own) return null;

  const raw = (own as Record<string, unknown>)[orderCol] as number | null ?? 0;
  const { count } = await supabase
    .from('profiles_public')
    .select('id', { count: 'exact', head: true })
    .gt(orderCol, raw);

  return {
    rank:       (count ?? 0) + 1,
    userId:     own.id as string,
    name:       (own.username as string | null) ?? 'Runner',
    runnerRank: (own.runner_rank as string | null) ?? 'pacer',
    value:      tab === 'weekly_pace' ? Number(raw) : Math.round(Number(raw)),
    isPlayer:   true,
  };
}

// Distance aggregates from `runs` — not a profiles column, so it needs its own
// RPCs (get_run_km_by_user for the ranked top page, get_own_distance_rank for
// the signed-in user's own position when they fall outside it).
async function fetchMonthOrAllDistance(
  cutoff: string, userId?: string, country?: string | null,
): Promise<LeaderboardEntry[]> {
  const { data: kmRows, error } = await supabase
    .rpc('get_run_km_by_user', { p_cutoff: cutoff, p_limit: PAGE_LIMIT });
  if (error) { console.error('[leaderboard] run km fetch:', error.message); return []; }

  const rows = (kmRows ?? []) as { user_id: string; total_km: number }[];
  if (!rows.length) return [];

  const ids = rows.map(r => r.user_id);
  const { data: profs, error: profErr } = await supabase
    .from('profiles_public')
    .select('id, username, runner_rank, country')
    .in('id', ids);
  if (profErr) { console.error('[leaderboard] profiles fetch:', profErr.message); return []; }

  const profMap = new Map((profs ?? []).map(p => [p.id, p]));
  const mapped: LeaderboardEntry[] = rows
    .filter(r => !country || profMap.get(r.user_id)?.country === country)
    .map(r => {
      const p = profMap.get(r.user_id);
      return {
        rank:       0,
        userId:     r.user_id,
        name:       p?.username ?? 'Runner',
        runnerRank: p?.runner_rank ?? 'pacer',
        value:      Math.round(Number(r.total_km) * 10) / 10,
        isPlayer:   userId === r.user_id,
      };
    });
  mapped.forEach((e, i) => { e.rank = i + 1; });

  if (userId && !mapped.some(e => e.isPlayer)) {
    const own = await fetchOwnDistanceEntry(cutoff, userId);
    if (own) mapped.push(own);
  }
  return mapped;
}

async function fetchOwnDistanceEntry(cutoff: string, userId: string): Promise<LeaderboardEntry | null> {
  const [{ data: myRuns }, { data: profile }, { data: rank }] = await Promise.all([
    supabase.from('runs').select('distance_m').eq('user_id', userId).gte('started_at', cutoff),
    supabase.from('profiles_public').select('id, username, runner_rank').eq('id', userId).maybeSingle(),
    supabase.rpc('get_own_distance_rank', { p_user_id: userId, p_cutoff: cutoff }),
  ]);
  if (!profile) return null;

  const totalKm = (myRuns ?? []).reduce((s, r) => s + Number(r.distance_m), 0) / 1000;
  return {
    rank:       (rank as number | null) ?? 0,
    userId,
    name:       profile.username ?? 'Runner',
    runnerRank: profile.runner_rank ?? 'pacer',
    value:      Math.round(totalKm * 10) / 10,
    isPlayer:   true,
  };
}
