import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import HexMark from './HexMark';
import { useTheme, Fonts, type AppColors } from '@theme';

export default function LandingHero() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <View style={s.wrap}>
      <HexMark size={64} color={C.red} fadedOpacity={1} />
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

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:     { alignItems: 'flex-start', paddingHorizontal: 28 },
    tagline:  {
      fontSize: 9, color: C.t3,
      letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 20, marginBottom: 14,
    },
    headline: {
      fontFamily: Fonts.display,
      fontSize: 38, color: C.t1, lineHeight: 44, marginBottom: 14,
    },
    red:      { color: C.red },
    subtitle: {
      fontSize: 13, color: C.t2, lineHeight: 20,
    },
  });
}
