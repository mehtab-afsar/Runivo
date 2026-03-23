import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import { saveNutritionProfile, NutritionProfile } from '@shared/services/store';
import { getProfile } from '@shared/services/profile';
import { calcDailyGoal, calcMacroGoals } from '../services/nutritionService';
import { haptic } from '@shared/lib/haptics';
import { T, F } from '@shared/design-system/tokens';

type Goal          = 'lose' | 'maintain' | 'gain';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Diet          = 'everything' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'halal';

const GOALS: { value: Goal; label: string; emoji: string }[] = [
  { value: 'lose',     label: 'Lose weight',  emoji: '🔥' },
  { value: 'maintain', label: 'Maintain',      emoji: '⚖️' },
  { value: 'gain',     label: 'Gain muscle',   emoji: '💪' },
];

const DIETS: { value: Diet; label: string; emoji: string }[] = [
  { value: 'everything',  label: 'Everything',  emoji: '🍗' },
  { value: 'vegetarian',  label: 'Vegetarian',  emoji: '🥦' },
  { value: 'vegan',       label: 'Vegan',        emoji: '🌱' },
  { value: 'pescatarian', label: 'Pescatarian', emoji: '🐟' },
  { value: 'keto',        label: 'Keto',         emoji: '🥑' },
  { value: 'halal',       label: 'Halal',        emoji: '🌙' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string; emoji: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',         desc: 'Desk job, little movement',    emoji: '🛋️' },
  { value: 'light',       label: 'Lightly active',    desc: 'Some walking daily',            emoji: '🚶' },
  { value: 'moderate',    label: 'Moderately active', desc: 'Exercise 3–5 days/week',        emoji: '🏃' },
  { value: 'active',      label: 'Very active',       desc: 'Hard training most days',       emoji: '⚡' },
  { value: 'very_active', label: 'Athlete',            desc: 'Twice daily training',          emoji: '🏆' },
];

/** Count-up animation hook — animates from previous value to new target */
function useCountUp(target: number, duration = 400): number {
  const [displayed, setDisplayed] = useState(target);
  const prevRef    = useRef(target);
  const rafRef     = useRef<number | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; prevRef.current = target; return; }
    if (prevRef.current === target) return;
    const from = prevRef.current;
    const to   = target;
    const t0   = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 2); // ease-out quad
      setDisplayed(Math.round(from + (to - from) * e));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    prevRef.current = target;
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return displayed;
}

export default function NutritionSetup() {
  const navigate = useNavigate();
  const [step, setStep]                   = useState(0);
  const [goal, setGoal]                   = useState<Goal>('maintain');
  const [diet, setDiet]                   = useState<Diet>('everything');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [saving, setSaving]               = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [biometrics, setBiometrics]       = useState<{
    weightKg: number; heightCm: number; age: number; sex: 'male' | 'female';
  }>({ weightKg: 70, heightCm: 170, age: 25, sex: 'male' });

  useEffect(() => {
    getProfile().then(p => {
      if (p) setBiometrics({
        weightKg: p.weightKg || 70,
        heightCm: p.heightCm || 170,
        age:      p.age      || 25,
        sex:      p.gender === 'female' ? 'female' : 'male',
      });
      setProfileLoaded(true);
    });
  }, []);

  const tdeeTarget = calcDailyGoal({
    id: 'profile', goal, activityLevel, diet,
    weightKg: biometrics.weightKg, heightCm: biometrics.heightCm,
    age: biometrics.age, sex: biometrics.sex,
    dailyGoalKcal: 0, proteinGoalG: 0, carbsGoalG: 0, fatGoalG: 0,
  });
  const macros     = calcMacroGoals(tdeeTarget);
  const displayKcal = useCountUp(tdeeTarget, 400);

  function goBack() {
    if (step === 0) { navigate(-1); return; }
    setStep(0); haptic('light');
  }
  function goNext() {
    if (step === 0) { setStep(1); haptic('light'); return; }
    handleSave();
  }
  async function handleSave() {
    setSaving(true); haptic('medium');
    const draft: NutritionProfile = {
      id: 'profile', goal, activityLevel, diet,
      weightKg: biometrics.weightKg, heightCm: biometrics.heightCm,
      age: biometrics.age, sex: biometrics.sex,
      dailyGoalKcal: tdeeTarget,
      proteinGoalG:  macros.proteinG,
      carbsGoalG:    macros.carbsG,
      fatGoalG:      macros.fatG,
    };
    await saveNutritionProfile(draft);
    setSaving(false);
    navigate('/calories', { replace: true });
  }

  if (!profileLoaded) return null;

  return (
    <div style={{ height: '100%', background: T.bg, display: 'flex', flexDirection: 'column', fontFamily: F }}>

      {/* Header */}
      <div style={{ background: T.white, borderBottom: `0.5px solid ${T.border}`, padding: '0 18px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
          <button
            onClick={goBack}
            style={{ width: 28, height: 28, borderRadius: '50%', background: T.bg, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronLeft size={14} color={T.t2} strokeWidth={1.5} />
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500, color: T.black }}>
            {step === 0 ? 'Nutrition setup' : 'Activity level'}
          </span>
          <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, minWidth: 28, textAlign: 'right' }}>{step + 1}/2</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: step === 1 ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: step === 1 ? -20 : 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ padding: '16px 18px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}
          >

            {/* ── Step 0: Goal + Diet ── */}
            {step === 0 && (<>

              {/* Biometrics chip */}
              <div>
                <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', display: 'flex' }}>
                  {[
                    { value: String(biometrics.weightKg), label: 'kg' },
                    { value: String(biometrics.heightCm), label: 'cm' },
                    { value: String(biometrics.age),      label: 'age' },
                    { value: biometrics.sex === 'male' ? 'M' : 'F', label: 'sex' },
                  ].map((cell, i) => (
                    <div
                      key={i}
                      style={{ flex: 1, padding: '9px 6px', textAlign: 'center', borderLeft: i > 0 ? `0.5px solid ${T.border}` : 'none' }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 300, color: T.black, letterSpacing: '-0.01em', lineHeight: 1, marginBottom: 2 }}>{cell.value}</div>
                      <div style={{ fontSize: 7, fontWeight: 400, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cell.label}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 9, color: T.t3, margin: '5px 0 0', textAlign: 'center', fontFamily: F }}>From your profile</p>
              </div>

              {/* Goal cards */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, margin: '0 0 8px' }}>Your goal</p>
                <div style={{ display: 'flex', gap: 7 }}>
                  {GOALS.map(g => (
                    <button
                      key={g.value}
                      onClick={() => { setGoal(g.value); haptic('light'); }}
                      style={{
                        flex: 1, padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
                        background: goal === g.value ? T.redLo : T.white,
                        border: `0.5px solid ${goal === g.value ? 'rgba(217,53,24,0.3)' : T.border}`,
                        borderRadius: 10, transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 18, marginBottom: 5 }}>{g.emoji}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, lineHeight: 1.2, color: goal === g.value ? T.red : T.black, fontFamily: F }}>{g.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Diet grid */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, margin: '0 0 8px' }}>Dietary preference</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {DIETS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => { setDiet(d.value); haptic('light'); }}
                      style={{
                        padding: '8px 6px', textAlign: 'center', cursor: 'pointer',
                        background: diet === d.value ? T.redLo : T.white,
                        border: `0.5px solid ${diet === d.value ? 'rgba(217,53,24,0.3)' : T.border}`,
                        borderRadius: 8, transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 14, marginBottom: 3 }}>{d.emoji}</div>
                      <div style={{ fontSize: 9, fontWeight: diet === d.value ? 500 : 400, color: diet === d.value ? T.red : T.t2, fontFamily: F }}>{d.label}</div>
                    </button>
                  ))}
                </div>
              </div>

            </>)}

            {/* ── Step 1: Activity + TDEE ── */}
            {step === 1 && (<>

              {/* TDEE preview card */}
              <div style={{ background: T.black, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                  Your daily target
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 32, fontWeight: 300, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                    {displayKcal.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.4)' }}>kcal / day</span>
                </div>
                <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.10)', marginBottom: 8 }} />
                <div style={{ display: 'flex' }}>
                  {[
                    { label: 'Protein', value: `${macros.proteinG}g` },
                    { label: 'Carbs',   value: `${macros.carbsG}g`   },
                    { label: 'Fat',     value: `${macros.fatG}g`     },
                  ].map(m => (
                    <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 300, color: '#fff', lineHeight: 1, marginBottom: 2 }}>{m.value}</div>
                      <div style={{ fontSize: 8, fontWeight: 300, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity level cards */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: T.t3, margin: '0 0 8px' }}>How active are you?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ACTIVITY_LEVELS.map(a => {
                    const sel = activityLevel === a.value;
                    return (
                      <button
                        key={a.value}
                        onClick={() => { setActivityLevel(a.value); haptic('light'); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          background: sel ? T.redLo : T.white,
                          border: `0.5px solid ${sel ? 'rgba(217,53,24,0.25)' : T.border}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{a.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: sel ? T.red : T.black, marginBottom: 1, fontFamily: F }}>{a.label}</div>
                          <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>{a.desc}</div>
                        </div>
                        {/* Radio */}
                        <div style={{
                          width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                          border: `0.5px solid ${sel ? T.red : T.border}`,
                          background: sel ? T.red : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {sel && <Check size={8} color="#fff" strokeWidth={2.5} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </>)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div style={{
        padding: '10px 18px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        background: T.white, borderTop: `0.5px solid ${T.border}`, flexShrink: 0,
      }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={goNext}
          disabled={saving}
          style={{
            width: '100%', padding: '13px 0', border: 'none',
            borderRadius: 4,
            background: step === 1 ? T.red : T.black,
            color: '#fff', fontSize: 11, fontWeight: 500,
            textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            fontFamily: F, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : step === 0 ? 'Continue' : 'Save & start →'}
        </motion.button>
      </div>
    </div>
  );
}
