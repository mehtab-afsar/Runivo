import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Plus, Flame, Trash2 } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';

const T = {
  bg: '#F8F6F3', white: '#FFFFFF', stone: '#F0EDE8',
  border: '#DDD9D4', mid: '#E8E4DF', black: '#0A0A0A',
  t2: '#6B6B6B', t3: '#ADADAD',
  red: '#D93518', redLo: '#FEF0EE',
  orange: '#C45C00', orangeLo: '#FEF3EE',
};
const F  = "'Barlow', sans-serif";
const FD = "'Playfair Display', serif";

const CALORIE_GOAL_KEY = 'runivo-calorie-goal';
const CALORIE_LOG_KEY  = 'runivo-calorie-log';

interface LogEntry {
  id: string;
  name: string;
  calories: number;
  time: string;
  date: string; // YYYY-MM-DD
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalorieTracker() {
  const navigate = useNavigate();
  const [goal,     setGoal]     = useState(() => Number(localStorage.getItem(CALORIE_GOAL_KEY) || 2000));
  const [log,      setLog]      = useState<LogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(CALORIE_LOG_KEY) || '[]'); } catch { return []; }
  });
  const [showAdd,  setShowAdd]  = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodCal,  setFoodCal]  = useState('');
  const [editGoal, setEditGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(goal));

  const today = todayKey();
  const todayEntries = log.filter(e => e.date === today);
  const consumed = todayEntries.reduce((s, e) => s + e.calories, 0);
  const remaining = Math.max(0, goal - consumed);
  const pct = Math.min(consumed / Math.max(goal, 1), 1);
  const over = consumed > goal;

  useEffect(() => {
    localStorage.setItem(CALORIE_LOG_KEY, JSON.stringify(log));
  }, [log]);

  function addEntry() {
    if (!foodName.trim() || !foodCal || Number(foodCal) <= 0) return;
    const entry: LogEntry = {
      id: Date.now().toString(),
      name: foodName.trim(),
      calories: Number(foodCal),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      date: today,
    };
    setLog(prev => [entry, ...prev]);
    setFoodName('');
    setFoodCal('');
    setShowAdd(false);
    haptic('light');
  }

  function deleteEntry(id: string) {
    setLog(prev => prev.filter(e => e.id !== id));
    haptic('light');
  }

  function saveGoal() {
    const g = Number(goalDraft);
    if (g > 0) {
      setGoal(g);
      localStorage.setItem(CALORIE_GOAL_KEY, String(g));
    }
    setEditGoal(false);
  }

  const ringC = 2 * Math.PI * 48;

  return (
    <div style={{ height: '100%', background: T.bg, overflowY: 'auto', fontFamily: F }}>

      {/* Header */}
      <div style={{
        background: T.white, borderBottom: `0.5px solid ${T.border}`,
        paddingTop: 'max(14px, env(safe-area-inset-top))',
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
            <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F, marginTop: 2 }}>Today's intake</div>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => { setShowAdd(true); haptic('light'); }}
            style={{ width: 32, height: 32, borderRadius: '50%', background: T.red, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Plus size={16} color="#fff" strokeWidth={1.5} />
          </motion.button>
        </div>
      </div>

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero ring card */}
        <div style={{ background: T.black, borderRadius: 20, padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Ring */}
          <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
            <svg width="104" height="104" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="52" cy="52" r="48" stroke="rgba(255,255,255,0.1)" strokeWidth="5" fill="none" />
              <motion.circle
                cx="52" cy="52" r="48" fill="none"
                stroke={over ? '#F97316' : T.red}
                strokeWidth="5" strokeLinecap="round"
                strokeDasharray={ringC}
                initial={{ strokeDashoffset: ringC }}
                animate={{ strokeDashoffset: ringC * (1 - pct) }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={14} color={over ? '#F97316' : T.red} strokeWidth={1.5} />
              <span style={{ fontSize: 18, fontWeight: 300, color: '#fff', fontFamily: F, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 4 }}>{consumed}</span>
              <span style={{ fontSize: 8, fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>kcal</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Daily goal</div>
              {editGoal ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    value={goalDraft}
                    onChange={e => setGoalDraft(e.target.value)}
                    autoFocus
                    style={{ width: 60, background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '3px 6px', fontSize: 12, color: '#fff', fontFamily: F, outline: 'none' }}
                  />
                  <button onClick={saveGoal} style={{ fontSize: 10, color: T.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, fontWeight: 500 }}>Save</button>
                </div>
              ) : (
                <button onClick={() => { setGoalDraft(String(goal)); setEditGoal(true); }} style={{ fontSize: 16, fontWeight: 300, color: '#fff', fontFamily: F, letterSpacing: '-0.02em', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  {goal} <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>kcal</span>
                </button>
              )}
            </div>
            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
            <div>
              <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{over ? 'Over by' : 'Remaining'}</div>
              <div style={{ fontSize: 16, fontWeight: 300, color: over ? '#F97316' : '#fff', fontFamily: F, letterSpacing: '-0.02em' }}>
                {over ? consumed - goal : remaining} <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>kcal</span>
              </div>
            </div>
            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)' }} />
            <div>
              <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.4)', fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Entries today</div>
              <div style={{ fontSize: 16, fontWeight: 300, color: '#fff', fontFamily: F, letterSpacing: '-0.02em' }}>{todayEntries.length}</div>
            </div>
          </div>
        </div>

        {/* Today log */}
        <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 10px', borderBottom: `0.5px solid ${T.mid}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F }}>Today's log</span>
            <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>{consumed} / {goal} kcal</span>
          </div>
          {todayEntries.length > 0 ? todayEntries.map((e, i) => (
            <div key={e.id} style={{ padding: '11px 16px', borderBottom: i < todayEntries.length - 1 ? `0.5px solid ${T.mid}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: T.redLo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Flame size={13} color={T.red} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 400, color: T.black, fontFamily: F }}>{e.name}</div>
                <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>{e.time}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 300, color: T.black, fontFamily: F, letterSpacing: '-0.02em' }}>{e.calories} kcal</span>
              <button onClick={() => deleteEntry(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                <Trash2 size={13} color={T.t3} strokeWidth={1.5} />
              </button>
            </div>
          )) : (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 300, color: T.t3, fontFamily: F }}>No entries yet</div>
              <button onClick={() => setShowAdd(true)} style={{ marginTop: 8, fontSize: 11, fontWeight: 400, color: T.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F }}>+ Add food</button>
            </div>
          )}
        </div>

      </div>

      {/* Add food modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowAdd(false)}>
          <motion.div
            initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
            transition={{ type: 'spring', damping: 28 }}
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: T.white, borderRadius: '20px 20px 0 0', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div style={{ width: 32, height: 3, borderRadius: 2, background: T.mid, margin: '0 auto 18px' }} />
            <div style={{ fontSize: 16, fontStyle: 'italic', fontFamily: FD, color: T.black, marginBottom: 16 }}>Add food</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, fontFamily: F, marginBottom: 4 }}>Food name</div>
              <input
                type="text"
                value={foodName}
                onChange={e => setFoodName(e.target.value)}
                placeholder="e.g. Chicken breast"
                autoFocus
                style={{ width: '100%', height: 40, border: `0.5px solid ${T.border}`, borderRadius: 6, padding: '0 12px', fontSize: 13, fontFamily: F, color: T.black, background: T.bg, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, fontFamily: F, marginBottom: 4 }}>Calories (kcal)</div>
              <input
                type="number"
                value={foodCal}
                onChange={e => setFoodCal(e.target.value)}
                placeholder="e.g. 350"
                style={{ width: '100%', height: 40, border: `0.5px solid ${T.border}`, borderRadius: 6, padding: '0 12px', fontSize: 13, fontFamily: F, color: T.black, background: T.bg, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={addEntry}
              disabled={!foodName.trim() || !foodCal || Number(foodCal) <= 0}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 4, border: 'none',
                background: (!foodName.trim() || !foodCal || Number(foodCal) <= 0) ? T.mid : T.black,
                color: (!foodName.trim() || !foodCal || Number(foodCal) <= 0) ? T.t3 : '#fff',
                fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontFamily: F,
                cursor: (!foodName.trim() || !foodCal || Number(foodCal) <= 0) ? 'not-allowed' : 'pointer',
              }}
            >
              Add entry
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
