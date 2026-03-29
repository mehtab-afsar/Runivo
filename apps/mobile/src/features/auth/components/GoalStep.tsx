/**
 * Step 3 — Primary goal selection.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Flame, Zap, Compass, Swords } from 'lucide-react-native';
import type { OnboardingData } from '../types';
import { GOAL_OPTIONS } from '../types';
import { C, shared } from './onboardingStyles';

type IconComponent = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;

const ICONS: Record<OnboardingData['primaryGoal'], IconComponent> = {
  get_fit:     Heart,
  lose_weight: Flame,
  run_faster:  Zap,
  explore:     Compass,
  compete:     Swords,
};

interface Props {
  primaryGoal: OnboardingData['primaryGoal'];
  onChange: (v: OnboardingData['primaryGoal']) => void;
}

export default function GoalStep({ primaryGoal, onChange }: Props) {
  const anims = useRef(GOAL_OPTIONS.map(() => ({
    opacity: new Animated.Value(0),
    translateX: new Animated.Value(20),
  }))).current;

  const pressAnims = useRef(GOAL_OPTIONS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.stagger(
      60,
      anims.map(({ opacity, translateX }) =>
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, damping: 22, useNativeDriver: true }),
        ])
      )
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView contentContainerStyle={shared.stepContent}>
      <Text style={shared.eyebrow}>Your mission</Text>
      <Text style={shared.heroTitle}>What's your main goal?</Text>
      <Text style={shared.subtitle}>This shapes your missions and weekly targets.</Text>
      {GOAL_OPTIONS.map((opt, i) => {
        const sel = primaryGoal === opt.key;
        const Icon = ICONS[opt.key];
        return (
          <Animated.View
            key={opt.key}
            style={{
              opacity: anims[i].opacity,
              transform: [
                { translateX: anims[i].translateX },
                { scale: pressAnims[i] },
              ],
            }}
          >
            <Pressable
              onPress={() => onChange(opt.key)}
              onPressIn={() => Animated.spring(pressAnims[i], { toValue: 0.97, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(pressAnims[i], { toValue: 1.0, useNativeDriver: true }).start()}
            >
              {sel ? (
                <LinearGradient
                  colors={[C.gradStart, C.gradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={shared.gradientCard}
                >
                  <Icon size={20} color="#fff" strokeWidth={1.8} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardLabelSel}>{opt.label}</Text>
                    <Text style={s.cardSubSel}>{opt.sub}</Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={s.cardUnsel}>
                  <Icon size={20} color="#9CA3AF" strokeWidth={1.8} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardLabel}>{opt.label}</Text>
                    <Text style={s.cardSub}>{opt.sub}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cardUnsel: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#F3F3F3',
    backgroundColor: C.white, marginBottom: 10,
  },
  cardLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 14, color: '#374151' },
  cardLabelSel: { fontFamily: 'Barlow_500Medium', fontSize: 14, color: '#FFFFFF' },
  cardSub:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  cardSubSel:   { fontFamily: 'Barlow_300Light', fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
});
