import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import { Footprints, PersonStanding, Zap, Flame } from 'lucide-react-native';
import { EXP_OPTIONS } from '../types';
import type { OnboardingData } from '../types';
import { D, shared } from './onboardingStyles';

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
const ICONS: Record<OnboardingData['experienceLevel'], IconComp> = {
  new: Footprints, casual: PersonStanding, regular: Zap, competitive: Flame,
};

interface Props {
  experienceLevel: OnboardingData['experienceLevel'];
  onChange: (v: OnboardingData['experienceLevel']) => void;
}

export default function UsernameStep({ experienceLevel, onChange }: Props) {
  const anims = useRef(EXP_OPTIONS.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(14),
  }))).current;

  useEffect(() => {
    Animated.stagger(70, anims.map(({ opacity, translateY }) =>
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    )).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView contentContainerStyle={shared.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={shared.eyebrow}>Your level</Text>
      <Text style={shared.heroTitle}>How do you run?</Text>
      <Text style={shared.subtitle}>We'll tailor missions and training to match.</Text>

      <View style={s.rule} />

      {EXP_OPTIONS.map((opt, i) => {
        const sel = experienceLevel === opt.key;
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
});
