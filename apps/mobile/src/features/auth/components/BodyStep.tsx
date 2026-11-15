import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { useTheme } from '@theme';
import { mkStep } from './onboardingStyles';
import WhyPaceX from './WhyPaceX';
import { NIGGLES, type Niggle } from '../types';

/** Sore spots and comebacks, so plans go easier where they need to. */
export default function BodyStep({ niggles, returning, onNiggles, onReturning }: {
  niggles: Niggle[]; returning: boolean; onNiggles: (n: Niggle[]) => void; onReturning: (v: boolean) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const none = niggles.length === 0;
  const toggle = (n: Niggle) => {
    Haptics.selectionAsync().catch(() => {});
    onNiggles(niggles.includes(n) ? niggles.filter(x => x !== n) : [...niggles, n]);
  };
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.title}>How's your{'\n'}body?</Text>
      <Text style={s.sub}>So PaceX knows what to protect. Only you and PaceX see this.</Text>

      <Text style={s.label}>Anything niggling?</Text>
      <View style={s.chips}>
        <Pressable style={[s.chip, none && s.chipOn]} onPress={() => onNiggles([])} accessibilityRole="checkbox" accessibilityState={{ checked: none }}>
          <Text style={[s.chipText, none && s.chipTextOn]}>Nothing</Text>
        </Pressable>
        {NIGGLES.map(n => {
          const on = niggles.includes(n.key);
          return (
            <Pressable key={n.key} style={[s.chip, on && s.chipOn]} onPress={() => toggle(n.key)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{n.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={[s.card, returning && s.cardOn]} onPress={() => onReturning(!returning)} accessibilityRole="checkbox" accessibilityState={{ checked: returning }}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Coming back from an injury or a break</Text>
          <Text style={s.cardSub}>Starts lower and builds slower</Text>
        </View>
      </Pressable>

      <WhyPaceX>with a niggle or a comeback your plan starts 20% lower, grows more slowly and keeps fewer hard days. If something hurts, PaceX tells you to rest, not push, and to see a physio if it doesn't settle.</WhyPaceX>
    </ScrollView>
  );
}
