/** The small setup steps: goal, distance, your week, injury history (PRD mocks 1, 6, 7). */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Flag, TrendUp, Lightning, PersonSimpleRun, ArrowCounterClockwise, Heart, FirstAid, WarningCircle, Minus } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { ChoiceCards, FieldLabel } from '@mobile/shared/components/form/FormKit';
import type { PlanGoal, InjuryLevel } from '@shared/engine/training';

export const GOALS: { value: PlanGoal; title: string; sub: string; Icon: typeof Flag }[] = [
  { value: 'race', title: 'Train for a race', sub: 'Find your race or add it', Icon: Flag },
  { value: 'further', title: 'Run further', sub: 'Build up to a new distance', Icon: TrendUp },
  { value: 'faster', title: 'Get faster', sub: 'A quicker 5K or 10K', Icon: Lightning },
  { value: 'start', title: 'Start running', sub: 'Walk-run to your first 5K in 9 weeks', Icon: PersonSimpleRun },
  { value: 'return', title: 'Get back into it', sub: 'Ease in after time off, 6 weeks', Icon: ArrowCounterClockwise },
];

export function GoalStep({ value, onChange }: { value: PlanGoal; onChange: (g: PlanGoal) => void }) {
  return <ChoiceCards options={GOALS} value={value} onChange={onChange} />;
}

export type InjuryChoice = InjuryLevel | 'unsaid';
export function InjuryStep({ value, onChange }: { value: InjuryChoice; onChange: (v: InjuryChoice) => void }) {
  return (
    <ChoiceCards
      value={value} onChange={onChange}
      options={[
        { value: 'none', title: 'Rarely or never', sub: 'Standard build', Icon: Heart },
        { value: 'minor', title: "Minor, or one I've recovered from", sub: 'Gentler build, less hard running', Icon: FirstAid },
        { value: 'often', title: 'Often, or recently', sub: 'Slowest build, no intervals for 3 weeks. Worth seeing a professional first.', Icon: WarningCircle },
        { value: 'unsaid', title: 'Prefer not to say', Icon: Minus },
      ]}
    />
  );
}

/** Even pill row: every option the same width. */
export function PillRow<T extends string | number>({ options, value, onChange, isOn, disabled }: {
  options: { value: T; label: string; a11y?: string }[];
  value?: T | null;
  onChange: (v: T) => void;
  isOn?: (v: T) => boolean;
  disabled?: (v: T) => boolean;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <View style={s.row}>
      {options.map(o => {
        const on = isOn ? isOn(o.value) : o.value === value;
        const off = disabled?.(o.value) ?? false;
        return (
          <Pressable key={String(o.value)} style={[s.pill, on && s.pillOn, off && { opacity: 0.35 }]} disabled={off} onPress={() => onChange(o.value)}
            accessibilityRole="button" accessibilityLabel={o.a11y ?? o.label} accessibilityState={{ selected: on, disabled: off }}>
            <Text style={[s.pillTxt, on && s.pillTxtOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKLY_KM = [
  { value: 5, label: '<10' }, { value: 15, label: '10–20' }, { value: 27, label: '20–35' }, { value: 40, label: '35+' },
];
export const nearestWeekly = (km: number | null) =>
  km == null ? 15 : WEEKLY_KM.reduce((b, o) => (Math.abs(o.value - km) < Math.abs(b - km) ? o.value : b), WEEKLY_KM[0].value);

export function WeekStep({ days, longDay, weeklyKm, fromRuns, showVolume, onDays, onLong, onWeekly }: {
  days: number[]; longDay: number; weeklyKm: number; fromRuns: number | null; showVolume: boolean;
  onDays: (d: number[]) => void; onLong: (d: number) => void; onWeekly: (km: number) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const toggle = (d: number) => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b);
    if (next.length > 5) return;
    onDays(next);
    if (!next.includes(longDay) && next.length) onLong(next[next.length - 1]);
  };
  return (
    <View style={{ gap: 18 }}>
      <View>
        <FieldLabel hint={`${days.length} picked`}>Days you can run</FieldLabel>
        <PillRow options={DAY_LETTER.map((l, i) => ({ value: i, label: l, a11y: DAY_NAME[i] }))} isOn={d => days.includes(d)} onChange={toggle} />
        <Text style={s.hint}>Pick 3 to 5.</Text>
      </View>
      {days.length > 0 && (
        <View>
          <FieldLabel>Long run on</FieldLabel>
          <PillRow options={days.map(d => ({ value: d, label: DAY_NAME[d].slice(0, 3) }))} value={longDay} onChange={onLong} />
        </View>
      )}
      {showVolume && (
        <View>
          <FieldLabel>Running now</FieldLabel>
          <PillRow options={WEEKLY_KM} value={weeklyKm} onChange={onWeekly} />
          <Text style={s.hint}>km a week{fromRuns != null ? `. From your runs: about ${fromRuns} km` : ''}</Text>
        </View>
      )}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    row:      { flexDirection: 'row', gap: 6 },
    pill:     { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    pillOn:   { backgroundColor: C.t1, borderColor: C.t1 },
    pillTxt:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    pillTxtOn:{ color: C.bg },
    hint:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 8 },
  });
}
