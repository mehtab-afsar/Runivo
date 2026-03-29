/**
 * Step 6 — "You're ready to run" confirmation screen.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Check } from 'lucide-react-native';
import { C } from './onboardingStyles';
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

  const checkScale   = useRef(new Animated.Value(0.6)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  const cardAnims = useRef(summaryCards.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(10),
  }))).current;

  useEffect(() => {
    // Animate check circle
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, damping: 18, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Stagger summary cards after a short delay
    setTimeout(() => {
      Animated.stagger(
        80,
        cardAnims.map(({ opacity, translateY }) =>
          Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, damping: 22, useNativeDriver: true }),
          ])
        )
      ).start();
    }, 200);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.wrap}>
      <Animated.View
        style={[
          s.checkCircle,
          { opacity: checkOpacity, transform: [{ scale: checkScale }] },
        ]}
      >
        <Check size={22} color={C.black} strokeWidth={2} />
      </Animated.View>
      <Text style={s.eyebrow}>You're in</Text>
      <Text style={s.title}>You're ready to run.</Text>
      <Text style={s.sub}>Your profile is set up. Time to claim some territory.</Text>
      <View style={{ width: '100%', gap: 8, marginBottom: 24 }}>
        {summaryCards.map((c, i) => (
          <Animated.View
            key={c.label}
            style={[
              s.summaryRowCard,
              {
                opacity: cardAnims[i].opacity,
                transform: [{ translateY: cardAnims[i].translateY }],
              },
            ]}
          >
            <Text style={s.summaryRowLabel}>{c.label}</Text>
            <Text style={s.summaryRowVal}>{c.val}</Text>
          </Animated.View>
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
