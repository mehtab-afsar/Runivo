import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Flag } from 'lucide-react-native';
import { RUNNING_GOALS, type RunningGoal } from '@shared/engine/onboarding';
import { useTheme, Fonts } from '@theme';
import { mkStep } from './onboardingStyles';

/** The last screen: one mission, one button (Start run, in the footer). */
export default function FirstMissionStep({ goal, weeklyTargetKm }: { goal: RunningGoal | null; weeklyTargetKm: number }) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const goalLabel = RUNNING_GOALS.find(g => g.key === goal)?.label ?? 'Get fit';
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>Your first mission</Text>
      <Text style={s.title}>Claim your{'\n'}first zone</Text>
      <Text style={s.sub}>Run a loop of at least 1 km. Close it and the streets inside are yours.</Text>

      <View style={[st.mission, { backgroundColor: C.alwaysDark }]}>
        <View style={[st.flag, { backgroundColor: C.red }]}>
          <Flag size={22} color={C.alwaysLight} strokeWidth={2.2} />
        </View>
        <Text style={[st.big, { color: C.alwaysLight }]}>1 km loop</Text>
        <Text style={[st.small, { color: 'rgba(255,255,255,0.65)' }]}>Back to where you started · +5 PACE for the new zone</Text>
      </View>

      <View style={st.row}>
        <View style={[s.statCard, st.half]}>
          <Text style={s.statUnit}>Weekly target</Text>
          <Text style={[s.statNum, { fontSize: 32 }]}>{weeklyTargetKm} <Text style={s.statUnit}>km</Text></Text>
        </View>
        <View style={[s.statCard, st.half]}>
          <Text style={s.statUnit}>Your goal</Text>
          <Text style={[st.goal, { color: C.t1 }]} numberOfLines={2}>{goalLabel}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  mission: { borderRadius: 22, padding: 20, marginTop: 4 },
  flag:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  big:     { fontFamily: Fonts.hero, fontSize: 40, lineHeight: 40, textTransform: 'uppercase' },
  small:   { fontFamily: Fonts.regular, fontSize: 14, marginTop: 6 },
  row:     { flexDirection: 'row', gap: 10, marginTop: 10 },
  half:    { flex: 1, marginTop: 0 },
  goal:    { fontFamily: Fonts.semiBold, fontSize: 18, marginTop: 6 },
});
