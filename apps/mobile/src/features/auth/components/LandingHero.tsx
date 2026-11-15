import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@theme';

/** "Run smarter." — the motto, then what Runivo is in one line. */
export default function LandingHero() {
  return (
    <View>
      <Text style={s.headline} accessibilityRole="header">
        Run <Text style={{ color: Colors.green }}>smarter.</Text>
      </Text>
      <Text style={s.subtitle}>AI coaching. Live crews. Your city.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  headline: { fontFamily: Fonts.semiBold, fontSize: 48, lineHeight: 52, letterSpacing: -1.7, color: Colors.t1 },
  subtitle: { fontFamily: Fonts.regular, fontSize: 17, lineHeight: 24, color: Colors.t2, marginTop: 6 },
});
