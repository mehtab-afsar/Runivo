import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Map, BarChart3, Users, Trophy,
  Coins, Gem, Zap, Activity, X, ChevronRight,
  User, Bell, Ruler, Lock, HelpCircle, LogOut, Moon, Heart,
  Camera, Check, MapPin, Target, Globe, Link2, ArrowLeft,
  Shield,
} from 'lucide-react';
import { usePlayerStats } from '../../hooks/usePlayerStats';
import { DailyMissions } from '../missions/DailyMissions';
import { soundManager } from '../../audio/sounds';
import { haptic } from '../../lib/haptics';
import { calculatePersonalRecords, formatRecordValue, getRecordLabel, PersonalRecord } from '../../game/personalRecords';
import TrainingCalendar from '../ui/TrainingCalendar';

type ProfileTab = 'overview' | 'missions' | 'achievements' | 'stats';

const AVATAR_COLORS = [
  { id: 'teal',    from: 'from-teal-400',   to: 'to-teal-600',    label: 'Teal' },
  { id: 'indigo',  from: 'from-indigo-400', to: 'to-indigo-600',  label: 'Indigo' },
  { id: 'rose',    from: 'from-rose-400',   to: 'to-rose-600',    label: 'Rose' },
  { id: 'amber',   from: 'from-amber-400',  to: 'to-amber-600',   label: 'Amber' },
  { id: 'violet',  from: 'from-violet-400', to: 'to-violet-600',  label: 'Violet' },
  { id: 'emerald', from: 'from-emerald-400',to: 'to-emerald-600', label: 'Emerald' },
  { id: 'sky',     from: 'from-sky-400',    to: 'to-sky-600',     label: 'Sky' },
  { id: 'orange',  from: 'from-orange-400', to: 'to-orange-600',  label: 'Orange' },
];

export default function Profile() {
  const navigate = useNavigate();
  const { player, recentRuns, loading, xpProgress, levelTitle } = usePlayerStats();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [units, setUnits] = useState<'km' | 'mi'>('km');
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [autoPause, setAutoPause] = useState(true);
  const [missionDifficulty, setMissionDifficulty] = useState<'easy' | 'mixed' | 'hard'>(() => {
    return (localStorage.getItem('runivo-mission-difficulty') as 'easy' | 'mixed' | 'hard') || 'mixed';
  });
  const [dailyMissionsEnabled, setDailyMissionsEnabled] = useState(() => {
    return localStorage.getItem('runivo-daily-missions') !== 'false';
  });

  // Edit Profile state
  const [avatarColorId, setAvatarColorId] = useState('teal');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('Running to conquer every street 🏃');
  const [location, setLocation] = useState('New Delhi, India');
  const [weeklyGoal, setWeeklyGoal] = useState(30);
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [stravaHandle, setStravaHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [savedProfile, setSavedProfile] = useState(false);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  const avatarColor = AVATAR_COLORS.find(c => c.id === avatarColorId) || AVATAR_COLORS[0];

  useEffect(() => {
    calculatePersonalRecords().then(setPersonalRecords);
  }, []);

  if (loading || !player) {
    return (
      <div className="h-full bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              className="w-2 h-2 rounded-full bg-teal-500"
            />
          ))}
        </div>
      </div>
    );
  }

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'missions', label: 'Missions' },
    { id: 'stats', label: 'Stats' },
    { id: 'achievements', label: 'Awards' },
  ];

  const longestRunKm = personalRecords.find(pr => pr.type === 'longest_run')?.value ?? 0;
  const profileAchievements = [
    { id: 'first_run',    cat: 'Running',   emoji: '🏃', title: 'First Steps',    desc: 'Complete your first run',       unlocked: player.totalRuns >= 1,                progress: Math.min(100, player.totalRuns * 100),                   gradient: 'from-sky-400 to-blue-600' },
    { id: '5k_club',     cat: 'Running',   emoji: '🎯', title: '5K Club',        desc: 'Run 5 km in a single session',  unlocked: longestRunKm >= 5,                   progress: Math.min(100, (longestRunKm / 5) * 100),                 gradient: 'from-teal-400 to-teal-600' },
    { id: '10k_warrior', cat: 'Running',   emoji: '🏅', title: '10K Warrior',    desc: 'Run 10 km in one session',      unlocked: longestRunKm >= 10,                  progress: Math.min(100, (longestRunKm / 10) * 100),                gradient: 'from-indigo-400 to-indigo-600' },
    { id: '50k_explorer',cat: 'Running',   emoji: '⚡', title: '50K Explorer',   desc: 'Run 50 km total distance',      unlocked: player.totalDistanceKm >= 50,        progress: Math.min(100, (player.totalDistanceKm / 50) * 100),      gradient: 'from-amber-400 to-orange-500' },
    { id: 'streak_3',    cat: 'Streak',    emoji: '🔥', title: 'On Fire',        desc: '3-day running streak',          unlocked: player.streakDays >= 3,              progress: Math.min(100, (player.streakDays / 3) * 100),            gradient: 'from-orange-400 to-red-500' },
    { id: 'streak_7',    cat: 'Streak',    emoji: '🌟', title: 'Week Warrior',   desc: '7-day running streak',          unlocked: player.streakDays >= 7,              progress: Math.min(100, (player.streakDays / 7) * 100),            gradient: 'from-yellow-400 to-orange-500' },
    { id: 'streak_30',   cat: 'Streak',    emoji: '💫', title: 'Monthly Grind',  desc: '30-day running streak',         unlocked: player.streakDays >= 30,             progress: Math.min(100, (player.streakDays / 30) * 100),           gradient: 'from-violet-400 to-purple-600' },
    { id: 'first_zone',  cat: 'Territory', emoji: '📍', title: 'Zone Claimer',   desc: 'Claim your first territory',    unlocked: player.totalTerritoriesClaimed >= 1, progress: Math.min(100, player.totalTerritoriesClaimed * 100),      gradient: 'from-emerald-400 to-emerald-600' },
    { id: 'zones_10',    cat: 'Territory', emoji: '🗺️', title: 'Map Maker',      desc: 'Claim 10 territories',          unlocked: player.totalTerritoriesClaimed >= 10, progress: Math.min(100, (player.totalTerritoriesClaimed / 10) * 100), gradient: 'from-teal-400 to-teal-600' },
    { id: 'zones_50',    cat: 'Territory', emoji: '🏰', title: 'Conqueror',      desc: 'Claim 50 territories',          unlocked: player.totalTerritoriesClaimed >= 50, progress: Math.min(100, (player.totalTerritoriesClaimed / 50) * 100), gradient: 'from-rose-400 to-rose-600' },
    { id: 'level_5',     cat: 'Level',     emoji: '⭐', title: 'Rising Star',    desc: 'Reach Level 5',                 unlocked: player.level >= 5,                   progress: Math.min(100, (player.level / 5) * 100),                 gradient: 'from-violet-400 to-violet-600' },
    { id: 'level_10',    cat: 'Level',     emoji: '👑', title: 'Veteran',        desc: 'Reach Level 10',                unlocked: player.level >= 10,                  progress: Math.min(100, (player.level / 10) * 100),                gradient: 'from-amber-400 to-amber-600' },
  ];
  const unlockedCount = profileAchievements.filter(a => a.unlocked).length;

  return (
    <div className="h-full bg-[#FAFAFA] overflow-y-auto pb-24">
      <div className="px-5" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        {/* Top actions */}
        <div className="flex justify-end gap-2 mb-4">
          <button
            onClick={() => {
              const newState = !soundEnabled;
              soundManager.setEnabled(newState);
              setSoundEnabled(newState);
              if (newState) soundManager.play('tap');
              haptic('light');
            }}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100"
          >
            {soundEnabled
              ? <Volume2 className="w-4 h-4 text-gray-500" strokeWidth={2} />
              : <VolumeX className="w-4 h-4 text-gray-400" strokeWidth={2} />
            }
          </button>
          <button
            onClick={() => { setShowSettings(true); haptic('light'); }}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Profile header */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600
                            flex items-center justify-center text-2xl font-bold text-white
                            shadow-[0_4px_16px_rgba(0,180,198,0.15)]">
              {player.username.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#FAFAFA] rounded-lg p-0.5">
              <div className="px-1.5 py-0.5 rounded-md bg-teal-50 border border-teal-200">
                <span className="text-stat text-[10px] font-bold text-teal-600">{player.level}</span>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{player.username}</h1>
            <p className="text-xs text-teal-600 font-medium mb-2">{levelTitle}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress.percent}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full"
                />
              </div>
              <span className="text-stat text-[10px] text-gray-400">
                {Math.floor(xpProgress.progress)}/{xpProgress.needed}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { value: player.totalDistanceKm.toFixed(1), label: 'km', color: 'text-gray-900' },
            { value: player.totalRuns, label: 'runs', color: 'text-gray-900' },
            { value: player.totalTerritoriesClaimed, label: 'zones', color: 'text-teal-600' },
            { value: player.streakDays, label: 'streak', color: 'text-orange-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-2.5 text-center border border-gray-100 shadow-sm">
              <span className={`text-stat text-base font-bold block ${stat.color}`}>{stat.value}</span>
              <span className="text-[9px] text-gray-400 uppercase tracking-wider">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Currencies */}
        <div className="flex items-center justify-center gap-5 mb-5">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" strokeWidth={2} />
            <span className="text-stat text-sm font-bold text-amber-500">{player.coins.toLocaleString()}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <Gem className="w-4 h-4 text-purple-500" strokeWidth={2} />
            <span className="text-stat text-sm font-bold text-purple-500">{player.gems}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-teal-600" strokeWidth={2} />
            <span className="text-stat text-sm font-bold text-teal-600">{player.energy}</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-50 rounded-xl p-1 mb-5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); haptic('light'); }}
              className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                activeTab === tab.id ? 'bg-gray-100 text-gray-900' : 'text-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-5">
        {activeTab === 'overview' && (
          <div>
            {/* Quick action cards */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {[
                { icon: <Map className="w-5 h-5 text-teal-600" strokeWidth={1.5} />, label: 'My Territories', sub: 'View your empire', path: '/territory-map' },
                { icon: <BarChart3 className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />, label: 'Run History', sub: `${recentRuns.length} total runs`, path: '/history' },
                { icon: <Users className="w-5 h-5 text-purple-500" strokeWidth={1.5} />, label: 'My Club', sub: 'Thunder Runners', path: '/club' },
                { icon: <Trophy className="w-5 h-5 text-amber-500" strokeWidth={1.5} />, label: 'Leaderboard', sub: 'Check your rank', path: '/leaderboard' },
              ].map(card => (
                <button
                  key={card.path}
                  onClick={() => { navigate(card.path); haptic('light'); }}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-left active:scale-[0.97] transition"
                >
                  <span className="mb-2 block">{card.icon}</span>
                  <span className="text-sm font-semibold text-gray-900 block">{card.label}</span>
                  <span className="text-[11px] text-gray-400">{card.sub}</span>
                </button>
              ))}
            </div>

            {/* Training Calendar */}
            <div className="mb-5">
              <TrainingCalendar
                runs={recentRuns.map(r => ({
                  startTime: r.startTime,
                  distanceMeters: r.distanceMeters,
                }))}
              />
            </div>

            {/* Recent Activity */}
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-3">
              Recent Activity
            </h3>
            {recentRuns.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-500">No runs yet. Let's go!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRuns.slice(0, 5).map(run => (
                  <motion.div
                    key={run.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => navigate(`/run-summary/${run.id}`, { state: run })}
                    className="bg-white rounded-xl p-3 flex items-center gap-3
                               border border-gray-100 shadow-sm active:scale-[0.98] transition cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-teal-600" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 block truncate">
                        {(run.distanceMeters / 1000).toFixed(2)} km run
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(run.startTime).toLocaleDateString()}
                      </span>
                    </div>
                    {run.territoriesClaimed.length > 0 && (
                      <span className="text-stat text-xs font-bold text-teal-600">
                        +{run.territoriesClaimed.length}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="space-y-5">
            {/* Today header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-[0.15em]">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-[20px] font-bold text-gray-900 mt-0.5 tracking-tight">Today's Missions</p>
              </div>
              {player.streakDays > 0 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-2 bg-gradient-to-br from-orange-50 to-amber-50
                             border border-orange-200/70 rounded-2xl px-3.5 py-2.5
                             shadow-[0_2px_12px_rgba(251,146,60,0.12)]"
                >
                  <span className="text-[22px] leading-none">🔥</span>
                  <div>
                    <p className="text-[16px] font-bold text-orange-600 leading-none">{player.streakDays}</p>
                    <p className="text-[9px] text-orange-400 uppercase tracking-wide font-medium">day streak</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* XP + level progress strip */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">Level {player.level} · {levelTitle}</span>
                  <span className="text-stat text-[12px] font-bold text-amber-600">{player.xp.toLocaleString()} XP</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>

            <DailyMissions />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">

            {/* ── Dark billboard hero ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 p-6
                         shadow-[0_24px_64px_rgba(0,0,0,0.22)]"
            >
              {/* Decorative rings */}
              <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full border border-white/[0.05]" />
              <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full border border-white/[0.05]" />
              <div className="absolute right-8 bottom-8 w-20 h-20 rounded-full bg-teal-500/10" />

              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400 mb-2">Total Distance</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-stat text-[56px] font-bold text-white leading-none tracking-tight">
                  {player.totalDistanceKm.toFixed(1)}
                </span>
                <span className="text-[22px] font-bold text-teal-400 mb-1.5">km</span>
              </div>
              <p className="text-[13px] text-gray-400 mb-5">{player.totalRuns} runs · {levelTitle}</p>

              <div className="flex gap-0">
                {[
                  { label: 'Avg / run', value: player.totalRuns > 0 ? `${(player.totalDistanceKm / player.totalRuns).toFixed(1)} km` : '—' },
                  { label: 'Level',     value: `Lv. ${player.level}` },
                  { label: 'Streak',    value: `${player.streakDays}d 🔥` },
                ].map((item, i) => (
                  <div key={item.label} className="flex-1">
                    {i > 0 && <div className="absolute w-px h-8 bg-white/10 -ml-px mt-0.5" />}
                    <div className={i > 0 ? 'pl-4' : ''}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{item.label}</p>
                      <p className="text-stat text-[15px] font-bold text-white mt-0.5">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Personal Records ── */}
            {personalRecords.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Trophy className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-[13px] font-bold text-gray-800">Personal Records</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
                  {personalRecords.map((pr, i) => {
                    const configs = [
                      { from: 'from-amber-500',   to: 'to-orange-600',   glow: 'rgba(245,158,11,0.25)' },
                      { from: 'from-teal-500',    to: 'to-teal-700',     glow: 'rgba(20,184,166,0.25)' },
                      { from: 'from-violet-500',  to: 'to-purple-700',   glow: 'rgba(139,92,246,0.25)' },
                      { from: 'from-rose-500',    to: 'to-pink-700',     glow: 'rgba(244,63,94,0.25)' },
                    ];
                    const c = configs[i % configs.length];
                    return (
                      <motion.div
                        key={pr.type}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className={`shrink-0 w-36 rounded-2xl bg-gradient-to-br ${c.from} ${c.to} p-4`}
                        style={{ boxShadow: `0 8px 32px ${c.glow}` }}
                      >
                        <Trophy className="w-5 h-5 text-white/70 mb-3" strokeWidth={1.5} />
                        <p className="text-stat text-[22px] font-bold text-white leading-none mb-1">{formatRecordValue(pr)}</p>
                        <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wide">{getRecordLabel(pr.type)}</p>
                        <p className="text-[10px] text-white/40 mt-1">
                          {new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Running stats ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                  <Activity className="w-3 h-3 text-white" strokeWidth={2.5} />
                </div>
                <h3 className="text-[13px] font-bold text-gray-800">Running</h3>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {[
                  { label: 'Total Runs',   value: `${player.totalRuns}`,                                                                     accent: 'bg-sky-500' },
                  { label: 'Total XP',     value: `${player.xp.toLocaleString()} XP`,                                                        accent: 'bg-amber-500' },
                  { label: 'Avg per Run',  value: player.totalRuns > 0 ? `${(player.totalDistanceKm / player.totalRuns).toFixed(1)} km` : '—', accent: 'bg-teal-500' },
                  { label: 'Energy',       value: `${player.energy} / 100`,                                                                  accent: 'bg-rose-500' },
                ].map((row, i, arr) => (
                  <motion.div
                    key={row.label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className={`flex items-center gap-3 px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.accent}`} />
                    <span className="flex-1 text-[13px] text-gray-500">{row.label}</span>
                    <span className="text-stat text-[14px] font-bold text-gray-900">{row.value}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Territory & Economy ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <Map className="w-3 h-3 text-white" strokeWidth={2.5} />
                </div>
                <h3 className="text-[13px] font-bold text-gray-800">Territory &amp; Economy</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Zones Claimed', value: player.totalTerritoriesClaimed, unit: 'zones', from: 'from-emerald-500', to: 'to-teal-600', glow: 'rgba(16,185,129,0.15)' },
                  { label: 'Coins Earned',  value: player.coins.toLocaleString(),  unit: 'coins', from: 'from-amber-500',   to: 'to-orange-500', glow: 'rgba(245,158,11,0.15)' },
                  { label: 'Gems',          value: player.gems,                    unit: 'gems',  from: 'from-violet-500',  to: 'to-purple-600', glow: 'rgba(139,92,246,0.15)' },
                  { label: 'Day Streak',    value: player.streakDays,              unit: 'days',  from: 'from-orange-500',  to: 'to-red-500',    glow: 'rgba(249,115,22,0.15)' },
                ].map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.07 }}
                    className="bg-white rounded-2xl p-4 border border-gray-100"
                    style={{ boxShadow: `0 4px 24px ${card.glow}` }}
                  >
                    <div className={`w-8 h-1.5 rounded-full bg-gradient-to-r ${card.from} ${card.to} mb-3`} />
                    <p className="text-stat text-[26px] font-bold text-gray-900 leading-none">{card.value}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mt-1">{card.unit}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">{card.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-5">

            {/* Header card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5
                         shadow-[0_16px_48px_rgba(245,158,11,0.28)]"
            >
              <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full border border-white/10" />
              <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full border border-white/10" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-[11px] font-semibold uppercase tracking-[0.18em] mb-1">Achievements</p>
                  <div className="flex items-end gap-1.5">
                    <span className="text-stat text-[40px] font-bold text-white leading-none">{unlockedCount}</span>
                    <span className="text-[18px] font-bold text-orange-200 mb-1">/ {profileAchievements.length}</span>
                  </div>
                  <p className="text-orange-100 text-[12px] mt-1">unlocked so far</p>
                </div>
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                    <motion.circle
                      cx="32" cy="32" r="26" fill="none"
                      stroke="white" strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - unlockedCount / profileAchievements.length) }}
                      transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[18px]">🏆</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(unlockedCount / profileAchievements.length) * 100}%` }}
                  transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }}
                />
              </div>
            </motion.div>

            {/* Achievement grid */}
            <div className="grid grid-cols-2 gap-3">
              {profileAchievements.map((ach, idx) => (
                <motion.div
                  key={ach.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + idx * 0.04 }}
                  className={`relative overflow-hidden rounded-2xl p-4 border ${
                    ach.unlocked
                      ? 'bg-white border-gray-100'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                  style={ach.unlocked ? { boxShadow: '0 4px 20px rgba(0,0,0,0.06)' } : {}}
                >
                  {/* Thin color top stripe on unlocked */}
                  {ach.unlocked && (
                    <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${ach.gradient}`} />
                  )}

                  {/* Badge icon */}
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 ${
                    ach.unlocked
                      ? `bg-gradient-to-br ${ach.gradient} shadow-sm`
                      : 'bg-gray-200'
                  }`}>
                    {ach.unlocked
                      ? <span className="text-[20px] leading-none">{ach.emoji}</span>
                      : <Lock className="w-4 h-4 text-gray-400" strokeWidth={2} />
                    }
                  </div>

                  <p className={`text-[13px] font-bold leading-tight mb-0.5 ${ach.unlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                    {ach.title}
                  </p>
                  <p className="text-[11px] text-gray-400 leading-snug mb-3">{ach.desc}</p>

                  {ach.unlocked ? (
                    <div className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-teal-500" strokeWidth={2.5} />
                      <span className="text-[10px] font-semibold text-teal-500">Earned</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide font-medium">{ach.cat}</span>
                        <span className="text-stat text-[10px] text-gray-400">{Math.round(ach.progress)}%</span>
                      </div>
                      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full bg-gradient-to-r ${ach.gradient} opacity-60`}
                          initial={{ width: 0 }}
                          animate={{ width: `${ach.progress}%` }}
                          transition={{ duration: 0.7, delay: 0.1 + idx * 0.04 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Sheet */}
      <AnimatePresence>
        {showEditProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setShowEditProfile(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-[#FAFAFA] rounded-t-3xl max-h-[92vh] overflow-y-auto"
              style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <button
                  onClick={() => { setShowEditProfile(false); haptic('light'); }}
                  className="p-1.5 rounded-full active:bg-gray-100 transition"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700" strokeWidth={2} />
                </button>
                <h2 className="flex-1 text-[16px] font-bold text-gray-900">Edit Profile</h2>
                <button
                  onClick={() => {
                    setSavedProfile(true);
                    haptic('medium');
                    setTimeout(() => {
                      setSavedProfile(false);
                      setShowEditProfile(false);
                    }, 1000);
                  }}
                  className={`px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-all ${
                    savedProfile
                      ? 'bg-teal-50 text-teal-600'
                      : 'bg-teal-500 text-white active:bg-teal-600'
                  }`}
                >
                  {savedProfile ? <Check className="w-4 h-4" strokeWidth={2.5} /> : 'Save'}
                </button>
              </div>

              <div className="px-5 pt-6 pb-4 space-y-6">

                {/* Avatar picker */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-3">
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarColor.from} ${avatarColor.to} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
                      {(displayName || player?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center ring-2 ring-white">
                      <Camera className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-400 mb-3">Choose avatar colour</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {AVATAR_COLORS.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setAvatarColorId(c.id); haptic('light'); }}
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${c.from} ${c.to} transition-all ${
                          avatarColorId === c.id
                            ? 'ring-2 ring-offset-2 ring-gray-700 scale-110'
                            : 'active:scale-95'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Display name */}
                <div>
                  <label className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2 block">Display Name</label>
                  <input
                    type="text"
                    value={displayName || player?.username || ''}
                    onChange={e => setDisplayName(e.target.value)}
                    maxLength={30}
                    placeholder="Your name"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-400 transition"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-right">{(displayName || player?.username || '').length}/30</p>
                </div>

                {/* Bio */}
                <div>
                  <label className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2 block">Bio</label>
                  <textarea
                    ref={bioRef}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    maxLength={150}
                    rows={3}
                    placeholder="Tell the community about yourself..."
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-400 transition resize-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-right">{bio.length}/150</p>
                </div>

                {/* Location */}
                <div>
                  <label className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2 block">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="City, Country"
                      className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-400 transition"
                    />
                  </div>
                </div>

                {/* Weekly goal */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" strokeWidth={2} />
                      Weekly Goal
                    </label>
                    <span className="text-[14px] font-bold text-teal-600">{weeklyGoal} km</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={weeklyGoal}
                    onChange={e => { setWeeklyGoal(Number(e.target.value)); haptic('light'); }}
                    className="w-full accent-teal-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-300 mt-1">
                    <span>5 km</span>
                    <span>120 km</span>
                  </div>
                </div>

                {/* Privacy */}
                <div>
                  <label className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2 block flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" strokeWidth={2} />
                    Profile Visibility
                  </label>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {([
                      { id: 'public',    icon: Globe,   label: 'Public',          sub: 'Anyone can see your runs' },
                      { id: 'followers', icon: Users,   label: 'Followers only',  sub: 'Only people you follow' },
                      { id: 'private',   icon: Lock,    label: 'Private',         sub: 'Only you can see' },
                    ] as const).map((opt, i, arr) => (
                      <button
                        key={opt.id}
                        onClick={() => { setPrivacy(opt.id); haptic('light'); }}
                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition active:bg-gray-50 ${
                          i < arr.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        <opt.icon className="w-4.5 h-4.5 text-gray-400 flex-shrink-0" strokeWidth={1.8} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-medium text-gray-900 block">{opt.label}</span>
                          <span className="text-[11px] text-gray-400">{opt.sub}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                          privacy === opt.id ? 'bg-teal-500 border-teal-500' : 'border-gray-300'
                        }`}>
                          {privacy === opt.id && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Linked apps */}
                <div>
                  <label className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2 block flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" strokeWidth={2} />
                    Linked Apps
                  </label>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Strava */}
                    <div className="flex items-center gap-3.5 px-4 py-3.5 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[11px] font-black">S</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-medium text-gray-900 block">Strava</span>
                        <input
                          type="text"
                          value={stravaHandle}
                          onChange={e => setStravaHandle(e.target.value)}
                          placeholder="strava.com/athletes/..."
                          className="text-[11px] text-gray-400 bg-transparent outline-none w-full placeholder:text-gray-300 mt-0.5"
                        />
                      </div>
                      {stravaHandle ? (
                        <button onClick={() => setStravaHandle('')} className="p-1 rounded-full active:bg-gray-100">
                          <X className="w-3.5 h-3.5 text-gray-300" strokeWidth={2} />
                        </button>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
                      )}
                    </div>
                    {/* Instagram */}
                    <div className="flex items-center gap-3.5 px-4 py-3.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[11px] font-black">ig</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-medium text-gray-900 block">Instagram</span>
                        <input
                          type="text"
                          value={instagramHandle}
                          onChange={e => setInstagramHandle(e.target.value)}
                          placeholder="@username"
                          className="text-[11px] text-gray-400 bg-transparent outline-none w-full placeholder:text-gray-300 mt-0.5"
                        />
                      </div>
                      {instagramHandle ? (
                        <button onClick={() => setInstagramHandle('')} className="p-1 rounded-full active:bg-gray-100">
                          <X className="w-3.5 h-3.5 text-gray-300" strokeWidth={2} />
                        </button>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={() => {
                    setSavedProfile(true);
                    haptic('medium');
                    setTimeout(() => {
                      setSavedProfile(false);
                      setShowEditProfile(false);
                    }, 1000);
                  }}
                  className={`w-full py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all ${
                    savedProfile
                      ? 'bg-teal-50 text-teal-600 border border-teal-200'
                      : 'bg-gray-900 text-white active:bg-gray-800 shadow-sm'
                  }`}
                >
                  {savedProfile ? (
                    <><Check className="w-4.5 h-4.5" strokeWidth={2.5} /> Saved!</>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setShowSettings(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 bg-[#FAFAFA] rounded-t-3xl max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-lg font-bold text-gray-900">Settings</h2>
              <button
                onClick={() => { setShowSettings(false); haptic('light'); }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" strokeWidth={2} />
              </button>
            </div>

            <div className="px-5 space-y-5 pb-4">
              {/* Account */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-2">Account</h3>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => { setShowEditProfile(true); haptic('light'); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 active:bg-gray-50 transition"
                  >
                    <User className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900 text-left">Edit Profile</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition">
                    <Lock className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900 text-left">Privacy</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Preferences */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-2">Preferences</h3>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Units */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                    <Ruler className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900">Distance Units</span>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => { setUnits('km'); haptic('light'); }}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition ${units === 'km' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}
                      >km</button>
                      <button
                        onClick={() => { setUnits('mi'); haptic('light'); }}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition ${units === 'mi' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}
                      >mi</button>
                    </div>
                  </div>

                  {/* Dark Mode */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                    <Moon className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900">Dark Mode</span>
                    <button
                      onClick={() => { setDarkMode(!darkMode); haptic('light'); }}
                      className={`w-11 h-6 rounded-full transition-colors ${darkMode ? 'bg-teal-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${darkMode ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* Notifications */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                    <Bell className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900">Notifications</span>
                    <button
                      onClick={() => { setNotifications(!notifications); haptic('light'); }}
                      className={`w-11 h-6 rounded-full transition-colors ${notifications ? 'bg-teal-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${notifications ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* Sound */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                    {soundEnabled ? <Volume2 className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} /> : <VolumeX className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />}
                    <span className="flex-1 text-sm text-gray-900">Sound Effects</span>
                    <button
                      onClick={() => {
                        const newState = !soundEnabled;
                        soundManager.setEnabled(newState);
                        setSoundEnabled(newState);
                        if (newState) soundManager.play('tap');
                        haptic('light');
                      }}
                      className={`w-11 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-teal-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${soundEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* Haptic */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <Heart className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900">Haptic Feedback</span>
                    <button
                      onClick={() => { setHapticFeedback(!hapticFeedback); haptic('light'); }}
                      className={`w-11 h-6 rounded-full transition-colors ${hapticFeedback ? 'bg-teal-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${hapticFeedback ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Run Settings */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-2">Run Settings</h3>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <Activity className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900">Auto-Pause</span>
                    <button
                      onClick={() => { setAutoPause(!autoPause); haptic('light'); }}
                      className={`w-11 h-6 rounded-full transition-colors ${autoPause ? 'bg-teal-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${autoPause ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Daily Missions */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-2">Daily Missions</h3>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Enable/Disable */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                    <Trophy className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900">Daily Missions</span>
                    <button
                      onClick={() => {
                        const next = !dailyMissionsEnabled;
                        setDailyMissionsEnabled(next);
                        localStorage.setItem('runivo-daily-missions', String(next));
                        haptic('light');
                      }}
                      className={`w-11 h-6 rounded-full transition-colors ${dailyMissionsEnabled ? 'bg-teal-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${dailyMissionsEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {/* Difficulty */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <Zap className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900">Difficulty</span>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      {(['easy', 'mixed', 'hard'] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => {
                            setMissionDifficulty(d);
                            localStorage.setItem('runivo-mission-difficulty', d);
                            haptic('light');
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition ${
                            missionDifficulty === d ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 px-1">
                  Missions refresh daily at midnight. Difficulty affects XP rewards.
                </p>
              </div>

              {/* Support */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-2">Support</h3>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition">
                    <HelpCircle className="w-4.5 h-4.5 text-gray-400" strokeWidth={1.8} />
                    <span className="flex-1 text-sm text-gray-900 text-left">Help & FAQ</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Log Out */}
              <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-50 border border-red-100 active:bg-red-100 transition">
                <LogOut className="w-4 h-4 text-red-500" strokeWidth={2} />
                <span className="text-sm font-semibold text-red-500">Log Out</span>
              </button>

              <p className="text-center text-[10px] text-gray-300">Runivo v1.0.0</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
