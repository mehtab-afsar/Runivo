import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Coins, AlertTriangle,
  Trophy, Calendar, Users, BarChart3, Zap, Gem, CheckCircle, Target,
} from 'lucide-react';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats';
import { getTodaysMissions } from '@features/missions/services/missionStore';
import { getAllTerritories, StoredTerritory } from '@shared/services/store';
import { GAME_CONFIG } from '@shared/services/config';
import { Mission } from '@features/missions/services/missions';
import { StatCard } from '@shared/ui/StatCard';
import WeeklyGoalRing from '@shared/ui/WeeklyGoalRing';
import { getRuns } from '@shared/services/store';
import { haptic } from '@shared/lib/haptics';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 22 } },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { player, loading, incomeCollected } = usePlayerStats();
  const [showIncomeBadge, setShowIncomeBadge] = useState(false);

  useEffect(() => {
    if (incomeCollected > 0) {
      setShowIncomeBadge(true);
      const t = setTimeout(() => setShowIncomeBadge(false), 4000);
      return () => clearTimeout(t);
    }
  }, [incomeCollected]);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [player]);

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

  const incomePausedDays = useMemo(() => {
    if (!player?.lastRunDate) return null;
    const last = new Date(player.lastRunDate);
    const diff = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 2 ? diff : null;
  }, [player]);

  const { missionsCompleted, missionsTotal, avgDefense, weakZones, enemyNearby } = useMemo(() => {
    const completed = missions.filter(m => m.completed).length;
    const total = missions.length;
    const owned = territories.filter(t => player && t.ownerId === player.id);
    const totalDef = owned.reduce((sum, t) => sum + t.defense, 0);
    const avg = ownedCount > 0 ? Math.round(totalDef / ownedCount) : 0;
    const weak = owned.filter(t => t.defense < 30);
    const enemy = territories.filter(t => t.ownerId && player && t.ownerId !== player.id).length;
    return { missionsCompleted: completed, missionsTotal: total, avgDefense: avg, weakZones: weak, enemyNearby: enemy };
  }, [missions, territories, player, ownedCount]);

  const motivation = useMemo(() => {
    if (enemyNearby > 0) return `${enemyNearby} enemy zones nearby`;
    if (weakZones.length > 0) return `${weakZones.length} zones losing defense`;
    if (missions.length > 0 && missionsCompleted < missionsTotal)
      return `${missionsTotal - missionsCompleted} missions to complete`;
    return 'Claim territory and earn XP';
  }, [enemyNearby, weakZones, missions, missionsCompleted, missionsTotal]);

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

  return (
    <div className="h-full bg-[#FAFAFA] relative overflow-hidden">
      {/* Passive income collected toast */}
      <AnimatePresence>
        {showIncomeBadge && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="fixed left-4 right-4 z-50 flex justify-center"
            style={{ top: 'max(12px, env(safe-area-inset-top))' }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 shadow-lg">
              <span className="text-sm">🪙</span>
              <span className="text-sm font-bold text-white">+{incomeCollected} coins collected from your zones</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="flex items-center gap-1.5">
              {/* Currency pills */}
              <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white border border-yellow-100 shadow-sm">
                <Coins className="w-3 h-3 text-yellow-400" strokeWidth={2} />
                <span className="text-stat text-[11px] font-bold text-yellow-500">{player.coins.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white border border-purple-100 shadow-sm">
                <Gem className="w-3 h-3 text-purple-400" strokeWidth={2} />
                <span className="text-stat text-[11px] font-bold text-purple-400">{player.diamonds}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white border border-teal-100 shadow-sm">
                <Zap className="w-3 h-3 text-teal-500" strokeWidth={2} />
                <span className="text-stat text-[11px] font-bold text-teal-500">{player.energy}</span>
              </div>
              {player.streakDays > 0 && (
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white border border-orange-200 shadow-sm">
                  <Flame className="w-3 h-3 text-orange-400" strokeWidth={2} />
                  <span className="text-stat text-[11px] font-bold text-orange-400">{player.streakDays}</span>
                </div>
              )}
              <NotificationBell variant="light" />
            </div>
          </motion.div>

          {/* Quick Actions Grid */}
          <motion.div variants={item} className="grid grid-cols-4 gap-2 mb-4">
            {[
              { icon: <Trophy className="w-5 h-5 text-yellow-400" strokeWidth={1.5} />, label: 'Leaders', path: '/leaderboard' },
              { icon: <Calendar className="w-5 h-5 text-purple-400" strokeWidth={1.5} />, label: 'Events', path: '/events' },
              { icon: <Users className="w-5 h-5 text-teal-600" strokeWidth={1.5} />, label: 'Club', path: '/club' },
              { icon: <BarChart3 className="w-5 h-5 text-green-400" strokeWidth={1.5} />, label: 'History', path: '/history' },
            ].map((nav) => (
              <button
                key={nav.path}
                onClick={() => { navigate(nav.path); haptic('light'); }}
                className="relative bg-white rounded-xl py-3 flex flex-col items-center gap-1.5
                           border border-gray-100 shadow-sm active:scale-[0.95] transition"
              >
                {nav.icon}
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

          {/* Passive income paused banner */}
          {incomePausedDays !== null && (
            <motion.div variants={item} className="mb-4">
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" strokeWidth={2} />
                <p className="text-xs text-amber-700 leading-snug flex-1">
                  No run in <span className="font-semibold">{incomePausedDays} days</span> — passive income is paused. Run today to earn coins.
                </p>
                <button
                  onClick={() => { navigate('/run'); haptic('medium'); }}
                  className="text-[11px] font-bold text-amber-600 whitespace-nowrap active:opacity-70"
                >
                  Run Now
                </button>
              </div>
            </motion.div>
          )}

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
            <p className="text-center text-[11px] text-gray-400 mt-2">{motivation}</p>
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
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: avgDefense / 100 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  style={{ transformOrigin: 'left' }}
                  className={`h-full w-full rounded-full ${
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
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: missionsCompleted / Math.max(missionsTotal, 1) }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                      style={{ transformOrigin: 'left' }}
                      className="h-full w-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
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
              <button
                onClick={() => navigate('/missions')}
                className="w-full bg-white rounded-2xl p-5 border border-gray-100 shadow-sm
                           flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-teal-600" strokeWidth={1.8} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Set Daily Mission</p>
                  <p className="text-xs text-gray-400 mt-0.5">Pick today's challenge to earn XP &amp; coins</p>
                </div>
                <span className="text-xs text-teal-600 font-medium">Choose</span>
              </button>
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
                        Zone {zone.id.slice(0, 8)}... defense at {zone.defense}%
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

        </motion.div>
      </div>
    </div>
  );
}
