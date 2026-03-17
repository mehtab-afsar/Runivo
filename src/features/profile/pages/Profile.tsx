import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Play, TrendingUp, Star, Globe, Navigation, Shield, Lock, Award,
  Zap, Flame, ArrowUp, AlertTriangle,
  Calendar, Check, Map as MapIcon, Gem, Settings,
} from 'lucide-react';
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats';
import { calculatePersonalRecords, PersonalRecord } from '@shared/services/personalRecords';
import { getRuns, StoredRun } from '@shared/services/store';
import { haptic } from '@shared/lib/haptics';
import { soundManager } from '@shared/audio/sounds';

type ProfileTab = 'overview' | 'stats' | 'awards';

// ─── Design tokens ────────────────────────────────────────────────────────────
const F  = "'Barlow', 'DM Sans', -apple-system, sans-serif";
const FD = "'Playfair Display', Georgia, serif";
const C = {
  ink:    '#0A0A0A',
  mid:    '#6B6B6B',
  muted:  '#ADADAD',
  border: '#DDD9D4',
  hair:   '#E8E4DF',
  surf:   '#F8F6F3',
  warm:   '#F0EDE8',
  pr:     '#FDF6E8',
  prText: '#9E6800',
  red:    '#D93518',
  bg:     '#FAFAF8',
};

// ─── AI color tokens ──────────────────────────────────────────────────────────
const AI = { accent: '#5A3A8A', tint: '#F2EEF9' } as const;

// ─── Avatar swatch colors ─────────────────────────────────────────────────────
const SWATCHES = ['#0A0A0A', '#E8435A', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmtMinsec = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const RING_R    = 34;
const RING_CIRC = 2 * Math.PI * RING_R;


export default function Profile() {
  const navigate = useNavigate();
  const { player, loading, xpProgress } = usePlayerStats();
  const [tab, setTab]       = useState<ProfileTab>('overview');
  const [prs, setPrs]       = useState<PersonalRecord[]>([]);
  const [allRuns, setAllRuns] = useState<StoredRun[]>([]);
  const [lockedId, setLockedId] = useState<string | null>(null);

  // Edit profile state
  const [editOpen, setEditOpen] = useState(false);
  const [avatarColor, setAvatarColor] = useState(() => localStorage.getItem('runivo-avatar-color') || SWATCHES[0]);
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('runivo-display-name') || '');
  const [bio, setBio] = useState(() => localStorage.getItem('runivo-bio') || 'Running to conquer every street 🏃');
  const [loc, setLoc] = useState(() => localStorage.getItem('runivo-location') || '');
  const [strava, setStrava] = useState(() => localStorage.getItem('runivo-strava') || '');
  const [instagram, setInstagram] = useState(() => localStorage.getItem('runivo-instagram') || '');
  const [privacy, setPrivacy] = useState<boolean>(() => (localStorage.getItem('runivo-privacy') || 'true') === 'true');
  const bioRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    calculatePersonalRecords().then(setPrs);
    getRuns(500).then(setAllRuns);
  }, []);

  // ── All hooks BEFORE any early return ─────────────────────────────────────
  const weeklyGoalKm = parseInt(localStorage.getItem('runivo-weekly-goal') || '30', 10);

  const thisWeekKm = useMemo(() => {
    const now = new Date();
    const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - todayIdx);
    weekStart.setHours(0, 0, 0, 0);
    return allRuns
      .filter(r => r.startTime >= weekStart.getTime())
      .reduce((s, r) => s + r.distanceMeters / 1000, 0);
  }, [allRuns]);

  const goalPct = Math.min(1, weeklyGoalKm > 0 ? thisWeekKm / weeklyGoalKm : 0);

  const weekDayBars = useMemo(() => {
    const now = new Date();
    const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - todayIdx);
    weekStart.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const ds = new Date(weekStart); ds.setDate(weekStart.getDate() + i);
      const de = new Date(ds); de.setHours(23, 59, 59, 999);
      const hasRun = allRuns.some(r => r.startTime >= ds.getTime() && r.startTime <= de.getTime());
      return { hasRun, isToday: i === todayIdx, isPast: i < todayIdx };
    });
  }, [allRuns]);

  const avgPaceSec = useMemo(() => {
    const p = prs.find(r => r.type === 'fastest_pace');
    return p ? p.value : 0;
  }, [prs]);

  const prRows = useMemo(() => {
    const find = (t: PersonalRecord['type']) => prs.find(r => r.type === t);
    const rows: { label: string; value: string; unit: string; isPR?: boolean }[] = [];
    const k1 = find('fastest_1k');
    if (k1) rows.push({ label: '1 km',      value: fmtMinsec(k1.value),    unit: 'min',    isPR: true });
    const k5 = find('fastest_5k');
    if (k5) rows.push({ label: '5 km',      value: fmtMinsec(k5.value),    unit: 'min'    });
    const k10 = find('fastest_10k');
    if (k10) rows.push({ label: '10 km',    value: fmtMinsec(k10.value),   unit: 'min'    });
    const lng = find('longest_run');
    if (lng) rows.push({ label: 'Longest',  value: lng.value.toFixed(1),   unit: 'km'     });
    const pc = find('fastest_pace');
    if (pc)  rows.push({ label: 'Best pace',value: fmtMinsec(pc.value),    unit: 'min/km' });
    return rows;
  }, [prs]);

  const longestKm = useMemo(() => prs.find(r => r.type === 'longest_run')?.value ?? 0, [prs]);


  // ── Weekly bar chart (Stats tab) ──────────────────────────────────────────
  const weeklyBars = useMemo(() => {
    const now = new Date();
    const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    return Array.from({ length: 8 }, (_, i) => {
      const wi = 7 - i;
      const ws = new Date(now); ws.setDate(now.getDate() - todayIdx - wi * 7); ws.setHours(0, 0, 0, 0);
      const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23, 59, 59, 999);
      const km = allRuns.filter(r => r.startTime >= ws.getTime() && r.startTime <= we.getTime())
        .reduce((s, r) => s + r.distanceMeters / 1000, 0);
      return { km, isCurrent: wi === 0, label: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    });
  }, [allRuns]);
  const maxBarKm = Math.max(...weeklyBars.map(b => b.km), 1);

  // ── Pace trend (last 7d vs prior 14d) ─────────────────────────────────────
  const paceTrendData = useMemo(() => {
    const now = Date.now();
    const valid = (r: StoredRun) => r.distanceMeters > 500 && r.durationSec > 30;
    const last7  = allRuns.filter(r => r.startTime >= now - 7  * 86400000 && valid(r));
    const prev14 = allRuns.filter(r => r.startTime >= now - 21 * 86400000 && r.startTime < now - 7 * 86400000 && valid(r));
    const avg = (runs: StoredRun[]) =>
      runs.length === 0 ? 0 : runs.reduce((s, r) => s + r.durationSec / (r.distanceMeters / 1000), 0) / runs.length;
    const recent = avg(last7);
    const prior  = avg(prev14);
    const pct = (prior > 0 && recent > 0) ? Math.round(((prior - recent) / prior) * 100) : 0;
    return { recent, prior, pctChange: Math.abs(pct), improved: pct > 0 };
  }, [allRuns]);

  // ── Pace zone distribution ────────────────────────────────────────────────
  const paceZonesData = useMemo(() => {
    const valid = allRuns.filter(r => r.distanceMeters > 1000 && r.durationSec > 60);
    const counts = [0, 0, 0, 0];
    valid.forEach(r => {
      const p = r.durationSec / (r.distanceMeters / 1000);
      if (p >= 390) counts[0]++;
      else if (p >= 330) counts[1]++;
      else if (p >= 285) counts[2]++;
      else counts[3]++;
    });
    const total = Math.max(1, counts.reduce((a, b) => a + b, 0));
    const hasData = valid.length > 0;
    const def = [20, 45, 25, 10];
    return [
      { label: 'Easy',     pct: hasData ? Math.round(counts[0] / total * 100) : def[0], color: '#C8C4BE' },
      { label: 'Moderate', pct: hasData ? Math.round(counts[1] / total * 100) : def[1], color: '#888780' },
      { label: 'Tempo',    pct: hasData ? Math.round(counts[2] / total * 100) : def[2], color: '#0A0A0A' },
      { label: 'Hard',     pct: hasData ? Math.round(counts[3] / total * 100) : def[3], color: '#D93518' },
    ];
  }, [allRuns]);

  // ── AI Race predictions (Riegel formula from best 5K equiv) ───────────────
  const racePredictionsData = useMemo(() => {
    const fmtT = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.round(s % 60);
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      return `${m}:${String(sec).padStart(2, '0')}`;
    };
    const pr5k = prs.find(r => r.type === 'fastest_5k');
    const baseT = pr5k ? pr5k.value : (avgPaceSec > 0 ? avgPaceSec * 5 : 360 * 5);
    const riegel = (t: number, d2: number) => t * Math.pow(d2 / 5, 1.06);
    return [
      { dist: '5K',            time: fmtT(baseT),               unit: 'min:sec',     delta: pr5k ? 'Personal best' : 'Projected', style: pr5k ? 'green' : 'purple' as const },
      { dist: '10K',           time: fmtT(riegel(baseT, 10)),   unit: 'min:sec',     delta: 'Projected', style: 'purple' as const },
      { dist: 'Half marathon', time: fmtT(riegel(baseT, 21.1)), unit: 'hr:min:sec',  delta: 'Projected', style: 'purple' as const },
      { dist: 'Marathon',      time: fmtT(riegel(baseT, 42.2)), unit: 'hr:min:sec',  delta: 'Projected', style: 'purple' as const },
    ];
  }, [prs, avgPaceSec]);

  // ── Early return after ALL hooks ──────────────────────────────────────────
  if (loading || !player) {
    return (
      <div style={{ height: '100%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: C.ink }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Derived data (player guaranteed non-null here) ─────────────────────────
  const initials = player.username.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const name     = displayName || player.username;
  const handle   = `@${player.username.toLowerCase().replace(/\s+/g, '_')} · Lv. ${player.level}`;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleShare = () => {
    haptic('light');
    const text = `${name} on Runivo — ${player.totalDistanceKm.toFixed(0)} km · ${player.totalTerritoriesClaimed} zones · Lv. ${player.level}`;
    if (navigator.share) {
      navigator.share({ title: 'My Runivo Profile', text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  };

  const saveEdit = () => {
    localStorage.setItem('runivo-avatar-color', avatarColor);
    localStorage.setItem('runivo-display-name', displayName);
    localStorage.setItem('runivo-bio', bio);
    localStorage.setItem('runivo-location', loc);
    localStorage.setItem('runivo-strava', strava);
    localStorage.setItem('runivo-instagram', instagram);
    localStorage.setItem('runivo-privacy', String(privacy));
    haptic('success');
    soundManager.play('tap');
    setEditOpen(false);
  };

  // ── AI coach derived content ──────────────────────────────────────────────
  const aiQuote = (() => {
    if (paceTrendData.improved && paceTrendData.pctChange >= 5)
      return `Your pace has improved ${paceTrendData.pctChange}% over the last 3 weeks. You're ready to target a new personal best this month.`;
    if (player.totalTerritoriesClaimed >= 20)
      return `${player.totalTerritoriesClaimed} zones conquered. Your territory strategy is paying off — now let's sharpen pace to match.`;
    if (player.streakDays >= 7)
      return `${player.streakDays}-day streak. Consistency like this builds real endurance. Keep easy effort to protect the streak.`;
    if (player.totalRuns >= 10)
      return `${player.totalRuns} runs in the bank. Your aerobic base is forming — add one tempo run weekly to accelerate progress.`;
    return `Every run builds the foundation. Stay consistent and your pace will follow. You're trending in the right direction.`;
  })();

  const aiContextTags: string[] = [
    paceTrendData.improved ? 'Pace trending up' : 'Pace steady',
    player.streakDays >= 5 ? 'Overtraining risk' : player.streakDays >= 3 ? 'Recovery good' : 'Build streak',
    player.totalTerritoriesClaimed > 5 ? 'Territory aggressive' : 'Territory explorer',
  ];

  const aiInsights: Array<{ icon: typeof TrendingUp; title: string; desc: string; chip: { label: string; style: 'green' | 'amber' | 'purple' } }> = [
    {
      icon: TrendingUp,
      title: paceTrendData.improved ? 'Pace improvement detected' : 'Consistent pacing',
      desc: paceTrendData.improved && paceTrendData.pctChange > 0
        ? `Avg pace improved ${paceTrendData.pctChange}% over the last 3 weeks — a consistent, sustainable gain.`
        : `Your pace is holding steady. Adding one weekly tempo run will spark the next level of improvement.`,
      chip: { label: paceTrendData.improved ? `+${paceTrendData.pctChange}% pace` : 'Steady pace', style: paceTrendData.improved ? 'green' : 'amber' },
    },
    {
      icon: Shield,
      title: 'Optimal territory window',
      desc: player.totalTerritoriesClaimed > 0
        ? `Morning runs capture zones most efficiently. ${Math.max(0, 10 - (player.totalTerritoriesClaimed % 10))} zones to your next territory milestone.`
        : `Start claiming zones during runs to build territory. Early morning routes capture 3× more unclaimed ground.`,
      chip: { label: player.totalTerritoriesClaimed > 0 ? `${player.totalTerritoriesClaimed} zones held` : 'Zones ready', style: 'purple' },
    },
    {
      icon: Zap,
      title: player.streakDays >= 5 ? 'Recovery gap noticed' : 'Build your streak',
      desc: player.streakDays >= 5
        ? `You've run ${player.streakDays} days straight. A rest day tomorrow will improve Sunday's performance by ~4%.`
        : `${Math.max(0, 3 - player.streakDays)} more day${player.streakDays >= 2 ? '' : 's'} to a 3-day streak. Daily consistency builds aerobic base faster than long gaps.`,
      chip: { label: player.streakDays >= 5 ? 'Rest recommended' : 'Keep going', style: player.streakDays >= 5 ? 'amber' : 'green' },
    },
  ];


  const SectionLabel = ({ children }: { children: string }) => (
    <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, fontFamily: F, marginBottom: 12 }}>
      {children}
    </p>
  );

  // ── Stats cell data ───────────────────────────────────────────────────────
  const statCells = [
    { value: player.totalDistanceKm >= 1000 ? (player.totalDistanceKm / 1000).toFixed(1) + 'k' : player.totalDistanceKm.toFixed(0), label: 'Total km',   sub: 'All time'       },
    { value: String(player.totalRuns),                                                                                                label: 'Runs',       sub: 'Since you joined' },
    { value: avgPaceSec > 0 ? fmtMinsec(avgPaceSec) : '–',                                                                          label: 'Avg pace',   sub: 'min/km'         },
    { value: thisWeekKm.toFixed(1),                                                                                                   label: 'This week',  sub: `of ${weeklyGoalKm} km goal` },
  ];

  // ── Awards sections data ──────────────────────────────────────────────────
  const awardSections: Array<{
    title: string;
    items: Array<{ key: string; label: string; Icon: typeof Navigation; earned: boolean; progress: number; progressLabel: string }>;
  }> = [
    {
      title: 'Running',
      items: [
        { key: 'first_run',   label: 'First Steps',  Icon: Play,       earned: player.totalRuns >= 1,                  progress: Math.min(1, player.totalRuns),             progressLabel: `${player.totalRuns} / 1 run` },
        { key: '5k_club',     label: '5K Club',       Icon: TrendingUp, earned: longestKm >= 5,                         progress: Math.min(1, longestKm / 5),                progressLabel: `${longestKm.toFixed(1)} / 5 km` },
        { key: '10k_warrior', label: '10K Warrior',   Icon: Star,       earned: longestKm >= 10,                        progress: Math.min(1, longestKm / 10),               progressLabel: `${longestKm.toFixed(1)} / 10 km` },
        { key: '50k',         label: '50K Explorer',  Icon: Globe,      earned: player.totalDistanceKm >= 50,           progress: Math.min(1, player.totalDistanceKm / 50), progressLabel: `${player.totalDistanceKm.toFixed(0)} / 50 km` },
      ],
    },
    {
      title: 'Streaks',
      items: [
        { key: 'streak_3',  label: 'On Fire',       Icon: Zap,      earned: player.streakDays >= 3,  progress: Math.min(1, player.streakDays / 3),  progressLabel: `${player.streakDays} / 3 days` },
        { key: 'streak_7',  label: 'Week Warrior',  Icon: Calendar, earned: player.streakDays >= 7,  progress: Math.min(1, player.streakDays / 7),  progressLabel: `${player.streakDays} / 7 days` },
        { key: 'streak_30', label: 'Monthly Grind', Icon: Lock,     earned: player.streakDays >= 30, progress: Math.min(1, player.streakDays / 30), progressLabel: `${player.streakDays} / 30 days` },
      ],
    },
    {
      title: 'Territory',
      items: [
        { key: 'first_zone', label: 'Zone Claimer', Icon: Navigation, earned: player.totalTerritoriesClaimed >= 1,  progress: Math.min(1, player.totalTerritoriesClaimed),      progressLabel: `${player.totalTerritoriesClaimed} / 1 zone` },
        { key: 'zones_10',   label: 'Map Maker',    Icon: MapIcon,    earned: player.totalTerritoriesClaimed >= 10, progress: Math.min(1, player.totalTerritoriesClaimed / 10), progressLabel: `${player.totalTerritoriesClaimed} / 10 zones` },
        { key: 'zones_50',   label: 'Conqueror',    Icon: Shield,     earned: player.totalTerritoriesClaimed >= 50, progress: Math.min(1, player.totalTerritoriesClaimed / 50), progressLabel: `${player.totalTerritoriesClaimed} / 50 zones` },
      ],
    },
    {
      title: 'Levels',
      items: [
        { key: 'level_5',  label: 'Rising Star', Icon: Star,  earned: player.level >= 5,  progress: Math.min(1, player.level / 5),  progressLabel: `Lv. ${player.level} / 5` },
        { key: 'level_10', label: 'Veteran',     Icon: Award, earned: player.level >= 10, progress: Math.min(1, player.level / 10), progressLabel: `Lv. ${player.level} / 10` },
      ],
    },
  ];
  const allAwardItems = awardSections.flatMap(s => s.items);
  const totalAwardUnlocked = allAwardItems.filter(a => a.earned).length;
  const totalAwardItems = allAwardItems.length;
  const awardRingPct = totalAwardItems > 0 ? totalAwardUnlocked / totalAwardItems : 0;
  const AWARD_RING_R = 20, AWARD_RING_CIRC = 2 * Math.PI * AWARD_RING_R;

  return (
    <div style={{ height: '100%', background: C.bg, overflowY: 'auto', paddingBottom: 96 }}>
      <style>{`
        @keyframes awardShake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-3px)}
          40%{transform:translateX(3px)}
          60%{transform:translateX(-3px)}
          80%{transform:translateX(3px)}
        }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        padding: '20px 20px 0',
        borderBottom: `0.5px solid ${C.border}`,
        paddingTop: 'max(20px, env(safe-area-inset-top))',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          {/* Avatar + XP ring */}
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 20, fontFamily: F, fontWeight: 300, color: '#fff', letterSpacing: '0.02em' }}>
                {initials}
              </span>
            </div>
            <svg width={72} height={72} viewBox="0 0 72 72" fill="none"
              style={{ position: 'absolute', top: -4, left: -4, transform: 'rotate(-90deg)' }}>
              <circle cx={36} cy={36} r={RING_R} stroke={C.hair} strokeWidth={2} />
              <motion.circle
                cx={36} cy={36} r={RING_R}
                stroke={C.ink}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                initial={{ strokeDashoffset: RING_CIRC }}
                animate={{ strokeDashoffset: RING_CIRC * (1 - xpProgress.percent / 100) }}
                transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
              />
            </svg>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <button onClick={handleShare} style={{
              padding: '7px 14px', borderRadius: 3, background: C.surf,
              border: `0.5px solid ${C.border}`, fontFamily: F,
              fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
              letterSpacing: '0.04em', color: C.mid, cursor: 'pointer',
            }}>Share</button>
            <button onClick={() => { setEditOpen(true); haptic('light'); }} style={{
              padding: '7px 14px', borderRadius: 3, background: C.ink,
              border: `0.5px solid ${C.ink}`, fontFamily: F,
              fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
              letterSpacing: '0.04em', color: '#fff', cursor: 'pointer',
            }}>Edit</button>
            <button onClick={() => { navigate('/settings'); haptic('light'); }} style={{
              width: 30, height: 30, borderRadius: 3, background: C.surf,
              border: `0.5px solid ${C.border}`, display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Settings size={14} color={C.mid} />
            </button>
          </div>
        </div>

        {/* Info block */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 24, color: C.ink, letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 4 }}>
            {name}
          </p>
          <p style={{ fontFamily: F, fontWeight: 300, fontSize: 12, color: C.muted, marginBottom: 6, letterSpacing: '0.01em' }}>
            {handle}
          </p>
          <p style={{ fontFamily: F, fontWeight: 300, fontSize: 12, color: C.mid, lineHeight: 1.6, marginBottom: 10 }}>
            {bio}
          </p>
          {loc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={10} stroke={C.muted} strokeWidth={1.5} fill="none" />
              <span style={{ fontFamily: F, fontWeight: 300, fontSize: 11, color: C.muted }}>{loc}</span>
            </div>
          )}
        </div>

        {/* Level progress row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 2, background: C.ink, color: '#fff',
            fontFamily: F, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Lv. {player.level}</span>
          <div style={{ flex: 1, height: 3, background: C.hair, borderRadius: 2, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress.percent}%` }}
              transition={{ duration: 1, delay: 0.4 }}
              style={{ height: '100%', background: C.ink, borderRadius: 2 }}
            />
          </div>
          <span style={{ fontFamily: F, fontWeight: 300, fontSize: 10, color: C.muted, whiteSpace: 'nowrap' }}>
            {Math.round(xpProgress.percent)}% → Lv. {player.level + 1}
          </span>
        </div>

        {/* Social stats row */}
        <div style={{ display: 'flex', borderTop: `0.5px solid ${C.hair}` }}>
          {[
            { value: '0',                                    label: 'Followers' },
            { value: '0',                                    label: 'Following' },
            { value: String(player.totalTerritoriesClaimed), label: 'Zones'     },
            { value: String(player.streakDays),              label: 'Streak'    },
          ].map((s, i, arr) => (
            <div key={s.label} style={{
              flex: 1, textAlign: 'center', padding: '10px 0',
              borderRight: i < arr.length - 1 ? `0.5px solid ${C.hair}` : 'none',
            }}>
              <p style={{ fontFamily: F, fontWeight: 300, fontSize: 16, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1, marginBottom: 2 }}>{s.value}</p>
              <p style={{ fontFamily: F, fontWeight: 400, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: `0.5px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
        {(['overview', 'stats', 'awards'] as ProfileTab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); haptic('light'); }}
            style={{
              flex: 1, textAlign: 'center', padding: '11px 0',
              fontFamily: F, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
              fontWeight: tab === t ? 500 : 400,
              color: tab === t ? C.ink : C.muted,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `1.5px solid ${tab === t ? C.ink : 'transparent'}`,
              outline: 'none',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >

          {/* ═══ OVERVIEW ═══ */}
          {tab === 'overview' && (
            <>
              {/* Stats 2×2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.hair, marginBottom: 1 }}>
                {statCells.map(s => (
                  <div key={s.label} style={{ background: '#fff', padding: '14px 18px' }}>
                    <p style={{ fontFamily: F, fontWeight: 300, fontSize: 22, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1, marginBottom: 3 }}>{s.value}</p>
                    <p style={{ fontFamily: F, fontWeight: 400, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{s.label}</p>
                    <p style={{ fontFamily: F, fontWeight: 300, fontSize: 10, color: C.muted, marginTop: 2 }}>{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Weekly goal */}
              <div style={{ background: '#fff', padding: '16px 18px', marginBottom: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span style={{ fontFamily: F, fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.ink }}>This week</span>
                  <span style={{ fontFamily: F, fontWeight: 300, fontSize: 11, color: C.muted }}>
                    {thisWeekKm.toFixed(1)} / {weeklyGoalKm} km
                  </span>
                </div>
                <div style={{ height: 3, background: C.hair, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${goalPct * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    style={{ height: '100%', background: goalPct >= 1 ? '#1A6B40' : C.ink, borderRadius: 2 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['M','T','W','T','F','S','S'].map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: '100%', height: 3, borderRadius: 2,
                        background: weekDayBars[i]?.isToday ? C.red : weekDayBars[i]?.hasRun ? C.ink : C.hair,
                      }} />
                      <span style={{ fontFamily: F, fontSize: 8, fontWeight: 400, color: weekDayBars[i]?.isToday ? C.red : C.muted }}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent runs */}
              {allRuns.length > 0 ? (
                <div style={{ background: '#fff', padding: '14px 18px', marginBottom: 1 }}>
                  <SectionLabel>Recent runs</SectionLabel>
                  {allRuns.slice(0, 3).map((r, i) => {
                    const distKm = (r.distanceMeters / 1000).toFixed(2);
                    const date = new Date(r.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 0',
                        borderBottom: i < Math.min(allRuns.length, 3) - 1 ? `0.5px solid ${C.hair}` : 'none',
                      }}>
                        <div>
                          <p style={{ fontFamily: F, fontWeight: 400, fontSize: 12, color: C.ink, marginBottom: 2 }}>{distKm} km</p>
                          <p style={{ fontFamily: F, fontWeight: 300, fontSize: 10, color: C.muted }}>{date}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontFamily: F, fontWeight: 300, fontSize: 12, color: C.mid }}>{r.avgPace}</p>
                          <p style={{ fontFamily: F, fontWeight: 300, fontSize: 10, color: C.muted }}>min/km</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ background: '#fff', padding: '32px 18px', marginBottom: 1, textAlign: 'center' }}>
                  <p style={{ fontFamily: F, fontWeight: 300, fontSize: 13, color: C.muted }}>No runs yet — go capture some territory</p>
                </div>
              )}
            </>
          )}

          {/* ═══ STATS ═══ */}
          {tab === 'stats' && (
            <>
              {/* ── 1. AI Coach Hero ── */}
              <div style={{ background: C.ink, padding: 18, marginBottom: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: AI.accent, flexShrink: 0 }} />
                  <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)' }}>AI coach · updated today</span>
                </div>
                <p style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 16, color: '#fff', lineHeight: 1.5, marginBottom: 14 }}>
                  {aiQuote}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {aiContextTags.map(tag => (
                    <span key={tag} style={{ padding: '3px 9px', borderRadius: 2, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)', fontFamily: F, fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── 2. Stats 2×2 ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.hair, marginBottom: 1 }}>
                {statCells.map(s => (
                  <div key={s.label} style={{ background: '#fff', padding: '14px 18px' }}>
                    <p style={{ fontFamily: F, fontWeight: 300, fontSize: 22, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1, marginBottom: 3 }}>{s.value}</p>
                    <p style={{ fontFamily: F, fontWeight: 400, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{s.label}</p>
                    <p style={{ fontFamily: F, fontWeight: 300, fontSize: 10, color: C.muted, marginTop: 2 }}>{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── 3. Weekly km Bar Chart ── */}
              <div style={{ background: '#fff', padding: '14px 16px', marginBottom: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted }}>Weekly km</span>
                  <span style={{ fontFamily: F, fontSize: 10, fontWeight: 300, color: C.muted }}>Last 8 weeks</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, marginBottom: 8 }}>
                  {weeklyBars.map((b, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: b.km > 0 ? `${(b.km / maxBarKm) * 100}%` : 2 }}
                      transition={{ duration: 0.5, delay: i * 0.04 }}
                      style={{
                        flex: 1, borderRadius: '2px 2px 0 0',
                        background: b.isCurrent ? '#D93518' : b.km >= 40 ? '#0A0A0A' : b.km >= 25 ? '#888780' : '#C8C4BE',
                        minHeight: 0,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {weeklyBars.map((b, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <span style={{ fontFamily: F, fontSize: 8, fontWeight: b.isCurrent ? 500 : 300, color: b.isCurrent ? '#D93518' : C.muted }}>
                        {b.isCurrent ? 'Now' : `W${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 4. AI Insights ── */}
              <div style={{ background: '#fff', padding: '14px 16px', marginBottom: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: AI.accent, flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted }}>AI insights</span>
                  </div>
                  <span style={{ padding: '2px 7px', borderRadius: 2, background: AI.tint, color: AI.accent, fontFamily: F, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>3 new</span>
                </div>
                {aiInsights.map((ins, i) => {
                  const InsIcon = ins.icon;
                  const chipBg   = ins.chip.style === 'green' ? '#EDF7F2' : ins.chip.style === 'amber' ? '#FDF6E8' : AI.tint;
                  const chipFg   = ins.chip.style === 'green' ? '#1A6B40' : ins.chip.style === 'amber' ? '#9E6800' : AI.accent;
                  const ChipIcon = ins.chip.style === 'green' ? ArrowUp : ins.chip.style === 'amber' ? AlertTriangle : Navigation;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < aiInsights.length - 1 ? `0.5px solid ${C.hair}` : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: AI.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <InsIcon size={13} stroke={AI.accent} strokeWidth={1.5} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: F, fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 3, lineHeight: 1.2 }}>{ins.title}</p>
                        <p style={{ fontFamily: F, fontSize: 11, fontWeight: 300, color: C.mid, lineHeight: 1.5 }}>{ins.desc}</p>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5, padding: '2px 7px', borderRadius: 2, background: chipBg, color: chipFg, fontFamily: F, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <ChipIcon size={8} strokeWidth={2} />
                          {ins.chip.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── 5. Pace Zones ── */}
              <div style={{ background: '#fff', padding: '14px 16px', marginBottom: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted }}>Pace zones</span>
                  <span style={{ fontFamily: F, fontSize: 10, fontWeight: 300, color: C.muted }}>Last 30 runs</span>
                </div>
                {paceZonesData.map((zone, i) => (
                  <div key={zone.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < paceZonesData.length - 1 ? 6 : 0 }}>
                    <span style={{ fontFamily: F, fontSize: 10, fontWeight: 400, color: C.mid, width: 52, flexShrink: 0 }}>{zone.label}</span>
                    <div style={{ flex: 1, height: 6, background: C.hair, borderRadius: 3, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${zone.pct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 + i * 0.1 }}
                        style={{ height: '100%', borderRadius: 3, background: zone.color }}
                      />
                    </div>
                    <span style={{ fontFamily: F, fontSize: 10, fontWeight: 300, color: C.muted, width: 30, textAlign: 'right' }}>{zone.pct}%</span>
                  </div>
                ))}
              </div>

              {/* ── 6. AI Race Predictions ── */}
              <div style={{ marginBottom: 1 }}>
                <div style={{ padding: '10px 16px 6px', background: C.warm }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: AI.accent, flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>AI Race Predictions</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.hair }}>
                  {racePredictionsData.map(pred => {
                    const dBg = pred.style === 'green' ? '#EDF7F2' : AI.tint;
                    const dFg = pred.style === 'green' ? '#1A6B40' : AI.accent;
                    const DIcon = pred.style === 'green' ? ArrowUp : Navigation;
                    return (
                      <div key={pred.dist} style={{ background: C.warm, padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p style={{ fontFamily: F, fontSize: 10, fontWeight: 400, color: C.mid }}>{pred.dist}</p>
                        <p style={{ fontFamily: F, fontSize: 18, fontWeight: 300, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1 }}>{pred.time}</p>
                        <p style={{ fontFamily: F, fontSize: 9, fontWeight: 300, color: C.muted }}>{pred.unit}</p>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2, padding: '2px 6px', borderRadius: 2, background: dBg, color: dFg, fontFamily: F, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', alignSelf: 'flex-start' }}>
                          <DIcon size={8} strokeWidth={2} />
                          {pred.delta}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── 7. Personal Records — horizontal scroll ── */}
              {prRows.length > 0 && (
                <div style={{ marginBottom: 1 }}>
                  <div style={{ padding: '10px 16px 6px', background: C.warm }}>
                    <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>Personal Records</span>
                  </div>
                  <div
                    className="scrollbar-none"
                    style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto', background: '#fff' }}
                  >
                    {prRows.map(r => (
                      <div key={r.label} style={{ flexShrink: 0, background: C.warm, borderRadius: 4, padding: '12px 14px', border: `0.5px solid ${C.border}`, minWidth: 108 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 2, background: C.pr, marginBottom: 8 }}>
                          <Star size={8} stroke={C.prText} strokeWidth={2} fill="none" />
                          <span style={{ fontFamily: F, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.prText }}>PR</span>
                        </span>
                        <p style={{ fontFamily: F, fontWeight: 300, fontSize: 20, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1, marginBottom: 3 }}>{r.value}</p>
                        <p style={{ fontFamily: F, fontSize: 9, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{r.label}</p>
                        <p style={{ fontFamily: F, fontSize: 9, fontWeight: 300, color: C.muted, marginTop: 2 }}>{r.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 8. Running Stats Grid (2×2) ── */}
              <div style={{ marginBottom: 1 }}>
                <div style={{ padding: '10px 16px 6px', background: C.warm }}>
                  <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>Running Stats</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.hair }}>
                  {[
                    { value: (player?.xp ?? 0).toLocaleString(), label: 'Total XP',    sub: 'All time' },
                    { value: player.totalRuns > 0 ? (player.totalDistanceKm / player.totalRuns).toFixed(1) : '0', label: 'Avg per run', sub: 'km' },
                    { value: `${player.energy}/5`,                         label: 'Energy',      sub: 'Current / max' },
                    { value: String(player.totalRuns),                     label: 'Total runs',  sub: 'All time' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#fff', padding: '14px 18px' }}>
                      <p style={{ fontFamily: F, fontWeight: 300, fontSize: 20, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1, marginBottom: 3 }}>{s.value}</p>
                      <p style={{ fontFamily: F, fontWeight: 400, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{s.label}</p>
                      <p style={{ fontFamily: F, fontWeight: 300, fontSize: 10, color: C.muted, marginTop: 2 }}>{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 9. Territory & Economy Grid (2×2) ── */}
              <div style={{ marginBottom: 1 }}>
                <div style={{ padding: '10px 16px 6px', background: C.warm }}>
                  <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>Territory & Economy</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.hair }}>
                  {[
                    { Icon: Navigation, iconColor: C.red,    value: String(player.totalTerritoriesClaimed), label: 'Zones owned'  },
                    { Icon: Zap,        iconColor: '#9E6800', value: String(player?.coins   ?? 0),   label: 'Coins earned' },
                    { Icon: Gem,        iconColor: '#1445AA', value: String(player?.diamonds ?? 0), label: 'Diamonds'     },
                    { Icon: Flame,      iconColor: C.red,    value: `${player.streakDays}d`,               label: 'Day streak'   },
                  ].map(({ Icon, iconColor, value, label }) => (
                    <div key={label} style={{ background: '#fff', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: C.warm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={13} stroke={iconColor} strokeWidth={1.5} fill="none" />
                      </div>
                      <div>
                        <p style={{ fontFamily: F, fontWeight: 300, fontSize: 20, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1, marginBottom: 3 }}>{value}</p>
                        <p style={{ fontFamily: F, fontWeight: 400, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ═══ AWARDS ═══ */}
          {tab === 'awards' && (
            <>
              {/* ── Progress header ── */}
              <div style={{ background: '#fff', padding: '16px', marginBottom: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                  <svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={26} cy={26} r={AWARD_RING_R} stroke={C.hair} strokeWidth={3} fill="none" />
                    <motion.circle
                      cx={26} cy={26} r={AWARD_RING_R} stroke={C.ink} strokeWidth={3} fill="none"
                      strokeLinecap="butt"
                      strokeDasharray={AWARD_RING_CIRC}
                      initial={{ strokeDashoffset: AWARD_RING_CIRC }}
                      animate={{ strokeDashoffset: AWARD_RING_CIRC * (1 - awardRingPct) }}
                      transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: F, fontWeight: 300, fontSize: 16, color: C.ink, lineHeight: 1 }}>{totalAwardUnlocked}</span>
                    <span style={{ fontFamily: F, fontWeight: 300, fontSize: 9, color: C.muted, lineHeight: 1.4 }}>/ {totalAwardItems}</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: F, fontWeight: 500, fontSize: 13, color: C.ink, marginBottom: 6 }}>{totalAwardUnlocked} of {totalAwardItems} unlocked</p>
                  <div style={{ height: 2, background: C.hair, borderRadius: 1, overflow: 'hidden', marginBottom: 5 }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${awardRingPct * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      style={{ height: '100%', background: C.ink, borderRadius: 1 }}
                    />
                  </div>
                  <p style={{ fontFamily: F, fontWeight: 300, fontSize: 10, color: C.muted }}>{totalAwardItems - totalAwardUnlocked} achievements remaining</p>
                </div>
              </div>

              {/* ── Award sections ── */}
              {awardSections.map(section => (
                <div key={section.title} style={{ marginBottom: 1 }}>
                  <div style={{ padding: '10px 16px 6px', background: C.warm }}>
                    <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted }}>{section.title}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.hair }}>
                    {section.items.map(award => {
                      const shaking = lockedId === award.key;
                      const AwardIcon = award.Icon;
                      return (
                        <div key={award.key} style={{ position: 'relative' }}>
                          <motion.button
                            whileTap={award.earned ? { scale: 1.06 } : {}}
                            onClick={() => {
                              haptic('light');
                              if (!award.earned) {
                                setLockedId(award.key);
                                setTimeout(() => setLockedId(null), 1500);
                              }
                            }}
                            style={{
                              width: '100%',
                              background: award.earned ? '#fff' : C.surf,
                              border: 'none', cursor: 'pointer',
                              padding: '14px 14px 12px',
                              display: 'flex', flexDirection: 'column', gap: 8,
                              textAlign: 'left',
                              animation: shaking ? 'awardShake 0.3s ease' : 'none',
                            }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: 8,
                              background: award.earned ? C.ink : C.warm,
                              border: award.earned ? 'none' : `0.5px solid ${C.hair}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <AwardIcon size={16} strokeWidth={1.5} stroke={award.earned ? '#fff' : C.muted} fill="none" />
                            </div>
                            <span style={{ fontFamily: F, fontSize: 11, fontWeight: award.earned ? 500 : 400, color: award.earned ? C.ink : C.muted, lineHeight: 1.2 }}>
                              {award.label}
                            </span>
                            {award.earned ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Check size={10} strokeWidth={2.5} stroke="#1A6B40" />
                                <span style={{ fontFamily: F, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1A6B40' }}>Earned</span>
                              </div>
                            ) : (
                              <div>
                                <div style={{ height: 2, background: C.hair, borderRadius: 1, overflow: 'hidden' }}>
                                  <div style={{ width: `${award.progress * 100}%`, height: '100%', background: C.muted, borderRadius: 1 }} />
                                </div>
                                <span style={{ fontFamily: F, fontSize: 9, fontWeight: 300, color: C.muted, marginTop: 3, display: 'block' }}>
                                  {award.progressLabel}
                                </span>
                              </div>
                            )}
                          </motion.button>
                          {shaking && (
                            <div style={{
                              position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%',
                              transform: 'translateX(-50%)', zIndex: 20,
                              background: '#fff', border: `0.5px solid ${C.border}`,
                              borderRadius: 4, padding: '4px 8px',
                              fontSize: 10, color: C.mid, fontFamily: F,
                              whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            }}>
                              {award.progressLabel}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ── Edit Profile Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            style={{
              position: 'fixed', inset: 0, background: '#fff', zIndex: 200,
              display: 'flex', flexDirection: 'column',
              paddingTop: 'max(0px, env(safe-area-inset-top))',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `0.5px solid ${C.hair}` }}>
              <button onClick={() => setEditOpen(false)} style={{ background: 'none', border: 'none', fontFamily: F, fontSize: 14, fontWeight: 300, color: C.muted, cursor: 'pointer' }}>Cancel</button>
              <span style={{ fontFamily: F, fontSize: 14, fontWeight: 500, color: C.ink }}>Edit profile</span>
              <button onClick={saveEdit} style={{ background: 'none', border: 'none', fontFamily: F, fontSize: 14, fontWeight: 500, color: C.red, cursor: 'pointer' }}>Save</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>
              {/* Avatar color */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 12 }}>Avatar colour</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  {SWATCHES.map(swatch => (
                    <button key={swatch} onClick={() => { setAvatarColor(swatch); haptic('light'); }} style={{
                      width: 36, height: 36, borderRadius: '50%', background: swatch, border: `2px solid ${avatarColor === swatch ? C.ink : 'transparent'}`, cursor: 'pointer',
                      boxShadow: avatarColor === swatch ? `0 0 0 2px #fff, 0 0 0 4px ${C.ink}` : 'none',
                    }} />
                  ))}
                </div>
              </div>

              {/* Fields */}
              {[
                { label: 'Display name', value: displayName, set: setDisplayName, maxLen: 40, tag: 'input' as const },
              ].map(f => (
                <div key={f.label} style={{ borderBottom: `0.5px solid ${C.hair}`, paddingBottom: 12, marginBottom: 16 }}>
                  <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>{f.label}</p>
                  <input
                    value={f.value} onChange={e => f.set(e.target.value)} maxLength={f.maxLen}
                    style={{ width: '100%', fontFamily: F, fontSize: 14, fontWeight: 300, color: C.ink, border: 'none', outline: 'none', background: 'transparent', padding: 0 }}
                  />
                </div>
              ))}

              {/* Bio */}
              <div style={{ borderBottom: `0.5px solid ${C.hair}`, paddingBottom: 12, marginBottom: 16 }}>
                <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>Bio</p>
                <div style={{ position: 'relative' }}>
                  <textarea
                    ref={bioRef} value={bio} onChange={e => setBio(e.target.value.slice(0, 80))}
                    rows={3} maxLength={80}
                    style={{ width: '100%', fontFamily: F, fontSize: 14, fontWeight: 300, color: C.ink, border: 'none', outline: 'none', background: 'transparent', resize: 'none', padding: 0 }}
                  />
                  <span style={{ fontFamily: F, fontSize: 11, color: C.muted, position: 'absolute', right: 0, bottom: 0 }}>{bio.length}/80</span>
                </div>
              </div>

              {/* Location */}
              <div style={{ borderBottom: `0.5px solid ${C.hair}`, paddingBottom: 12, marginBottom: 16 }}>
                <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>Location</p>
                <input value={loc} onChange={e => setLoc(e.target.value)}
                  style={{ width: '100%', fontFamily: F, fontSize: 14, fontWeight: 300, color: C.ink, border: 'none', outline: 'none', background: 'transparent', padding: 0 }}
                />
              </div>

              {/* Strava */}
              <div style={{ borderBottom: `0.5px solid ${C.hair}`, paddingBottom: 12, marginBottom: 16 }}>
                <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>Strava</p>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontFamily: F, fontSize: 14, fontWeight: 300, color: C.muted }}>@</span>
                  <input value={strava} onChange={e => setStrava(e.target.value)}
                    style={{ flex: 1, fontFamily: F, fontSize: 14, fontWeight: 300, color: C.ink, border: 'none', outline: 'none', background: 'transparent', padding: 0 }}
                  />
                </div>
              </div>

              {/* Instagram */}
              <div style={{ borderBottom: `0.5px solid ${C.hair}`, paddingBottom: 12, marginBottom: 16 }}>
                <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 6 }}>Instagram</p>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontFamily: F, fontSize: 14, fontWeight: 300, color: C.muted }}>@</span>
                  <input value={instagram} onChange={e => setInstagram(e.target.value)}
                    style={{ flex: 1, fontFamily: F, fontSize: 14, fontWeight: 300, color: C.ink, border: 'none', outline: 'none', background: 'transparent', padding: 0 }}
                  />
                </div>
              </div>

              {/* Privacy toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 }}>
                <div>
                  <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 4 }}>Privacy</p>
                  <p style={{ fontFamily: F, fontSize: 14, fontWeight: 300, color: C.ink }}>Public profile</p>
                </div>
                <button
                  onClick={() => { setPrivacy(p => !p); haptic('light'); }}
                  style={{
                    width: 44, height: 26, borderRadius: 13, position: 'relative', cursor: 'pointer',
                    background: privacy ? C.ink : C.hair, border: 'none', transition: 'background 0.2s',
                  }}
                >
                  <motion.div
                    animate={{ x: privacy ? 20 : 2 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    style={{ position: 'absolute', top: 2, left: 0, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
