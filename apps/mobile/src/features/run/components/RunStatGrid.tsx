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
            i % 2 === 0 && { borderRightWidth: 0.5, borderRightColor: C.mid },
            i < stats.length - 2 && { borderBottomWidth: 0.5, borderBottomColor: C.mid },
          ]}
        >
          <Text style={ss.value}>
            {value}
            {unit ? <Text style={ss.unit}> {unit}</Text> : null}
          </Text>
          <Text style={ss.label}>{label.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    grid:  { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.card, borderRadius: 4, overflow: 'hidden' },
    cell:  { width: '50%', paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
    value: { fontFamily: Fonts.light, fontSize: 24, letterSpacing: -0.5, color: C.black, lineHeight: 28, fontVariant: ['tabular-nums'] },
    unit:  { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    label: { fontFamily: Fonts.semiBold, fontSize: 10, letterSpacing: 0.8, color: C.t3, marginTop: 4 },
  });
}
