import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { saveNutritionProfile, NutritionProfile } from '@shared/services/store';
import { getProfile } from '@shared/services/profile';
import { calcDailyGoal, calcMacroGoals } from '../services/nutritionService';
import { haptic } from '@shared/lib/haptics';

const T = {
  bg: '#F8F6F3', white: '#FFFFFF', stone: '#F0EDE8',
  border: '#DDD9D4', mid: '#E8E4DF', black: '#0A0A0A',
  t2: '#6B6B6B', t3: '#ADADAD',
  red: '#D93518', redLo: '#FEF0EE',
};
const F  = "'Barlow', sans-serif";
const FD = "'Playfair Display', serif";

type Goal          = 'lose' | 'maintain' | 'gain';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Diet          = 'everything' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'halal';

const GOALS: { value: Goal; label: string; desc: string; emoji: string }[] = [
  { value: 'lose',     label: 'Lose weight',  desc: 'Calorie deficit',       emoji: '🔥' },
  { value: 'maintain', label: 'Maintain',     desc: 'Stay at current weight', emoji: '⚖️' },
  { value: 'gain',     label: 'Gain muscle',  desc: 'Calorie surplus',        emoji: '💪' },
];

const DIETS: { value: Diet; label: string; emoji: string }[] = [
  { value: 'everything',  label: 'Everything',    emoji: '🍗' },
  { value: 'vegetarian',  label: 'Vegetarian',    emoji: '🥦' },
  { value: 'vegan',       label: 'Vegan',         emoji: '🌱' },
  { value: 'pescatarian', label: 'Pescatarian',   emoji: '🐟' },
  { value: 'keto',        label: 'Keto',          emoji: '🥑' },
  { value: 'halal',       label: 'Halal',         emoji: '🌙' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string; emoji: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',         desc: 'Desk job, little exercise', emoji: '🛋️' },
  { value: 'light',       label: 'Lightly active',    desc: '1–3 workouts / week',       emoji: '🚶' },
  { value: 'moderate',    label: 'Moderately active', desc: '3–5 workouts / week',       emoji: '🏃' },
  { value: 'active',      label: 'Very active',       desc: '6–7 workouts / week',       emoji: '⚡' },
  { value: 'very_active', label: 'Athlete',            desc: 'Twice a day training',      emoji: '🏆' },
];

export default function NutritionSetup() {
  const navigate = useNavigate();
  const [step, setStep]                   = useState(0);
  const [goal, setGoal]                   = useState<Goal>('maintain');
  const [diet, setDiet]                   = useState<Diet>('everything');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [saving, setSaving]               = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Pre-load biometrics from onboarding profile — no re-entry needed
  const [biometrics, setBiometrics] = useState<{
    weightKg: number; heightCm: number; age: number; sex: 'male' | 'female';
  }>({ weightKg: 70, heightCm: 170, age: 25, sex: 'male' });

  useEffect(() => {
    getProfile().then(p => {
      if (p) {
        setBiometrics({
          weightKg: p.weightKg || 70,
          heightCm: p.heightCm || 170,
          age:      p.age      || 25,
          sex:      (p.gender === 'female' ? 'female' : 'male'),
        });
      }
      setProfileLoaded(true);
    });
  }, []);

  const totalSteps = 2;

  function goBack() {
    if (step === 0) { navigate(-1); return; }
    setStep(s => s - 1);
    haptic('light');
  }

  function goNext() {
    if (step < totalSteps - 1) { setStep(s => s + 1); haptic('light'); return; }
    handleSave();
  }

  async function handleSave() {
    setSaving(true);
    haptic('medium');
    const draft: NutritionProfile = {
      id:            'profile',
      goal,
      activityLevel,
      weightKg:      biometrics.weightKg,
      heightCm:      biometrics.heightCm,
      age:           biometrics.age,
      sex:           biometrics.sex,
      dailyGoalKcal: 0,
      proteinGoalG:  0,
      carbsGoalG:    0,
      fatGoalG:      0,
    };
    const kcal   = calcDailyGoal(draft);
    const macros = calcMacroGoals(kcal);
    draft.dailyGoalKcal = kcal;
    draft.proteinGoalG  = macros.proteinG;
    draft.carbsGoalG    = macros.carbsG;
    draft.fatGoalG      = macros.fatG;
    await saveNutritionProfile(draft);
    setSaving(false);
    navigate('/calories', { replace: true });
  }

  const slideVariants = {
    enter:  { opacity: 0, x: 32 },
    center: { opacity: 1, x: 0 },
    exit:   { opacity: 0, x: -32 },
  };

  if (!profileLoaded) return null;

  return (
    <div style={{ height: '100%', background: T.bg, display: 'flex', flexDirection: 'column', fontFamily: F }}>

      {/* Header */}
      <div style={{
        background: T.white, borderBottom: `0.5px solid ${T.border}`,
        padding: '0 18px 14px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
          <button
            onClick={goBack}
            style={{ width: 28, height: 28, borderRadius: '50%', background: T.stone, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ChevronLeft size={14} color={T.t2} strokeWidth={1.5} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontStyle: 'italic', fontFamily: FD, color: T.black, lineHeight: 1 }}>
              {step === 0 ? 'Your goal' : 'Activity level'}
            </div>
            <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, marginTop: 2 }}>
              Step {step + 1} of {totalSteps}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 5, marginTop: 14 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? T.red : T.mid,
              transition: 'background 0.3s ease',
            }} />
          ))}
        </div>
      </div>

      {/* Biometrics chip — shows what was pulled from onboarding */}
      <div style={{
        margin: '12px 18px 0',
        padding: '10px 14px',
        background: T.stone, borderRadius: 10, border: `0.5px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 15 }}>👤</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: T.black }}>
            {biometrics.weightKg} kg · {biometrics.heightCm} cm · {biometrics.age} yrs · {biometrics.sex}
          </div>
          <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, marginTop: 1 }}>
            Pulled from your profile
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            style={{ padding: '20px 18px 16px' }}
          >

            {/* ── Step 0: Goal + Diet ── */}
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Goal */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, marginBottom: 10 }}>
                    What's your goal?
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {GOALS.map(g => (
                      <button
                        key={g.value}
                        onClick={() => { setGoal(g.value); haptic('light'); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 16px', borderRadius: 12,
                          border: `1.5px solid ${goal === g.value ? T.red : T.border}`,
                          background: goal === g.value ? T.redLo : T.white,
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{g.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: goal === g.value ? T.red : T.black }}>{g.label}</div>
                          <div style={{ fontSize: 11, fontWeight: 300, color: T.t3, marginTop: 1 }}>{g.desc}</div>
                        </div>
                        {goal === g.value && (
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 8, color: '#fff' }}>✓</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Diet */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, marginBottom: 10 }}>
                    Dietary preference
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {DIETS.map(d => (
                      <button
                        key={d.value}
                        onClick={() => { setDiet(d.value); haptic('light'); }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: '12px 8px 10px', borderRadius: 12,
                          border: `1.5px solid ${diet === d.value ? T.red : T.border}`,
                          background: diet === d.value ? T.redLo : T.white,
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <span style={{ fontSize: 22, marginBottom: 5 }}>{d.emoji}</span>
                        <span style={{ fontSize: 10, fontWeight: diet === d.value ? 600 : 400, color: diet === d.value ? T.red : T.t2, textAlign: 'center', lineHeight: 1.2 }}>
                          {d.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ── Step 1: Activity level ── */}
            {step === 1 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, marginBottom: 12 }}>
                  How active are you?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ACTIVITY_LEVELS.map(a => (
                    <button
                      key={a.value}
                      onClick={() => { setActivityLevel(a.value); haptic('light'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '13px 16px', borderRadius: 12,
                        border: `1.5px solid ${activityLevel === a.value ? T.red : T.border}`,
                        background: activityLevel === a.value ? T.redLo : T.white,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{a.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: activityLevel === a.value ? T.red : T.black }}>{a.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 300, color: T.t3, marginTop: 1 }}>{a.desc}</div>
                      </div>
                      {activityLevel === a.value && (
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 8, color: '#fff' }}>✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* TDEE preview */}
                <div style={{
                  marginTop: 16, padding: '12px 14px', borderRadius: 12,
                  background: T.black, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>
                      Estimated daily goal
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 300, color: '#fff', letterSpacing: '-0.02em' }}>
                      {calcDailyGoal({
                        id: 'profile', goal, activityLevel,
                        weightKg: biometrics.weightKg, heightCm: biometrics.heightCm,
                        age: biometrics.age, sex: biometrics.sex,
                        dailyGoalKcal: 0, proteinGoalG: 0, carbsGoalG: 0, fatGoalG: 0,
                      })} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>kcal / day</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 24 }}>
                    {goal === 'lose' ? '🔥' : goal === 'gain' ? '💪' : '⚖️'}
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div style={{
        padding: '12px 18px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        background: T.white, borderTop: `0.5px solid ${T.border}`,
        display: 'flex', gap: 10, flexShrink: 0,
      }}>
        {step > 0 && (
          <button
            onClick={goBack}
            style={{
              flex: 0.4, padding: '14px 0', borderRadius: 10,
              border: `0.5px solid ${T.border}`, background: T.stone,
              fontSize: 13, fontWeight: 500, color: T.t2, cursor: 'pointer', fontFamily: F,
            }}
          >
            Back
          </button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={goNext}
          disabled={saving}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
            background: T.black, color: '#fff',
            fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
            textTransform: 'uppercase' as const, fontFamily: F,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : step === totalSteps - 1 ? 'Save & Start' : 'Continue'}
        </motion.button>
      </div>
    </div>
  );
}
