import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@theme';

const C = Colors;
const FONT       = 'Barlow_400Regular';
const FONT_MED   = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';
const FONT_SEMI  = 'Barlow_600SemiBold';

export interface Split { km: number; pace: number }

interface SplitsListProps {
  splits: Split[];
}

function formatPace(paceMinPerKm: number): string {
  const m = Math.floor(paceMinPerKm);
  const s = Math.floor((paceMinPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SplitsList({ splits }: SplitsListProps) {
  if (splits.length === 0) return null;

  const avg = splits.reduce((s, x) => s + x.pace, 0) / splits.length;
  const max = Math.max(...splits.map(s => s.pace));
  const min = Math.min(...splits.map(s => s.pace));
  const paceRange = max - min || 1;

  const barColor = (pace: number) => {
    if (pace <= avg - 0.2) return C.green;
    if (pace >= avg + 0.2) return C.red;
    return C.amber;
  };

  return (
    <View style={ss.container}>
      <View style={ss.header}>
        {['KM', 'PACE BAR', 'PACE'].map(h => (
          <Text key={h} style={[ss.headerCell, h === 'PACE BAR' && { flex: 1 }]}>{h}</Text>
        ))}
      </View>
      {splits.map((s, i) => {
        const color = barColor(s.pace);
        const barWidth = 20 + ((s.pace - min) / paceRange) * 80;
        return (
          <View key={i} style={[ss.row, i < splits.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.mid }]}>
            <Text style={ss.km}>{s.km}</Text>
            <View style={ss.barContainer}>
              <View style={[ss.bar, { width: `${barWidth}%`, backgroundColor: color }]} />
            </View>
            <Text style={[ss.pace, { color }]}>{formatPace(s.pace)}<Text style={ss.paceUnit}>/km</Text></Text>
          </View>
        );
      })}
    </View>
  );
}

const ss = StyleSheet.create({
  container:   { backgroundColor: C.white, borderRadius: 4, overflow: 'hidden' },
  header:      { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.mid },
  headerCell:  { fontFamily: FONT_SEMI, fontSize: 9, letterSpacing: 1, color: C.t3, width: 32 },
  row:         { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center' },
  km:          { fontFamily: FONT_MED, fontSize: 12, color: C.t2, width: 32 },
  barContainer:{ flex: 1, height: 6, backgroundColor: C.mid, borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 },
  bar:         { height: '100%', borderRadius: 3 },
  pace:        { fontFamily: FONT_LIGHT, fontSize: 13, width: 56, textAlign: 'right' },
  paceUnit:    { fontFamily: FONT, fontSize: 10, color: C.t3 },
});
