import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavVisibility } from '@shared/hooks/useNavVisibility';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Flame, Trash2, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import {
  getNutritionProfile, getNutritionEntries, addNutritionEntry, deleteNutritionEntry,
  getNutritionEntriesRange, NutritionProfile, NutritionEntry,
} from '@shared/services/store';
import { getRuns } from '@shared/services/store';
import { todayKey, getWeekDates, calcRunCalories, calcNutritionXP } from '../services/nutritionService';
import { FoodSearch } from '../components/FoodSearch';
import { haptic } from '@shared/lib/haptics';

const T = {
  bg: '#F8F6F3', white: '#FFFFFF', stone: '#F0EDE8',
  border: '#DDD9D4', mid: '#E8E4DF', black: '#0A0A0A',
  t2: '#6B6B6B', t3: '#ADADAD',
  red: '#D93518', redLo: '#FEF0EE',
  orange: '#F97316', orangeLo: 'rgba(249,115,22,0.1)',
};
const F  = "'Barlow', sans-serif";
const FD = "'Playfair Display', serif";

type Meal = NutritionEntry['meal'];
const MEALS: { value: Meal; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch',     label: 'Lunch',     emoji: '☀️' },
  { value: 'dinner',    label: 'Dinner',    emoji: '🌙' },
  { value: 'snacks',    label: 'Snacks',    emoji: '🍎' },
];

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export default function CalorieTracker() {
  const navigate = useNavigate();
  const { setNavVisible } = useNavVisibility();

  useEffect(() => {
    setNavVisible(false);
    return () => setNavVisible(true);
  }, [setNavVisible]);

  const [profile, setProfile]             = useState<NutritionProfile | null>(null);
  const [entries, setEntries]             = useState<NutritionEntry[]>([]);
  const [weekEntries, setWeekEntries]     = useState<Record<string, NutritionEntry[]>>({});
  const [runBurnKcal, setRunBurnKcal]     = useState(0);
  const [showSearch, setShowSearch]       = useState(false);
  const [defaultMeal, setDefaultMeal]     = useState<Meal>('snacks');
  const [expandedMeal, setExpandedMeal]   = useState<Meal | null>(null);
  const [loading, setLoading]             = useState(true);

  const today = todayKey();

  const load = useCallback(async () => {
    const prof = await getNutritionProfile();
    if (!prof) { setLoading(false); return; }
    setProfile(prof);

    const todayEntries = await getNutritionEntries(today);
    setEntries(todayEntries);

    // Week range for bar chart
    const weekDates = getWeekDates();
    const from = weekDates[0], to = weekDates[weekDates.length - 1];
    const range = await getNutritionEntriesRange(from, to);
    const byDate: Record<string, NutritionEntry[]> = {};
    weekDates.forEach(d => { byDate[d] = []; });
    range.forEach(e => { if (byDate[e.date]) byDate[e.date].push(e); });
    setWeekEntries(byDate);

    // Today's run burn
    const allRuns = await getRuns();
    const todayRuns = allRuns.filter(r => {
      const d = new Date(r.startTime).toISOString().slice(0, 10);
      return d === today;
    });
    const burn = todayRuns.reduce((s, r) => s + calcRunCalories(r.distanceMeters, prof.weightKg), 0);
    setRunBurnKcal(burn);

    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const foodEntries    = entries.filter(e => e.source !== 'run');
  const consumed       = foodEntries.reduce((s, e) => s + e.kcal, 0);
  const net            = consumed - runBurnKcal;
  const goal           = profile?.dailyGoalKcal ?? 2000;
  const remaining      = Math.max(0, goal - net);
  const over           = net > goal;
  const pct            = Math.min(net / Math.max(goal, 1), 1);
  const ringC          = 2 * Math.PI * 48;

  // Macros
  const proteinConsumed = foodEntries.reduce((s, e) => s + e.proteinG, 0);
  const carbsConsumed   = foodEntries.reduce((s, e) => s + e.carbsG, 0);
  const fatConsumed     = foodEntries.reduce((s, e) => s + e.fatG, 0);

  async function handleAdd(entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) {
    const xp = calcNutritionXP(foodEntries);
    const full: NutritionEntry = {
      ...entry,
      date: today,
      loggedAt: Date.now(),
      xpAwarded: xp > 0,
    };
    await addNutritionEntry(full);
    await load();
    setShowSearch(false);
  }

  async function handleDelete(id: number) {
    await deleteNutritionEntry(id);
    haptic('light');
    await load();
  }

  function openSearch(meal: Meal) {
    setDefaultMeal(meal);
    setShowSearch(true);
    haptic('light');
  }

  // Redirect to setup if no profile
  useEffect(() => {
    if (!loading && !profile) {
      navigate('/calories/setup', { replace: true });
    }
  }, [loading, profile, navigate]);

  if (loading) {
    return (
      <div style={{ height: '100%', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid rgba(217,53,24,0.2)`, borderTopColor: T.red, animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!profile) return null;

  const weekDates = getWeekDates();

  return (
    <div style={{ height: '100%', background: T.bg, overflowY: 'auto', fontFamily: F }}>

      {/* Header */}
      <div style={{
        background: T.white, borderBottom: `0.5px solid ${T.border}`,
        padding: '0 18px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
          <button
            onClick={() => navigate('/home')}
            style={{ width: 28, height: 28, borderRadius: '50%', background: T.stone, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
          >
            <ChevronLeft size={14} color={T.t2} strokeWidth={1.5} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontStyle: 'italic', fontFamily: FD, color: T.black, lineHeight: 1 }}>Calorie Tracker</div>
            <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, marginTop: 2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <button
            onClick={() => navigate('/calories/setup')}
            style={{ width: 28, height: 28, borderRadius: '50%', background: T.stone, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
          >
            <Settings size={14} color={T.t2} strokeWidth={1.5} />
          </button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => { setShowSearch(true); haptic('light'); }}
            style={{ width: 32, height: 32, borderRadius: '50%', background: T.red, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Plus size={16} color="#fff" strokeWidth={1.5} />
          </motion.button>
        </div>
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero ring card */}
        <div style={{ background: T.black, borderRadius: 20, padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
            <svg width="104" height="104" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="52" cy="52" r="48" stroke="rgba(255,255,255,0.1)" strokeWidth="5" fill="none" />
              <motion.circle
                cx="52" cy="52" r="48" fill="none"
                stroke={over ? T.orange : T.red}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={ringC}
                initial={{ strokeDashoffset: ringC }}
                animate={{ strokeDashoffset: ringC * (1 - pct) }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={14} color={over ? T.orange : T.red} strokeWidth={1.5} />
              <span style={{ fontSize: 18, fontWeight: 300, color: '#fff', fontFamily: F, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 4 }}>{consumed}</span>
              <span style={{ fontSize: 8, fontWeight: 400, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>kcal</span>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Daily goal</div>
              <div style={{ fontSize: 16, fontWeight: 300, color: '#fff', letterSpacing: '-0.02em' }}>
                {goal} <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>kcal</span>
              </div>
            </div>
            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
            <div>
              <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                {over ? 'Over budget' : 'Remaining'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 300, color: over ? T.orange : '#fff', letterSpacing: '-0.02em' }}>
                {over ? net - goal : remaining} <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>kcal</span>
              </div>
            </div>
            {runBurnKcal > 0 && (
              <>
                <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
                <div>
                  <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Burned today</div>
                  <div style={{ fontSize: 14, fontWeight: 300, color: T.orange, letterSpacing: '-0.02em' }}>
                    -{runBurnKcal} <span style={{ fontSize: 9, color: 'rgba(249,115,22,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>kcal</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Macro bars */}
        <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.black }}>Macros</div>
          {[
            { label: 'Protein', consumed: proteinConsumed, goal: profile.proteinGoalG, color: '#3B82F6' },
            { label: 'Carbs',   consumed: carbsConsumed,   goal: profile.carbsGoalG,   color: '#F59E0B' },
            { label: 'Fat',     consumed: fatConsumed,     goal: profile.fatGoalG,     color: '#10B981' },
          ].map(macro => {
            const pct = Math.min(macro.consumed / Math.max(macro.goal, 1), 1);
            return (
              <div key={macro.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 400, color: T.t2 }}>{macro.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 300, color: T.t3 }}>
                    {Math.round(macro.consumed)}g <span style={{ color: T.t3 }}>/ {macro.goal}g</span>
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: T.mid, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
                    style={{ height: '100%', borderRadius: 3, background: macro.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Meal sections */}
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal === meal.value && e.source !== 'run');
          const mealKcal    = mealEntries.reduce((s, e) => s + e.kcal, 0);
          const isExpanded  = expandedMeal === meal.value;

          return (
            <div key={meal.value} style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>
              {/* Meal header */}
              <button
                onClick={() => { setExpandedMeal(isExpanded ? null : meal.value); haptic('light'); }}
                style={{
                  width: '100%', padding: '13px 16px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: isExpanded ? `0.5px solid ${T.mid}` : 'none',
                }}
              >
                <span style={{ fontSize: 16 }}>{meal.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.black, flex: 1, textAlign: 'left' }}>{meal.label}</span>
                <span style={{ fontSize: 12, fontWeight: 300, color: mealKcal > 0 ? T.t2 : T.t3 }}>
                  {mealKcal > 0 ? `${mealKcal} kcal` : '—'}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); openSearch(meal.value); }}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: T.stone, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <Plus size={11} color={T.t2} strokeWidth={2} />
                </button>
                <div style={{ color: T.t3, marginLeft: 2 }}>
                  {isExpanded ? <ChevronUp size={13} strokeWidth={1.5} /> : <ChevronDown size={13} strokeWidth={1.5} />}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {mealEntries.length === 0 ? (
                      <div style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 300, color: T.t3 }}>No entries yet</div>
                        <button
                          onClick={() => openSearch(meal.value)}
                          style={{ marginTop: 6, fontSize: 11, color: T.red, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          + Add food
                        </button>
                      </div>
                    ) : (
                      <>
                        {mealEntries.map((entry, i) => (
                          <div key={entry.id} style={{
                            padding: '10px 16px',
                            borderBottom: i < mealEntries.length - 1 ? `0.5px solid ${T.mid}` : 'none',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 400, color: T.black }}>{entry.name}</div>
                              <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, marginTop: 1 }}>
                                {entry.servingSize} · P {entry.proteinG}g · C {entry.carbsG}g · F {entry.fatG}g
                              </div>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 300, color: T.black }}>{entry.kcal} kcal</span>
                            <button
                              onClick={() => { if (entry.id != null) handleDelete(entry.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                            >
                              <Trash2 size={12} color={T.t3} strokeWidth={1.5} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => openSearch(meal.value)}
                          style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', borderTop: `0.5px solid ${T.mid}` }}
                        >
                          <Plus size={11} color={T.red} strokeWidth={2} />
                          <span style={{ fontSize: 11, color: T.red, fontWeight: 400 }}>Add food</span>
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Weekly summary strip */}
        <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.black, marginBottom: 12 }}>This week</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            {weekDates.map((date, i) => {
              const dayEntries  = weekEntries[date] ?? [];
              const dayKcal     = dayEntries.filter(e => e.source !== 'run').reduce((s, e) => s + e.kcal, 0);
              const isToday     = date === today;
              const isPast      = date < today;
              const barPct      = Math.min(dayKcal / Math.max(goal, 1), 1);
              const maxBarH     = 48;

              return (
                <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {/* bar */}
                  <div style={{ width: '100%', height: maxBarH, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(barPct * maxBarH, dayKcal > 0 ? 4 : 0)}px` }}
                      transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                      style={{
                        width: '60%', borderRadius: 3,
                        background: isToday ? T.red : isPast && dayKcal > 0 ? T.t3 : T.mid,
                      }}
                    />
                  </div>
                  {/* day label */}
                  <div style={{ fontSize: 9, fontWeight: isToday ? 600 : 400, color: isToday ? T.red : T.t3 }}>
                    {DAY_LABELS[i]}
                  </div>
                  {/* kcal */}
                  <div style={{ fontSize: 8, color: T.t3, lineHeight: 1, textAlign: 'center' }}>
                    {dayKcal > 0 ? dayKcal : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Run burn info */}
        {runBurnKcal > 0 && (
          <div style={{
            background: T.orangeLo, border: `0.5px solid rgba(249,115,22,0.2)`,
            borderRadius: 12, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Flame size={16} color={T.orange} strokeWidth={1.5} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.orange }}>Burned from running today</div>
              <div style={{ fontSize: 11, fontWeight: 300, color: 'rgba(249,115,22,0.7)', marginTop: 1 }}>
                {runBurnKcal} kcal · net {net} / {goal} kcal
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Food search modal */}
      <AnimatePresence>
        {showSearch && (
          <FoodSearch
            defaultMeal={defaultMeal}
            onAdd={handleAdd}
            onClose={() => setShowSearch(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
