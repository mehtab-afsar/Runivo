import { useState, useEffect, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Activity, Flag, Zap, Crown } from 'lucide-react';
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats';
import { getRuns } from '@shared/services/store';

type LeaderboardTab = 'distance' | 'territories' | 'xp';
type TimeFrame = 'week' | 'month' | 'all';

interface LeaderboardEntry {
  rank: number;
  name: string;
  value: number;
  level: number;
  isPlayer: boolean;
}

export default function Leaderboard() {
  const { player } = usePlayerStats();
  const [tab, setTab] = useState<LeaderboardTab>('distance');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { generateLeaderboard(); }, [tab, timeFrame, player]);

  const generateLeaderboard = async () => {
    if (!player) return;

    const allRuns = await getRuns();
    const now = Date.now();
    const cutoff = {
      week: now - 7 * 24 * 60 * 60 * 1000,
      month: now - 30 * 24 * 60 * 60 * 1000,
      all: 0,
    }[timeFrame];

    const filteredRuns = allRuns.filter(r => r.startTime >= cutoff);

    let playerValue = 0;
    switch (tab) {
      case 'distance':
        playerValue = filteredRuns.reduce((sum, r) => sum + r.distanceMeters / 1000, 0);
        break;
      case 'territories':
        playerValue = filteredRuns.reduce((sum, r) => sum + r.territoriesClaimed.length, 0);
        break;
      case 'xp':
        playerValue = filteredRuns.reduce((sum, r) => sum + r.xpEarned, 0);
        break;
    }

    const mockNames = [
      'SpeedDemon_42', 'NightRunner_X', 'MilesAhead', 'TerritoryKing',
      'UrbanExplorer', 'PaceBreaker', 'TrailBlaze_7', 'RunRebel',
      'StreetConquer', 'MapMaster_99', 'ZoneHunter', 'SwiftStrike',
      'EnduranceKing', 'HexHero', 'CityRunner_X', 'GroundControl',
      'PavementPro', 'GridLord', 'SprintStar', 'ConquestKing',
    ];

    const mockEntries: LeaderboardEntry[] = mockNames.map((name) => {
      const baseMultiplier = tab === 'distance' ? 15 : tab === 'territories' ? 12 : 500;
      const timeMultiplier = timeFrame === 'week' ? 1 : timeFrame === 'month' ? 3.5 : 10;
      const randomFactor = 0.3 + Math.random() * 1.7;
      const value = Math.round(baseMultiplier * timeMultiplier * randomFactor * 10) / 10;
      return { rank: 0, name, value, level: Math.floor(3 + Math.random() * 15), isPlayer: false };
    });

    mockEntries.push({
      rank: 0, name: player.username,
      value: Math.round(playerValue * 10) / 10,
      level: player.level, isPlayer: true,
    });

    mockEntries.sort((a, b) => b.value - a.value);
    mockEntries.forEach((entry, i) => { entry.rank = i + 1; });
    setEntries(mockEntries);
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
    <div className="min-h-screen bg-[#FAFAFA] pb-28">
      <div className="px-5" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold text-gray-900 mb-5">Leaderboard</h1>

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
                  ? 'bg-teal-50 text-teal-600 border border-teal-200'
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
          <div className="mb-4 bg-white rounded-2xl p-4 border border-teal-200 shadow-[0_2px_12px_rgba(0,180,198,0.08)]">
            <div className="flex items-center gap-3">
              <span className="text-stat text-lg font-bold text-teal-600 w-8 text-center">{playerEntry.rank}</span>
              <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-200
                              flex items-center justify-center text-sm font-bold text-teal-600">
                {playerEntry.name.charAt(0)}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-gray-900">{playerEntry.name}</span>
                <span className="text-xs text-teal-500 ml-2">You</span>
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
                entry.isPlayer ? 'bg-teal-50 border border-teal-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`text-stat text-sm font-bold w-8 text-center ${entry.isPlayer ? 'text-teal-600' : 'text-gray-300'}`}>
                {entry.rank}
              </span>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                entry.isPlayer ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {entry.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium truncate block ${entry.isPlayer ? 'text-gray-900' : 'text-gray-600'}`}>
                  {entry.name}
                  {entry.isPlayer && <span className="text-xs text-teal-500 ml-1.5">You</span>}
                </span>
                <span className="text-[11px] text-gray-300">Lv.{entry.level}</span>
              </div>
              <span className={`text-stat text-sm font-semibold ${entry.isPlayer ? 'text-teal-600' : 'text-gray-500'}`}>
                {formatValue(entry.value)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
