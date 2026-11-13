import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { HeartPulse, Trophy, Swords, Users, type LucideIcon } from 'lucide-react-native';
import { RUNNING_GOALS, type RunningGoal } from '@shared/engine/onboarding';
import { useTheme } from '@theme';
import { mkStep } from './onboardingStyles';

const ICONS: Record<RunningGoal, LucideIcon> = {
  get_fit: HeartPulse, race: Trophy, compete: Swords, social: Users,
};

/** "Why do you run?" — sets the mission mix and how PaceX talks to them. */
export default function GoalStep({ goal, onChange }: { goal: RunningGoal | null; onChange: (g: RunningGoal) => void }) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>PaceX · your AI coach</Text>
      <Text style={s.title}>Why do{'\n'}you run?</Text>
      <Text style={s.sub}>PaceX, your coach, tunes your missions and how it talks to you around this.</Text>
      {RUNNING_GOALS.map(g => {
        const on = goal === g.key;
        const Icon = ICONS[g.key];
        return (
          <Pressable
            key={g.key}
            style={[s.card, on && s.cardOn]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(g.key); }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <View style={[s.cardIcon, on && s.cardIconOn]}>
              <Icon size={22} color={on ? C.red : C.t1} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{g.label}</Text>
              <Text style={s.cardSub}>{g.sub}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
