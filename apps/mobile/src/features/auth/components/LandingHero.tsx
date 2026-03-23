import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LandingHero() {
  return (
    <View style={s.hero}>
      <Text style={s.eyebrow}>Run · Capture · Conquer</Text>
      <Text style={s.headline}>
        Claim your <Text style={s.headlineRed}>city.</Text>
      </Text>
      <Text style={s.subtitle}>
        Run through your neighbourhood.{'\n'}Capture territory. Compete nearby.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 8, zIndex: 2 },
  eyebrow: {
    fontFamily: 'Barlow_300Light', fontSize: 8, color: '#ADADAD',
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8,
  },
  headline: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 30, color: '#0A0A0A', lineHeight: 33,
  },
  headlineRed: { color: '#D93518' },
  subtitle: {
    fontFamily: 'Barlow_300Light', fontSize: 13, color: '#6B6B6B',
    lineHeight: 20, marginTop: 10,
  },
});
