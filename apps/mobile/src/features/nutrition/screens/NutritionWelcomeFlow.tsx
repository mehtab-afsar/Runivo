import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  Easing,
} from 'react-native-reanimated';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, type AppColors } from '@theme';
import { FontSize, FontWeight, Spacing } from '@theme';
import type { NutritionProfile } from '@shared/services/store';
import {
  fetchExistingProfile,
  saveNutritionProfileService,
} from '@features/nutrition/services/nutritionSetupService';
import {
  computeNutritionTargets,
  type NutritionGoal,
  type ActivityLevel,
  type DietType,
} from '@shared/services/nutrition';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';

const SCREEN_W = Dimensions.get('window').width;

// ─── Animated step wrapper ────────────────────────────────────────────────────

function StepSlide({ direction, children }: { direction: 'forward' | 'back'; children: React.ReactNode }) {
  const translateX = useSharedValue(direction === 'forward' ? SCREEN_W : -SCREEN_W);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.9 });
    opacity.value    = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
  }, []);

  const style = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep({
  prefill, onContinue,
}: { prefill: NutritionProfile | undefined; onContinue: () => void }) {
  const C = useTheme();
  const ss = useMemo(() => mkWelcomeStyles(C), [C]);

  const chips = [
    prefill?.age      ? `${prefill.age} yrs`      : null,
    prefill?.weightKg ? `${prefill.weightKg} kg`  : null,
    prefill?.heightCm ? `${prefill.heightCm} cm`  : null,
  ].filter(Boolean) as string[];

  return (
    <ScrollView contentContainerStyle={ss.screen} keyboardShouldPersistTaps="handled">
      <View style={ss.iconWrap}>
        <Text style={ss.icon}>🥗</Text>
      </View>

      <Text style={ss.headline}>Nutrition tracking,{'\n'}built for runners.</Text>

      <Text style={ss.body}>
        We'll use your profile to calculate your daily calorie and macro targets.
        You won't need to re-enter your details.
      </Text>

      {chips.length > 0 && (
        <View style={ss.statsCard}>
          <Text style={ss.statsLabel}>FROM YOUR PROFILE</Text>
          <View style={ss.chipsRow}>
            {chips.map(s => (
              <View key={s} style={ss.chip}>
                <Text style={ss.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={ss.ctaWrap}>
        <PrimaryButton label="Get started" onPress={onContinue} fullWidth />
      </View>
    </ScrollView>
  );
}

function mkWelcomeStyles(C: AppColors) {
  return StyleSheet.create({
    screen:    { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xxl },
    iconWrap:  {
      width: 72, height: 72, borderRadius: Spacing.radius.xl,
      backgroundColor: C.greenBg,
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxl,
    },
    icon:      { fontSize: 32 },
    headline:  {
      fontSize: FontSize.title1, fontWeight: FontWeight.semibold, color: C.black,
      lineHeight: FontSize.title1 * 1.2, marginBottom: Spacing.md,
    },
    body:      {
      fontSize: FontSize.callout, color: C.t2,
      lineHeight: FontSize.callout * 1.55, marginBottom: Spacing.xxl,
    },
    statsCard: {
      backgroundColor: C.surface, borderRadius: Spacing.radius.lg,
      borderWidth: 0.5, borderColor: C.border,
      padding: Spacing.md, marginBottom: Spacing.xxl,
    },
    statsLabel: {
      fontSize: FontSize.caption2, fontWeight: FontWeight.medium,
      color: C.t3, letterSpacing: 0.07, marginBottom: Spacing.sm,
    },
    chipsRow:  { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    chip:      {
      backgroundColor: C.backgroundSecondary, borderRadius: Spacing.radius.full,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    },
    chipText:  { fontSize: FontSize.footnote, color: C.black, fontWeight: FontWeight.medium },
    ctaWrap:   { marginTop: 'auto' as any, paddingTop: Spacing.xl },
  });
}

// ─── Step 2: Goal ─────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { key: NutritionGoal; label: string; desc: string; icon: string }[] = [
  { key: 'lose',     label: 'Lose weight',  desc: 'Calorie deficit to reduce body fat',       icon: '↓' },
  { key: 'maintain', label: 'Stay healthy', desc: 'Balanced intake for your activity level',   icon: '=' },
  { key: 'gain',     label: 'Build muscle', desc: 'Calorie surplus to support training',       icon: '↑' },
];

function GoalStep({ onSelect }: { onSelect: (g: NutritionGoal) => void }) {
  const C = useTheme();
  const ss = useMemo(() => mkOptionStyles(C), [C]);
  return (
    <View style={ss.screen}>
      <Text style={ss.eyebrow}>2 OF 5</Text>
      <Text style={ss.headline}>What are you{'\n'}eating for?</Text>
      <View style={ss.options}>
        {GOAL_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={ss.option}
            onPress={() => { Haptics.selectionAsync(); onSelect(opt.key); }}
          >
            <View style={ss.optIcon}><Text style={ss.optIconText}>{opt.icon}</Text></View>
            <View style={ss.optBody}>
              <Text style={ss.optLabel}>{opt.label}</Text>
              <Text style={ss.optDesc}>{opt.desc}</Text>
            </View>
            <CaretRight size={16} color={C.t3} weight="regular" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Step 3: Activity ─────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; desc: string; icon: string }[] = [
  { key: 'sedentary',   label: 'Mostly sitting',  desc: 'Desk job, minimal extra movement',     icon: '🪑' },
  { key: 'light',       label: 'Light movement',  desc: 'Walks, some standing work',            icon: '🚶' },
  { key: 'moderate',    label: 'Active day',      desc: 'On feet often, active role',           icon: '🏃' },
  { key: 'very_active', label: 'Very active',     desc: 'Physical job or double sessions',      icon: '⚡' },
];

function ActivityStep({ onSelect }: { onSelect: (a: ActivityLevel) => void }) {
  const C = useTheme();
  const ss = useMemo(() => mkOptionStyles(C), [C]);
  return (
    <View style={ss.screen}>
      <Text style={ss.eyebrow}>3 OF 5</Text>
      <Text style={ss.headline}>How active are{'\n'}you day-to-day?</Text>
      <View style={ss.options}>
        {ACTIVITY_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={ss.option}
            onPress={() => { Haptics.selectionAsync(); onSelect(opt.key); }}
          >
            <View style={ss.optIcon}><Text style={ss.optIconText}>{opt.icon}</Text></View>
            <View style={ss.optBody}>
              <Text style={ss.optLabel}>{opt.label}</Text>
              <Text style={ss.optDesc}>{opt.desc}</Text>
            </View>
            <CaretRight size={16} color={C.t3} weight="regular" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Shared styles for GoalStep + ActivityStep
function mkOptionStyles(C: AppColors) {
  return StyleSheet.create({
    screen:      { flex: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
    eyebrow:     {
      fontSize: FontSize.caption2, fontWeight: FontWeight.medium,
      color: C.t3, letterSpacing: 0.07, marginBottom: Spacing.md,
    },
    headline:    {
      fontSize: FontSize.title1, fontWeight: FontWeight.semibold, color: C.black,
      lineHeight: FontSize.title1 * 1.2, marginBottom: Spacing.xxl,
    },
    options:     { gap: Spacing.sm },
    option:      {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      padding: Spacing.md, backgroundColor: C.surface,
      borderRadius: Spacing.radius.lg, borderWidth: 0.5, borderColor: C.border,
    },
    optIcon:     {
      width: 40, height: 40, borderRadius: Spacing.radius.md,
      backgroundColor: C.backgroundSecondary,
      alignItems: 'center', justifyContent: 'center',
    },
    optIconText: { fontSize: 18 },
    optBody:     { flex: 1 },
    optLabel:    { fontSize: FontSize.subhead, fontWeight: FontWeight.medium, color: C.black },
    optDesc:     { fontSize: FontSize.caption1, color: C.t2, marginTop: 2 },
  });
}

// ─── Step 4: Diet ─────────────────────────────────────────────────────────────

const DIET_OPTIONS: { key: DietType; label: string; icon: string }[] = [
  { key: 'everything',  label: 'Everything',  icon: '🍽' },
  { key: 'vegetarian',  label: 'Vegetarian',  icon: '🥗' },
  { key: 'vegan',       label: 'Vegan',       icon: '🌱' },
  { key: 'keto',        label: 'Keto',        icon: '🥑' },
  { key: 'halal',       label: 'Halal',       icon: '☪️'  },
  { key: 'pescatarian', label: 'Pescatarian', icon: '🐟' },
];

function DietStep({ onSelect }: { onSelect: (d: DietType) => void }) {
  const C = useTheme();
  const ss = useMemo(() => mkDietStyles(C), [C]);
  return (
    <View style={ss.screen}>
      <Text style={ss.eyebrow}>4 OF 5</Text>
      <Text style={ss.headline}>Any dietary{'\n'}preferences?</Text>
      <View style={ss.grid}>
        {DIET_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={ss.chip}
            onPress={() => { Haptics.selectionAsync(); onSelect(opt.key); }}
          >
            <Text style={ss.chipIcon}>{opt.icon}</Text>
            <Text style={ss.chipLabel}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function mkDietStyles(C: AppColors) {
  return StyleSheet.create({
    screen:    { flex: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
    eyebrow:   {
      fontSize: FontSize.caption2, fontWeight: FontWeight.medium,
      color: C.t3, letterSpacing: 0.07, marginBottom: Spacing.md,
    },
    headline:  {
      fontSize: FontSize.title1, fontWeight: FontWeight.semibold, color: C.black,
      lineHeight: FontSize.title1 * 1.2, marginBottom: Spacing.xxl,
    },
    grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip:      {
      width: '47%' as any,
      backgroundColor: C.surface, borderRadius: Spacing.radius.lg,
      borderWidth: 0.5, borderColor: C.border,
      padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    },
    chipIcon:  { fontSize: 28 },
    chipLabel: { fontSize: FontSize.footnote, fontWeight: FontWeight.medium, color: C.black },
  });
}

// ─── Step 5: Results ─────────────────────────────────────────────────────────

interface ResultsStepProps {
  prefill:       NutritionProfile | undefined;
  goal:          NutritionGoal;
  activityLevel: ActivityLevel;
  onStart:       () => void;
  saving:        boolean;
}

function ResultsStep({ prefill, goal, activityLevel, onStart, saving }: ResultsStepProps) {
  const C  = useTheme();
  const ss = useMemo(() => mkResultsStyles(C), [C]);

  const targets = useMemo(() => computeNutritionTargets({
    weightKg:      prefill?.weightKg ?? 70,
    heightCm:      prefill?.heightCm ?? 170,
    age:           prefill?.age      ?? 25,
    sex:           prefill?.sex      ?? 'male',
    goal,
    activityLevel,
  }), [prefill, goal, activityLevel]);

  const macros = [
    { label: 'Protein', value: targets.proteinG, unit: 'g', color: '#3B82F6' },
    { label: 'Carbs',   value: targets.carbsG,   unit: 'g', color: '#10B981' },
    { label: 'Fat',     value: targets.fatG,      unit: 'g', color: '#F59E0B' },
  ];

  return (
    <ScrollView contentContainerStyle={ss.screen} keyboardShouldPersistTaps="handled">
      <Text style={ss.eyebrow}>5 OF 5</Text>
      <Text style={ss.headline}>Your daily targets</Text>
      <Text style={ss.body}>
        Calibrated for your body, goal, and activity level. Update anytime in settings.
      </Text>

      <View style={ss.kcalCard}>
        <Text style={ss.kcalNum}>{targets.dailyKcal}</Text>
        <Text style={ss.kcalUnit}>kcal / day</Text>
      </View>

      <View style={ss.macroRow}>
        {macros.map(m => (
          <View key={m.label} style={ss.macroCard}>
            <View style={[ss.macroDot, { backgroundColor: m.color }]} />
            <Text style={ss.macroVal}>{m.value}<Text style={ss.macroUnit}>{m.unit}</Text></Text>
            <Text style={ss.macroLabel}>{m.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <Text style={ss.note}>
        Run calories are added automatically when you finish a run.
      </Text>

      <View style={ss.ctaWrap}>
        <PrimaryButton label="Start tracking" onPress={onStart} loading={saving} fullWidth />
      </View>
    </ScrollView>
  );
}

function mkResultsStyles(C: AppColors) {
  return StyleSheet.create({
    screen:    { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
    eyebrow:   {
      fontSize: FontSize.caption2, fontWeight: FontWeight.medium,
      color: C.t3, letterSpacing: 0.07, marginBottom: Spacing.md,
    },
    headline:  {
      fontSize: FontSize.title2, fontWeight: FontWeight.semibold, color: C.black,
      marginBottom: Spacing.sm,
    },
    body:      {
      fontSize: FontSize.callout, color: C.t2,
      lineHeight: FontSize.callout * 1.55, marginBottom: Spacing.xl,
    },
    kcalCard:  {
      backgroundColor: C.surface, borderRadius: Spacing.radius.lg,
      borderWidth: 0.5, borderColor: C.border,
      padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md,
    },
    kcalNum:   { fontSize: 48, fontWeight: FontWeight.semibold, color: C.black, lineHeight: 52 },
    kcalUnit:  { fontSize: FontSize.subhead, color: C.t2, marginTop: 4 },
    macroRow:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    macroCard: {
      flex: 1, backgroundColor: C.surface,
      borderRadius: Spacing.radius.md, borderWidth: 0.5, borderColor: C.border,
      padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    },
    macroDot:  { width: 6, height: 6, borderRadius: 3 },
    macroVal:  { fontSize: FontSize.title3 ?? 20, fontWeight: FontWeight.medium, color: C.black },
    macroUnit: { fontSize: FontSize.footnote, color: C.t2, fontWeight: FontWeight.regular },
    macroLabel:{ fontSize: FontSize.caption2, color: C.t3, letterSpacing: 0.07 },
    note:      {
      fontSize: FontSize.caption1, color: C.t3, textAlign: 'center',
      lineHeight: FontSize.caption1 * 1.5, marginBottom: Spacing.xxl,
    },
    ctaWrap:   { marginTop: 'auto' as any, paddingTop: Spacing.md },
  });
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

interface NutritionWelcomeFlowProps {
  onComplete: () => void;
}

export function NutritionWelcomeFlow({ onComplete }: NutritionWelcomeFlowProps) {
  const C = useTheme();

  const [step,          setStep]     = useState<1 | 2 | 3 | 4 | 5>(1);
  const [direction,     setDirection] = useState<'forward' | 'back'>('forward');
  const [goal,          setGoal]     = useState<NutritionGoal>('maintain');
  const [activityLevel, setActivity] = useState<ActivityLevel>('moderate');
  const [diet,          setDiet]     = useState<DietType>('everything');
  const [prefill,       setPrefill]  = useState<NutritionProfile | undefined>();
  const [saving,        setSaving]   = useState(false);

  useEffect(() => {
    fetchExistingProfile().then(p => setPrefill(p ?? undefined)).catch(() => {});
  }, []);

  async function handleComplete() {
    setSaving(true);
    try {
      const wt = prefill?.weightKg ?? 70;
      const ht = prefill?.heightCm ?? 170;
      const ag = prefill?.age      ?? 25;
      const sx = prefill?.sex      ?? 'male';
      const targets = computeNutritionTargets({ weightKg: wt, heightCm: ht, age: ag, sex: sx, goal, activityLevel });
      await saveNutritionProfileService({
        id:            'profile',
        goal,
        activityLevel,
        diet,
        sex:           sx,
        weightKg:      wt,
        heightCm:      ht,
        age:           ag,
        dailyGoalKcal: targets.dailyKcal,
        proteinGoalG:  targets.proteinG,
        carbsGoalG:    targets.carbsG,
        fatGoalG:      targets.fatG,
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onComplete();
    } catch {
      setSaving(false);
    }
  }

  function advance(next: 1 | 2 | 3 | 4 | 5) {
    setDirection('forward');
    setStep(next);
  }

  function goBack() {
    if (step > 1) {
      setDirection('back');
      setStep(s => (s - 1) as typeof step);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Progress bar */}
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}>
        {([1, 2, 3, 4, 5] as const).map(n => (
          <View
            key={n}
            style={{
              flex: 1, height: 2, borderRadius: 1,
              backgroundColor: n <= step ? C.red : C.border,
            }}
          />
        ))}
      </View>

      {/* Back button */}
      {step > 1 && (
        <Pressable
          onPress={goBack}
          style={{ padding: Spacing.lg, paddingBottom: 0, alignSelf: 'flex-start' }}
        >
          <CaretLeft size={22} color={C.black} weight="regular" />
        </Pressable>
      )}

      <View style={{ flex: 1, overflow: 'hidden' }}>
        {step === 1 && (
          <StepSlide key={1} direction={direction}>
            <WelcomeStep prefill={prefill} onContinue={() => advance(2)} />
          </StepSlide>
        )}
        {step === 2 && (
          <StepSlide key={2} direction={direction}>
            <GoalStep onSelect={g => { setGoal(g); advance(3); }} />
          </StepSlide>
        )}
        {step === 3 && (
          <StepSlide key={3} direction={direction}>
            <ActivityStep onSelect={a => { setActivity(a); advance(4); }} />
          </StepSlide>
        )}
        {step === 4 && (
          <StepSlide key={4} direction={direction}>
            <DietStep onSelect={d => { setDiet(d); advance(5); }} />
          </StepSlide>
        )}
        {step === 5 && (
          <StepSlide key={5} direction={direction}>
            <ResultsStep
              prefill={prefill}
              goal={goal}
              activityLevel={activityLevel}
              onStart={handleComplete}
              saving={saving}
            />
          </StepSlide>
        )}
      </View>
    </SafeAreaView>
  );
}
