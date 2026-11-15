import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { useTheme } from '@theme';
import { mkStep } from './onboardingStyles';
import WhyPaceX from './WhyPaceX';
import type { UsualRunTime } from '../types';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMES: { key: UsualRunTime; label: string }[] = [
  { key: 'early', label: 'Before 7' }, { key: 'morning', label: 'Morning' },
  { key: 'evening', label: 'Evening' }, { key: 'varies', label: 'It varies' },
];
const MINUTES = [30, 45, 60, 90];

/** Your week: run days, long-run day, usual time, time on a weekday. */
export default function WeekStep({ runDays, longRunDay, usualTime, weekdayMinutes, onDays, onLong, onTime, onMinutes }: {
  runDays: number[]; longRunDay: number; usualTime: UsualRunTime | null; weekdayMinutes: number | null;
  onDays: (d: number[]) => void; onLong: (d: number) => void; onTime: (t: UsualRunTime) => void; onMinutes: (m: number) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const toggle = (d: number) => {
    Haptics.selectionAsync().catch(() => {});
    const next = runDays.includes(d) ? runDays.filter(x => x !== d) : [...runDays, d].sort();
    onDays(next);
    if (!next.includes(longRunDay) && next.length) onLong(next[next.length - 1]);
  };
  const Chip = ({ on, label, onPress, a11y }: { on: boolean; label: string; onPress: () => void; a11y?: string }) => (
    <Pressable style={[s.chip, on && s.chipOn]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={a11y}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.title}>Your{'\n'}week.</Text>
      <Text style={s.sub}>PaceX fits training around your life, not the other way round.</Text>

      <Text style={s.label}>Days you can run · {runDays.length} picked</Text>
      <View style={[s.chips, { flexWrap: 'nowrap', gap: 6 }]}>
        {DAYS.map((d, i) => {
          const on = runDays.includes(i);
          return (
            <Pressable key={i} style={[s.chip, on && s.chipOn, { flex: 1, minWidth: 0, paddingHorizontal: 0, borderRadius: 14 }]}
              onPress={() => toggle(i)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={DAY_NAMES[i]}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
      {runDays.length > 5 && <Text style={[s.note, { marginTop: -8, marginBottom: 12 }]}>Plans use up to 5 of these; the rest stay easy or rest.</Text>}

      <Text style={s.label}>Long run day</Text>
      <View style={s.chips}>
        {runDays.map(d => <Chip key={d} on={d === longRunDay} label={DAY_NAMES[d]} onPress={() => onLong(d)} />)}
      </View>

      <Text style={s.label}>Usual time</Text>
      <View style={s.chips}>
        {TIMES.map(t => <Chip key={t.key} on={t.key === usualTime} label={t.label} onPress={() => onTime(t.key)} />)}
      </View>

      <Text style={s.label}>Time on a weekday</Text>
      <View style={s.chips}>
        {MINUTES.map(m => <Chip key={m} on={m === weekdayMinutes} label={`${m} min`} onPress={() => onMinutes(m)} />)}
      </View>

      <WhyPaceX>sessions go only on these days, the long run on your long-run day, weekday runs fit your time, and reminders come before you usually head out.</WhyPaceX>
    </ScrollView>
  );
}
