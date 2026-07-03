import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Check } from 'phosphor-react-native';
import { D } from './onboardingStyles';
import { GOAL_LABELS, EXP_LABELS } from '../types';
import type { OnboardingData } from '../types';

interface Props {
  weeklyKmDisplay: number;
  primaryGoal: OnboardingData['primaryGoal'];
  experienceLevel: OnboardingData['experienceLevel'];
  error: string;
}

const GOAL_LINES: Record<OnboardingData['primaryGoal'], string> = {
  get_fit:     'Your territories are waiting. Go claim them.',
  lose_weight: 'Every zone you claim is progress that lasts.',
  run_faster:  'Speed is territory claimed per second.',
  explore:     "The best routes haven't been discovered yet — by you.",
  compete:     'Someone, somewhere, is already defending their turf.',
};

export default function LaunchStep({ weeklyKmDisplay, primaryGoal, experienceLevel, error }: Props) {
  const summaryRows = [
    { label: 'Weekly goal',  val: `${weeklyKmDisplay.toFixed(0)} km` },
    { label: 'Primary goal', val: GOAL_LABELS[primaryGoal] ?? primaryGoal },
    { label: 'Level',        val: EXP_LABELS[experienceLevel] ?? experienceLevel },
  ];

  const checkScale   = useRef(new Animated.Value(0.6)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  const rowAnims = useRef(summaryRows.map(() => ({
    opacity:    new Animated.Value(0),
    translateY: new Animated.Value(10),
  }))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkScale,   { toValue: 1, damping: 18, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.stagger(
        80,
        rowAnims.map(({ opacity, translateY }) =>
          Animated.parallel([
            Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, damping: 22, useNativeDriver: true }),
          ])
        )
      ).start();
    }, 200);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.wrap}>
      <Animated.View style={[s.checkCircle, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}>
        <Check size={22} color={D.t1} weight="regular" />
      </Animated.View>

      <Text style={s.eyebrow}>You're in</Text>
      <Text style={s.title}>Ready to{'\n'}run.</Text>
      <Text style={s.sub}>{GOAL_LINES[primaryGoal]}</Text>

      <View style={s.summaryList}>
        {summaryRows.map((r, i) => (
          <Animated.View
            key={r.label}
            style={[
              s.summaryRow,
              i === 0 && s.summaryRowFirst,
              { opacity: rowAnims[i].opacity, transform: [{ translateY: rowAnims[i].translateY }] },
            ]}
          >
            <Text style={s.summaryLabel}>{r.label}</Text>
            <Text style={s.summaryVal}>{r.val}</Text>
          </Animated.View>
        ))}
      </View>

      {!!error && <Text style={s.errText}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  checkCircle: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 0.5, borderColor: D.div, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  eyebrow: {
    fontWeight: '500', fontSize: 9, color: D.red,
    textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10,
  },
  title: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 36,
    color: D.t1, lineHeight: 40, textAlign: 'center', marginBottom: 10,
  },
  sub: {
    fontSize: 13, color: D.t2,
    textAlign: 'center', lineHeight: 19, marginBottom: 32,
  },
  summaryList: { width: '100%', marginBottom: 16 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: D.div,
  },
  summaryRowFirst: { borderTopWidth: 0.5, borderTopColor: D.div },
  summaryLabel: { fontSize: 12, color: D.t2 },
  summaryVal:   { fontWeight: '500', fontSize: 14, color: D.t1 },
  errText: {
    fontSize: 10, color: D.red,
    textAlign: 'center', marginTop: 8,
  },
});
