/**
 * Step 6 — "You're ready to run" confirmation screen.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, shared } from './onboardingStyles';
import { GOAL_LABELS, EXP_LABELS } from '../types';
import type { OnboardingData } from '../types';

interface Props {
  weeklyKmDisplay: number;
  primaryGoal: OnboardingData['primaryGoal'];
  experienceLevel: OnboardingData['experienceLevel'];
  error: string;
}

export default function ReadyStep({ weeklyKmDisplay, primaryGoal, experienceLevel, error }: Props) {
  const summaryCards = [
    { label: 'Weekly goal',  val: `${weeklyKmDisplay.toFixed(0)} km` },
    { label: 'Primary goal', val: GOAL_LABELS[primaryGoal] ?? primaryGoal },
    { label: 'Level',        val: EXP_LABELS[experienceLevel] ?? experienceLevel },
  ];

  return (
    <View style={s.wrap}>
      <View style={s.checkCircle}>
        <Text style={{ fontSize: 22, color: C.black }}>✓</Text>
      </View>
      <Text style={s.eyebrow}>You're in</Text>
      <Text style={s.title}>You're ready to run.</Text>
      <Text style={s.sub}>Your profile is set up. Time to claim some territory.</Text>
      <View style={{ width: '100%', gap: 8, marginBottom: 24 }}>
        {summaryCards.map(c => (
          <View key={c.label} style={s.summaryRowCard}>
            <Text style={s.summaryRowLabel}>{c.label}</Text>
            <Text style={s.summaryRowVal}>{c.val}</Text>
          </View>
        ))}
      </View>
      {error ? <Text style={s.errText}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  checkCircle: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 0.5, borderColor: C.border, backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  eyebrow: { fontFamily: 'Barlow_300Light', fontSize: 8, color: C.t3, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: C.black, marginBottom: 8, textAlign: 'center' },
  sub: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, textAlign: 'center', lineHeight: 17, marginBottom: 24 },
  summaryRowCard: {
    backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border,
    borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  summaryRowLabel: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  summaryRowVal: { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.black },
  errText: { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.red, textAlign: 'center', marginBottom: 10 },
});
