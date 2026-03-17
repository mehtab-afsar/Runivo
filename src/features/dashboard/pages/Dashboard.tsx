import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gem, Zap, Clock, Play, Check, MapPin, Target } from 'lucide-react';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats';
import { getTodaysMissions } from '@features/missions/services/missionStore';
import { getAllTerritories, StoredTerritory, getRuns } from '@shared/services/store';
import { GAME_CONFIG } from '@shared/services/config';
import { Mission } from '@features/missions/services/missions';
import { haptic } from '@shared/lib/haptics';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  bg:          '#F7F6F4',
  surface:     '#FFFFFF',
  surfaceAlt:  '#FAFAF8',
  border:      '#E0DFDD',
  black:       '#0A0A0A',
  text2:       '#7A7A7A',
  text3:       '#ADADAD',
  mid:         '#EBEBEB',
  red:         '#E8391C',
  redLight:    '#FFF1EE',
  green:       '#1A7A4A',
  greenLight:  '#EEF8F3',
  amber:       '#B87A00',
  amberLight:  '#FFF9EE',
  amberBorder: '#E8C97A',
  gold:        '#B8960A',
  silver:      '#8A8A8A',
  bronze:      '#A0622A',
};
const F = "'Barlow', 'DM Sans', sans-serif";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: string }) => (
  <div style={{ padding: '0 22px', marginBottom: 10 }}>
    <span style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.text3, fontFamily: F }}>
      {children}
    </span>
  </div>
);

// ─── Avatar + XP Ring ────────────────────────────────────────────────────────
function AvatarXP({ initials, xpPct }: { initials: string; xpPct: number }) {
  const SZ = 44, SW = 2, R = (SZ - SW) / 2, C = 2 * Math.PI * R;
  return (
    <div style={{ position: 'relative', width: SZ, height: SZ }}>
      <svg width={SZ} height={SZ} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={SZ/2} cy={SZ/2} r={R} fill="none" stroke={T.border} strokeWidth={SW} />
        <motion.circle
          cx={SZ/2} cy={SZ/2} r={R} fill="none"
          stroke={T.red} strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - xpPct / 100) }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: SW + 1, borderRadius: '50%',
        background: T.black,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 500, color: '#FFFFFF', fontFamily: F,
      }}>
        {initials}
      </div>
    </div>
  );
}

// ─── Weekly Goal Ring ─────────────────────────────────────────────────────────
function WeeklyRing({ current, goal }: { current: number; goal: number }) {
  const SZ = 72, SW = 5, R = (SZ - SW) / 2, C = 2 * Math.PI * R;
  const pct = Math.min(current / Math.max(goal, 1), 1);
  return (
    <div style={{ position: 'relative', width: SZ, height: SZ, flexShrink: 0 }}>
      <svg width={SZ} height={SZ} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SZ/2} cy={SZ/2} r={R} fill="none" stroke={T.mid} strokeWidth={SW} />
        <motion.circle
          cx={SZ/2} cy={SZ/2} r={R} fill="none"
          stroke={T.red} strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1,
      }}>
        <span style={{ fontSize: 16, fontWeight: 300, color: T.black, fontFamily: F, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {current.toFixed(1)}
        </span>
        <span style={{ fontSize: 9, fontWeight: 400, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: F }}>
          km
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { player, loading, incomeCollected } = usePlayerStats();
  const [showIncomeBadge, setShowIncomeBadge] = useState(false);
  const [missions,     setMissions]     = useState<Mission[]>([]);
  const [territories,  setTerritories]  = useState<StoredTerritory[]>([]);
  const [ownedCount,   setOwnedCount]   = useState(0);
  const [greeting,     setGreeting]     = useState('Good morning');
  const [weeklyKm,     setWeeklyKm]     = useState(0);
  const [runDays,      setRunDays]      = useState<boolean[]>(Array(7).fill(false));
  const [weeklyGoal]                    = useState(() => Number(localStorage.getItem('runivo-weekly-goal') || 20));

  useEffect(() => {
    if (incomeCollected > 0) {
      setShowIncomeBadge(true);
      const t = setTimeout(() => setShowIncomeBadge(false), 4000);
      return () => clearTimeout(t);
    }
  }, [incomeCollected]);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5)       setGreeting('Good night');
    else if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else if (h < 21) setGreeting('Good evening');
    else             setGreeting('Good night');
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [player]);

  const loadData = async () => {
    const m = await getTodaysMissions();
    setMissions(m);

    const allT = await getAllTerritories();
    setTerritories(allT);
    if (player) setOwnedCount(allT.filter(t => t.ownerId === player.id).length);

    const now     = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const allRuns = await getRuns();
    const weekRuns = allRuns.filter(r => r.startTime >= weekAgo);
    setWeeklyKm(Math.round(weekRuns.reduce((s, r) => s + r.distanceMeters / 1000, 0) * 10) / 10);

    const todayMon = (new Date().getDay() + 6) % 7;
    const days = Array(7).fill(false);
    weekRuns.forEach(r => {
      const idx = (new Date(r.startTime).getDay() + 6) % 7;
      if (now - r.startTime < (todayMon + 1) * 86_400_000) days[idx] = true;
    });
    setRunDays(days);
  };

  const incomePausedDays = useMemo(() => {
    if (!player?.lastRunDate) return null;
    const diff = Math.floor((Date.now() - new Date(player.lastRunDate).getTime()) / 86_400_000);
    return diff >= 2 ? diff : null;
  }, [player]);

  const { missionsCompleted, missionsTotal, avgDefense, weakZones, dailyIncome } = useMemo(() => {
    const owned   = territories.filter(t => player && t.ownerId === player.id);
    const avg     = ownedCount > 0 ? Math.round(owned.reduce((s, t) => s + t.defense, 0) / ownedCount) : 0;
    return {
      missionsCompleted: missions.filter(m => m.completed).length,
      missionsTotal:     missions.length,
      avgDefense:        avg,
      weakZones:         owned.filter(t => t.defense < 30),
      dailyIncome:       ownedCount * GAME_CONFIG.BASE_INCOME_PER_HEX_DAY,
    };
  }, [missions, territories, player, ownedCount]);

  const xpPct = useMemo(() => Math.min(100, (player?.xp ?? 0) % 1000 / 10), [player]);

  if (loading || !player) {
    return (
      <div style={{ height: '100%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ fontSize: 22, fontWeight: 300, fontStyle: 'italic', color: T.black, fontFamily: F, letterSpacing: '-0.02em' }}
        >
          runivo
        </motion.div>
      </div>
    );
  }

  const initials = player.username?.slice(0, 2).toUpperCase() ?? 'RU';
  const todayIdx = (new Date().getDay() + 6) % 7;
  const pct      = Math.min(weeklyKm / Math.max(weeklyGoal, 1), 1);
  const leftKm   = Math.max(0, weeklyGoal - weeklyKm).toFixed(1);

  const LEADERBOARD = [
    { rank: 1,  initials: 'SK', name: 'Sarah K.',  km: '67.4 km', isUser: false },
    { rank: 2,  initials: 'JM', name: 'James M.',  km: '54.1 km', isUser: false },
    { rank: 3,  initials: 'PS', name: 'Priya S.',  km: '51.8 km', isUser: false },
    { rank: 14, initials: initials, name: 'You',   km: `${weeklyKm} km`, isUser: true },
  ];

  const RANK_COLORS: Record<number, string> = { 1: T.gold, 2: T.silver, 3: T.bronze };

  const MISSION_ICONS: Record<string, typeof Check> = {
    run_distance: Target, capture_zones: MapPin, run_in_enemy_zone: MapPin,
    complete_run: Check, beat_pace: Zap,
  };

  return (
    <div style={{ height: '100%', background: T.bg, overflowY: 'auto', fontFamily: F }}>
      <style>{`
        @keyframes startPulse {
          0%,100% { box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
          50%      { box-shadow: 0 8px 32px rgba(0,0,0,0.25); }
        }
      `}</style>

      {/* Income toast */}
      <AnimatePresence>
        {showIncomeBadge && (
          <motion.div
            initial={{ y: -56, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -56, opacity: 0 }}
            transition={{ type: 'spring', damping: 22 }}
            style={{ position: 'fixed', left: 16, right: 16, top: 'max(12px,env(safe-area-inset-top))', zIndex: 50, display: 'flex', justifyContent: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 20, background: T.surface, border: `0.5px solid ${T.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <Coins size={13} color={T.amber} strokeWidth={1.5} />
              <span style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F }}>+{incomeCollected} coins collected</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ paddingBottom: 100 }}>

        {/* ── 2. Header ── */}
        <div style={{ padding: '16px 22px 12px', paddingTop: 'max(16px,env(safe-area-inset-top))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.text3, fontFamily: F, marginBottom: 3 }}>
              {greeting}
            </div>
            <div style={{ fontSize: 22, fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: T.black, fontFamily: F, lineHeight: 1 }}>
              {player.username}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell variant="light" />
            <AvatarXP initials={initials} xpPct={xpPct} />
          </div>
        </div>

        {/* ── 3. Currency Bar ── */}
        <div style={{ padding: '0 22px 16px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[
            { Icon: Coins,  value: player.coins.toLocaleString(), label: 'coins',  iconColor: T.amber },
            { Icon: Gem,    value: String(player.diamonds),        label: 'gems',   iconColor: '#4A6EE8' },
            { Icon: Zap,    value: `${player.energy}/5`,           label: 'energy', iconColor: T.red },
            { Icon: Clock,  value: String(player.streakDays || 0), label: 'streak', iconColor: T.red },
          ].map(({ Icon, value, label, iconColor }) => (
            <motion.button
              key={label}
              whileTap={{ scale: 0.97 }}
              onClick={() => haptic('light')}
              style={{
                flexShrink: 0, height: 32, padding: '0 11px',
                background: T.surface, border: `0.5px solid ${T.border}`,
                borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5,
                cursor: 'pointer',
              }}
            >
              <Icon size={13} color={iconColor} strokeWidth={1.5} />
              <span style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F }}>{value}</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: T.text3, fontFamily: F }}>{label}</span>
            </motion.button>
          ))}
        </div>

        {/* ── 4. Weekly Goal Ring Card ── */}
        <div style={{ margin: '0 16px 16px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 20, padding: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
          <WeeklyRing current={weeklyKm} goal={weeklyGoal} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: T.black, fontFamily: F, marginBottom: 3 }}>Weekly goal</div>
            <div style={{ fontSize: 12, fontWeight: 300, color: T.text2, fontFamily: F, marginBottom: 10 }}>
              {Math.round(pct * 100)}% · {leftKm} km left
            </div>
            {/* Day bars */}
            <div style={{ display: 'flex', gap: 5 }}>
              {['M','T','W','T','F','S','S'].map((_, i) => {
                const done  = runDays[i];
                const today = i === todayIdx;
                const future = i > todayIdx;
                return (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
                    style={{
                      width: 22, height: 4, borderRadius: 2,
                      background: today ? T.red : done ? T.black : future ? T.mid : T.mid,
                      transformOrigin: 'bottom',
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} style={{ width: 22, textAlign: 'center', fontSize: 8, fontWeight: 400, color: i === todayIdx ? T.red : T.text3, fontFamily: F }}>
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Passive income warning ── */}
        {incomePausedDays !== null && (
          <div style={{
            margin: '0 16px 16px',
            background: T.amberLight, borderLeft: `3px solid ${T.amber}`,
            borderRadius: 12, padding: '11px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#7A5200', fontFamily: F }}>
                Your empire is weakening — run today
              </div>
              <div style={{ fontSize: 11, fontWeight: 300, color: T.amber, fontFamily: F, marginTop: 2 }}>
                Last run: {incomePausedDays} day{incomePausedDays !== 1 ? 's' : ''} ago
              </div>
            </div>
            <button
              onClick={() => { navigate('/run'); haptic('medium'); }}
              style={{ fontSize: 11, fontWeight: 500, color: T.amber, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, whiteSpace: 'nowrap' }}
            >
              Run now →
            </button>
          </div>
        )}

        {/* ── 5. Start Run Button ── */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { navigate('/run'); haptic('medium'); }}
          style={{
            margin: '0 16px 16px', width: 'calc(100% - 32px)',
            background: T.black, borderRadius: 14, padding: '18px 22px', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', animation: 'startPulse 2s ease-in-out infinite',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Play size={16} color="#FFFFFF" strokeWidth={1.5} fill="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontFamily: F }}>
                Tap to begin
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, color: '#FFFFFF', letterSpacing: '0.01em', fontFamily: F, lineHeight: 1.2 }}>
                Start run
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
            <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.7)', fontFamily: F }}>1 energy</span>
          </div>
        </motion.button>

        {/* ── 6. Empire Overview ── */}
        <SectionLabel>Your empire</SectionLabel>
        <div style={{ margin: '0 16px 16px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 20, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 18px 10px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F }}>Overview</span>
            <button
              onClick={() => { navigate('/territory-map'); haptic('light'); }}
              style={{ fontSize: 11, fontWeight: 400, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}
            >
              View map →
            </button>
          </div>
          {/* 2×2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {[
              { value: String(ownedCount),  label: 'Zones owned',  color: T.black },
              { value: `${avgDefense}%`,    label: 'Avg defense',  color: T.black },
              { value: `+${dailyIncome}`,   label: 'Daily income', color: T.black },
              { value: String(weakZones.length), label: 'Weak zones', color: weakZones.length > 0 ? T.red : T.black },
            ].map((stat, i) => (
              <div key={i} style={{
                padding: '12px 18px',
                borderRight:  i % 2 === 0 ? `0.5px solid ${T.border}` : 'none',
                borderBottom: i < 2       ? `0.5px solid ${T.border}` : 'none',
              }}>
                <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: '-0.02em', color: stat.color, fontFamily: F, lineHeight: 1, marginBottom: 4 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.text3, fontFamily: F }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 8. Weak zones alert ── */}
        {weakZones.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { navigate('/territory-map'); haptic('medium'); }}
            style={{
              margin: '0 16px 16px', width: 'calc(100% - 32px)',
              background: T.amberLight, border: `0.5px solid ${T.amberBorder}`,
              borderRadius: 12, padding: '11px 14px',
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            }}
          >
            <div style={{ width: 3, height: 32, background: T.amber, borderRadius: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#7A5200', fontFamily: F }}>
                {weakZones.length} zones need defending
              </div>
              <div style={{ fontSize: 11, fontWeight: 300, color: T.amber, fontFamily: F, marginTop: 2 }}>
                Tap to reinforce →
              </div>
            </div>
          </motion.button>
        )}

        {/* ── 9. Daily Missions ── */}
        <SectionLabel>Missions</SectionLabel>
        <div style={{ margin: '0 16px 16px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F }}>Today</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {missionsTotal > 0 && (
                <div style={{ padding: '3px 9px', borderRadius: 20, background: T.greenLight, fontSize: 10, fontWeight: 500, color: T.green, fontFamily: F }}>
                  {missionsCompleted} / {missionsTotal} done
                </div>
              )}
              <button
                onClick={() => { navigate('/missions'); haptic('light'); }}
                style={{ fontSize: 11, fontWeight: 400, color: T.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}
              >
                Change →
              </button>
            </div>
          </div>

          {missions.length > 0 ? missions.map((m, i) => {
            const Icon = MISSION_ICONS[m.type] ?? Target;
            const bar  = Math.min(m.current / Math.max(m.target, 1), 1);
            return (
              <div key={m.id} style={{ padding: '12px 18px', borderBottom: i < missions.length - 1 ? `0.5px solid ${T.border}` : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: m.completed ? T.greenLight : '#F7F6F4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {m.completed
                    ? <Check size={14} color={T.green} strokeWidth={1.5} />
                    : <Icon size={14} color={T.black} strokeWidth={1.5} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 400, color: m.completed ? T.text3 : T.black, fontFamily: F, textDecoration: m.completed ? 'line-through' : 'none', marginBottom: 5 }}>
                    {m.title}
                  </div>
                  <div style={{ height: 2, background: T.mid, borderRadius: 1, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: bar }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                      style={{ height: '100%', transformOrigin: 'left', background: m.completed ? T.green : T.black, borderRadius: 1 }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: T.text2, fontFamily: F, flexShrink: 0, marginTop: 2 }}>+{m.rewards.xp} XP</span>
              </div>
            );
          }) : (
            <button
              onClick={() => { navigate('/missions'); haptic('light'); }}
              style={{ width: '100%', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F7F6F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={14} color={T.text3} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F }}>No missions set</div>
                <div style={{ fontSize: 12, fontWeight: 300, color: T.text2, fontFamily: F, marginTop: 2 }}>Pick today's challenge</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 400, color: T.red, fontFamily: F, flexShrink: 0 }}>Choose missions →</span>
            </button>
          )}
        </div>

        {/* ── 10. Leaderboard ── */}
        <SectionLabel>Leaderboard</SectionLabel>
        <div style={{ margin: '0 16px 24px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F }}>Top runners</span>
            <button
              onClick={() => { navigate('/leaderboard'); haptic('light'); }}
              style={{ fontSize: 11, fontWeight: 400, color: T.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}
            >
              See all →
            </button>
          </div>
          {LEADERBOARD.map((row, i) => (
            <div key={i} style={{
              padding: '11px 18px',
              background: row.isUser ? T.surfaceAlt : T.surface,
              borderBottom: i < LEADERBOARD.length - 1 ? `0.5px solid ${T.border}` : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ width: 18, fontSize: 13, fontWeight: 500, color: RANK_COLORS[row.rank] ?? T.black, fontFamily: F, textAlign: 'center', flexShrink: 0 }}>
                {row.rank}
              </span>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: row.isUser ? T.black : '#F7F6F4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 500,
                color: row.isUser ? '#FFFFFF' : T.text2, fontFamily: F,
              }}>
                {row.initials}
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: row.isUser ? 500 : 400, color: T.black, fontFamily: F }}>
                {row.name}
              </span>
              <span style={{ fontSize: 13, fontWeight: 300, color: T.text2, letterSpacing: '-0.01em', fontFamily: F }}>
                {row.km}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
