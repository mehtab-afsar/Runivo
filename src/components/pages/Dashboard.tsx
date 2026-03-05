import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Flame, Coins, AlertTriangle,
  Trophy, Calendar, Users, BarChart3, Zap, Gem, CheckCircle,
} from 'lucide-react';
import { usePlayerStats } from '../../hooks/usePlayerStats';
import { getTodaysMissions } from '../../game/missionStore';
import { getAllTerritories, StoredTerritory } from '../../game/store';
import { GAME_CONFIG } from '../../game/config';
import { Mission } from '../../game/missions';
import { StatCard } from '../ui/StatCard';
import WeeklyGoalRing from '../ui/WeeklyGoalRing';
import { getRuns } from '../../game/store';
import { haptic } from '../../lib/haptics';

export default function Dashboard() {
  const navigate = useNavigate();
  const { player, loading, xpProgress, levelTitle } = usePlayerStats();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [territories, setTerritories] = useState<StoredTerritory[]>([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [greeting, setGreeting] = useState('');
  const [weeklyKm, setWeeklyKm] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    const saved = localStorage.getItem('runivo-weekly-goal');
    return saved ? Number(saved) : 20;
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 5) setGreeting('Night Owl');
    else if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else if (hour < 21) setGreeting('Good Evening');
    else setGreeting('Night Owl');
  }, []);

  useEffect(() => {
    loadData();
  }, [player]);

  const loadData = async () => {
    const m = await getTodaysMissions();
    setMissions(m);

    const allT = await getAllTerritories();
    setTerritories(allT);
    if (player) {
      setOwnedCount(allT.filter(t => t.ownerId === player.id).length);
    }

    // Calculate weekly distance
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const allRuns = await getRuns();
    const weekDist = allRuns
      .filter(r => r.startTime >= weekAgo)
      .reduce((sum, r) => sum + r.distanceMeters / 1000, 0);
    setWeeklyKm(Math.round(weekDist * 10) / 10);
  };

  const missionsCompleted = missions.filter(m => m.completed).length;
  const missionsTotal = missions.length;

  const totalDefense = territories
    .filter(t => player && t.ownerId === player.id)
    .reduce((sum, t) => sum + t.defense, 0);

  const avgDefense =
    ownedCount > 0 ? Math.round(totalDefense / ownedCount) : 0;

  const weakZones = territories.filter(
    t => player && t.ownerId === player.id && t.defense < 30
  );

  const enemyNearby = territories.filter(
    t => t.ownerId && player && t.ownerId !== player.id
  ).length;

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const item = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 22 } },
  };

  if (loading || !player) {
    return (
      <div className="h-full bg-[#FAFAFA] flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600
                     flex items-center justify-center shadow-[0_4px_20px_rgba(0,180,198,0.15)]"
        >
          <span className="text-xl font-bold text-white">R</span>
        </motion.div>
      </div>
    );
  }

  const getMotivation = (): string => {
    if (enemyNearby > 0) return `${enemyNearby} enemy zones nearby`;
    if (weakZones.length > 0) return `${weakZones.length} zones losing defense`;
    if (missions.length > 0 && missionsCompleted < missionsTotal)
      return `${missionsTotal - missionsCompleted} missions to complete`;
    return 'Claim territory and earn XP';
  };

  return (
    <div className="h-full bg-[#FAFAFA] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-[#F0F7F8] to-[#FAFAFA]" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-teal-500/[0.03] blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-pink-500/[0.02] blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full overflow-y-auto pb-24">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="px-5"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
        >
          {/* Header */}
          <motion.div variants={item} className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{greeting}</p>
              <h1 className="text-xl font-bold text-gray-900">{player.username}</h1>
            </div>
            <div className="flex items-center gap-2">
              {player.streakDays > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white border border-orange-200 shadow-sm">
                  <Flame className="w-3.5 h-3.5 text-orange-400" strokeWidth={2} />
                  <span className="text-stat text-xs font-bold text-orange-400">
                    {player.streakDays}
                  </span>
                </div>
              )}
              <button className="w-9 h-9 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
            </div>
          </motion.div>

          {/* Quick Actions Grid */}
          <motion.div variants={item} className="grid grid-cols-4 gap-2 mb-4">
            {[
              { icon: <Trophy className="w-5 h-5 text-yellow-400" strokeWidth={1.5} />, label: 'Leaders', path: '/leaderboard' },
              { icon: <Calendar className="w-5 h-5 text-purple-400" strokeWidth={1.5} />, label: 'Events', path: '/events', badge: 3 },
              { icon: <Users className="w-5 h-5 text-teal-600" strokeWidth={1.5} />, label: 'Club', path: '/club', badge: 2 },
              { icon: <BarChart3 className="w-5 h-5 text-green-400" strokeWidth={1.5} />, label: 'History', path: '/history' },
            ].map((nav) => (
              <button
                key={nav.path}
                onClick={() => { navigate(nav.path); haptic('light'); }}
                className="relative bg-white rounded-xl py-3 flex flex-col items-center gap-1.5
                           border border-gray-100 shadow-sm active:scale-[0.95] transition"
              >
                <div className="relative">
                  {nav.icon}
                  {'badge' in nav && nav.badge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white leading-none">{nav.badge}</span>
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-medium text-gray-500">{nav.label}</span>
              </button>
            ))}
          </motion.div>

          {/* Weekly Goal */}
          <motion.div variants={item} className="mb-4">
            <WeeklyGoalRing
              currentKm={weeklyKm}
              goalKm={weeklyGoal}
              onEditGoal={() => {
                const input = prompt('Set weekly goal (km):', String(weeklyGoal));
                if (input) {
                  const val = Math.max(1, Math.min(500, Number(input) || 20));
                  setWeeklyGoal(val);
                  localStorage.setItem('runivo-weekly-goal', String(val));
                }
              }}
            />
          </motion.div>

          {/* Start Run CTA */}
          <motion.div variants={item} className="mb-5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { navigate('/run'); haptic('medium'); }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                         flex items-center justify-center gap-3
                         shadow-[0_4px_20px_rgba(0,180,198,0.15)]
                         active:shadow-[0_4px_20px_rgba(0,180,198,0.25)] transition-shadow"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="black" stroke="black" strokeWidth="1" />
              </svg>
              <span className="text-base font-bold text-white">Start Run</span>
            </motion.button>
            <p className="text-center text-[11px] text-gray-400 mt-2">{getMotivation()}</p>
          </motion.div>

          {/* Empire Overview */}
          <motion.div variants={item} className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                Your Empire
              </h2>
              <button
                onClick={() => { navigate('/territory-map'); haptic('light'); }}
                className="text-xs text-teal-600 font-medium"
              >
                View Map
              </button>
            </div>
            <div
              className="bg-white rounded-2xl border border-gray-100 p-4 active:scale-[0.98] transition cursor-pointer"
              onClick={() => { navigate('/territory-map'); haptic('light'); }}
            >
              {/* Three stats row */}
              <div className="flex items-center mb-4">
                <div className="flex-1 text-center">
                  <span className="text-stat text-2xl font-bold text-gray-900 block">{ownedCount}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Zones</span>
                </div>
                <div className="w-px h-10 bg-gray-100" />
                <div className="flex-1 text-center">
                  <span className="text-stat text-2xl font-bold text-gray-900 block">{avgDefense}%</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Defense</span>
                </div>
                <div className="w-px h-10 bg-gray-100" />
                <div className="flex-1 text-center">
                  <span className="text-stat text-2xl font-bold text-gray-900 block">{ownedCount * GAME_CONFIG.BASE_INCOME_PER_HEX_DAY}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Coins/day</span>
                </div>
              </div>

              {/* Defense bar */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${avgDefense}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className={`h-full rounded-full ${
                    avgDefense > 60 ? 'bg-teal-500' : avgDefense > 30 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                />
              </div>

              {/* Alert row */}
              <div className="flex items-center justify-between">
                {weakZones.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.8} />
                    <span className="text-[11px] text-amber-500 font-medium">
                      {weakZones.length} zone{weakZones.length !== 1 ? 's' : ''} need fortifying
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-400">All zones secure</span>
                )}
                <span className="text-[11px] text-teal-600 font-medium">View Map</span>
              </div>
            </div>
          </motion.div>

          {/* Daily Missions */}
          <motion.div variants={item} className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                Daily Missions
              </h2>
              <span className="text-stat text-xs text-teal-600 font-medium">
                {missionsCompleted}/{missionsTotal}
              </span>
            </div>

            {missions.length > 0 ? (
              <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(missionsCompleted / Math.max(missionsTotal, 1)) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                    />
                  </div>
                </div>
                {missions.map((mission, i) => (
                  <div
                    key={mission.id}
                    className={`flex items-center gap-3 p-3 px-4 ${
                      i < missions.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    {mission.completed
                      ? <CheckCircle className="w-5 h-5 text-green-400" strokeWidth={2} />
                      : <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center"><span className="text-[10px] text-gray-500">{missions.indexOf(mission) + 1}</span></div>
                    }
                    <span className={`flex-1 text-sm ${mission.completed ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                      {mission.title}
                    </span>
                    <span className="text-stat text-xs text-gray-400">
                      {mission.type === 'run_distance' || mission.type === 'run_in_enemy_zone'
                        ? `${mission.current.toFixed(1)}/${mission.target}`
                        : `${Math.floor(mission.current)}/${mission.target}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 text-center border border-gray-100 shadow-sm">
                <span className="text-sm text-gray-500">Loading missions...</span>
              </div>
            )}
          </motion.div>

          {/* Leaderboard Preview */}
          <motion.div variants={item} className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-medium">
                This Week's Leaders
              </h2>
              <button
                onClick={() => { navigate('/leaderboard'); haptic('light'); }}
                className="text-xs text-teal-600 font-medium"
              >
                Full Board
              </button>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-stat text-sm font-bold text-teal-600">#{Math.floor(Math.random() * 50) + 10}</span>
                <span className="text-xs text-gray-500">in your area</span>
              </div>
              <div className="space-y-2">
                {[
                  { rank: 1, name: 'SpeedDemon_42', value: '28.4 km', color: 'text-yellow-400' },
                  { rank: 2, name: 'NightRunner_X', value: '24.1 km', color: 'text-gray-600' },
                  { rank: 3, name: 'MilesAhead', value: '21.7 km', color: 'text-amber-600/80' },
                ].map(entry => (
                  <div key={entry.rank} className="flex items-center gap-3">
                    <span className={`text-stat text-xs font-bold w-5 text-center ${entry.color}`}>
                      {entry.rank}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      {entry.name.charAt(0)}
                    </div>
                    <span className="text-xs text-gray-600 flex-1">{entry.name}</span>
                    <span className="text-stat text-xs text-gray-500">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Territory Alerts */}
          {weakZones.length > 0 && (
            <motion.div variants={item} className="mb-5">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-3">
                Territory Alerts
              </h2>
              <div className="space-y-2">
                {weakZones.slice(0, 3).map((zone, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-3 flex items-center gap-3 border border-amber-200 shadow-sm
                               cursor-pointer active:scale-[0.98] transition"
                    onClick={() => { navigate('/territory-map'); haptic('light'); }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-gray-600 block">
                        Zone {zone.hexId.slice(0, 8)}... defense at {zone.defense}%
                      </span>
                    </div>
                    <span className="text-[10px] text-yellow-400/60 font-medium">Fortify</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quick Stats */}
          <motion.div variants={item} className="mb-5">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-3">
              All Time
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard label="Total Distance" value={player.totalDistanceKm.toFixed(1)} unit="km" />
              <StatCard label="Total Runs" value={player.totalRuns} />
            </div>
          </motion.div>

          {/* Currencies */}
          <motion.div variants={item}>
            <div className="flex items-center justify-center gap-5 py-3">
              <div className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-yellow-400" strokeWidth={2} />
                <span className="text-stat text-sm font-bold text-yellow-400">{player.coins.toLocaleString()}</span>
              </div>
              <div className="w-px h-4 bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <Gem className="w-4 h-4 text-purple-400" strokeWidth={2} />
                <span className="text-stat text-sm font-bold text-purple-400">{player.gems}</span>
              </div>
              <div className="w-px h-4 bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-teal-600" strokeWidth={2} />
                <span className="text-stat text-sm font-bold text-teal-600">
                  {player.energy}/{GAME_CONFIG.MAX_ENERGY}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
