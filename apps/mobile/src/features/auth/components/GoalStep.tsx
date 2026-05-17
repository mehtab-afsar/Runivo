import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import { Heart, Flame, Zap, Compass, Swords } from 'lucide-react-native';
import type { OnboardingData } from '../types';
import { GOAL_OPTIONS } from '../types';
import { D, shared } from './onboardingStyles';

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
const ICONS: Record<OnboardingData['primaryGoal'], IconComp> = {
  get_fit: Heart, lose_weight: Flame, run_faster: Zap, explore: Compass, compete: Swords,
};

const GOAL_HINTS: Record<OnboardingData['primaryGoal'], string> = {
  get_fit:     'Missions will build your endurance week over week.',
  lose_weight: 'Every run burns calories. Your map shows the proof.',
  run_faster:  'Pace targets and tempo missions will define your plan.',
  explore:     'New hexagons = new routes. Your city is the gym.',
  compete:     'Territory battles and leaderboard ranking await.',
};

interface Props {
  primaryGoal: OnboardingData['primaryGoal'];
  onChange: (v: OnboardingData['primaryGoal']) => void;
}

export default function GoalStep({ primaryGoal, onChange }: Props) {
  const anims = useRef(GOAL_OPTIONS.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(14),
  }))).current;

  useEffect(() => {
    Animated.stagger(70, anims.map(({ opacity, translateY }) =>
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    )).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView contentContainerStyle={shared.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={shared.eyebrow}>Your mission</Text>
      <Text style={shared.heroTitle}>What's your main goal?</Text>
      <Text style={shared.subtitle}>This shapes your missions and weekly targets.</Text>

      <View style={s.rule} />

      {GOAL_OPTIONS.map((opt, i) => {
        const sel = primaryGoal === opt.key;
        const Icon = ICONS[opt.key];
        return (
          <Animated.View
            key={opt.key}
            style={{ opacity: anims[i].opacity, transform: [{ translateY: anims[i].translateY }] }}
          >
            <Pressable style={s.row} onPress={() => onChange(opt.key)}>
              <View style={[s.accent, sel && s.accentActive]} />
              <Icon size={18} color={sel ? D.red : D.t3} strokeWidth={1.5} />
              <View style={{ flex: 1 }}>
                <Text style={[s.label, sel && s.labelSel]}>{opt.label}</Text>
                <Text style={s.sub}>{opt.sub}</Text>
              </View>
              {sel && <View style={s.dot} />}
            </Pressable>
          </Animated.View>
        );
      })}

      <View style={s.hint}>
        <Text style={s.hintText}>{GOAL_HINTS[primaryGoal]}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rule:        { height: 1, backgroundColor: D.div, marginBottom: 0 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: D.div },
  accent:      { width: 2, height: 32, borderRadius: 1, backgroundColor: 'transparent' },
  accentActive:{ backgroundColor: D.red },
  label:       { fontFamily: 'DMSans_400Regular', fontSize: 15, color: D.t2 },
  labelSel:    { fontFamily: 'DMSans_500Medium', color: D.t1 },
  sub:         { fontFamily: 'DMSans_300Light', fontSize: 12, color: D.t3, marginTop: 2 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: D.red },
  hint:        { marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: 'rgba(200,57,26,0.05)', borderRadius: 8, borderLeftWidth: 2, borderLeftColor: D.red },
  hintText:    { fontFamily: 'DMSans_300Light', fontSize: 13, color: D.t1, lineHeight: 19 },
});
