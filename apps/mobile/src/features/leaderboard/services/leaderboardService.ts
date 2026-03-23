import { supabase } from '@shared/services/supabase';
import type { LeaderboardEntry, LeaderboardTab, LeaderboardTimeFrame } from '../types';

export async function fetchLeaderboard(
  tab: LeaderboardTab,
  timeFrame: LeaderboardTimeFrame,
): Promise<LeaderboardEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (timeFrame === 'week') {
    const { data } = await supabase
      .from('leaderboard_weekly')
      .select('id, username, level, weekly_xp, weekly_km, weekly_territories, rank')
      .order('rank', { ascending: true })
      .limit(50);

    if (!data) return [];

    const mapped: LeaderboardEntry[] = data.map(row => ({
      rank: row.rank,
      name: row.username,
      level: row.level,
      value:
        tab === 'distance' ? Math.round(Number(row.weekly_km) * 10) / 10
        : tab === 'xp' ? Number(row.weekly_xp)
        : Number(row.weekly_territories),
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

  const [{ data: runs }, { data: profiles }] = await Promise.all([
    supabase.from('runs').select('user_id, distance_m, xp_earned, territories_claimed').gte('started_at', cutoff),
    supabase.from('profiles').select('id, username, level'),
  ]);

  if (!runs || !profiles) return [];

  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const totals = new Map<string, { km: number; xp: number; zones: number }>();

  for (const run of runs) {
    const prev = totals.get(run.user_id) ?? { km: 0, xp: 0, zones: 0 };
    totals.set(run.user_id, {
      km: prev.km + run.distance_m / 1000,
      xp: prev.xp + (run.xp_earned ?? 0),
      zones: prev.zones + (run.territories_claimed?.length ?? 0),
    });
  }

  const mapped: LeaderboardEntry[] = Array.from(totals.entries()).map(([uid, t]) => {
    const p = profileMap.get(uid);
    return {
      rank: 0,
      name: p?.username ?? 'Runner',
      level: p?.level ?? 1,
      value: tab === 'distance' ? Math.round(t.km * 10) / 10
             : tab === 'xp' ? t.xp : t.zones,
      isPlayer: user?.id === uid,
    };
  });
  mapped.sort((a, b) => b.value - a.value);
  mapped.forEach((e, i) => { e.rank = i + 1; });
  return mapped.slice(0, 100);
}
