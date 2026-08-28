import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Footprints, Person, Lightning, Fire, type Icon } from 'phosphor-react-native';
import type { OnboardingData } from '../types';
import { EXP_OPTIONS, DAY_LABELS, DIST_CHIPS } from '../types';
import { mkD, mkShared, type OnboardingD } from './onboardingStyles';
import { useTheme, Fonts } from '@theme';

// ─── Stepper (age/height/weight) — same interaction as NutritionWelcomeFlow's
// BodyStatsStep, reused here instead of the old drum-wheel pickers. ──────────

function Stepper({
  label, value, unit, onInc, onDec, min, max, s,
}: {
  label: string; value: number; unit: string;
  onInc: () => void; onDec: () => void; min: number; max: number;
  s: ReturnType<typeof mkStyles>;
}) {
  return (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <View style={s.stepperRow}>
        <Pressable
          style={[s.stepBtn, value <= min && s.stepBtnDisabled]}
          onPress={() => { if (value > min) { Haptics.selectionAsync(); onDec(); } }}
          hitSlop={8}
        >
          <Text style={[s.stepBtnText, value <= min && s.stepBtnTextDisabled]}>−</Text>
        </Pressable>
        <View style={s.valueWrap}>
          <Text style={s.valueNum}>{value}</Text>
          <Text style={s.valueUnit}>{unit}</Text>
        </View>
        <Pressable
          style={[s.stepBtn, value >= max && s.stepBtnDisabled]}
          onPress={() => { if (value < max) { Haptics.selectionAsync(); onInc(); } }}
          hitSlop={8}
        >
          <Text style={[s.stepBtnText, value >= max && s.stepBtnTextDisabled]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

type IconComp = Icon;
const ICONS: Record<OnboardingData['experienceLevel'], IconComp> = {
  new: Footprints, casual: Person, regular: Lightning, competitive: Fire,
};

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  data: Pick<OnboardingData, 'experienceLevel' | 'gender' | 'age' | 'heightCm' | 'weightKg' | 'preferredDistance'>;
  onChange: <K extends 'experienceLevel' | 'gender' | 'age' | 'heightCm' | 'weightKg' | 'preferredDistance'>(
    key: K, val: OnboardingData[K]
  ) => void;
  selectedDays: number[];
  distKm: number;
  weeklyKmDisplay: number;
  todayIdx: number;
  onToggleDay: (i: number) => void;
}

/** Merged "who you are + your weekly rhythm" — was two separate steps
 * (Profile, Target); no dependency between the two so there's no reason
 * they were a tap apart. */
export default function ProfileStep({
  data, onChange, selectedDays, distKm, weeklyKmDisplay, todayIdx, onToggleDay,
}: Props) {
  const C = useTheme();
  const D = useMemo(() => mkD(C), [C]);
  const shared = useMemo(() => mkShared(C), [C]);
  const s = useMemo(() => mkStyles(D), [D]);

  const expAnims = useRef(EXP_OPTIONS.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(14),
  }))).current;

  useEffect(() => {
    Animated.stagger(70, expAnims.map(({ opacity, translateY }) =>
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    )).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView contentContainerStyle={shared.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={shared.eyebrow}>Who you are</Text>
      <Text style={shared.heroTitle}>Your profile.</Text>
      <Text style={shared.subtitle}>Shapes training intensity, calorie estimates, and your weekly plan.</Text>

      {/* Experience level */}
      <Text style={shared.fieldLabel}>Running experience</Text>
      <View style={s.rule} />

      {EXP_OPTIONS.map((opt, i) => {
        const sel = data.experienceLevel === opt.key;
        const Icon = ICONS[opt.key];
        return (
          <Animated.View
            key={opt.key}
            style={{ opacity: expAnims[i].opacity, transform: [{ translateY: expAnims[i].translateY }] }}
          >
            <Pressable style={s.row} onPress={() => onChange('experienceLevel', opt.key)}>
              <View style={[s.accent, sel && s.accentActive]} />
              <Icon size={18} color={sel ? D.red : D.t3} weight="light" />
              <View style={{ flex: 1 }}>
                <Text style={[s.label, sel && s.labelSel]}>{opt.label}</Text>
                <Text style={s.sub}>{opt.sub}</Text>
              </View>
              {sel && <View style={s.dot} />}
            </Pressable>
          </Animated.View>
        );
      })}

      {/* Body stats divider */}
      <View style={s.divider} />
      <Text style={shared.fieldLabel}>Body stats</Text>

      {/* Gender */}
      {(['male', 'female'] as const).map(g => {
        const sel = data.gender === g;
        return (
          <Pressable key={g} style={s.row} onPress={() => onChange('gender', g)}>
            <View style={[s.accent, sel && s.accentActive]} />
            <Text style={[s.label, sel && s.labelSel]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
            {sel && <View style={s.dot} />}
          </Pressable>
        );
      })}

      <View style={s.statCard}>
        <Stepper s={s} label="Age" unit="yrs" value={data.age}
          onInc={() => onChange('age', data.age + 1)} onDec={() => onChange('age', data.age - 1)}
          min={16} max={100}
        />
        <View style={s.statDivider} />
        <Stepper s={s} label="Height" unit="cm" value={data.heightCm}
          onInc={() => onChange('heightCm', data.heightCm + 1)} onDec={() => onChange('heightCm', data.heightCm - 1)}
          min={100} max={250}
        />
        <View style={s.statDivider} />
        <Stepper s={s} label="Weight" unit="kg" value={data.weightKg}
          onInc={() => onChange('weightKg', data.weightKg + 1)} onDec={() => onChange('weightKg', data.weightKg - 1)}
          min={30} max={250}
        />
      </View>

      {/* Weekly rhythm divider */}
      <View style={s.divider} />
      <Text style={shared.fieldLabel}>Your weekly rhythm</Text>

      <View style={s.dayRow}>
        {DAY_LABELS.map((d, i) => {
          const sel     = selectedDays.includes(i);
          const isToday = i === todayIdx;
          return (
            <Pressable
              key={i}
              style={[
                s.dayTile,
                sel     ? s.dayTileSel   :
                isToday ? s.dayTileToday : s.dayTileUnsel,
              ]}
              onPress={() => { Haptics.selectionAsync(); onToggleDay(i); }}
            >
              <Text style={[s.dayLetter, sel ? s.dayLetterSel : isToday ? { color: D.red } : null]}>
                {d[0]}
              </Text>
              <Text style={[s.dayLetterSub, sel ? s.dayLetterSubSel : isToday ? { color: D.red } : null]}>
                {d.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[shared.fieldLabel, { marginTop: 20, marginBottom: 10 }]}>Typical run distance</Text>
      <View style={s.distGrid}>
        {DIST_CHIPS.map(c => {
          const sel = data.preferredDistance === c.key;
          return (
            <Pressable
              key={c.key}
              style={[s.distChip, sel ? s.distChipSel : s.distChipUnsel]}
              onPress={() => onChange('preferredDistance', c.key)}
            >
              <Text style={[s.distLabel, sel && s.distLabelSel]}>{c.label}</Text>
              <Text style={[s.distSub,   sel && s.distSubSel  ]}>{c.sub}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.summaryCard}>
        <Text style={s.summaryEyebrow}>WEEKLY GOAL</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={s.summaryNum}>{weeklyKmDisplay.toFixed(0)}</Text>
          <Text style={s.summaryUnit}>km / week</Text>
        </View>
        <Text style={s.summarySub}>
          {selectedDays.length} run{selectedDays.length !== 1 ? 's' : ''} · ~{distKm}km each
        </Text>
      </View>
    </ScrollView>
  );
}

function mkStyles(D: OnboardingD) {
  return StyleSheet.create({
    rule:        { height: 1, backgroundColor: D.div, marginBottom: 0 },
    row:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: D.div },
    accent:      { width: 2, height: 32, borderRadius: 1, backgroundColor: 'transparent' },
    accentActive:{ backgroundColor: D.red },
    label:       { fontSize: 15, color: D.t2, flex: 1 },
    labelSel:    { fontFamily: Fonts.medium, color: D.t1 },
    sub:         { fontSize: 12, color: D.t3, marginTop: 2 },
    dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: D.red },
    divider:     { height: 1, backgroundColor: D.div, marginVertical: 24 },

    // Age/height/weight stepper card
    statCard:    { marginTop: 14, backgroundColor: D.surf, borderRadius: 14, borderWidth: 0.5, borderColor: D.div, overflow: 'hidden' },
    statDivider: { height: 0.5, backgroundColor: D.div, marginHorizontal: 16 },
    statRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    statLabel:   { fontFamily: Fonts.medium, fontSize: 14, color: D.t1 },
    stepperRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: D.bg, borderWidth: 0.5, borderColor: D.div, alignItems: 'center', justifyContent: 'center' },
    stepBtnDisabled: { opacity: 0.35 },
    stepBtnText: { fontFamily: Fonts.medium, fontSize: 18, lineHeight: 22, color: D.t1 },
    stepBtnTextDisabled: { color: D.t3 },
    valueWrap:   { flexDirection: 'row', alignItems: 'baseline', gap: 3, minWidth: 64, justifyContent: 'center' },
    valueNum:    { fontFamily: Fonts.semiBold, fontSize: 18, color: D.t1, fontVariant: ['tabular-nums'] },
    valueUnit:   { fontSize: 11, color: D.t3 },

    // Day selector
    dayRow:          { flexDirection: 'row', gap: 5 },
    dayTile:         { paddingVertical: 12, borderRadius: 8, alignItems: 'center', gap: 3, flex: 1, borderWidth: 0.5 },
    dayTileUnsel:    { borderColor: D.div, backgroundColor: 'transparent' },
    dayTileToday:    { borderColor: D.red, backgroundColor: D.redLo },
    dayTileSel:      { borderColor: D.alwaysDark, backgroundColor: D.alwaysDark },
    dayLetter:       { fontSize: 12, color: D.t3 },
    dayLetterSel:    { color: D.alwaysLight, fontFamily: Fonts.medium },
    dayLetterSub:    { fontSize: 8, color: D.div },
    dayLetterSubSel: { color: 'rgba(255,255,255,0.5)' },

    // Distance chips
    distGrid:        { flexDirection: 'row', gap: 8, marginBottom: 24 },
    distChip:        { flex: 1, padding: 14, borderRadius: 8, borderWidth: 0.5, alignItems: 'flex-start' },
    distChipUnsel:   { borderColor: D.div, backgroundColor: 'transparent' },
    distChipSel:     { borderColor: D.alwaysDark, backgroundColor: D.alwaysDark },
    distLabel:       { fontSize: 15, color: D.t1, marginBottom: 2 },
    distLabelSel:    { color: D.alwaysLight },
    distSub:         { fontSize: 9, color: D.t3, textTransform: 'uppercase', letterSpacing: 1 },
    distSubSel:      { color: 'rgba(255,255,255,0.6)' },

    // Weekly goal summary
    summaryCard:     { borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: D.div, paddingVertical: 24 },
    summaryEyebrow:  { fontFamily: Fonts.medium, fontSize: 10, color: D.red, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },
    summaryNum:      { fontFamily: Fonts.display, fontSize: 52, color: D.t1, lineHeight: 52 },
    summaryUnit:     { fontSize: 14, color: D.t3 },
    summarySub:      { fontSize: 13, color: D.t3, marginTop: 6 },
  });
}
