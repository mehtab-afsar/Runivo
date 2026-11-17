import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { AGE_RANGES, type AgeRange } from '@shared/engine/onboarding';
import { useTheme } from '@theme';
import { mkStep, type StepStyles } from './onboardingStyles';

type Sex = 'female' | 'male' | 'other';

interface Props {
  ageRange: AgeRange | null;
  gender: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  onAge: (v: AgeRange | null) => void;
  onGender: (v: Sex | null) => void;
  onHeight: (v: number | null) => void;
  onWeight: (v: number | null) => void;
}

const SEXES: { key: Sex; label: string }[] = [
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'other', label: 'Another' },
];

/** Optional and skippable. Only for calories and heart-rate zones. */
export default function AboutYouStep(p: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const tap = () => Haptics.selectionAsync().catch(() => {});

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>Optional</Text>
      <Text style={s.title}>About you</Text>
      <Text style={s.sub}>Only used to estimate calories and heart-rate zones. Skip any of it.</Text>

      <Text style={s.label}>Age</Text>
      <View style={s.grid}>
        {AGE_RANGES.map(a => {
          const on = p.ageRange === a.key;
          return (
            <Pressable key={a.key} style={[s.chip, s.gridCell, on && s.chipOn]} onPress={() => { tap(); p.onAge(on ? null : a.key); }}
              accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>Sex</Text>
      <View style={s.row}>
        {SEXES.map(x => {
          const on = p.gender === x.key;
          return (
            <Pressable key={x.key} style={[s.chip, s.cell, on && s.chipOn]} onPress={() => { tap(); p.onGender(on ? null : x.key); }}
              accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Stepper s={s} label="Height" unit="cm" value={p.heightCm} start={170} min={120} max={220} onChange={p.onHeight} />
      <Stepper s={s} label="Weight" unit="kg" value={p.weightKg} start={70} min={30} max={200} onChange={p.onWeight} />
    </ScrollView>
  );
}

function Stepper({ s, label, unit, value, start, min, max, onChange }: {
  s: StepStyles; label: string; unit: string; value: number | null; start: number; min: number; max: number;
  onChange: (v: number | null) => void;
}) {
  const C = useTheme();
  const step = (d: number) => {
    Haptics.selectionAsync().catch(() => {});
    const next = (value ?? start) + (value == null ? 0 : d);
    onChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <View style={[s.card, { justifyContent: 'space-between' }]}>
      <View>
        <Text style={s.cardTitle}>{label}</Text>
        {value != null
          ? <Pressable onPress={() => onChange(null)} hitSlop={6}><Text style={[s.cardSub, { textDecorationLine: 'underline' }]}>Clear</Text></Pressable>
          : <Text style={s.cardSub}>Not set</Text>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={() => step(-1)} style={[s.chip, { minWidth: 44 }]} accessibilityLabel={`Decrease ${label}`}>
          <Text style={s.chipText}>−</Text>
        </Pressable>
        <Text style={[s.statNum, { fontSize: 30, lineHeight: 32, minWidth: 64, textAlign: 'center', color: value == null ? C.t3 : C.t1 }]}>
          {value ?? '—'}<Text style={s.statUnit}> {unit}</Text>
        </Text>
        <Pressable onPress={() => step(1)} style={[s.chip, { minWidth: 44 }]} accessibilityLabel={`Increase ${label}`}>
          <Text style={s.chipText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
