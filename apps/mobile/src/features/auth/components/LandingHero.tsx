import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@theme';

/** Headline block of the welcome sheet. */
export default function LandingHero() {
  return (
    <View>
      <Text style={s.eyebrow}>Run, claim, defend</Text>
      <Text style={s.headline} accessibilityRole="header">{'Your city\nis the game.'}</Text>
      <Text style={s.subtitle}>
        Close a loop on a run and the streets inside it are yours. Run them again before a rival does.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow:  { fontFamily: Fonts.medium, fontSize: 12, color: Colors.red },
  headline: {
    fontFamily: Fonts.hero, fontSize: 58, lineHeight: 52, marginTop: 12,
    textTransform: 'uppercase', letterSpacing: -0.3, color: Colors.t1,
  },
  subtitle: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: Colors.t2, marginTop: 14 },
});
