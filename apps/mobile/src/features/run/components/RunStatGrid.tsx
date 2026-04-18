import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@theme';

const C = Colors;
const FONT_LIGHT = 'Barlow_300Light';
const FONT_SEMI  = 'Barlow_600SemiBold';
const FONT       = 'Barlow_400Regular';

interface StatItem {
  label: string;
  value: string;
  unit?: string;
}

interface RunStatGridProps {
  stats: StatItem[];
}

export default function RunStatGrid({ stats }: RunStatGridProps) {
  return (
    <View style={ss.grid}>
      {stats.map(({ label, value, unit }, i) => (
        <View
          key={label}
          style={[
            ss.cell,
            i % 2 === 0 && { borderRightWidth: 1, borderRightColor: C.mid },
            i < stats.length - 2 && { borderBottomWidth: 1, borderBottomColor: C.mid },
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

const ss = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.white, borderRadius: 4, overflow: 'hidden' },
  cell:  { width: '50%', paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  value: { fontFamily: FONT_LIGHT, fontSize: 24, letterSpacing: -0.5, color: C.black, lineHeight: 28 },
  unit:  { fontFamily: FONT, fontSize: 11, color: C.t3 },
  label: { fontFamily: FONT_SEMI, fontSize: 9, letterSpacing: 0.8, color: C.t3, marginTop: 4 },
});
