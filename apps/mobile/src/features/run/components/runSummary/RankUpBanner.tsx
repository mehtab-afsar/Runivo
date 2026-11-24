import React, { useMemo } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  rankName: string;
  scale: Animated.Value;
  opacity: Animated.Value;
}

/**
 * The rank-up sits right under the hero with the PACE earned, where the eye already is.
 * It used to be below the charts and splits, so its haptic fired for something unseen.
 */
export default function RankUpBanner({ rankName, scale, opacity }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <Animated.View style={[ss.rankUpBanner, { marginHorizontal: 18, marginTop: 12, marginBottom: 0 }, {
      transform: [{ scale }],
      opacity,
    }]} accessibilityRole="alert">
      <Text style={ss.rankUpText}>Rank up. You’re now a {rankName}</Text>
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    rankUpBanner: { backgroundColor: C.red, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
    rankUpText:   { fontFamily: Fonts.semiBold, fontSize: 13, color: C.white },
  });
}
