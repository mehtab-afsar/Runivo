import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = {
  black: '#0A0A0A',
  white: '#FFFFFF',
  red:   '#E8391C',
};

const FONT_LIGHT = 'Barlow_300Light';
const FONT_SEMI  = 'Barlow_600SemiBold';

interface RunHUDProps {
  distance: number;
  pace: string;
  elapsed: number;
  energy: number;
  claimProgress: number;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RunHUD({ distance, pace, elapsed, energy, claimProgress }: RunHUDProps) {
  return (
    <View style={ss.container}>
      <View style={ss.distanceBlock}>
        <Text style={ss.distanceValue}>{distance.toFixed(2)}</Text>
        <Text style={ss.distanceUnit}>km</Text>
      </View>
      <View style={ss.secondaryStats}>
        <View style={ss.secondaryStat}>
          <Text style={ss.secondaryValue}>{formatElapsed(elapsed)}</Text>
          <Text style={ss.secondaryLabel}>TIME</Text>
        </View>
        <View style={[ss.secondaryStat, ss.secondaryStatMid]}>
          <Text style={ss.secondaryValue}>{pace}</Text>
          <Text style={ss.secondaryLabel}>PACE /KM</Text>
        </View>
        <View style={ss.secondaryStat}>
          <Text style={[ss.secondaryValue, { color: C.red }]}>{energy}</Text>
          <Text style={ss.secondaryLabel}>ENERGY</Text>
        </View>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  container:        { backgroundColor: C.black, paddingTop: 24, paddingBottom: 16, paddingHorizontal: 24 },
  distanceBlock:    { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 16 },
  distanceValue:    { fontFamily: FONT_LIGHT, fontSize: 72, color: C.white, letterSpacing: -2, lineHeight: 76 },
  distanceUnit:     { fontFamily: FONT_LIGHT, fontSize: 22, color: 'rgba(255,255,255,0.4)' },
  secondaryStats:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 14 },
  secondaryStat:    { flex: 1, alignItems: 'center' },
  secondaryStatMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  secondaryValue:   { fontFamily: FONT_LIGHT, fontSize: 20, color: C.white, letterSpacing: -0.5 },
  secondaryLabel:   { fontFamily: FONT_SEMI, fontSize: 8, letterSpacing: 1, color: 'rgba(255,255,255,0.35)', marginTop: 3 },
});
