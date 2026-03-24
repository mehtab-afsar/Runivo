import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Zap, Check, Play, Award, Calendar, Users, Target, MapPin, Flame } from 'lucide-react';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats';
import { getTodaysMissions } from '@features/missions/services/missionStore';
import { getAllTerritories, StoredTerritory, getRuns, StoredRun, getNutritionProfile, getNutritionEntries, getSettings, localDateString } from '@shared/services/store';
import { Mission } from '@features/missions/services/missions';
import { haptic } from '@shared/lib/haptics';
import { onSyncStatusChange, postRunSync, type SyncStatus } from '@shared/services/sync';

import { T as TBase, F, FD } from '@shared/design-system/tokens';

const T = {
  ...TBase,
  amberBo: '#E8C97A',
};

// ─── Section header ───────────────────────────────────────────────────────────
function SectionTitle({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.t3, fontFamily: F }}>{label}</span>
      {action && (
        <button onClick={onAction} style={{ fontSize: 11, fontWeight: 400, color: T.t3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}>
          {action}
        </button>
      )}
    </div>
  );
}

// ─── Avatar + XP Ring ─────────────────────────────────────────────────────────
function AvatarXP({ initials, xpPct }: { initials: string; xpPct: number }) {
  const SZ = 40, SW = 2, R = (SZ - SW) / 2, C = 2 * Math.PI * R;
  return (
    <div style={{ position: 'relative', width: SZ, height: SZ }}>
      <svg width={SZ} height={SZ} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={SZ / 2} cy={SZ / 2} r={R} fill="none" stroke={T.mid} strokeWidth={SW} />
        <motion.circle
          cx={SZ / 2} cy={SZ / 2} r={R} fill="none"
          stroke={T.red} strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - xpPct / 100) }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: SW + 2, borderRadius: '50%',
        background: T.black, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 500, color: '#fff', fontFamily: F,
      }}>{initials}</div>
    </div>
  );
}


// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { player, loading, loginBonusCoins, xpProgress } = usePlayerStats();
  const [showIncomeBadge, setShowIncomeBadge] = useState(false);
  const [missions,    setMissions]    = useState<Mission[]>([]);
  const [territories, setTerritories] = useState<StoredTerritory[]>([]);
  const [ownedCount,  setOwnedCount]  = useState(0);
  const [greeting,    setGreeting]    = useState('Good morning');
  const [weeklyKm,    setWeeklyKm]    = useState(0);
  const [runDays,     setRunDays]     = useState<boolean[]>(Array(7).fill(false));
  const [weeklyGoal, setWeeklyGoal]   = useState(20);
  const [recentRuns,  setRecentRuns]  = useState<StoredRun[]>([]);
  const [heroSlide,   setHeroSlide]   = useState(0); // 0 = weekly goal, 1 = calories
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [calorieGoal,      setCalorieGoal]      = useState(2000);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    if (loginBonusCoins > 0) {
      setShowIncomeBadge(true);
      const t = setTimeout(() => setShowIncomeBadge(false), 4000);
      return () => clearTimeout(t);
    }
  }, [loginBonusCoins]);

  useEffect(() => {
    return onSyncStatusChange(setSyncStatus);
  }, []);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night');
  }, []);

  // Reload when the player ID changes (first load) — not on every XP/coin delta
  useEffect(() => { if (player?.id) loadData(); }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    const m = await getTodaysMissions();
    setMissions(m);

    const allT = await getAllTerritories();
    setTerritories(allT);
    if (player) setOwnedCount(allT.filter(t => t.ownerId === player.id).length);

    const settings = await getSettings();
    setWeeklyGoal(settings.weeklyGoalKm);

    const now      = Date.now();
    const weekAgo  = now - 7 * 24 * 60 * 60 * 1000;
    const allRuns  = await getRuns(100); // 100 runs is enough for weekly stats + recent list
    const weekRuns = allRuns.filter(r => r.startTime >= weekAgo);
    setWeeklyKm(Math.round(weekRuns.reduce((s, r) => s + r.distanceMeters / 1000, 0) * 10) / 10);

    const todayMon = (new Date().getDay() + 6) % 7;
    const days = Array(7).fill(false);
    weekRuns.forEach(r => {
      const idx = (new Date(r.startTime).getDay() + 6) % 7;
      if (now - r.startTime < (todayMon + 1) * 86_400_000) days[idx] = true;
    });
    setRunDays(days);

    // Calorie data — read from IDB
    try {
      const nutProf     = await getNutritionProfile();
      const todayDate   = localDateString();
      const nutEntries  = await getNutritionEntries(todayDate);
      const consumed    = nutEntries.filter(e => e.source !== 'run').reduce((s, e) => s + e.kcal, 0);
      setCaloriesConsumed(Math.max(0, consumed));
      setCalorieGoal(nutProf?.dailyGoalKcal ?? 2000);
    } catch { /* ignore */ }

    const recent = [...allRuns]
      .filter(r => r.distanceMeters >= 50)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 3);
    setRecentRuns(recent);
  };

  const { avgDefense, weakZones, dailyIncome } = useMemo(() => {
    const owned = territories.filter(t => player && t.ownerId === player.id);
    const avg   = ownedCount > 0 ? Math.round(owned.reduce((s, t) => s + t.defense, 0) / ownedCount) : 0;
    return {
      avgDefense:  avg,
      weakZones:   owned.filter(t => t.defense < 30),
      dailyIncome: 0,
    };
  }, [territories, player, ownedCount]);

  // Use the canonical XP progress from usePlayerStats (respects GAME_CONFIG.LEVEL_XP thresholds)
  const xpPct = xpProgress.percent;

  if (loading || !player) {
    return (
      <div style={{ height: '100%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ fontSize: 22, fontWeight: 300, fontStyle: 'italic', color: T.black, fontFamily: FD }}
        >
          runivo
        </motion.div>
      </div>
    );
  }

  const initials = player.username?.slice(0, 2).toUpperCase() ?? 'RU';
  const todayIdx = (new Date().getDay() + 6) % 7;
  const pct      = Math.min(weeklyKm / Math.max(weeklyGoal, 1), 1);

  const MISSION_ICONS: Record<string, typeof Check> = {
    run_distance: Target, capture_zones: MapPin, run_in_enemy_zone: MapPin,
    complete_run: Check,  beat_pace: Zap,
  };

  const P = '0 22px';   // horizontal padding
  const GAP = 28;        // gap between sections

  return (
    <div style={{ height: '100%', background: T.bg, overflowY: 'auto', fontFamily: F }}>

      {/* Income toast */}
      <AnimatePresence>
        {showIncomeBadge && (
          <motion.div
            initial={{ y: -56, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -56, opacity: 0 }}
            transition={{ type: 'spring', damping: 22 }}
            style={{ position: 'fixed', left: 16, right: 16, top: 'max(12px,env(safe-area-inset-top))', zIndex: 50, display: 'flex', justifyContent: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 20, background: T.white, border: `0.5px solid ${T.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <Coins size={13} color={T.amber} strokeWidth={1.5} />
              <span style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F }}>Daily bonus: +{loginBonusCoins} coins</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync error chip */}
      <AnimatePresence>
        {(syncStatus === 'error' || syncStatus === 'offline') && (
          <motion.div
            initial={{ y: -56, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -56, opacity: 0 }}
            transition={{ type: 'spring', damping: 22 }}
            style={{ position: 'fixed', left: 16, right: 16, top: 'max(12px,env(safe-area-inset-top))', zIndex: 49, display: 'flex', justifyContent: 'center' }}
          >
            <button
              onClick={() => { haptic('light'); postRunSync(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 20, background: '#FEF3EE', border: '0.5px solid #C45C00', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', cursor: 'pointer' }}
            >
              <Zap size={13} color="#C45C00" strokeWidth={1.5} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#C45C00', fontFamily: F }}>
                {syncStatus === 'offline' ? 'Offline · Tap to retry' : 'Sync pending · Tap to retry'}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ paddingBottom: 100, paddingTop: 'max(0px, env(safe-area-inset-top))' }}>

        {/* ── Header ── */}
        <div style={{ padding: `20px 22px 0` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.t3, fontFamily: F, marginBottom: 4 }}>
                {greeting}
              </div>
              <div style={{ fontSize: 26, fontStyle: 'italic', color: T.black, fontFamily: FD, lineHeight: 1.1 }}>
                {player.username}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NotificationBell variant="light" />
              <AvatarXP initials={initials} xpPct={xpPct} />
            </div>
          </div>

          {/* Currency pills */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: GAP } as React.CSSProperties}>
            {([
              { Icon: Coins, value: player.coins.toLocaleString(),              label: 'coins',  color: '#9E6800' },
              { Icon: Zap,   value: `${player.energy}/${10}`,                   label: 'energy', color: T.red     },
              { Icon: Check, value: String(player.streakDays || 0),             label: 'streak', color: T.red     },
            ] as const).map(({ Icon, value, label, color }) => (
              <motion.button
                key={label} whileTap={{ scale: 0.95 }} onClick={() => haptic('light')}
                style={{
                  flexShrink: 0, height: 34, padding: '0 13px',
                  background: T.white, border: `0.5px solid ${T.border}`,
                  borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                }}
              >
                <Icon size={13} color={color} strokeWidth={1.5} />
                <span style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F }}>{value}</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: T.t3, fontFamily: F }}>{label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Bento ── */}
        <div style={{ padding: '0 16px', marginBottom: GAP }}>

          {/* Row: Leaderboard (left) + Events·Clubs·Feed (right) */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>

            {/* Hero carousel: weekly goal ↔ calorie tracker */}
            <div style={{ flex: 1.15, height: 224, borderRadius: 16, background: T.black, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {/* Slides — fixed height area */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <AnimatePresence initial={false} mode="wait">
                {heroSlide === 0 ? (
                  <motion.div key="goal"
                    initial={{ x: '-100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '-100%', opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{ position: 'absolute', inset: 0, padding: 18, display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#fff', fontFamily: F, marginBottom: 16 }}>Weekly goal</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                      <div style={{ position: 'relative', width: 100, height: 100 }}>
                        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.12)" strokeWidth="5" fill="none" />
                          <motion.circle cx="50" cy="50" r="42" stroke={T.red} strokeWidth="5" strokeLinecap="round" fill="none"
                            strokeDasharray="263.9" initial={{ strokeDashoffset: 263.9 }}
                            animate={{ strokeDashoffset: 263.9 * (1 - pct) }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }} />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 20, fontWeight: 300, color: '#fff', fontFamily: F, letterSpacing: '-0.03em', lineHeight: 1 }}>{weeklyKm.toFixed(1)}</span>
                          <span style={{ fontSize: 8, fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontFamily: F, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: 2 }}>km</span>
                        </div>
                      </div>
                      <div style={{ width: '100%' }}>
                        <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.65)', fontFamily: F, textAlign: 'center', marginBottom: 10 }}>
                          {Math.round(pct * 100)}% of {weeklyGoal} km
                        </div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {Array(7).fill(0).map((_, i) => (
                            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === todayIdx ? T.red : runDays[i] ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.12)' }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button key="cal"
                    initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    onClick={() => { navigate('/calories'); haptic('light'); }}
                    style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                      {/* Flame icon */}
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(249,115,22,0.15)', border: '0.5px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Flame size={26} color="#F97316" strokeWidth={1.5} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', fontFamily: F, lineHeight: 1.2, marginBottom: 6 }}>Track your cal</div>
                        <div style={{ fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.45)', fontFamily: F }}>
                          {caloriesConsumed > 0 ? `${caloriesConsumed} / ${calorieGoal} kcal today` : `Goal: ${calorieGoal} kcal`}
                        </div>
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.28)', fontFamily: F, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Tap to open →</div>
                    </div>
                  </motion.button>
                )}
              </AnimatePresence>
              </div>

              {/* Dot indicators + swipe hint */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 12 }}>
                {[0, 1].map(i => (
                  <button key={i} onClick={() => { setHeroSlide(i); haptic('light'); }}
                    style={{ width: i === heroSlide ? 16 : 5, height: 5, borderRadius: 3, background: i === heroSlide ? T.red : 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', padding: 0, transition: 'width 0.2s' }} />
                ))}
              </div>
            </div>

            {/* Right column: Events · Clubs · Leaderboard */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { Icon: Calendar, name: 'Events',      route: '/events'      },
                { Icon: Users,    name: 'Clubs',       route: '/club'        },
                { Icon: Award,    name: 'Leaderboard', route: '/leaderboard' },
              ] as const).map(({ Icon, name, route }) => (
                <motion.button
                  key={name}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { navigate(route); haptic('light'); }}
                  style={{
                    flex: 1, padding: 15, borderRadius: 14,
                    background: T.stone, border: `0.5px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: T.white, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} color={T.red} strokeWidth={1.5} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F, letterSpacing: '-0.01em' }}>{name}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Start Run — inside bento */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { navigate('/run'); haptic('medium'); }}
            style={{
              width: '100%', background: T.black, border: 'none', borderRadius: 16,
              padding: '14px 16px', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Play size={16} color="#fff" fill="#fff" strokeWidth={1.5} />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', fontFamily: F }}>Tap to begin</div>
                  <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', fontFamily: F, lineHeight: 1.2 }}>Start run</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '5px 11px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap size={11} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
                <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.5)', fontFamily: F }}>1 energy</span>
              </div>
            </div>
          </motion.button>

        </div>

        {/* ── Empire ── */}
        <div style={{ padding: P, marginBottom: weakZones.length > 0 ? 0 : GAP }}>
          <SectionTitle label="Empire" action="View map →" onAction={() => { navigate('/territory-map'); haptic('light'); }} />
          <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: T.mid }}>
              {[
                { value: String(ownedCount),       label: 'Zones owned',  color: T.black },
                { value: `${avgDefense}%`,          label: 'Avg defense',  color: T.black },
                { value: `+${dailyIncome}`,         label: 'Daily income', color: T.black },
                { value: String(weakZones.length),  label: 'Weak zones',   color: weakZones.length > 0 ? T.red : T.black },
              ].map((stat, i) => (
                <div key={i} style={{ background: T.white, padding: '16px 20px' }}>
                  <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-0.03em', color: stat.color, fontFamily: F, lineHeight: 1, marginBottom: 4 }}>{stat.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.t3, fontFamily: F }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weak zones alert */}
        {weakZones.length > 0 && (
          <div style={{ padding: P, marginBottom: GAP, marginTop: 10 }}>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { navigate('/territory-map'); haptic('medium'); }}
              style={{
                width: '100%', background: T.amberLo, border: `0.5px solid ${T.amberBo}`,
                borderRadius: 14, padding: '12px 18px',
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ width: 3, height: 28, background: T.amber, borderRadius: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#7A5200', fontFamily: F }}>{weakZones.length} zones need defending</div>
                <div style={{ fontSize: 10, fontWeight: 300, color: T.amber, fontFamily: F, marginTop: 2 }}>Tap to reinforce →</div>
              </div>
            </motion.button>
          </div>
        )}

        {/* ── Missions ── */}
        <div style={{ padding: P, marginBottom: GAP }}>
          <SectionTitle label="Missions" action="Change →" onAction={() => { navigate('/missions'); haptic('light'); }} />
          <div style={{ background: T.black, borderRadius: 20, overflow: 'hidden', padding: '18px 20px' }}>
            {/* Inner label */}
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: F, marginBottom: 14 }}>
              Today's challenge
            </div>

            {missions.length > 0 ? missions.map((m, i) => {
              const Icon = MISSION_ICONS[m.type] ?? Target;
              const bar  = Math.min(m.current / Math.max(m.target, 1), 1);
              return (
                <div key={m.id} style={{ paddingBottom: i < missions.length - 1 ? 14 : 0, marginBottom: i < missions.length - 1 ? 14 : 0, borderBottom: i < missions.length - 1 ? '0.5px solid rgba(255,255,255,0.08)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: m.completed ? 'rgba(26,107,64,0.3)' : 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {m.completed
                      ? <Check size={13} color="#4ADE80" strokeWidth={1.5} />
                      : <Icon  size={13} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 400, color: m.completed ? 'rgba(255,255,255,0.35)' : '#fff', fontFamily: F, textDecoration: m.completed ? 'line-through' : 'none', marginBottom: 8 }}>
                      {m.title}
                    </div>
                    <div style={{ height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ scaleX: 0 }} animate={{ scaleX: bar }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                        style={{ height: '100%', transformOrigin: 'left', background: m.completed ? '#4ADE80' : T.red, borderRadius: 1 }}
                      />
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 400, color: m.completed ? '#4ADE80' : 'rgba(255,255,255,0.45)', fontFamily: F, flexShrink: 0, marginTop: 2 }}>+{m.rewards.xp} XP</span>
                </div>
              );
            }) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 400, color: '#fff', fontFamily: FD, lineHeight: 1.25 }}>
                  No missions set yet.
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => { navigate('/missions'); haptic('light'); }}
                  style={{
                    width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 26, fontWeight: 200, color: '#fff', lineHeight: 1, marginTop: -1 }}>+</span>
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Runs ── */}
        <div style={{ padding: P, marginBottom: GAP }}>
          <SectionTitle label="Recent runs" action="See all →" onAction={() => { navigate('/history'); haptic('light'); }} />
          <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 20, overflow: 'hidden' }}>
            {recentRuns.length > 0 ? recentRuns.map((r, i) => {
              const km        = (r.distanceMeters / 1000).toFixed(2);
              const totalSec  = Math.round(r.durationSec);
              const h         = Math.floor(totalSec / 3600);
              const min       = Math.floor((totalSec % 3600) / 60);
              const durLabel  = h > 0 ? `${h}h ${min}m` : `${min}m`;
              const diff      = Math.floor((Date.now() - r.startTime) / 86_400_000);
              const dateLabel = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : new Date(r.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const type      = r.activityType ?? 'run';
              return (
                <div key={r.id} style={{ padding: '14px 20px', borderBottom: i < recentRuns.length - 1 ? `0.5px solid ${T.mid}` : 'none', display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: T.t2, fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{type}</div>
                    <div style={{ fontSize: 11, fontWeight: 300, color: T.t3, fontFamily: F, marginTop: 2 }}>{dateLabel}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 300, color: T.black, fontFamily: F, letterSpacing: '-0.02em', lineHeight: 1 }}>{km}</div>
                      <div style={{ fontSize: 8, fontWeight: 400, color: T.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>km</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 300, color: T.black, fontFamily: F, letterSpacing: '-0.02em', lineHeight: 1 }}>{durLabel}</div>
                      <div style={{ fontSize: 8, fontWeight: 400, color: T.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>time</div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 300, color: T.t3, fontFamily: F }}>No runs yet</span>
                <button onClick={() => { navigate('/run'); haptic('light'); }} style={{ fontSize: 11, fontWeight: 400, color: T.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}>
                  Start running →
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
