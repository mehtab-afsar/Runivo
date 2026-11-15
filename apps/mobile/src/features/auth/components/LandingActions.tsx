import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { Colors, Fonts } from '@theme';

interface Props {
  onSignUp: () => void;
  onSignIn: () => void;
}

export default function LandingActions({ onSignUp, onSignIn }: Props) {
  return (
    <View style={s.wrap}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [s.primary, pressed && s.pressed]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onSignUp(); }}
      >
        <Text style={s.primaryLabel}>Get started</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [s.secondary, pressed && s.pressed]}
        onPress={onSignIn}
      >
        <Text style={s.secondaryLabel}>I already have an account</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:           { gap: 10 },
  primary:        { height: 56, borderRadius: 999, backgroundColor: Colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryLabel:   { fontFamily: Fonts.semiBold, fontSize: 17, color: '#FFFFFF' },
  secondary:      { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontFamily: Fonts.medium, fontSize: 16, color: Colors.t1 },
  pressed:        { transform: [{ scale: 0.985 }], opacity: 0.92 },
});
