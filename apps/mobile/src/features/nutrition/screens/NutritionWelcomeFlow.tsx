import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Dimensions, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  Easing,
} from 'react-native-reanimated';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, type AppColors } from '@theme';
import { FontSize, Type, Fonts, Spacing } from '@theme';
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

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  const C  = useTheme();
  const ss = useMemo(() => mkWelcomeStyles(C), [C]);

  return (
    <ScrollView contentContainerStyle={ss.screen} keyboardShouldPersistTaps="handled">
      <View style={ss.iconWrap}>
        <Text style={ss.icon}>🥗</Text>
      </View>

      <Text style={ss.headline}>Nutrition tracking,{'\n'}built for runners.</Text>

      <Text style={ss.body}>
        Tell us a bit about yourself so we can calculate your precise daily calorie and macro targets.
        Takes about 30 seconds.
      </Text>

      <View style={ss.featureList}>
        {[
          { icon: '🎯', text: 'Personalised calorie & macro targets' },
          { icon: '📊', text: 'Track meals by type — breakfast, lunch, dinner, snacks' },
          { icon: '📷', text: 'Scan barcodes or photos to log food instantly' },
          { icon: '⚡', text: 'Run calories automatically deducted' },
        ].map(f => (
          <View key={f.icon} style={ss.featureRow}>
            <Text style={ss.featureIcon}>{f.icon}</Text>
            <Text style={ss.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <View style={ss.ctaWrap}>
        <PrimaryButton label="Get started" onPress={onContinue} fullWidth />
      </View>
    </ScrollView>
  );
}

function mkWelcomeStyles(C: AppColors) {
  return StyleSheet.create({
    screen:      { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xxl },
    iconWrap:    {
      width: 72, height: 72, borderRadius: Spacing.radius.xl,
      backgroundColor: C.greenBg,
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxl,
    },
    icon:        { fontSize: 32 },
    headline:    {
      fontFamily: Fonts.semiBold, fontSize: FontSize.title1, color: C.black,
      lineHeight: FontSize.title1 * 1.2, marginBottom: Spacing.md,
    },
    body:        {
      fontFamily: Fonts.regular, fontSize: FontSize.callout, color: C.t2,
      lineHeight: FontSize.callout * 1.55, marginBottom: Spacing.xl,
    },
    featureList: { gap: Spacing.md, marginBottom: Spacing.xxl },
    featureRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    featureIcon: { fontSize: 18, width: 28, textAlign: 'center' },
    featureText: { fontFamily: Fonts.regular, fontSize: FontSize.callout, color: C.black, flex: 1 },
    ctaWrap:     { marginTop: 'auto' as any, paddingTop: Spacing.xl },
  });
}

// ─── Step 2: Body Stats ───────────────────────────────────────────────────────

interface BodyStatsStepProps {
  weightKg: number;
  heightCm: number;
  age:      number;
  sex:      'male' | 'female';
  onChange: (patch: Partial<{ weightKg: number; heightCm: number; age: number; sex: 'male' | 'female' }>) => void;
  onContinue: () => void;
}

function BodyStatsStep({ weightKg, heightCm, age, sex, onChange, onContinue }: BodyStatsStepProps) {
  const C  = useTheme();
  const ss = useMemo(() => mkBodyStatsStyles(C), [C]);

  function Stepper({
    label, value, unit, onInc, onDec, min, max,
  }: { label: string; value: number; unit: string; onInc: () => void; onDec: () => void; min: number; max: number }) {
    return (
      <View style={ss.statRow}>
        <Text style={ss.statLabel}>{label}</Text>
        <View style={ss.stepperRow}>
          <Pressable
            style={[ss.stepBtn, value <= min && ss.stepBtnDisabled]}
            onPress={() => { if (value > min) { Haptics.selectionAsync(); onDec(); } }}
            hitSlop={8}
          >
            <Text style={[ss.stepBtnText, value <= min && ss.stepBtnTextDisabled]}>−</Text>
          </Pressable>
          <View style={ss.valueWrap}>
            <Text style={ss.valueNum}>{value}</Text>
            <Text style={ss.valueUnit}>{unit}</Text>
          </View>
          <Pressable
            style={[ss.stepBtn, value >= max && ss.stepBtnDisabled]}
            onPress={() => { if (value < max) { Haptics.selectionAsync(); onInc(); } }}
            hitSlop={8}
          >
            <Text style={[ss.stepBtnText, value >= max && ss.stepBtnTextDisabled]}>+</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canContinue = weightKg > 0 && heightCm > 0 && age > 0;

  return (
    <ScrollView contentContainerStyle={ss.screen} keyboardShouldPersistTaps="handled">
      <Text style={ss.eyebrow}>2 OF 6</Text>
      <Text style={ss.headline}>Your body{'\n'}stats</Text>
      <Text style={ss.body}>Used to calculate your precise calorie needs. You can update these anytime.</Text>

      <View style={ss.card}>
        <Stepper
          label="Weight" value={weightKg} unit="kg"
          onInc={() => onChange({ weightKg: weightKg + 1 })}
          onDec={() => onChange({ weightKg: weightKg - 1 })}
          min={30} max={250}
        />
        <View style={ss.divider} />
        <Stepper
          label="Height" value={heightCm} unit="cm"
          onInc={() => onChange({ heightCm: heightCm + 1 })}
          onDec={() => onChange({ heightCm: heightCm - 1 })}
          min={100} max={250}
        />
        <View style={ss.divider} />
        <Stepper
          label="Age" value={age} unit="yrs"
          onInc={() => onChange({ age: age + 1 })}
          onDec={() => onChange({ age: age - 1 })}
          min={10} max={100}
        />
        <View style={ss.divider} />
        <View style={ss.statRow}>
          <Text style={ss.statLabel}>Sex</Text>
          <View style={ss.sexToggle}>
            {(['male', 'female'] as const).map(s => (
              <Pressable
                key={s}
                style={[ss.sexBtn, sex === s && ss.sexBtnActive]}
                onPress={() => { Haptics.selectionAsync(); onChange({ sex: s }); }}
              >
                <Text style={[ss.sexBtnText, sex === s && ss.sexBtnTextActive]}>
                  {s === 'male' ? 'Male' : 'Female'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Text style={ss.privacy}>Your stats are stored privately and used only to personalise your targets.</Text>

      <View style={ss.ctaWrap}>
        <PrimaryButton label="Continue" onPress={onContinue} fullWidth disabled={!canContinue} />
      </View>
    </ScrollView>
  );
}

function mkBodyStatsStyles(C: AppColors) {
  return StyleSheet.create({
    screen:           { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
    eyebrow:          { ...Type.overline, color: C.t3, marginBottom: Spacing.md },
    headline:         {
      fontFamily: Fonts.semiBold, fontSize: FontSize.title1, color: C.black,
      lineHeight: FontSize.title1 * 1.2, marginBottom: Spacing.sm,
    },
    body:             {
      fontFamily: Fonts.regular, fontSize: FontSize.callout, color: C.t2,
      lineHeight: FontSize.callout * 1.55, marginBottom: Spacing.xl,
    },
    card:             {
      backgroundColor: C.white, borderRadius: Spacing.radius.lg,
      borderWidth: 0.5, borderColor: C.border,
      overflow: 'hidden', marginBottom: Spacing.md,
    },
    divider:          { height: 0.5, backgroundColor: C.border, marginHorizontal: Spacing.md },
    statRow:          {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: 14,
    },
    statLabel:        { fontFamily: Fonts.medium, fontSize: FontSize.subhead, color: C.black },
    stepperRow:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    stepBtn:          {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    stepBtnDisabled:  { opacity: 0.35 },
    stepBtnText:      { fontFamily: Fonts.medium, fontSize: 20, lineHeight: 24, color: C.black },
    stepBtnTextDisabled: { color: C.t3 },
    valueWrap:        { flexDirection: 'row', alignItems: 'baseline', gap: 3, minWidth: 72, justifyContent: 'center' },
    valueNum:         { fontFamily: Fonts.semiBold, fontSize: FontSize.title3 ?? 20, color: C.black, fontVariant: ['tabular-nums'] },
    valueUnit:        { fontFamily: Fonts.regular, fontSize: FontSize.caption1, color: C.t2 },
    sexToggle:        {
      flexDirection: 'row', borderRadius: Spacing.radius.md,
      borderWidth: 0.5, borderColor: C.border, overflow: 'hidden',
    },
    sexBtn:           {
      paddingHorizontal: Spacing.lg, paddingVertical: 8,
      backgroundColor: C.surface,
    },
    sexBtnActive:     { backgroundColor: C.alwaysDark },
    sexBtnText:       { fontFamily: Fonts.medium, fontSize: FontSize.subhead, color: C.t2 },
    sexBtnTextActive: { color: C.alwaysLight },
    privacy:          { fontFamily: Fonts.regular, fontSize: FontSize.caption2, color: C.t3, textAlign: 'center', lineHeight: 16, marginBottom: Spacing.lg },
    ctaWrap:          { marginTop: 'auto' as any, paddingTop: Spacing.sm },
  });
}

// ─── Step 3: Goal ─────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { key: NutritionGoal; label: string; desc: string; icon: string }[] = [
  { key: 'lose',     label: 'Lose weight',  desc: 'Calorie deficit to reduce body fat',       icon: '↓' },
  { key: 'maintain', label: 'Stay healthy', desc: 'Balanced intake for your activity level',   icon: '=' },
  { key: 'gain',     label: 'Build muscle', desc: 'Calorie surplus to support training',       icon: '↑' },
];

function GoalStep({ onSelect }: { onSelect: (g: NutritionGoal) => void }) {
  const C  = useTheme();
  const ss = useMemo(() => mkOptionStyles(C), [C]);
  return (
    <View style={ss.screen}>
      <Text style={ss.eyebrow}>3 OF 6</Text>
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

// ─── Step 4: Activity ─────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; desc: string; icon: string }[] = [
  { key: 'sedentary',   label: 'Mostly sitting',  desc: 'Desk job, minimal extra movement',     icon: '🪑' },
  { key: 'light',       label: 'Light movement',  desc: 'Walks, some standing work',            icon: '🚶' },
  { key: 'moderate',    label: 'Active day',      desc: 'On feet often, active role',           icon: '🏃' },
  { key: 'very_active', label: 'Very active',     desc: 'Physical job or double sessions',      icon: '⚡' },
];

function ActivityStep({ onSelect }: { onSelect: (a: ActivityLevel) => void }) {
  const C  = useTheme();
  const ss = useMemo(() => mkOptionStyles(C), [C]);
  return (
    <View style={ss.screen}>
      <Text style={ss.eyebrow}>4 OF 6</Text>
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

function mkOptionStyles(C: AppColors) {
  return StyleSheet.create({
    screen:      { flex: 1, padding: Spacing.lg, paddingTop: Spacing.xl },
    eyebrow:     { ...Type.overline, color: C.t3, marginBottom: Spacing.md },
    headline:    {
      fontFamily: Fonts.semiBold, fontSize: FontSize.title1, color: C.black,
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
    optLabel:    { fontFamily: Fonts.medium, fontSize: FontSize.subhead, color: C.black },
    optDesc:     { fontFamily: Fonts.regular, fontSize: FontSize.caption1, color: C.t2, marginTop: 2 },
  });
}

// ─── Step 5: Diet ─────────────────────────────────────────────────────────────

const DIET_OPTIONS: { key: DietType; label: string; icon: string }[] = [
  { key: 'everything',  label: 'Everything',  icon: '🍽' },
  { key: 'vegetarian',  label: 'Vegetarian',  icon: '🥗' },
  { key: 'vegan',       label: 'Vegan',       icon: '🌱' },
  { key: 'keto',        label: 'Keto',        icon: '🥑' },
  { key: 'halal',       label: 'Halal',       icon: '☪️'  },
  { key: 'pescatarian', label: 'Pescatarian', icon: '🐟' },
];

function DietStep({ onSelect }: { onSelect: (d: DietType) => void }) {
  const C  = useTheme();
  const ss = useMemo(() => mkDietStyles(C), [C]);
  return (
    <View style={ss.screen}>
      <Text style={ss.eyebrow}>5 OF 6</Text>
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
    eyebrow:   { ...Type.overline, color: C.t3, marginBottom: Spacing.md },
    headline:  {
      fontFamily: Fonts.semiBold, fontSize: FontSize.title1, color: C.black,
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
    chipLabel: { fontFamily: Fonts.medium, fontSize: FontSize.footnote, color: C.black },
  });
}

// ─── Step 6: Results ─────────────────────────────────────────────────────────

interface ResultsStepProps {
  weightKg:      number;
  heightCm:      number;
  age:           number;
  sex:           'male' | 'female';
  goal:          NutritionGoal;
  activityLevel: ActivityLevel;
  onStart:       () => void;
  saving:        boolean;
}

function ResultsStep({ weightKg, heightCm, age, sex, goal, activityLevel, onStart, saving }: ResultsStepProps) {
  const C  = useTheme();
  const ss = useMemo(() => mkResultsStyles(C), [C]);

  const targets = useMemo(() => computeNutritionTargets({
    weightKg, heightCm, age, sex, goal, activityLevel,
  }), [weightKg, heightCm, age, sex, goal, activityLevel]);

  const macros = [
    { label: 'Protein', value: targets.proteinG, unit: 'g', color: '#3B82F6' },
    { label: 'Carbs',   value: targets.carbsG,   unit: 'g', color: '#10B981' },
    { label: 'Fat',     value: targets.fatG,      unit: 'g', color: '#F59E0B' },
  ];

  return (
    <ScrollView contentContainerStyle={ss.screen} keyboardShouldPersistTaps="handled">
      <Text style={ss.eyebrow}>6 OF 6</Text>
      <Text style={ss.headline}>Your daily targets</Text>
      <Text style={ss.body}>
        Calibrated for your body, goal, and activity level. Update anytime in settings.
      </Text>

      <View style={ss.kcalCard}>
        <Text style={ss.kcalNum}>{targets.dailyKcal.toLocaleString()}</Text>
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

      <View style={ss.statsRow}>
        {[
          { label: 'Body weight', value: `${weightKg} kg` },
          { label: 'Height', value: `${heightCm} cm` },
          { label: 'Age', value: `${age} yrs` },
        ].map(s => (
          <View key={s.label} style={ss.statItem}>
            <Text style={ss.statVal}>{s.value}</Text>
            <Text style={ss.statLbl}>{s.label}</Text>
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
    eyebrow:   { ...Type.overline, color: C.t3, marginBottom: Spacing.md },
    headline:  {
      fontFamily: Fonts.semiBold, fontSize: FontSize.title2, color: C.black,
      marginBottom: Spacing.sm,
    },
    body:      {
      fontFamily: Fonts.regular, fontSize: FontSize.callout, color: C.t2,
      lineHeight: FontSize.callout * 1.55, marginBottom: Spacing.xl,
    },
    kcalCard:  {
      backgroundColor: C.surface, borderRadius: Spacing.radius.lg,
      borderWidth: 0.5, borderColor: C.border,
      padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md,
    },
    kcalNum:   { fontFamily: Fonts.semiBold, fontSize: 48, color: C.black, lineHeight: 52, fontVariant: ['tabular-nums'] },
    kcalUnit:  { fontFamily: Fonts.regular, fontSize: FontSize.subhead, color: C.t2, marginTop: 4 },
    macroRow:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    macroCard: {
      flex: 1, backgroundColor: C.surface,
      borderRadius: Spacing.radius.md, borderWidth: 0.5, borderColor: C.border,
      padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
    },
    macroDot:  { width: 6, height: 6, borderRadius: 3 },
    macroVal:  { fontFamily: Fonts.medium, fontSize: (FontSize.title3 ?? 20), color: C.black, fontVariant: ['tabular-nums'] },
    macroUnit: { fontFamily: Fonts.regular, fontSize: FontSize.footnote, color: C.t2 },
    macroLabel:{ fontFamily: Fonts.regular, fontSize: FontSize.caption2, color: C.t3, letterSpacing: 0.07 },
    statsRow:  { flexDirection: 'row', marginBottom: Spacing.md, backgroundColor: C.surface, borderRadius: Spacing.radius.md, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
    statItem:  { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
    statVal:   { fontFamily: Fonts.semiBold, fontSize: FontSize.subhead, color: C.black },
    statLbl:   { fontFamily: Fonts.regular, fontSize: FontSize.caption2, color: C.t3, marginTop: 2 },
    note:      {
      fontFamily: Fonts.regular, fontSize: FontSize.caption1, color: C.t3, textAlign: 'center',
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

  const [step,          setStep]     = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [direction,     setDirection] = useState<'forward' | 'back'>('forward');
  const [goal,          setGoal]     = useState<NutritionGoal>('maintain');
  const [activityLevel, setActivity] = useState<ActivityLevel>('moderate');
  const [diet,          setDiet]     = useState<DietType>('everything');

  // Body stats — start with sensible placeholders, override from prefill when loaded
  const [weightKg, setWeightKg] = useState(70);
  const [heightCm, setHeightCm] = useState(170);
  const [age,      setAge]      = useState(25);
  const [sex,      setSex]      = useState<'male' | 'female'>('male');

  const [saving, setSaving] = useState(false);

  // Prefill body stats from existing profile / onboarding if present
  useEffect(() => {
    fetchExistingProfile().then(p => {
      if (!p) return;
      if (p.weightKg) setWeightKg(p.weightKg);
      if (p.heightCm) setHeightCm(p.heightCm);
      if (p.age)      setAge(p.age);
      if (p.sex)      setSex(p.sex as 'male' | 'female');
    }).catch(() => {});
  }, []);

  async function handleComplete() {
    setSaving(true);
    try {
      const targets = computeNutritionTargets({ weightKg, heightCm, age, sex, goal, activityLevel });
      await saveNutritionProfileService({
        id:            'profile',
        goal,
        activityLevel,
        diet,
        sex,
        weightKg,
        heightCm,
        age,
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

  function advance(next: 1 | 2 | 3 | 4 | 5 | 6) {
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
        {([1, 2, 3, 4, 5, 6] as const).map(n => (
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
            <WelcomeStep onContinue={() => advance(2)} />
          </StepSlide>
        )}
        {step === 2 && (
          <StepSlide key={2} direction={direction}>
            <BodyStatsStep
              weightKg={weightKg} heightCm={heightCm} age={age} sex={sex}
              onChange={patch => {
                if (patch.weightKg !== undefined) setWeightKg(patch.weightKg);
                if (patch.heightCm !== undefined) setHeightCm(patch.heightCm);
                if (patch.age      !== undefined) setAge(patch.age);
                if (patch.sex      !== undefined) setSex(patch.sex);
              }}
              onContinue={() => advance(3)}
            />
          </StepSlide>
        )}
        {step === 3 && (
          <StepSlide key={3} direction={direction}>
            <GoalStep onSelect={g => { setGoal(g); advance(4); }} />
          </StepSlide>
        )}
        {step === 4 && (
          <StepSlide key={4} direction={direction}>
            <ActivityStep onSelect={a => { setActivity(a); advance(5); }} />
          </StepSlide>
        )}
        {step === 5 && (
          <StepSlide key={5} direction={direction}>
            <DietStep onSelect={d => { setDiet(d); advance(6); }} />
          </StepSlide>
        )}
        {step === 6 && (
          <StepSlide key={6} direction={direction}>
            <ResultsStep
              weightKg={weightKg} heightCm={heightCm} age={age} sex={sex}
              goal={goal} activityLevel={activityLevel}
              onStart={handleComplete}
              saving={saving}
            />
          </StepSlide>
        )}
      </View>
    </SafeAreaView>
  );
}
