import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import * as Haptics from '@theme/hapticsGated';
import { useTheme } from '@theme';
import { RACE_LABEL, PLAN_WEEKS, fmtPace, RACE_KM, type RaceDistance } from '@shared/engine/training';
import { mkStep } from './onboardingStyles';
import WhyPaceX from './WhyPaceX';
import { parseGoalTime } from '../types';

const RACES: RaceDistance[] = ['5k', '10k', 'half', 'marathon'];
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Only for the race goal: which race, when, and an optional goal time. */
export default function RaceStep({ race, weeks, raceDate, goalInput, onRace, onWeeks, onGoal }: {
  race: RaceDistance | null; weeks: number; raceDate: string; goalInput: string;
  onRace: (r: RaceDistance) => void; onWeeks: (w: number) => void; onGoal: (v: string) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const min = race ? PLAN_WEEKS[race].min : 4;
  const goal = parseGoalTime(goalInput);
  const goalSec = goal.ok ? goal.seconds : null;
  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Which{'\n'}race?</Text>
      <Text style={s.sub}>Pick one you've entered, or one you'd like to run.</Text>

      <Text style={s.label}>Distance</Text>
      <View style={s.chips} accessibilityRole="radiogroup">
        {RACES.map(r => {
          const on = r === race;
          return (
            <Pressable key={r} style={[s.chip, on && s.chipOn, { flexGrow: 1 }]} onPress={() => { Haptics.selectionAsync().catch(() => {}); onRace(r); }}
              accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{RACE_LABEL[r]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>Race day</Text>
      <View style={[s.card, { justifyContent: 'space-between' }]}>
        <Pressable hitSlop={8} onPress={() => onWeeks(Math.max(min, weeks - 1))} accessibilityRole="button" accessibilityLabel="One week earlier"><Minus size={18} color={C.t1} /></Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.cardTitle}>{fmtDate(raceDate)}</Text>
          <Text style={s.cardSub}>{weeks} weeks away</Text>
        </View>
        <Pressable hitSlop={8} onPress={() => onWeeks(Math.min(52, weeks + 1))} accessibilityRole="button" accessibilityLabel="One week later"><Plus size={18} color={C.t1} /></Pressable>
      </View>

      <Text style={s.label}>Goal time (optional)</Text>
      <TextInput
        style={[s.input, !goal.ok && s.inputError]} value={goalInput} onChangeText={onGoal}
        placeholder="h:mm:ss or mm:ss" placeholderTextColor={C.t3} keyboardType="numbers-and-punctuation"
        accessibilityLabel="Goal time"
      />
      {goalSec && race ? <Text style={s.note}>That's {fmtPace(goalSec / RACE_KM[race])} /km.</Text> : null}
      {!goal.ok && <Text style={s.error}>Type it like 1:59:00 or 52:30.</Text>}

      <WhyPaceX>the date sets how long your plan is and when you taper. A goal faster than your fitness suggests is capped to keep you safe.</WhyPaceX>
    </ScrollView>
  );
}
