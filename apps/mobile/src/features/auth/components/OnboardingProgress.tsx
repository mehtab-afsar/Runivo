import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ArrowLeft } from '@mobile/shared/icons/lucideCompat';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  index: number;
  total: number;
  label: string;
  onBack: () => void;
}

/** Back, "Your running · 3 of 9", and a segmented bar. Skipping lives in the footer. */
export default function OnboardingProgress({ index, total, label, onBack }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={s.header} accessibilityLabel={`${label}, step ${index + 1} of ${total}`}>
      {index > 0 ? (
        <Pressable onPress={onBack} hitSlop={8} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={18} color={C.t1} strokeWidth={2} />
        </Pressable>
      ) : <View style={s.back} />}
      <View style={s.bars} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: index + 1 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[s.bar, i <= index && s.barOn]} />
        ))}
      </View>
      <Text style={s.step}>{index + 1}/{total}</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 8 },
    back:   { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    bars:   { flex: 1, flexDirection: 'row', gap: 4 },
    bar:    { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#DDE0D8' },
    barOn:  { backgroundColor: C.brandGreen },
    step:   { minWidth: 34, textAlign: 'right', fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
  });
}
