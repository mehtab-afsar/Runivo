import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { RUNS_PER_WEEK_OPTIONS, USUAL_DISTANCE_OPTIONS_KM, parseFiveKTime } from '@shared/engine/onboarding';
import { useTheme } from '@theme';
import { mkStep } from './onboardingStyles';

interface Props {
  runsPerWeek: number;
  usualKm: number;
  fiveKInput: string;
  weeklyTargetKm: number;
  onRuns: (n: number) => void;
  onKm: (km: number) => void;
  onFiveK: (v: string) => void;
}

/** "Your running now" — sets the starting weekly target, mission difficulty and PaceX's pace zones. */
export default function RunningNowStep({ runsPerWeek, usualKm, fiveKInput, weeklyTargetKm, onRuns, onKm, onFiveK }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const fiveK = parseFiveKTime(fiveKInput);
  // Typing "2" or "28:" is simply unfinished, not wrong: only complain once it could be a full time.
  const showFiveKError = !fiveK.ok && fiveKInput.length >= 4;

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>Your running</Text>
      <Text style={s.title}>Your running{'\n'}right now</Text>
      <Text style={s.sub}>Be honest. We start where you are, and build from there.</Text>

      <Text style={s.label}>Runs a week</Text>
      <View style={s.chips}>
        {RUNS_PER_WEEK_OPTIONS.map(n => {
          const on = runsPerWeek === n;
          return (
            <Pressable key={n} style={[s.chip, on && s.chipOn]} onPress={() => { Haptics.selectionAsync().catch(() => {}); onRuns(n); }}
              accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${n} runs a week`}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>Usual distance</Text>
      <View style={s.chips}>
        {USUAL_DISTANCE_OPTIONS_KM.map(km => {
          const on = usualKm === km;
          return (
            <Pressable key={km} style={[s.chip, on && s.chipOn]} onPress={() => { Haptics.selectionAsync().catch(() => {}); onKm(km); }}
              accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{km} km</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>Recent 5K time <Text style={{ color: C.t3 }}>(optional)</Text></Text>
      <TextInput
        value={fiveKInput}
        onChangeText={v => onFiveK(v.replace(/[^\d:]/g, '').slice(0, 7))}
        placeholder="mm:ss, e.g. 28:30"
        placeholderTextColor={C.t3}
        keyboardType="numbers-and-punctuation"
        style={[s.input, showFiveKError && s.inputError]}
        accessibilityLabel="Recent 5K time in minutes and seconds"
      />
      {showFiveKError && !fiveK.ok && <Text style={s.error}>{fiveK.error}</Text>}

      <View style={[s.statCard, { marginTop: 22 }]}>
        <Text style={s.statUnit}>Your starting target</Text>
        <Text style={s.statNum}>{weeklyTargetKm} <Text style={s.statUnit}>km a week</Text></Text>
      </View>
    </ScrollView>
  );
}
