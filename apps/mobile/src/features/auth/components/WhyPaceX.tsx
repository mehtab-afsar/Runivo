import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@theme';
import { mkStep } from './onboardingStyles';

/** The lavender note under an onboarding question: what PaceX does with the answer. */
export default function WhyPaceX({ children }: { children: string }) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  return (
    <View style={s.why} accessibilityRole="text">
      <View style={s.whyOrb} />
      <Text style={s.whyText}><Text style={s.whyStrong}>Why PaceX asks: </Text>{children}</Text>
    </View>
  );
}
