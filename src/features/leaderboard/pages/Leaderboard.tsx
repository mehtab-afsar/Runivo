import { useState, useEffect, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Activity, Flag, Zap, Crown } from 'lucide-react';
import { supabase } from '@shared/services/supabase';
import type { LeaderboardTab, TimeFrame, LeaderboardEntry } from '../types';

export default function Leaderboard() {
  const [tab, setTab] = useState<LeaderboardTab>('distance');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, timeFrame]);

  const loadLeaderboard = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (timeFrame === 'week') {
      const { data } = await supabase
        .from('leaderboard_weekly')
        .select('id, username, level, weekly_xp, weekly_km, weekly_territories, rank')
        .order('rank', { ascending: true })
        .limit(50);

      if (data) {
        const mapped: LeaderboardEntry[] = data.map(row => ({
          rank: row.rank,
          name: row.username,
          level: row.level,
          value: tab === 'distance' ? Math.round(Number(row.weekly_km) * 10) / 10
               : tab === 'xp'       ? Number(row.weekly_xp)
               :                      Number(row.weekly_territories),
          isPlayer: user?.id === row.id,
        }));
        mapped.sort((a, b) => b.value - a.value);
        mapped.forEach((e, i) => { e.rank = i + 1; });
        setEntries(mapped);
      }
    } else {
      const cutoff = timeFrame === 'month'
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(0).toISOString();

      const [{ data: runs }, { data: profiles }] = await Promise.all([
        supabase.from('runs').select('user_id, distance_m, xp_earned, territories_claimed').gte('started_at', cutoff),
        supabase.from('profiles').select('id, username, level'),
      ]);

      if (runs && profiles) {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        const totals = new Map<string, { km: number; xp: number; zones: number }>();

        for (const run of runs) {
          const prev = totals.get(run.user_id) ?? { km: 0, xp: 0, zones: 0 };
          totals.set(run.user_id, {
            km: prev.km + run.distance_m / 1000,
            xp: prev.xp + run.xp_earned,
            zones: prev.zones + (run.territories_claimed?.length ?? 0),
          });
        }

        const mapped: LeaderboardEntry[] = Array.from(totals.entries()).map(([uid, t]) => {
          const profile = profileMap.get(uid);
          return {
            rank: 0,
            name: profile?.username ?? 'Runner',
            level: profile?.level ?? 1,
            value: tab === 'distance' ? Math.round(t.km * 10) / 10
                 : tab === 'xp'       ? t.xp
                 :                      t.zones,
            isPlayer: user?.id === uid,
          };
        });

        mapped.sort((a, b) => b.value - a.value);
        mapped.forEach((e, i) => { e.rank = i + 1; });
        setEntries(mapped);
      }
    }
    setLoading(false);
  };

  const tabs: { id: LeaderboardTab; label: string; icon: ReactNode }[] = [
    { id: 'distance', label: 'Distance', icon: <Activity className="w-3.5 h-3.5" strokeWidth={2} /> },
    { id: 'territories', label: 'Zones', icon: <Flag className="w-3.5 h-3.5" strokeWidth={2} /> },
    { id: 'xp', label: 'XP', icon: <Zap className="w-3.5 h-3.5" strokeWidth={2} /> },
  ];

  const timeFrames: { id: TimeFrame; label: string }[] = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
  ];

  const formatValue = (value: number): string => {
    if (tab === 'distance') return `${value.toFixed(1)} km`;
    if (tab === 'xp') return `${value.toLocaleString()} XP`;
    return `${Math.floor(value)} zones`;
  };

  const playerEntry = entries.find(e => e.isPlayer);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] pb-28">
      <div className="px-5" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold text-gray-900 mb-5">Leaderboard</h1>

        {loading && (
          <div className="flex justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-6 h-6 border-2 border-gray-200 border-t-[#E8435A] rounded-full"
            />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Crown className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No runners yet</p>
            <p className="text-xs text-gray-400 mt-1">Complete a run to appear here</p>
          </div>
        )}

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {timeFrames.map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeFrame(tf.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                timeFrame === tf.id
                  ? 'bg-[#F9E4E7] text-[#E8435A] border border-[#F9E4E7]'
                  : 'bg-gray-50 text-gray-400 border border-gray-100'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {entries.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-8 px-2">
            <div className="flex-1 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 border-2 border-gray-200
                              flex items-center justify-center text-lg font-bold text-gray-500 mb-2">
                {entries[1].name.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-gray-600 truncate max-w-full mb-0.5">{entries[1].name}</span>
              <span className="text-stat text-xs text-gray-400 mb-2">{formatValue(entries[1].value)}</span>
              <div className="w-full h-16 rounded-t-xl bg-gray-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-300">2</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div className="relative mb-2">
                <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-300
                                flex items-center justify-center text-xl font-bold text-amber-600
                                shadow-[0_4px_16px_rgba(245,158,11,0.15)]">
                  {entries[0].name.charAt(0)}
                </div>
                <Crown className="absolute -top-2 -right-1 w-5 h-5 text-amber-500" strokeWidth={2} />
              </div>
              <span className="text-xs font-bold text-gray-900 truncate max-w-full mb-0.5">{entries[0].name}</span>
              <span className="text-stat text-xs text-amber-600 mb-2">{formatValue(entries[0].value)}</span>
              <div className="w-full h-24 rounded-t-xl bg-amber-50 flex items-center justify-center border-t border-amber-200">
                <span className="text-3xl font-bold text-amber-400">1</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-orange-50 border-2 border-orange-200
                              flex items-center justify-center text-lg font-bold text-orange-400 mb-2">
                {entries[2].name.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-gray-500 truncate max-w-full mb-0.5">{entries[2].name}</span>
              <span className="text-stat text-xs text-gray-400 mb-2">{formatValue(entries[2].value)}</span>
              <div className="w-full h-12 rounded-t-xl bg-orange-50 flex items-center justify-center">
                <span className="text-2xl font-bold text-orange-300">3</span>
              </div>
            </div>
          </div>
        )}

        {playerEntry && playerEntry.rank > 3 && (
          <div className="mb-4 bg-white rounded-2xl p-4 border border-[#F9E4E7] shadow-[0_2px_12px_rgba(232,67,90,0.08)]">
            <div className="flex items-center gap-3">
              <span className="text-stat text-lg font-bold text-[#E8435A] w-8 text-center">{playerEntry.rank}</span>
              <div className="w-10 h-10 rounded-full bg-[#F9E4E7] border border-[#F9E4E7]
                              flex items-center justify-center text-sm font-bold text-[#E8435A]">
                {playerEntry.name.charAt(0)}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-900">{playerEntry.name}</span>
                <span className="text-xs text-[#E8435A] ml-2">You</span>
              </div>
              <span className="text-stat text-sm font-bold text-gray-900">{formatValue(playerEntry.value)}</span>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {entries.slice(3).map((entry, i) => (
            <motion.div
              key={entry.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className={`flex items-center gap-3 py-3 px-3 rounded-xl transition ${
                entry.isPlayer ? 'bg-[#F9E4E7] border border-[#F9E4E7]' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`text-stat text-sm font-bold w-8 text-center ${entry.isPlayer ? 'text-[#E8435A]' : 'text-gray-300'}`}>
                {entry.rank}
              </span>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                entry.isPlayer ? 'bg-[#F9E4E7] text-[#E8435A]' : 'bg-gray-100 text-gray-500'
              }`}>
                {entry.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium truncate block ${entry.isPlayer ? 'text-gray-900' : 'text-gray-600'}`}>
                  {entry.name}
                  {entry.isPlayer && <span className="text-xs text-[#E8435A] ml-1.5">You</span>}
                </span>
                <span className="text-[11px] text-gray-300">Lv.{entry.level}</span>
              </div>
              <span className={`text-stat text-sm font-semibold ${entry.isPlayer ? 'text-[#E8435A]' : 'text-gray-500'}`}>
                {formatValue(entry.value)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
