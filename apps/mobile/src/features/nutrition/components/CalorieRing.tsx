import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CalorieRingProps {
  consumed: number;
  goal: number;
  pct: number;
  size?: number;
}

const TRACK_COLOR = '#E8E4DF';

function arcColor(pct: number): string {
  if (pct >= 1)   return '#C25A00';
  if (pct >= 0.8) return '#F97316';
  return '#22C55E';
}

export function CalorieRing({ consumed, goal, pct, size = 100 }: CalorieRingProps) {
  const clampedPct = Math.min(pct, 1);
  const color      = arcColor(pct);
  const remaining  = Math.max(0, goal - consumed);
  const strokeW    = 7;
  const r          = (size - strokeW) / 2;
  const circ       = 2 * Math.PI * r;
  const cx         = size / 2;
  const cy         = size / 2;

  return (
    <View style={s.wrap}>
      <View style={[s.ringWrap, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} stroke={TRACK_COLOR} strokeWidth={strokeW} fill="none" />
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={color} strokeWidth={strokeW}
            strokeLinecap="round" fill="none"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - clampedPct)}
            transform={`rotate(-90, ${cx}, ${cy})`}
          />
        </Svg>
        <View style={s.center}>
          <Text style={[s.kcal, { color }]}>{consumed}</Text>
          <Text style={s.eaten}>kcal</Text>
        </View>
      </View>

      <View style={s.stats}>
        <View style={s.stat}>
          <Text style={s.statVal}>{goal}</Text>
          <Text style={s.statLabel}>goal</Text>
        </View>
        <View style={s.divider} />
        <View style={s.stat}>
          <Text style={[s.statVal, remaining === 0 && { color: '#22C55E' }]}>{remaining}</Text>
          <Text style={s.statLabel}>{pct >= 1 ? 'over!' : 'left'}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.stat}>
          <Text style={s.statVal}>{Math.round(pct * 100)}%</Text>
          <Text style={s.statLabel}>of goal</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringWrap:{ position: 'relative', alignItems: 'center', justifyContent: 'center' },
  center:  { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  kcal:    { fontFamily: 'Barlow_700Bold', fontSize: 18, lineHeight: 20 },
  eaten:   { fontFamily: 'Barlow_300Light', fontSize: 8, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1 },
  stats:   { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  stat:    { alignItems: 'center', gap: 2 },
  statVal: { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: '#0A0A0A' },
  statLabel:{ fontFamily: 'Barlow_300Light', fontSize: 9, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { width: 0.5, height: 28, backgroundColor: '#E8E4DF' },
});
