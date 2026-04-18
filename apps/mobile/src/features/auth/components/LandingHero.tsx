import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import HexMark from './HexMark';

export default function LandingHero() {
  return (
    <View style={s.wrap}>
      <HexMark size={64} color="#D93518" fadedOpacity={1} />
      <Text style={s.tagline}>RUN · CAPTURE · CONQUER</Text>
      <Text style={s.headline}>
        {'Your city is\n'}<Text style={s.red}>territory.</Text>
      </Text>
      <Text style={s.subtitle}>
        Turn every run into conquest. Claim hex zones, build{'\n'}your empire, climb the leaderboard.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { alignItems: 'flex-start', paddingHorizontal: 28 },
  tagline:  {
    fontFamily: 'Barlow_400Regular', fontSize: 9, color: '#ADADAD',
    letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 20, marginBottom: 14,
  },
  headline: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 38, color: '#0A0A0A', lineHeight: 44, marginBottom: 14,
  },
  red:      { color: '#D93518' },
  subtitle: {
    fontFamily: 'Barlow_300Light', fontSize: 13, color: '#6B6B6B', lineHeight: 20,
  },
});
