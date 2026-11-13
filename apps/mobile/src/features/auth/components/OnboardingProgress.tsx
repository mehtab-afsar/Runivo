import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
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
    <View>
      <View style={s.header}>
        {index > 0 ? (
          <Pressable onPress={onBack} hitSlop={8} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={16} color={C.t1} strokeWidth={1.8} />
          </Pressable>
        ) : <View style={s.spacer} />}
        <Text style={s.step} accessibilityRole="text">
          <Text style={s.stepStrong}>{label}</Text>{`  ·  ${index + 1} of ${total}`}
        </Text>
        <View style={s.spacer} />
      </View>
      <View style={s.bars} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: index + 1 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[s.bar, i <= index && s.barOn]} />
        ))}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 8 },
    back:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    spacer:     { width: 40, height: 40 },
    step:       { fontFamily: Fonts.medium, fontSize: 13, color: C.t3 },
    stepStrong: { fontFamily: Fonts.semiBold, color: C.t1 },
    bars:       { flexDirection: 'row', gap: 4, paddingHorizontal: 18, paddingBottom: 12 },
    bar:        { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.border },
    barOn:      { backgroundColor: C.red },
  });
}
