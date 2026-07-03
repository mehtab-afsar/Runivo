import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

interface SegmentedProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.seg}>
      {options.map(opt => (
        <Pressable key={opt} style={[ss.segBtn, value === opt && ss.segBtnActive]} onPress={() => onChange(opt)}>
          <Text style={[ss.segLabel, value === opt && ss.segLabelActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

interface PillCycleProps {
  value: string;
  onPress: () => void;
}

export function PillCycle({ value, onPress }: PillCycleProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <Pressable style={ss.pill} onPress={onPress}>
      <Text style={ss.pillText}>{value}</Text>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    seg: { flexDirection: 'row', backgroundColor: C.stone, borderRadius: 6, padding: 2, gap: 2 },
    segBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: 'transparent' },
    segBtnActive: { backgroundColor: C.alwaysDark },
    segLabel: { fontSize: 11, color: C.t3 },
    segLabelActive: { color: C.white },
    pill: { backgroundColor: C.stone, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
    pillText: { fontSize: 12, color: C.black },
  });
}
