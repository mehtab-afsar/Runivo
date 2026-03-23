/**
 * Step 1 — Experience level selection.
 * Named UsernameStep to match spec, maps to the "How do you run?" experience step.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { EXP_OPTIONS } from '../types';
import type { OnboardingData } from '../types';
import { C, shared } from './onboardingStyles';

interface Props {
  experienceLevel: OnboardingData['experienceLevel'];
  onChange: (v: OnboardingData['experienceLevel']) => void;
}

export default function UsernameStep({ experienceLevel, onChange }: Props) {
  return (
    <ScrollView contentContainerStyle={shared.stepContent}>
      <Text style={shared.eyebrow}>Your level</Text>
      <Text style={shared.heroTitle}>How do you run?</Text>
      <Text style={shared.subtitle}>We'll tailor missions and training to match.</Text>
      {EXP_OPTIONS.map(opt => {
        const sel = experienceLevel === opt.key;
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
