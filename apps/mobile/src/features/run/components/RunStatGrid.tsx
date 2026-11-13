import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface StatItem {
  label: string;
  value: string;
  unit?: string;
}

interface RunStatGridProps {
  stats: StatItem[];
}

export default function RunStatGrid({ stats }: RunStatGridProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.grid}>
      {stats.map(({ label, value, unit }, i) => (
        <View
          key={label}
          style={[
            ss.cell,
            i % 2 === 0 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.border },
            i < stats.length - 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
          ]}
        >
          <Text style={ss.value}>
            {value}
            {unit ? <Text style={ss.unit}> {unit}</Text> : null}
          </Text>
          <Text style={ss.label}>{label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()}</Text>
        </View>
      ))}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    grid:  { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
    cell:  { width: '50%', paddingVertical: 14, paddingHorizontal: 16 },
    value: { fontFamily: Fonts.numeric, fontSize: 30, color: C.t1, lineHeight: 32, fontVariant: ['tabular-nums'] },
    unit:  { fontFamily: Fonts.medium, fontSize: 13, color: C.t3 },
    label: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 4 },
  });
}
