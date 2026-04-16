import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Play, TrendingUp, Star, Globe, Navigation, Shield, Lock, Award,
  Zap, Flame, ArrowUp,
  Calendar, Check, Map as MapIcon, Settings, Camera, RefreshCw, ChevronRight,
} from 'lucide-react';
import { useWeeklyBrief } from '@features/intelligence/hooks/useWeeklyBrief';
import { supabase } from '@shared/services/supabase';
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats';
import { calculatePersonalRecords, PersonalRecord } from '@shared/services/personalRecords';
import { getRuns, StoredRun, getNutritionProfile, getNutritionEntriesRange, NutritionProfile, NutritionEntry, getSettings, localDateString, getShoes, StoredShoe } from '@shared/services/store';
import { haptic } from '@shared/lib/haptics';
import { soundManager } from '@shared/audio/sounds';
import { getWeekDates, todayKey } from '@features/nutrition/services/nutritionService';

type ProfileTab = 'overview' | 'stats' | 'awards' | 'nutrition' | 'gear';

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
const SWATCHES = ['#0A0A0A', '#D93518', '#3B82F6', '#1A6B40', '#F59E0B', '#8B5CF6'];

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
  const { brief: aiBrief, loading: aiLoading, refresh: aiRefresh } = useWeeklyBrief();
  const [tab, setTab]       = useState<ProfileTab>('overview');
  const [prs, setPrs]       = useState<PersonalRecord[]>([]);
  const [allRuns, setAllRuns] = useState<StoredRun[]>([]);
  const [lockedId, setLockedId] = useState<string | null>(null);
  const [nutProfile, setNutProfile] = useState<NutritionProfile | null>(null);
  const [nutWeekEntries, setNutWeekEntries] = useState<Record<string, NutritionEntry[]>>({});
  const [nutStreak, setNutStreak] = useState(0);
  const [nutTotalEntries, setNutTotalEntries] = useState(0);
  const [nutAvgKcal, setNutAvgKcal] = useState(0);
  const [weeklyGoalKm, setWeeklyGoalKm] = useState(20);
  const [shoes, setShoes] = useState<StoredShoe[]>([]);

  // Edit profile state
  const [editOpen, setEditOpen] = useState(false);
  const [avatarColor, setAvatarColor] = useState(() => localStorage.getItem('runivo-avatar-color') || SWATCHES[0]);
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('runivo-display-name') || '');
  const [bio, setBio] = useState(() => localStorage.getItem('runivo-bio') || '');
  const [loc, setLoc] = useState(() => localStorage.getItem('runivo-location') || '');
  const [strava, setStrava] = useState(() => localStorage.getItem('runivo-strava') || '');
  const [instagram, setInstagram] = useState(() => localStorage.getItem('runivo-instagram') || '');
  const [privacy, setPrivacy] = useState<boolean>(() => (localStorage.getItem('runivo-privacy') || 'true') === 'true');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem('runivo-avatar-url') || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED.includes(file.type)) return; // silently ignore invalid types
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setAvatarUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${session.user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
      localStorage.setItem('runivo-avatar-url', publicUrl);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
    }
    setAvatarUploading(false);
  };

  // Load profile fields from Supabase on mount — localStorage is only a cache
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('profiles')
          .select('bio, location, avatar_color, avatar_url, display_name, strava, instagram')
          .eq('id', session.user.id)
          .single();
        if (!data) return;
        if (data.bio        != null) { setBio(data.bio);               localStorage.setItem('runivo-bio', data.bio); }
        if (data.location   != null) { setLoc(data.location);          localStorage.setItem('runivo-location', data.location); }
        if (data.avatar_color != null){ setAvatarColor(data.avatar_color); localStorage.setItem('runivo-avatar-color', data.avatar_color); }
        if (data.avatar_url != null) { setAvatarUrl(data.avatar_url);  localStorage.setItem('runivo-avatar-url', data.avatar_url); }
        if (data.display_name != null){ setDisplayName(data.display_name); localStorage.setItem('runivo-display-name', data.display_name); }
        if (data.strava     != null) { setStrava(data.strava);         localStorage.setItem('runivo-strava', data.strava); }
        if (data.instagram  != null) { setInstagram(data.instagram);   localStorage.setItem('runivo-instagram', data.instagram); }
      } catch { /* offline — localStorage cache used */ }
    })();
  }, []);

  useEffect(() => {
    getSettings().then(s => setWeeklyGoalKm(s.weeklyGoalKm));
    calculatePersonalRecords().then(setPrs);
    getRuns(500).then(setAllRuns);
    getShoes().then(setShoes);

    // Load nutrition data
    getNutritionProfile().then(prof => {
      if (!prof) return;
      setNutProfile(prof);
      const weekDates = getWeekDates();
      const from = weekDates[0], to = weekDates[weekDates.length - 1];
      // Load 90-day range for streak & avg calculation
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const longFrom = localDateString(ninetyDaysAgo);
      getNutritionEntriesRange(longFrom, to).then(allEntries => {
        const foodEntries = allEntries.filter(e => e.source !== 'run');

        // Build week map
        const byDate: Record<string, NutritionEntry[]> = {};
        weekDates.forEach(d => { byDate[d] = []; });
        allEntries.filter(e => e.date >= from).forEach(e => { if (byDate[e.date]) byDate[e.date].push(e); });
        setNutWeekEntries(byDate);

        // Streak (consecutive days with food entries) — use local dates
        const today = todayKey();
        let streak = 0; const d = new Date();
        for (let i = 0; i < 90; i++) {
          const key = localDateString(d);
          if (key > today) { d.setDate(d.getDate() - 1); continue; }
          const has = foodEntries.some(e => e.date === key);
          if (has) { streak++; d.setDate(d.getDate() - 1); } else break;
        }
        setNutStreak(streak);

        // Total & avg
        const daysWithEntries = new Set(foodEntries.map(e => e.date));
        setNutTotalEntries(foodEntries.length);
        if (daysWithEntries.size > 0) {
          const totalKcal = foodEntries.reduce((s, e) => s + e.kcal, 0);
          setNutAvgKcal(Math.round(totalKcal / daysWithEntries.size));
        }
      });
    });
  }, []);

  // ── All hooks BEFORE any early return ─────────────────────────────────────

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

  const saveEdit = async () => {
    // Write to localStorage immediately for instant UI
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

    // Persist to Supabase in the background
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('profiles').update({
        bio,
        location:     loc,
        avatar_color: avatarColor,
        display_name: displayName,
        strava,
        instagram,
      }).eq('id', session.user.id);
    } catch { /* offline — localStorage cache will sync later */ }
  };

  // ── AI coach derived content (from Claude via edge function) ─────────────
  const aiQuote = aiBrief?.headline ?? (aiLoading ? null : `Every run builds the foundation. Stay consistent and your pace will follow.`);
  const aiTip   = aiBrief?.tip ?? null;
  const aiInsightTexts: string[] = aiBrief?.insights ?? [];


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
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 20, fontFamily: F, fontWeight: 300, color: '#fff', letterSpacing: '0.02em' }}>{initials}</span>
              }
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
        {(['overview', 'stats', 'awards', 'nutrition', 'gear'] as ProfileTab[]).map(t => (
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
              {/* AI brief card — mirrors mobile overview tab */}
              {aiBrief && (
                <div style={{ background: '#fff', padding: '14px 18px', marginBottom: 1, borderBottom: `0.5px solid ${C.hair}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: AI.accent }} />
                    <span style={{ fontFamily: F, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted }}>This week</span>
                  </div>
                  <p style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 15, color: C.ink, lineHeight: 1.5, marginBottom: aiBrief.tip ? 8 : 0 }}>
                    {aiBrief.headline}
                  </p>
                  {aiBrief.tip && (
                    <p style={{ fontFamily: F, fontWeight: 300, fontSize: 12, color: C.mid, lineHeight: 1.6 }}>{aiBrief.tip}</p>
                  )}
                </div>
              )}

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

              {/* Gear row */}
              {(() => {
                const activeShoes = shoes.filter(s => !s.isRetired);
                const wornCount = activeShoes.filter(s => {
                  const km = allRuns.filter(r => r.shoeId === s.id).reduce((sum, r) => sum + r.distanceMeters / 1000, 0);
                  return km / s.maxKm >= 0.85;
                }).length;
                return (
                  <div
                    onClick={() => navigate('/gear')}
                    style={{ background: '#fff', padding: '14px 18px', marginBottom: 1, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: C.hair, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 16 }}>👟</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontFamily: F, fontSize: 13, fontWeight: 400, color: C.ink }}>Gear</p>
                        {wornCount > 0 && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#9E6800', display: 'block', flexShrink: 0 }} />
                        )}
                      </div>
                      <p style={{ fontFamily: F, fontSize: 11, fontWeight: 300, color: C.muted }}>
                        {activeShoes.length === 0 ? 'Track shoe mileage' : `${activeShoes.length} shoe${activeShoes.length > 1 ? 's' : ''} tracked${wornCount > 0 ? ` · ${wornCount} near retirement` : ''}`}
                      </p>
                    </div>
                    <ChevronRight size={14} color={C.muted} strokeWidth={1.5} />
                  </div>
                );
              })()}
            </>
          )}

          {/* ═══ STATS ═══ */}
          {tab === 'stats' && (
            <>
              {/* ── 1. AI Coach Hero ── */}
              <div style={{ background: C.ink, padding: 18, marginBottom: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: AI.accent, flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)' }}>Runivo Intelligence</span>
                  </div>
                  <button
                    onClick={aiRefresh}
                    disabled={aiLoading}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: aiLoading ? 0.4 : 0.6 }}
                  >
                    <RefreshCw size={12} color="#fff" strokeWidth={1.5} className={aiLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
                {aiLoading && !aiQuote ? (
                  <div className="animate-pulse" style={{ height: 48, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 14 }} />
                ) : (
                  <p style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 16, color: '#fff', lineHeight: 1.5, marginBottom: aiTip ? 10 : 0 }}>
                    {aiQuote}
                  </p>
                )}
                {aiTip && (
                  <p style={{ fontFamily: F, fontSize: 11, fontWeight: 300, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 0 }}>
                    {aiTip}
                  </p>
                )}
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
                  {aiInsightTexts.length > 0 && (
                    <span style={{ padding: '2px 7px', borderRadius: 2, background: AI.tint, color: AI.accent, fontFamily: F, fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{aiInsightTexts.length} insights</span>
                  )}
                </div>
                {aiLoading && aiInsightTexts.length === 0 ? (
                  <>
                    {[0, 1, 2].map(i => (
                      <div key={i} className="animate-pulse" style={{ height: 56, background: C.hair, borderRadius: 4, marginBottom: i < 2 ? 8 : 0 }} />
                    ))}
                  </>
                ) : aiInsightTexts.length > 0 ? (
                  aiInsightTexts.map((text, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < aiInsightTexts.length - 1 ? `0.5px solid ${C.hair}` : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: AI.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <TrendingUp size={13} stroke={AI.accent} strokeWidth={1.5} />
                      </div>
                      <p style={{ fontFamily: F, fontSize: 11, fontWeight: 300, color: C.mid, lineHeight: 1.6, paddingTop: 6 }}>{text}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ fontFamily: F, fontSize: 11, fontWeight: 300, color: C.muted, lineHeight: 1.5 }}>
                    Log more runs to unlock AI-powered insights about your training.
                  </p>
                )}
              </div>

              {/* ── 5. Nutrition This Week (from weekly brief) ── */}
              {aiBrief?.nutrition && (
                <div style={{ background: '#fff', padding: '14px 16px', marginBottom: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316', flexShrink: 0 }} />
                    <span style={{ fontFamily: F, fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.muted }}>Nutrition This Week</span>
                  </div>
                  <p style={{ fontFamily: F, fontSize: 12, fontWeight: 400, color: C.ink, lineHeight: 1.6, marginBottom: 6 }}>
                    {aiBrief.nutrition.summary}
                  </p>
                  {aiBrief.nutrition.connection && (
                    <p style={{ fontFamily: F, fontSize: 11, fontWeight: 300, color: C.mid, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 6 }}>
                      {aiBrief.nutrition.connection}
                    </p>
                  )}
                  <p style={{ fontFamily: F, fontSize: 11, fontWeight: 500, color: '#F97316', lineHeight: 1.5, marginBottom: 0 }}>
                    → {aiBrief.nutrition.priority}
                  </p>
                </div>
              )}

              {/* ── 6. Pace Zones ── */}
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
                    { Icon: Navigation, iconColor: C.red,     value: String(player.totalTerritoriesClaimed), label: 'Zones owned' },
                    { Icon: Zap,        iconColor: '#9E6800', value: String(player?.coins ?? 0),              label: 'Coins'       },
                    { Icon: Flame,      iconColor: C.red,     value: `${player.streakDays}d`,                 label: 'Day streak'  },
                    { Icon: Navigation, iconColor: C.ink,     value: `${player.totalRuns}`,                   label: 'Total runs'  },
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

          {/* ═══ NUTRITION ═══ */}
          {tab === 'nutrition' && (
            <>
              {!nutProfile ? (
                <div style={{ padding: '40px 18px', textAlign: 'center' }}>
                  <Flame size={32} color={C.red} strokeWidth={1.5} style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 16, fontStyle: 'italic', fontFamily: "'Playfair Display', serif", color: C.ink, marginBottom: 8 }}>
                    Track your nutrition
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 300, color: C.muted, marginBottom: 20 }}>
                    Set up your calorie goals to see your nutrition stats here.
                  </div>
                  <button
                    onClick={() => navigate('/calories/setup')}
                    style={{ padding: '12px 24px', borderRadius: 10, background: C.ink, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: F }}
                  >
                    Set up nutrition
                  </button>
                </div>
              ) : (
                <>
                  {/* Goal card */}
                  <div style={{ background: C.bg, margin: '12px 12px 0', borderRadius: 14, border: `0.5px solid ${C.border}`, padding: '14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontFamily: F }}>Daily goal</div>
                      <button onClick={() => navigate('/calories/setup')} style={{ fontSize: 10, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}>Edit →</button>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {[
                        { label: 'Calories', value: `${nutProfile.dailyGoalKcal}`, unit: 'kcal' },
                        { label: 'Protein',  value: `${nutProfile.proteinGoalG}`,  unit: 'g' },
                        { label: 'Carbs',    value: `${nutProfile.carbsGoalG}`,    unit: 'g' },
                        { label: 'Fat',      value: `${nutProfile.fatGoalG}`,      unit: 'g' },
                      ].map(s => (
                        <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 300, color: C.ink, fontFamily: F, letterSpacing: '-0.02em' }}>
                            {s.value}<span style={{ fontSize: 9, color: C.muted, marginLeft: 1 }}>{s.unit}</span>
                          </div>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Week bars */}
                  <div style={{ background: C.bg, margin: '10px 12px 0', borderRadius: 14, border: `0.5px solid ${C.border}`, padding: '14px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontFamily: F, marginBottom: 12 }}>
                      This week
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
                      {getWeekDates().map((date, i) => {
                        const dayEntries = nutWeekEntries[date] ?? [];
                        const dayKcal    = dayEntries.filter(e => e.source !== 'run').reduce((s, e) => s + e.kcal, 0);
                        const isToday    = date === todayKey();
                        const maxBarH    = 52;
                        const barPct     = Math.min(dayKcal / Math.max(nutProfile.dailyGoalKcal, 1), 1);
                        const DLABELS    = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
                        return (
                          <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: '100%', height: maxBarH, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(barPct * maxBarH, dayKcal > 0 ? 4 : 0)}px` }}
                                transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                                style={{ width: '55%', borderRadius: 3, background: isToday ? C.red : dayKcal > 0 ? C.muted : C.hair }}
                              />
                            </div>
                            <div style={{ fontSize: 9, fontWeight: isToday ? 600 : 400, color: isToday ? C.red : C.muted, fontFamily: F }}>{DLABELS[i]}</div>
                            <div style={{ fontSize: 8, color: C.muted, fontFamily: F }}>{dayKcal > 0 ? dayKcal : '—'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Streak + all-time */}
                  <div style={{ margin: '10px 12px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: C.bg, borderRadius: 14, border: `0.5px solid ${C.border}`, padding: '14px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Flame size={14} color={C.red} strokeWidth={1.5} />
                        <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontFamily: F }}>Streak</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 300, color: C.ink, fontFamily: F, letterSpacing: '-0.02em' }}>{nutStreak}</div>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: F, marginTop: 2 }}>days in a row</div>
                    </div>
                    <div style={{ background: C.bg, borderRadius: 14, border: `0.5px solid ${C.border}`, padding: '14px 14px' }}>
                      <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontFamily: F, marginBottom: 6 }}>Avg / day</div>
                      <div style={{ fontSize: 22, fontWeight: 300, color: C.ink, fontFamily: F, letterSpacing: '-0.02em' }}>{nutAvgKcal || '—'}</div>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: F, marginTop: 2 }}>kcal logged</div>
                    </div>
                  </div>

                  <div style={{ margin: '10px 12px 16px', background: C.bg, borderRadius: 14, border: `0.5px solid ${C.border}`, padding: '14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontFamily: F, marginBottom: 4 }}>Total entries</div>
                      <div style={{ fontSize: 22, fontWeight: 300, color: C.ink, fontFamily: F, letterSpacing: '-0.02em' }}>{nutTotalEntries}</div>
                    </div>
                    <button
                      onClick={() => navigate('/calories')}
                      style={{ padding: '10px 16px', borderRadius: 8, background: C.ink, border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: F }}
                    >
                      Open tracker
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══ GEAR ═══ */}
          {tab === 'gear' && (
            <>
              {shoes.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>👟</span>
                  <div style={{ fontSize: 16, fontStyle: 'italic', fontFamily: "'Playfair Display', serif", color: C.ink, marginBottom: 8 }}>
                    No shoes tracked yet
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 300, color: C.muted, marginBottom: 20 }}>
                    Add your running shoes to track mileage and get retirement alerts.
                  </div>
                  <button
                    onClick={() => navigate('/gear')}
                    style={{ padding: '12px 24px', borderRadius: 10, background: C.ink, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: F }}
                  >
                    Manage gear
                  </button>
                </div>
              ) : (
                <div style={{ padding: '12px 12px 24px' }}>
                  {shoes.map(shoe => {
                    const usedKm = allRuns
                      .filter(r => r.shoeId === shoe.id)
                      .reduce((sum, r) => sum + r.distanceMeters / 1000, 0);
                    const maxKm = shoe.maxKm ?? 800;
                    const pct = Math.min(usedKm / maxKm, 1);
                    const barColor = pct >= 0.85 ? '#D93518' : pct >= 0.6 ? '#9E6800' : '#1A6B40';
                    const statusLabel = shoe.isRetired ? 'Retired' : pct >= 0.85 ? 'Replace soon' : pct >= 0.6 ? 'Moderate wear' : 'Good';
                    const statusColor = shoe.isRetired ? C.muted : pct >= 0.85 ? '#D93518' : pct >= 0.6 ? '#9E6800' : '#1A6B40';
                    const statusBg    = shoe.isRetired ? C.hair   : pct >= 0.85 ? '#FEF0EE'  : pct >= 0.6 ? '#FDF6E8'  : '#EDF7F2';
                    return (
                      <div
                        key={shoe.id}
                        onClick={() => navigate('/gear')}
                        style={{
                          background: '#fff',
                          borderRadius: 14,
                          border: `0.5px solid ${C.border}`,
                          padding: '14px 14px',
                          marginBottom: 8,
                          cursor: 'pointer',
                          opacity: shoe.isRetired ? 0.55 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.hair, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 18 }}>👟</span>
                            </div>
                            <div>
                              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: C.ink }}>{shoe.brand} {shoe.model}</div>
                              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 300, color: C.muted, marginTop: 1 }}>
                                {Math.round(usedKm)} km / {maxKm} km
                              </div>
                            </div>
                          </div>
                          <span style={{
                            fontFamily: F, fontSize: 10, fontWeight: 500, letterSpacing: '0.04em',
                            color: statusColor, background: statusBg,
                            borderRadius: 6, padding: '3px 8px',
                          }}>
                            {statusLabel}
                          </span>
                        </div>

                        {/* Mileage bar */}
                        <div style={{ height: 5, background: C.hair, borderRadius: 3, overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct * 100}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            style={{ height: '100%', background: barColor, borderRadius: 3 }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                          <span style={{ fontFamily: F, fontSize: 9, color: C.muted }}>{Math.round(pct * 100)}% used</span>
                          <span style={{ fontFamily: F, fontSize: 9, color: C.muted }}>{Math.round(maxKm - usedKm)} km left</span>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => navigate('/gear')}
                    style={{ width: '100%', marginTop: 4, padding: '12px', borderRadius: 10, background: C.hair, border: 'none', color: C.ink, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: F }}
                  >
                    Manage all gear →
                  </button>
                </div>
              )}
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
              {/* Avatar photo + color */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 12 }}>Avatar</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  {/* Preview */}
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: avatarColor, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 17, fontFamily: F, fontWeight: 300, color: '#fff' }}>{(displayName || player.username || '?').charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  {/* Upload button */}
                  <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
                  <button onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                      background: C.warm, border: `0.5px solid ${C.border}`, fontFamily: F, fontSize: 13,
                      fontWeight: 400, color: C.ink, cursor: 'pointer', opacity: avatarUploading ? 0.5 : 1 }}>
                    <Camera size={14} strokeWidth={1.5} />
                    {avatarUploading ? 'Uploading…' : 'Upload photo'}
                  </button>
                  {avatarUrl && (
                    <button onClick={() => { setAvatarUrl(null); localStorage.removeItem('runivo-avatar-url'); }}
                      style={{ background: 'none', border: 'none', fontFamily: F, fontSize: 12, color: C.muted, cursor: 'pointer' }}>
                      Remove
                    </button>
                  )}
                </div>
                <p style={{ fontFamily: F, fontSize: 10, textTransform: 'uppercase', color: C.muted, letterSpacing: '0.08em', marginBottom: 10 }}>Colour</p>
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
