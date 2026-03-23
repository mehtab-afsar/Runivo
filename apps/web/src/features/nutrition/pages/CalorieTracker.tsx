import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavVisibility } from '@/shared/hooks/useNavVisibility';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Trash2, ChevronDown, Settings, Zap, Sparkles, RefreshCw } from 'lucide-react';
import {
  getNutritionProfile, getNutritionEntries, addNutritionEntry, deleteNutritionEntry,
  getNutritionEntriesRange, NutritionProfile, NutritionEntry,
  getRunsSince, getPlayer, savePlayer,
} from '@shared/services/store';
import { todayKey, getWeekDates, calcRunCalories, calcNutritionXP } from '../services/nutritionService';
import {
  type DailyContext,
  getHeaderMessage, getProteinNote, getCarbsNote, getFatNote,
} from '../services/trackerInsights';
import { FoodSearch } from '../components/FoodSearch';
import { useNutritionInsights } from '@features/intelligence/hooks/useNutritionInsights';
import type { NutritionInsights } from '@features/intelligence/services/intelligenceService';
import { haptic } from '@shared/lib/haptics';
import { T as TBase, F } from '@shared/design-system/tokens';

const T = {
  ...TBase,
  orange:   '#C25A00',
  orangeLo: '#FEF0E6',
};

type Meal = NutritionEntry['meal'];
const MEALS: { value: Meal; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch',     label: 'Lunch',     emoji: '☀️'  },
  { value: 'dinner',    label: 'Dinner',    emoji: '🌙'  },
  { value: 'snacks',    label: 'Snacks',    emoji: '🍎'  },
];
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Determine which meal to auto-expand based on time of day */
function defaultExpandedMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11)  return 'breakfast';
  if (h < 15)  return 'lunch';
  if (h < 20)  return 'dinner';
  return 'snacks';
}

/** Ring colour based on % of goal consumed */
function ringColor(pct: number): string {
  if (pct >= 1)    return T.orange; // over budget
  if (pct >= 0.8)  return T.amber;  // approaching
  return T.red;
}

export default function CalorieTracker() {
  const navigate = useNavigate();
  const { setNavVisible } = useNavVisibility();

  useEffect(() => { setNavVisible(false); return () => setNavVisible(true); }, [setNavVisible]);

  const [profile, setProfile]           = useState<NutritionProfile | null>(null);
  const [entries, setEntries]           = useState<NutritionEntry[]>([]);
  const [weekEntries, setWeekEntries]   = useState<Record<string, NutritionEntry[]>>({});
  const [runBurnKcal, setRunBurnKcal]   = useState(0);
  const [dailyCtx, setDailyCtx]         = useState<DailyContext | null>(null);
  const [showSearch, setShowSearch]     = useState(false);
  const [defaultMeal, setDefaultMeal]   = useState<Meal>('snacks');
  const [expandedMeal, setExpandedMeal] = useState<Meal | null>(defaultExpandedMeal);
  const [activeTab, setActiveTab]       = useState<'today' | 'insights'>('today');
  const [loading, setLoading]           = useState(true);
  const [openDeleteId, setOpenDeleteId] = useState<number | null>(null);
  const [toast, setToast]               = useState('');

  const { insights: aiInsights, loading: insightsLoading, error: insightsError, refresh: refreshInsights } = useNutritionInsights();
  const swipeRowRef  = useRef<{ id: number; startX: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = todayKey();

  // Cleanup toast timer on unmount
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(''), 2500);
  }

  const load = useCallback(async () => {
    const prof = await getNutritionProfile();
    if (!prof) { setLoading(false); return; }
    setProfile(prof);

    const todayEntries = await getNutritionEntries(today);
    setEntries(todayEntries);

    const weekDates = getWeekDates();
    const range = await getNutritionEntriesRange(weekDates[0], weekDates[weekDates.length - 1]);
    const byDate: Record<string, NutritionEntry[]> = {};
    weekDates.forEach(d => { byDate[d] = []; });
    range.forEach(e => { if (byDate[e.date]) byDate[e.date].push(e); });
    setWeekEntries(byDate);

    // Only fetch runs from today's start (PERF: avoids full-table scan)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayRuns = await getRunsSince(todayStart.getTime());
    const burn = todayRuns
      .reduce((s, r) => s + calcRunCalories(r.distanceMeters, prof.weightKg), 0);
    setRunBurnKcal(burn);

    // Build DailyContext for rule-based tracker intelligence
    const yesterdayStart    = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const allSinceYesterday = await getRunsSince(yesterdayStart.getTime());
    const yesterdayRuns     = allSinceYesterday.filter(r => r.startTime < todayStart.getTime());

    // Last 7 days of nutrition for protein deficit streak
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDayStr  = sevenDaysAgo.toISOString().split('T')[0];
    const yesterdayStr = yesterdayStart.toISOString().split('T')[0];
    const last7Entries = await getNutritionEntriesRange(sevenDayStr, yesterdayStr);

    // Count consecutive days (ending yesterday) where protein < 80% of goal
    const proteinGoal = prof.proteinGoalG;
    const last7ByDate: Record<string, number> = {};
    last7Entries.filter(e => e.source !== 'run').forEach(e => {
      last7ByDate[e.date] = (last7ByDate[e.date] ?? 0) + e.proteinG;
    });
    let proteinDeficitDays = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const ds = d.toISOString().split('T')[0];
      if ((last7ByDate[ds] ?? 0) < proteinGoal * 0.8) proteinDeficitDays++;
      else break;
    }

    // Unique run days this calendar week
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Mon
    const weekRuns = await getRunsSince(weekStart.getTime());
    const runDaySet = new Set(weekRuns.map(r => new Date(r.startTime).toISOString().split('T')[0]));

    const todayFoodEntries = todayEntries.filter(e => e.source !== 'run');
    const todayConsumed    = todayFoodEntries.reduce((s, e) => s + e.kcal, 0);
    const todayProtein     = todayFoodEntries.reduce((s, e) => s + e.proteinG, 0);
    const todayCarbs       = todayFoodEntries.reduce((s, e) => s + e.carbsG, 0);
    const todayFat         = todayFoodEntries.reduce((s, e) => s + e.fatG, 0);

    setDailyCtx({
      ranToday:            todayRuns.length > 0,
      ranYesterday:        yesterdayRuns.length > 0,
      caloriesBurnedToday: burn,
      consumed:            todayConsumed,
      goal:                prof.dailyGoalKcal,
      remaining:           prof.dailyGoalKcal - (todayConsumed - burn),
      proteinConsumed:     todayProtein,
      proteinGoal:         prof.proteinGoalG,
      carbsConsumed:       todayCarbs,
      carbsGoal:           prof.carbsGoalG,
      fatConsumed:         todayFat,
      fatGoal:             prof.fatGoalG,
      proteinDeficitDays,
      daysUntilEvent:      null, // would require Supabase query — kept null client-side
      runDaysThisWeek:     runDaySet.size,
    });

    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && !profile) navigate('/calories/setup', { replace: true });
  }, [loading, profile, navigate]);

  const { consumed, goal, net, remaining, pct, proteinConsumed, carbsConsumed, fatConsumed } = useMemo(() => {
    const foodEntries = entries.filter(e => e.source !== 'run');
    const consumed    = foodEntries.reduce((s, e) => s + e.kcal, 0);
    const goal        = profile?.dailyGoalKcal ?? 2000;
    const net         = consumed - runBurnKcal;
    return {
      consumed,
      goal,
      net,
      remaining:        goal - net,
      pct:              Math.min(net / Math.max(goal, 1), 1),
      proteinConsumed:  foodEntries.reduce((s, e) => s + e.proteinG, 0),
      carbsConsumed:    foodEntries.reduce((s, e) => s + e.carbsG, 0),
      fatConsumed:      foodEntries.reduce((s, e) => s + e.fatG, 0),
    };
  }, [entries, profile, runBurnKcal]);
  const ringC  = 2 * Math.PI * 32; // r=32 → 201.06
  const rColor = ringColor(pct);

  const { weekDates, weekKcals, weekAvg } = useMemo(() => {
    const weekDates = getWeekDates();
    const weekKcals = weekDates.map(d =>
      (weekEntries[d] ?? []).filter(e => e.source !== 'run').reduce((s, e) => s + e.kcal, 0)
    );
    const loggedDays = weekKcals.filter(k => k > 0);
    return {
      weekDates,
      weekKcals,
      weekAvg: loggedDays.length > 0 ? Math.round(loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length) : 0,
    };
  }, [weekEntries]);

  const handleAdd = useCallback(async (entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) => {
    // Re-read IDB entries for XP calculation to avoid race when two adds fire concurrently
    const freshEntries = await getNutritionEntries(today);
    const xp = calcNutritionXP(freshEntries.filter(e => e.source !== 'run'));
    await addNutritionEntry({ ...entry, date: today, loggedAt: Date.now(), xpAwarded: xp > 0 });
    if (xp > 0) {
      const player = await getPlayer();
      if (player) await savePlayer({ ...player, xp: player.xp + xp });
    }
    await load();
    setShowSearch(false);
    const mealLabel = MEALS.find(m => m.value === entry.meal)?.label ?? entry.meal;
    showToast(`${entry.name} added to ${mealLabel}`);
  }, [today, load]);

  const handleDelete = useCallback(async (id: number) => {
    setOpenDeleteId(null);
    await deleteNutritionEntry(id);
    haptic('light');
    await load();
  }, [load]);

  function openSearch(meal: Meal) {
    setDefaultMeal(meal);
    setShowSearch(true);
    haptic('light');
  }

  // Swipe-to-delete handlers
  function onSwipeStart(id: number, e: React.TouchEvent) {
    swipeRowRef.current = { id, startX: e.touches[0].clientX };
  }
  function onSwipeEnd(id: number, e: React.TouchEvent) {
    if (!swipeRowRef.current || swipeRowRef.current.id !== id) return;
    const dx = e.changedTouches[0].clientX - swipeRowRef.current.startX;
    if (dx < -30) { setOpenDeleteId(id); haptic('light'); }
    else if (dx > 10 && openDeleteId === id) setOpenDeleteId(null);
    swipeRowRef.current = null;
  }

  if (loading) {
    return (
      <div style={{ height: '100%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes ct-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid rgba(217,53,24,0.15)`, borderTopColor: T.red, animation: 'ct-spin 0.8s linear infinite' }} />
      </div>
    );
  }
  if (!profile) return null;

  return (
    <div style={{ height: '100%', background: T.bg, overflowY: 'auto', fontFamily: F }}>

      {/* Header */}
      <div style={{ background: T.white, borderBottom: `0.5px solid ${T.border}`, padding: '0 18px 11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
          <button
            onClick={() => navigate('/home')}
            style={{ width: 26, height: 26, borderRadius: '50%', background: T.bg, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
          >
            <ChevronLeft size={13} color={T.t2} strokeWidth={1.5} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.black, lineHeight: 1 }}>Calorie Tracker</div>
            <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, marginTop: 2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <button
            onClick={() => navigate('/calories/setup')}
            style={{ width: 26, height: 26, borderRadius: '50%', background: T.bg, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
          >
            <Settings size={12} color={T.t2} strokeWidth={1.5} />
          </button>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => { setShowSearch(true); haptic('light'); }}
            style={{ width: 32, height: 32, borderRadius: '50%', background: T.red, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 8px rgba(217,53,24,0.30)', flexShrink: 0 }}
          >
            <Plus size={14} color="#fff" strokeWidth={1.5} />
          </motion.button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: T.white, borderBottom: `0.5px solid ${T.border}`, display: 'flex' }}>
        {(['today', 'insights'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); haptic('light'); }}
            style={{
              flex: 1, padding: '9px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? T.red : T.t3,
              textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F,
              borderBottom: activeTab === tab ? `2px solid ${T.red}` : '2px solid transparent',
              transition: 'color 150ms',
            }}
          >
            {tab === 'today' ? 'Today' : 'Insights'}
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {activeTab === 'insights' && (
          <NutritionInsightsTab
            insights={aiInsights}
            loading={insightsLoading}
            error={insightsError}
            onRefresh={refreshInsights}
            onAskCoach={() => navigate('/coach')}
          />
        )}

        {activeTab === 'today' && <>

        {/* ── Hero ring card ── */}
        <div style={{ background: T.black, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Ring */}
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg width="80" height="80">
              <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.10)" strokeWidth="5" fill="none" />
              <motion.circle
                cx="40" cy="40" r="32" fill="none"
                stroke={rColor} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={ringC}
                initial={{ strokeDashoffset: ringC }}
                animate={{ strokeDashoffset: ringC * (1 - Math.max(0, pct)) }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 300, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{consumed}</span>
              <span style={{ fontSize: 8, fontWeight: 400, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>kcal</span>
            </div>
          </div>

          {/* Stats column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Goal',      value: goal.toLocaleString(),                color: '#fff',     show: true },
              { label: 'Remaining', value: remaining > 0 ? `+${remaining.toLocaleString()}` : `${remaining.toLocaleString()}`, color: remaining >= 0 ? '#4ADE80' : T.orange, show: true },
              { label: 'Burned',    value: `+${runBurnKcal}`,                    color: '#FF8C42',  show: runBurnKcal > 0 },
            ].filter(r => r.show).map((row, i, arr) => (
              <div key={row.label}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 400, color: row.color, fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
                </div>
                {i < arr.length - 1 && <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.10)' }} />}
              </div>
            ))}
          </div>
          </div>{/* end ring+stats row */}

          {/* ── AI header message ── */}
          {dailyCtx && (() => {
            const msg = getHeaderMessage(dailyCtx);
            return msg ? (
              <div style={{
                marginTop: 10, padding: '8px 12px',
                background: 'rgba(255,255,255,0.08)', borderRadius: 8,
                fontSize: 12, color: 'rgba(255,255,255,0.82)',
                fontFamily: F, lineHeight: 1.45,
              }}>
                {msg}
              </div>
            ) : null;
          })()}
        </div>{/* end hero card */}

        {/* ── Run burn chip ── */}
        {runBurnKcal > 0 && (
          <div style={{
            background: T.orangeLo, border: `0.5px solid rgba(194,90,0,0.20)`,
            borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(194,90,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={12} color="#7A3800" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#7A3800' }}>Run activity · +{runBurnKcal} kcal added</div>
              <div style={{ fontSize: 9, fontWeight: 300, color: T.orange, marginTop: 1 }}>
                Net: {net.toLocaleString()} kcal against {goal.toLocaleString()} kcal goal
              </div>
            </div>
          </div>
        )}

        {/* ── Macros card ── */}
        <div style={{ background: T.white, borderRadius: 12, border: `0.5px solid ${T.border}`, padding: '12px 14px' }}>
          {[
            { name: 'Protein', consumed: proteinConsumed, goal: profile.proteinGoalG, dot: T.blue,  fill: T.blue,  bg: T.blueLo,  note: dailyCtx ? getProteinNote(dailyCtx) : null },
            { name: 'Carbs',   consumed: carbsConsumed,   goal: profile.carbsGoalG,   dot: T.amber, fill: T.amber, bg: T.amberLo, note: dailyCtx ? getCarbsNote(dailyCtx)   : null },
            { name: 'Fat',     consumed: fatConsumed,     goal: profile.fatGoalG,     dot: T.green, fill: T.green, bg: T.greenLo, note: dailyCtx ? getFatNote(dailyCtx)     : null },
          ].map((m, i) => {
            const p = Math.min(m.consumed / Math.max(m.goal, 1), 1);
            return (
              <div key={m.name} style={{ marginBottom: i < 2 ? (m.note ? 10 : 8) : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 400, color: T.black, width: 50, flexShrink: 0 }}>{m.name}</span>
                  <div style={{ flex: 1, height: 5, background: T.mid, borderRadius: 3, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                      style={{ height: '100%', borderRadius: 3, background: m.fill }}
                    />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 300, color: T.t3, minWidth: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(m.consumed)} / {m.goal}g
                  </span>
                </div>
                {m.note && (
                  <p style={{ margin: '3px 0 0 18px', fontSize: 10, color: T.t3, fontStyle: 'italic', lineHeight: 1.4, fontFamily: F }}>
                    {m.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Meal sections ── */}
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal === meal.value && e.source !== 'run');
          const mealKcal    = mealEntries.reduce((s, e) => s + e.kcal, 0);
          const isExpanded  = expandedMeal === meal.value;

          return (
            <div key={meal.value} style={{ background: T.white, borderRadius: 12, border: `0.5px solid ${T.border}`, overflow: 'hidden' }}>
              {/* Header row */}
              <button
                onClick={() => { setExpandedMeal(isExpanded ? null : meal.value); setOpenDeleteId(null); haptic('light'); }}
                style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14 }}>{meal.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F }}>{meal.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>{mealKcal > 0 ? `${mealKcal} kcal` : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={e => { e.stopPropagation(); openSearch(meal.value); }}
                    style={{ width: 22, height: 22, borderRadius: '50%', background: T.bg, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Plus size={10} color={T.black} strokeWidth={1.5} />
                  </button>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={11} color={T.t3} strokeWidth={1.5} />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ borderTop: `0.5px solid ${T.mid}` }}>
                      {mealEntries.length === 0 ? (
                        <button
                          onClick={() => openSearch(meal.value)}
                          style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 300, color: T.t3, fontFamily: F }}>Add your first item →</span>
                        </button>
                      ) : (
                        <>
                          {mealEntries.map(entry => (
                            <div key={entry.id} style={{ position: 'relative', overflow: 'hidden', borderTop: `0.5px solid ${T.mid}` }}>
                              {/* Delete background */}
                              <div
                                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                onClick={() => { if (entry.id != null) handleDelete(entry.id); }}
                              >
                                <Trash2 size={14} color="#fff" strokeWidth={1.5} />
                              </div>
                              {/* Swipeable row */}
                              <motion.div
                                animate={{ x: openDeleteId === entry.id ? -40 : 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                onTouchStart={e => { if (entry.id != null) onSwipeStart(entry.id, e); }}
                                onTouchEnd={e => { if (entry.id != null) onSwipeEnd(entry.id, e); }}
                                onClick={() => { if (openDeleteId === entry.id) setOpenDeleteId(null); }}
                                style={{ background: T.white, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 500, color: T.black, marginBottom: 3, fontFamily: F }}>{entry.name}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 9, fontWeight: 300, color: T.t3 }}>{entry.servingSize}</span>
                                    {/* Macro badges */}
                                    {[
                                      { val: `${Math.round(entry.proteinG)}g P`, bg: T.blueLo,  color: T.blue  },
                                      { val: `${Math.round(entry.carbsG)}g C`,   bg: T.amberLo, color: T.amber },
                                      { val: `${Math.round(entry.fatG)}g F`,     bg: T.greenLo, color: T.green },
                                    ].map(b => (
                                      <span key={b.val} style={{ padding: '1px 4px', borderRadius: 2, background: b.bg, color: b.color, fontSize: 7, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                                        {b.val}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 300, color: T.black, marginRight: 6, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{entry.kcal}</span>
                                <button
                                  onClick={e => { e.stopPropagation(); if (entry.id != null) handleDelete(entry.id); }}
                                  style={{ width: 18, height: 18, borderRadius: '50%', background: T.bg, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                                >
                                  <Trash2 size={9} color={T.t3} strokeWidth={1.5} />
                                </button>
                              </motion.div>
                            </div>
                          ))}
                          {/* Add more row */}
                          <button
                            onClick={() => openSearch(meal.value)}
                            style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', borderTop: `0.5px solid ${T.mid}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <Plus size={10} color={T.red} strokeWidth={1.5} />
                            <span style={{ fontSize: 10, color: T.red, fontWeight: 400, fontFamily: F }}>Add more</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* ── Weekly bar chart card ── */}
        <div style={{ background: T.white, borderRadius: 12, border: `0.5px solid ${T.border}`, padding: '12px 14px', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3 }}>This week</span>
            {weekAvg > 0 && <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>avg {weekAvg.toLocaleString()} kcal</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 52 }}>
            {weekDates.map((date, i) => {
              const dayKcal = weekKcals[i];
              const isToday = date === today;
              const isPast  = date < today;
              const barH    = dayKcal > 0 ? Math.max(Math.round((dayKcal / Math.max(goal, 1)) * 48), 4) : 4;
              return (
                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: barH }}
                    transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }}
                    style={{
                      width: '100%', borderRadius: '3px 3px 0 0',
                      background: isToday ? T.red : isPast && dayKcal > 0 ? '#C8C4BE' : T.mid,
                    }}
                  />
                  <span style={{ fontSize: 8, fontWeight: isToday ? 500 : 400, color: isToday ? T.red : T.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {DAY_LABELS[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        </>}{/* end activeTab === 'today' */}

      </div>

      {/* ── Food search modal ── */}
      <AnimatePresence>
        {showSearch && (
          <FoodSearch defaultMeal={defaultMeal} onAdd={handleAdd} onClose={() => setShowSearch(false)} />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast !== '' && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
              background: T.black, color: '#fff', fontSize: 12, fontWeight: 400, fontFamily: F,
              borderRadius: 8, padding: '8px 14px', whiteSpace: 'nowrap',
              zIndex: 300, pointerEvents: 'none',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Nutrition Insights Tab ───────────────────────────────────────────────────
interface InsightsTabProps {
  insights: NutritionInsights | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAskCoach: () => void;
}

function NutritionInsightsTab({ insights, loading, error, onRefresh, onAskCoach }: InsightsTabProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="animate-pulse" style={{ background: T.white, borderRadius: 12, border: `0.5px solid ${T.border}`, padding: '14px 16px' }}>
            <div style={{ height: 10, width: '40%', background: T.mid, borderRadius: 4, marginBottom: 10 }} />
            <div style={{ height: 8, width: '90%', background: T.mid, borderRadius: 4, marginBottom: 6 }} />
            <div style={{ height: 8, width: '75%', background: T.mid, borderRadius: 4 }} />
          </div>
        ))}
        <p style={{ textAlign: 'center', fontSize: 11, color: T.t3, fontFamily: F, marginTop: 4 }}>
          Analysing your nutrition patterns…
        </p>
      </div>
    );
  }

  if (error || !insights || insights.cards.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px' }}>
        <p style={{ fontSize: 13, color: T.t2, fontFamily: F, marginBottom: 16 }}>
          {error
            ? 'Could not load insights right now.'
            : "Log meals for a few days and I'll find patterns in your nutrition and training."}
        </p>
        <button
          onClick={onRefresh}
          style={{ padding: '8px 16px', borderRadius: 8, background: T.red, border: 'none', color: '#fff', fontSize: 12, fontFamily: F, fontWeight: 500, cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    );
  }

  const updatedDate = new Date(insights.generatedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} color="#5A3A8A" strokeWidth={1.5} />
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5A3A8A', fontFamily: F }}>
            Runivo Intelligence
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: T.t3, fontFamily: F }}>Updated {updatedDate}</span>
          <button onClick={onRefresh} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <RefreshCw size={11} color={T.t3} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {insights.cards.map((card, i) => (
        <div key={i} style={{ background: '#F2EEF9', border: '0.5px solid rgba(90,58,138,0.15)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{card.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3B2461', fontFamily: F }}>{card.title}</span>
          </div>
          <p style={{ fontSize: 12, color: '#5A3A8A', lineHeight: 1.5, margin: 0, fontFamily: F }}>{card.body}</p>
        </div>
      ))}

      <button
        onClick={onAskCoach}
        style={{ width: '100%', padding: '12px 16px', background: T.white, border: `0.5px solid rgba(90,58,138,0.3)`, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={13} color="#5A3A8A" strokeWidth={1.5} />
          <span style={{ fontSize: 12, color: '#5A3A8A', fontFamily: F, fontWeight: 500 }}>Ask about your nutrition</span>
        </div>
        <span style={{ fontSize: 14, color: '#5A3A8A' }}>→</span>
      </button>
    </div>
  );
}
