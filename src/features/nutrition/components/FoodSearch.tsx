import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { NutritionEntry } from '@shared/services/store';
import { FoodItem } from '../data/commonFoods';
import { searchLocalFoods, searchOpenFoodFacts, calcServingNutrition } from '../services/nutritionService';
import { haptic } from '@shared/lib/haptics';

const T = {
  bg: '#F8F6F3', white: '#FFFFFF', stone: '#F0EDE8',
  border: '#DDD9D4', mid: '#E8E4DF', black: '#0A0A0A',
  t2: '#6B6B6B', t3: '#ADADAD',
  red: '#D93518', redLo: '#FEF0EE',
};
const F = "'Barlow', sans-serif";

type Meal = NutritionEntry['meal'];

const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch' },
  { value: 'dinner',    label: 'Dinner' },
  { value: 'snacks',    label: 'Snacks' },
];

const CATEGORIES = [
  { value: 'all',     label: 'All' },
  { value: 'protein', label: 'Protein' },
  { value: 'carbs',   label: 'Carbs' },
  { value: 'dairy',   label: 'Dairy' },
  { value: 'fruit',   label: 'Fruit' },
  { value: 'veg',     label: 'Veg' },
  { value: 'fat',     label: 'Fat' },
  { value: 'drink',   label: 'Drinks' },
  { value: 'other',   label: 'Other' },
];

interface Props {
  defaultMeal?: Meal;
  onAdd: (entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) => void;
  onClose: () => void;
}

export function FoodSearch({ defaultMeal = 'snacks', onAdd, onClose }: Props) {
  const [query, setQuery]               = useState('');
  const [category, setCategory]         = useState('all');
  const [localResults, setLocalResults] = useState<FoodItem[]>(() => searchLocalFoods('', 'all'));
  const [offResults, setOffResults]     = useState<FoodItem[]>([]);
  const [offLoading, setOffLoading]     = useState(false);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [serving, setServing]           = useState<Record<string, string>>({});
  const [meal, setMeal]                 = useState<Meal>(defaultMeal);
  const inputRef  = useRef<HTMLInputElement>(null);
  const offTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  // Local search — instant
  useEffect(() => {
    setLocalResults(searchLocalFoods(query, category));
  }, [query, category]);

  // OFF search — debounced 350ms, only if query ≥ 3 chars
  const triggerOFF = useCallback((q: string) => {
    if (offTimer.current) clearTimeout(offTimer.current);
    if (q.length < 3) { setOffResults([]); return; }
    offTimer.current = setTimeout(async () => {
      setOffLoading(true);
      const results = await searchOpenFoodFacts(q);
      setOffResults(results);
      setOffLoading(false);
    }, 350);
  }, []);

  useEffect(() => { triggerOFF(query); }, [query, triggerOFF]);
  useEffect(() => () => { if (offTimer.current) clearTimeout(offTimer.current); }, []);

  function toggleExpand(id: string, food: FoodItem) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!serving[id]) setServing(prev => ({ ...prev, [id]: String(food.defaultServingG) }));
    haptic('light');
  }

  function handleAdd(food: FoodItem) {
    const servingG = parseFloat(serving[food.id] ?? String(food.defaultServingG));
    if (!servingG || servingG <= 0) return;
    const nutrition = calcServingNutrition(food, servingG);
    onAdd({
      meal,
      name: food.name,
      kcal: nutrition.kcal,
      proteinG: nutrition.proteinG,
      carbsG: nutrition.carbsG,
      fatG: nutrition.fatG,
      servingSize: `${servingG}g`,
      source: 'search',
    });
    haptic('medium');
    setExpanded(null);
  }

  function renderFoodRow(food: FoodItem, fromOFF = false) {
    const servingG    = parseFloat(serving[food.id] ?? String(food.defaultServingG));
    const nutrition   = calcServingNutrition(food, servingG || food.defaultServingG);
    const isExpanded  = expanded === food.id;

    return (
      <div key={food.id}>
        <button
          onClick={() => toggleExpand(food.id, food)}
          style={{
            width: '100%', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            background: isExpanded ? T.redLo : 'transparent',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.15s ease',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 400, color: T.black, fontFamily: F }}>{food.name}</div>
            <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F, marginTop: 2 }}>
              {food.defaultServing} · {Math.round(food.kcalPer100g * food.defaultServingG / 100)} kcal
              <span style={{ marginLeft: 8, color: T.t3 }}>P {Math.round(food.proteinPer100g * food.defaultServingG / 100)}g · C {Math.round(food.carbsPer100g * food.defaultServingG / 100)}g · F {Math.round(food.fatPer100g * food.defaultServingG / 100)}g</span>
            </div>
            {fromOFF && <div style={{ fontSize: 9, color: T.t3, fontFamily: F, marginTop: 2, fontStyle: 'italic' }}>Open Food Facts</div>}
          </div>
          <div style={{ color: T.t3, flexShrink: 0 }}>
            {isExpanded ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '0 16px 14px', background: T.redLo }}>
                {/* Serving input */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, fontFamily: F, marginBottom: 4 }}>Serving size (g)</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number"
                      value={serving[food.id] ?? String(food.defaultServingG)}
                      onChange={e => setServing(prev => ({ ...prev, [food.id]: e.target.value }))}
                      style={{ flex: 1, height: 36, border: `0.5px solid ${T.border}`, borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: F, color: T.black, background: T.white, outline: 'none' }}
                    />
                    <div style={{ fontSize: 11, color: T.t2, fontFamily: F, minWidth: 70, textAlign: 'right' }}>
                      {nutrition.kcal} kcal
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: T.t3, marginTop: 4, fontFamily: F }}>
                    P {nutrition.proteinG}g · C {nutrition.carbsG}g · F {nutrition.fatG}g
                  </div>
                </div>

                {/* Meal selector */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, fontFamily: F, marginBottom: 6 }}>Meal</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {MEALS.map(m => (
                      <button
                        key={m.value}
                        onClick={() => setMeal(m.value)}
                        style={{
                          padding: '5px 12px', borderRadius: 20,
                          border: `0.5px solid ${meal === m.value ? T.red : T.border}`,
                          background: meal === m.value ? T.red : T.white,
                          color: meal === m.value ? '#fff' : T.t2,
                          fontSize: 11, fontWeight: meal === m.value ? 500 : 400, fontFamily: F,
                          cursor: 'pointer',
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAdd(food)}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                    background: T.black, color: '#fff',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const, fontFamily: F,
                    cursor: 'pointer',
                  }}
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

  const showDivider = offResults.length > 0 || offLoading;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: T.white,
          borderRadius: '20px 20px 0 0',
          maxHeight: '75vh',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
          overflow: 'hidden',
        }}
      >
        {/* Handle */}
        <div style={{ width: 32, height: 3, borderRadius: 2, background: T.mid, margin: '12px auto 0' }} />

        {/* Header + Search */}
        <div style={{ padding: '12px 16px 10px', borderBottom: `0.5px solid ${T.mid}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontStyle: 'italic', fontFamily: "'Playfair Display', serif", color: T.black }}>
              Add food
            </div>
            <button
              onClick={onClose}
              style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: '50%', background: T.stone, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={12} color={T.t2} strokeWidth={2} />
            </button>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} color={T.t3} strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search food…"
              style={{
                width: '100%', height: 38,
                border: `0.5px solid ${T.border}`, borderRadius: 8,
                padding: '0 12px 0 32px',
                fontSize: 13, fontFamily: F, color: T.black, background: T.bg,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
              >
                <X size={12} color={T.t3} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  padding: '4px 12px', borderRadius: 20, flexShrink: 0,
                  border: `0.5px solid ${category === c.value ? T.red : T.border}`,
                  background: category === c.value ? T.red : 'transparent',
                  color: category === c.value ? '#fff' : T.t2,
                  fontSize: 11, fontWeight: category === c.value ? 500 : 400, fontFamily: F,
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {localResults.length === 0 && !offLoading && offResults.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 300, color: T.t3, fontFamily: F }}>No local matches</div>
              {query.length >= 3 && (
                <div style={{ fontSize: 11, color: T.t3, fontFamily: F, marginTop: 6 }}>Searching Open Food Facts…</div>
              )}
            </div>
          )}

          {/* Local results */}
          <div style={{ borderBottom: showDivider ? `0.5px solid ${T.mid}` : 'none' }}>
            {localResults.map(f => renderFoodRow(f, false))}
          </div>

          {/* OFF divider */}
          {showDivider && (
            <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: '0.5px', background: T.mid }} />
              <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, fontFamily: F, flexShrink: 0 }}>
                {offLoading ? 'Searching…' : 'Open Food Facts'}
              </span>
              <div style={{ flex: 1, height: '0.5px', background: T.mid }} />
            </div>
          )}

          {/* OFF results */}
          {offResults.map(f => renderFoodRow(f, true))}
          {offLoading && (
            <div style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: T.t3, fontFamily: F }}>Loading…</div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
