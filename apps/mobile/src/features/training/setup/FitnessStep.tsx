/**
 * Current fitness (PRD mock 5): a time over 5K, 10K or a half, set with
 * steppers instead of typing. "I don't know" estimates it from recent runs,
 * or asks for an ability level when there aren't enough runs.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CaretUp, CaretDown } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { ChipGroup, ChoiceCards } from '@mobile/shared/components/form/FormKit';
import { fmtDuration, FIVE_K_BY_LEVEL } from '@shared/engine/training';

export type FitnessBasis = '5k' | '10k' | 'half';
export const BASIS_KM: Record<FitnessBasis, number> = { '5k': 5, '10k': 10, half: 21.0975 };
const BASIS = [{ value: '5k' as const, label: '5K' }, { value: '10k' as const, label: '10K' }, { value: 'half' as const, label: 'Half' }];
/** Allowed range per basis, seconds. */
export const BASIS_RANGE: Record<FitnessBasis, [number, number]> = { '5k': [13 * 60, 59 * 60], '10k': [27 * 60, 125 * 60], half: [60 * 60, 4 * 3600] };
export type Level = keyof typeof FIVE_K_BY_LEVEL;

export interface FitnessValue {
  mode: 'time' | 'estimate' | 'level';
  basis: FitnessBasis;
  sec: number;
  level: Level | null;
}

export default function FitnessStep({ value, onChange, estimate }: {
  value: FitnessValue;
  onChange: (v: FitnessValue) => void;
  /** Best 5K-equivalent from recent runs, when there are enough. */
  estimate: { fiveKSec: number; runs: number } | null;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [lo, hi] = BASIS_RANGE[value.basis];
  const set = (sec: number) => onChange({ ...value, mode: 'time', sec: Math.max(lo, Math.min(hi, sec)) });
  const min = Math.floor(value.sec / 60), sec = value.sec % 60;

  const unknown = value.mode !== 'time';
  return (
    <View style={{ gap: 18 }}>
      <ChipGroup
        options={BASIS} value={value.basis}
        onChange={b => onChange({ mode: 'time', basis: b, level: null, sec: b === value.basis ? value.sec : defaultFor(b, value) })}
      />
      <View style={[s.clock, unknown && { opacity: 0.4 }]}>
        <Text style={s.lead}>I can run a <Text style={{ color: C.green }}>{BASIS.find(b => b.value === value.basis)!.label}</Text> in</Text>
        <Text style={s.big} accessibilityLiveRegion="polite">{fmtDuration(value.sec)}</Text>
        <View style={s.cols}>
          <Spinner s={s} C={C} label="minutes" text={`${min} min`} onUp={() => set(value.sec + 60)} onDown={() => set(value.sec - 60)} />
          <Spinner s={s} C={C} label="seconds" text={`${String(sec).padStart(2, '0')} s`} onUp={() => set(value.sec + 5)} onDown={() => set(value.sec - 5)} />
        </View>
      </View>

      <Pressable
        style={[s.idk, value.mode === 'estimate' && s.idkOn]}
        onPress={() => estimate
          ? onChange({ mode: 'estimate', basis: '5k', sec: estimate.fiveKSec, level: null })
          : onChange({ ...value, mode: 'level', level: value.level ?? 'regular' })}
        accessibilityRole="button" accessibilityState={{ selected: unknown }}
      >
        <Text style={s.idkTitle}>I don't know</Text>
        <Text style={s.idkSub}>
          {estimate ? `Estimate from my last ${estimate.runs} runs: about ${fmtDuration(estimate.fiveKSec)} for 5K` : "Not enough recent runs to estimate. Tell us roughly how you run."}
        </Text>
      </Pressable>

      {value.mode === 'level' && (
        <ChoiceCards
          options={[
            { value: 'beginner', title: 'Just starting', sub: 'Running 5K takes me 35 minutes or more' },
            { value: 'regular', title: 'Run regularly', sub: 'Around 30 minutes for 5K' },
            { value: 'experienced', title: 'Experienced', sub: 'Under 25 minutes for 5K' },
          ]}
          value={value.level ?? 'regular'}
          onChange={l => onChange({ mode: 'level', basis: '5k', sec: FIVE_K_BY_LEVEL[l], level: l })}
        />
      )}
    </View>
  );
}

function defaultFor(b: FitnessBasis, v: FitnessValue): number {
  // Keep the same fitness when switching distance (Riegel from the current value).
  const fiveK = v.sec * Math.pow(5 / BASIS_KM[v.basis], 1.06);
  const t = Math.round((fiveK * Math.pow(BASIS_KM[b] / 5, 1.06)) / 5) * 5;
  const [lo, hi] = BASIS_RANGE[b];
  return Math.max(lo, Math.min(hi, t));
}

function Spinner({ s, C, label, text, onUp, onDown }: { s: ReturnType<typeof mk>; C: AppColors; label: string; text: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={s.col}>
      <Pressable style={s.arrow} onPress={onUp} hitSlop={6} accessibilityRole="button" accessibilityLabel={`More ${label}`}><CaretUp size={18} color={C.t1} weight="bold" /></Pressable>
      <Text style={s.colTxt}>{text}</Text>
      <Pressable style={s.arrow} onPress={onDown} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Fewer ${label}`}><CaretDown size={18} color={C.t1} weight="bold" /></Pressable>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    clock:   { backgroundColor: C.card, borderRadius: 24, padding: 18, alignItems: 'center', gap: 6 },
    lead:    { fontFamily: Fonts.medium, fontSize: 15, color: C.t1 },
    big:     { fontFamily: Fonts.semiBold, fontSize: 44, letterSpacing: -1.5, color: C.t1, fontVariant: ['tabular-nums'] },
    cols:    { flexDirection: 'row', gap: 16, marginTop: 4 },
    col:     { alignItems: 'center', gap: 6, width: 96 },
    arrow:   { width: 56, height: 40, borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    colTxt:  { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, fontVariant: ['tabular-nums'] },
    idk:     { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.border },
    idkOn:   { backgroundColor: C.mint, borderColor: C.t1, borderWidth: 2 },
    idkTitle:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    idkSub:  { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2, marginTop: 2 },
  });
}
