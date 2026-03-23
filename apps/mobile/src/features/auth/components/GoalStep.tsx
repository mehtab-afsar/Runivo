/**
 * Step 3 — Primary goal selection.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { OnboardingData } from '../types';
import { GOAL_OPTIONS } from '../types';
import { shared } from './onboardingStyles';

interface Props {
  primaryGoal: OnboardingData['primaryGoal'];
  onChange: (v: OnboardingData['primaryGoal']) => void;
}

export default function GoalStep({ primaryGoal, onChange }: Props) {
  return (
    <ScrollView contentContainerStyle={shared.stepContent}>
      <Text style={shared.eyebrow}>Your mission</Text>
      <Text style={shared.heroTitle}>What's your main goal?</Text>
      <Text style={shared.subtitle}>This shapes your missions and weekly targets.</Text>
      {GOAL_OPTIONS.map(opt => {
        const sel = primaryGoal === opt.key;
        return (
          <Pressable key={opt.key} style={shared.listRow} onPress={() => onChange(opt.key)}>
            <View style={{ flex: 1 }}>
              <Text style={[shared.listLabel, sel && shared.listLabelSel]}>{opt.label}</Text>
              <Text style={shared.listSub}>{opt.sub}</Text>
            </View>
            <View style={[shared.radio, sel && shared.radioSel]}>
              {sel && <View style={shared.radioDot} />}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
