import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  weeklyKm: number;
  goalKm:   number;
  runDays:  boolean[];
}

const CIRC = 263.9;

export function WeeklyRing({ weeklyKm, goalKm, runDays }: Props) {
  const pct      = Math.min(weeklyKm / Math.max(goalKm, 1), 1);
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <View style={ss.content}>
      <Text style={ss.label}>WEEKLY GOAL</Text>

      <View style={ss.ringWrap}>
        <Svg width={100} height={100}>
          <Circle cx={50} cy={50} r={42} stroke="rgba(255,255,255,0.12)" strokeWidth={5} fill="none" />
          <Circle
            cx={50} cy={50} r={42} stroke="#D93518" strokeWidth={5}
            strokeLinecap="round" fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct)}
            transform="rotate(-90, 50, 50)"
          />
        </Svg>
        <View style={ss.ringCenter}>
          <Text style={ss.km}>{weeklyKm.toFixed(1)}</Text>
          <Text style={ss.kmLabel}>KM</Text>
        </View>
      </View>

      <Text style={ss.pct}>{Math.round(pct * 100)}% of {goalKm} km</Text>

      <View style={ss.dayDots}>
        {runDays.map((active, i) => (
          <View
            key={i}
            style={[
              ss.dot,
              i === todayIdx
                ? { backgroundColor: '#D93518' }
                : active
                  ? { backgroundColor: 'rgba(255,255,255,0.65)' }
                  : { backgroundColor: 'rgba(255,255,255,0.12)' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  content:  { flex: 1, padding: 18, alignItems: 'center' },
  label:    { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1, color: '#fff', alignSelf: 'flex-start', marginBottom: 12 },
  ringWrap: { position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  km:       { fontFamily: 'Barlow_300Light', fontSize: 20, color: '#fff', letterSpacing: -0.6, lineHeight: 22 },
  kmLabel:  { fontFamily: 'Barlow_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.6, marginTop: 2 },
  pct:      { fontFamily: 'Barlow_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 10, marginBottom: 8 },
  dayDots:  { flexDirection: 'row', gap: 3, width: '100%' },
  dot:      { flex: 1, height: 3, borderRadius: 2 },
});
