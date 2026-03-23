import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, ChevronUp, Clock, PenLine, ScanLine } from 'lucide-react';
import { NutritionEntry } from '@shared/services/store';
import { getRecentFoods } from '@shared/services/store';
import { FoodItem } from '../data/commonFoods';
import { searchLocalFoods, searchOpenFoodFacts, calcServingNutrition } from '../services/nutritionService';
import { haptic } from '@shared/lib/haptics';
import { T, F } from '@shared/design-system/tokens';

type Meal = NutritionEntry['meal'];
type Tab  = 'search' | 'manual';

const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch'     },
  { value: 'dinner',    label: 'Dinner'    },
  { value: 'snacks',    label: 'Snacks'    },
];

const CATEGORIES = [
  { value: 'all',     label: 'All'     },
  { value: 'protein', label: 'Protein' },
  { value: 'carbs',   label: 'Carbs'   },
  { value: 'dairy',   label: 'Dairy'   },
  { value: 'fruit',   label: 'Fruit'   },
  { value: 'veg',     label: 'Veg'     },
  { value: 'fat',     label: 'Fat'     },
  { value: 'drink',   label: 'Drinks'  },
  { value: 'other',   label: 'Other'   },
];

interface Props {
  defaultMeal?: Meal;
  onAdd: (entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) => void;
  onClose: () => void;
}

export function FoodSearch({ defaultMeal = 'snacks', onAdd, onClose }: Props) {
  const [tab, setTab]                   = useState<Tab>('search');
  const [query, setQuery]               = useState('');
  const [category, setCategory]         = useState('all');
  const [localResults, setLocalResults] = useState<FoodItem[]>(() => searchLocalFoods('', 'all'));
  const [offResults, setOffResults]     = useState<FoodItem[]>([]);
  const [offLoading, setOffLoading]     = useState(false);
  const [offError, setOffError]         = useState(false);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [serving, setServing]           = useState<Record<string, string>>({});
  const [meal, setMeal]                 = useState<Meal>(defaultMeal);
  const [recentFoods, setRecentFoods]   = useState<NutritionEntry[]>([]);

  // Manual entry
  const [manualName,    setManualName]    = useState('');
  const [manualKcal,    setManualKcal]    = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs,   setManualCarbs]   = useState('');
  const [manualFat,     setManualFat]     = useState('');
  const [manualServing, setManualServing] = useState('1 serving');
  const [manualMeal,    setManualMeal]    = useState<Meal>(defaultMeal);
  const [manualError,   setManualError]   = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const offTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120);
    getRecentFoods(10).then(setRecentFoods);
  }, []);

  useEffect(() => { setLocalResults(searchLocalFoods(query, category)); }, [query, category]);

  const triggerOFF = useCallback((q: string) => {
    if (offTimer.current) clearTimeout(offTimer.current);
    if (q.length < 3) { setOffResults([]); setOffError(false); return; }
    offTimer.current = setTimeout(async () => {
      setOffLoading(true); setOffError(false);
      try {
        const r = await searchOpenFoodFacts(q);
        setOffResults(r);
      } catch { setOffError(true); }
      setOffLoading(false);
    }, 400);
  }, []);

  useEffect(() => { triggerOFF(query); }, [query, triggerOFF]);
  useEffect(() => () => { if (offTimer.current) clearTimeout(offTimer.current); }, []);

  function toggleExpand(id: string, food: FoodItem) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!serving[id]) setServing(prev => ({ ...prev, [id]: String(food.defaultServingG) }));
    haptic('light');
  }

  function handleAddFood(food: FoodItem) {
    const g = parseFloat(serving[food.id] ?? String(food.defaultServingG));
    if (!g || g <= 0) return;
    const n = calcServingNutrition(food, g);
    onAdd({ meal, name: food.name, kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG, servingSize: `${g}g`, source: 'search' });
    haptic('medium');
  }

  function handleAddRecent(entry: NutritionEntry) {
    onAdd({ meal, name: entry.name, kcal: entry.kcal, proteinG: entry.proteinG, carbsG: entry.carbsG, fatG: entry.fatG, servingSize: entry.servingSize, source: entry.source === 'manual' ? 'manual' : 'search' });
    haptic('medium');
  }

  function handleManualAdd() {
    if (!manualName.trim()) { setManualError('Food name is required'); return; }
    const kcal = parseFloat(manualKcal);
    if (!kcal || kcal <= 0) { setManualError('Enter a valid calorie amount'); return; }
    setManualError('');
    onAdd({
      meal: manualMeal,
      name: manualName.trim(),
      kcal: Math.round(kcal),
      proteinG: Math.round(parseFloat(manualProtein) || 0),
      carbsG:   Math.round(parseFloat(manualCarbs)   || 0),
      fatG:     Math.round(parseFloat(manualFat)      || 0),
      servingSize: manualServing.trim() || '1 serving',
      source: 'manual',
    });
    haptic('medium');
  }

  function renderFoodRow(food: FoodItem, fromOFF = false) {
    const g    = parseFloat(serving[food.id] ?? String(food.defaultServingG));
    const n    = calcServingNutrition(food, g || food.defaultServingG);
    const isEx = expanded === food.id;

    return (
      <div key={food.id} style={{ borderBottom: `0.5px solid ${T.mid}` }}>
        {/* Collapsed row */}
        <button
          onClick={() => toggleExpand(food.id, food)}
          style={{ width: '100%', padding: '10px 18px', display: 'flex', alignItems: 'center', background: isEx ? T.redLo : T.white, border: 'none', cursor: 'pointer', textAlign: 'left', gap: 10 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F, marginBottom: 2 }}>{food.name}</div>
            <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>
              per {food.defaultServing}{fromOFF && ' · Open Food Facts'}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 300, color: T.black }}>{Math.round(food.kcalPer100g * food.defaultServingG / 100)}</span>
            <span style={{ fontSize: 9, fontWeight: 300, color: T.t3, marginLeft: 2 }}>kcal</span>
          </div>
          <div style={{ color: T.t3, flexShrink: 0 }}>
            {isEx ? <ChevronUp size={13} strokeWidth={1.5} /> : <ChevronDown size={13} strokeWidth={1.5} />}
          </div>
        </button>

        {/* Expanded panel */}
        <AnimatePresence>
          {isEx && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ background: T.redLo, border: `0.5px solid rgba(217,53,24,0.15)`, borderRadius: '0 0 10px 10px', padding: '12px 18px', margin: '0 0 0 0' }}>
                {/* Serving size row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 400, color: T.t2, flex: 1, fontFamily: F }}>Serving size</span>
                  <input
                    type="number"
                    value={serving[food.id] ?? String(food.defaultServingG)}
                    onChange={e => setServing(prev => ({ ...prev, [food.id]: e.target.value }))}
                    style={{ width: 70, background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: F, color: T.black, textAlign: 'right', outline: 'none' }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 400, color: T.t2, fontFamily: F }}>g</span>
                </div>

                {/* Macro preview row — 4 cells */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {[
                    { label: 'Cal',     value: String(n.kcal),                  bg: T.white,    color: T.black, border: T.border },
                    { label: 'Protein', value: `${n.proteinG}g`,                bg: T.blueLo,   color: T.blue,  border: 'transparent' },
                    { label: 'Carbs',   value: `${n.carbsG}g`,                  bg: T.amberLo,  color: T.amber, border: 'transparent' },
                    { label: 'Fat',     value: `${n.fatG}g`,                    bg: T.greenLo,  color: T.green, border: 'transparent' },
                  ].map(c => (
                    <div key={c.label} style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 6, padding: '5px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 300, color: c.color, letterSpacing: '-0.01em', lineHeight: 1, marginBottom: 2 }}>{c.value}</div>
                      <div style={{ fontSize: 7, fontWeight: 400, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* Meal selector */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                  {MEALS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMeal(m.value)}
                      style={{
                        padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${meal === m.value ? T.black : T.border}`,
                        background: meal === m.value ? T.black : 'transparent',
                        color: meal === m.value ? '#fff' : T.t2,
                        fontSize: 9, fontWeight: meal === m.value ? 500 : 400, fontFamily: F, cursor: 'pointer',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAddFood(food)}
                  style={{ width: '100%', padding: '10px 0', borderRadius: 4, border: 'none', background: T.black, color: '#fff', fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: F, cursor: 'pointer' }}
                >
                  Add to {MEALS.find(m => m.value === meal)?.label}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const showOFF    = offResults.length > 0 || offLoading;
  const showRecent = tab === 'search' && query === '' && recentFoods.length > 0;
  const noResults  = tab === 'search' && localResults.length === 0 && !offLoading && offResults.length === 0 && query.length > 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', height: '75vh', background: T.bg,
          borderRadius: '24px 24px 0 0', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 32, height: 3, borderRadius: 2, background: T.border, margin: '10px auto 14px', flexShrink: 0 }} />

        {/* Sheet header */}
        <div style={{ padding: '0 18px 12px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: T.black, fontFamily: F }}>Add food</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Tab switcher */}
            <button
              onClick={() => { setTab(tab === 'search' ? 'manual' : 'search'); haptic('light'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${T.border}`, background: tab === 'manual' ? T.black : T.stone, cursor: 'pointer' }}
            >
              <PenLine size={10} color={tab === 'manual' ? '#fff' : T.t2} strokeWidth={1.5} />
              <span style={{ fontSize: 9, fontWeight: 500, color: tab === 'manual' ? '#fff' : T.t2, fontFamily: F }}>Manual</span>
            </button>
            <button
              onClick={onClose}
              style={{ width: 26, height: 26, borderRadius: '50%', background: T.stone, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={11} color={T.black} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {tab === 'search' && (<>
          {/* Search input */}
          <div style={{ padding: '10px 18px', background: T.white, borderBottom: `0.5px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 20, padding: '8px 14px' }}>
              <Search size={13} color={T.t3} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search food…"
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, fontFamily: F, color: T.black, outline: 'none', minWidth: 0 }}
              />
              {query.length > 0
                ? <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><X size={11} color={T.t3} strokeWidth={1.5} /></button>
                : <ScanLine size={13} color={T.t3} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              }
            </div>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 5, padding: '8px 18px', background: T.white, borderBottom: `0.5px solid ${T.border}`, overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  padding: '4px 10px', borderRadius: 20, flexShrink: 0, cursor: 'pointer',
                  background: category === c.value ? T.redLo : T.bg,
                  border: `0.5px solid ${category === c.value ? 'rgba(217,53,24,0.25)' : T.border}`,
                  color: category === c.value ? T.red : T.t3,
                  fontSize: 9, fontWeight: category === c.value ? 500 : 400, fontFamily: F,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>)}

        {/* Scrollable results / manual form */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── Search tab ── */}
          {tab === 'search' && (<>

            {/* Recent foods */}
            {showRecent && (
              <div>
                <div style={{ padding: '8px 18px 4px', display: 'flex', alignItems: 'center', gap: 5, background: T.bg }}>
                  <Clock size={10} color={T.t3} strokeWidth={1.5} />
                  <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, fontFamily: F }}>Recent</span>
                </div>
                {recentFoods.map(entry => (
                  <button
                    key={`r-${entry.id}`}
                    onClick={() => handleAddRecent(entry)}
                    style={{ width: '100%', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, background: T.white, border: 'none', borderBottom: `0.5px solid ${T.mid}`, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F }}>{entry.name}</div>
                      <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F, marginTop: 1 }}>{entry.servingSize}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 300, color: T.black }}>{entry.kcal}</span>
                      <span style={{ fontSize: 9, color: T.t3, marginLeft: 2 }}>kcal</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.red, fontFamily: F, flexShrink: 0 }}>+</span>
                  </button>
                ))}
                <div style={{ height: '0.5px', background: T.mid }} />
              </div>
            )}

            {/* Local results */}
            {localResults.length > 0 && (
              <div>
                <div style={{ padding: '8px 18px 4px', background: T.bg }}>
                  <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, fontFamily: F }}>Search results</span>
                </div>
                <div style={{ background: T.white }}>
                  {localResults.map(f => renderFoodRow(f, false))}
                </div>
              </div>
            )}

            {/* No local results */}
            {noResults && (
              <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 300, color: T.t3, fontFamily: F, margin: '0 0 8px' }}>No local matches for "{query}"</p>
                {query.length >= 3
                  ? <p style={{ fontSize: 11, color: T.t3, fontFamily: F, margin: 0 }}>Searching Open Food Facts…</p>
                  : (
                    <button onClick={() => setTab('manual')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.red, fontFamily: F, fontWeight: 600 }}>
                      Add manually →
                    </button>
                  )
                }
              </div>
            )}

            {/* Open Food Facts */}
            {showOFF && (
              <div>
                <div style={{ padding: '8px 18px 4px', background: T.bg, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, fontFamily: F }}>
                    {offLoading ? 'Searching…' : 'Open Food Facts'}
                  </span>
                </div>
                {offLoading
                  ? <div style={{ padding: '12px 18px', textAlign: 'center', background: T.bg }}><span style={{ fontSize: 11, color: T.t3, fontFamily: F }}>Loading…</span></div>
                  : <div style={{ background: '#F4F1EE' }}>{offResults.map(f => renderFoodRow(f, true))}</div>
                }
              </div>
            )}

            {/* OFF error / not found → suggest manual */}
            {!offLoading && offError && query.length >= 3 && (
              <div style={{ padding: '12px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: T.t3, fontFamily: F, margin: '0 0 6px' }}>Couldn't reach Open Food Facts</p>
                <button onClick={() => setTab('manual')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.red, fontFamily: F, fontWeight: 600 }}>Add manually →</button>
              </div>
            )}
            {!offLoading && !offError && offResults.length === 0 && localResults.length === 0 && query.length >= 3 && (
              <div style={{ padding: '8px 18px', textAlign: 'center' }}>
                <button onClick={() => setTab('manual')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.red, fontFamily: F, fontWeight: 600 }}>
                  Not found? Add manually →
                </button>
              </div>
            )}
          </>)}

          {/* ── Manual tab ── */}
          {tab === 'manual' && (
            <div style={{ padding: '16px 18px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 300, color: T.t3, fontFamily: F, margin: 0 }}>
                Enter details from your food label or estimate.
              </p>

              {/* Name */}
              <div>
                <label style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, fontFamily: F, display: 'block', marginBottom: 5 }}>Food name *</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="e.g. Homemade chicken curry"
                  style={{ width: '100%', height: 40, border: `0.5px solid ${manualError && !manualName ? T.red : T.border}`, borderRadius: 8, padding: '0 12px', fontSize: 13, fontFamily: F, color: T.black, background: T.white, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Serving */}
              <div>
                <label style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, fontFamily: F, display: 'block', marginBottom: 5 }}>Serving size</label>
                <input
                  type="text"
                  value={manualServing}
                  onChange={e => setManualServing(e.target.value)}
                  placeholder="e.g. 1 bowl, 250g"
                  style={{ width: '100%', height: 40, border: `0.5px solid ${T.border}`, borderRadius: 8, padding: '0 12px', fontSize: 13, fontFamily: F, color: T.black, background: T.white, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Calories */}
              <div>
                <label style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, fontFamily: F, display: 'block', marginBottom: 5 }}>Calories (kcal) *</label>
                <input
                  type="number"
                  value={manualKcal}
                  onChange={e => setManualKcal(e.target.value)}
                  placeholder="e.g. 420"
                  style={{ width: '100%', height: 40, border: `0.5px solid ${manualError && !manualKcal ? T.red : T.border}`, borderRadius: 8, padding: '0 12px', fontSize: 13, fontFamily: F, color: T.black, background: T.white, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Macros */}
              <div>
                <label style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, fontFamily: F, display: 'block', marginBottom: 5 }}>Macros (g) — optional</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Protein', value: manualProtein, set: setManualProtein, color: T.blue  },
                    { label: 'Carbs',   value: manualCarbs,   set: setManualCarbs,   color: T.amber },
                    { label: 'Fat',     value: manualFat,     set: setManualFat,     color: T.green },
                  ].map(m => (
                    <div key={m.label}>
                      <div style={{ fontSize: 8, fontWeight: 600, color: m.color, marginBottom: 4, fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                      <input
                        type="number"
                        value={m.value}
                        onChange={e => m.set(e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', height: 36, border: `0.5px solid ${T.border}`, borderRadius: 6, padding: '0 8px', fontSize: 13, fontFamily: F, color: T.black, background: T.white, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Meal */}
              <div>
                <label style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, fontFamily: F, display: 'block', marginBottom: 6 }}>Meal</label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {MEALS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setManualMeal(m.value)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                        border: `0.5px solid ${manualMeal === m.value ? T.black : T.border}`,
                        background: manualMeal === m.value ? T.black : T.white,
                        color: manualMeal === m.value ? '#fff' : T.t2,
                        fontSize: 11, fontWeight: manualMeal === m.value ? 500 : 400, fontFamily: F,
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {manualError && <p style={{ fontSize: 12, color: T.red, fontFamily: F, margin: 0 }}>{manualError}</p>}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleManualAdd}
                style={{ width: '100%', padding: '13px 0', borderRadius: 4, border: 'none', background: T.black, color: '#fff', fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: F, cursor: 'pointer', marginTop: 4 }}
              >
                Add to {MEALS.find(m => m.value === manualMeal)?.label}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
