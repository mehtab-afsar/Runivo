import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  weeklyKm: number;
  goalKm:   number;
  runDays:  boolean[];
}

const R    = 68;
const CIRC = 2 * Math.PI * R;

export function WeeklyRing({ weeklyKm, goalKm, runDays }: Props) {
  const pct      = Math.min(weeklyKm / Math.max(goalKm, 1), 1);
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <View style={ss.content}>
      <View style={ss.ringWrap}>
        <Svg width={148} height={148}>
          {/* Track */}
          <Circle cx={74} cy={74} r={R} stroke="rgba(255,255,255,0.06)" strokeWidth={5} fill="none" />
          {/* Soft glow bloom behind the arc */}
          {pct > 0 && (
            <Circle
              cx={74} cy={74} r={R}
              stroke="#D93518" strokeWidth={16} strokeOpacity={0.13}
              strokeLinecap="round" fill="none"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct)}
              transform="rotate(-90, 74, 74)"
            />
          )}
          {/* Main arc */}
          <Circle
            cx={74} cy={74} r={R} stroke="#D93518" strokeWidth={5}
            strokeLinecap="round" fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct)}
            transform="rotate(-90, 74, 74)"
          />
        </Svg>
        <View style={ss.center}>
          <View style={ss.kmRow}>
            <Text style={ss.km}>{weeklyKm.toFixed(1)}</Text>
            <Text style={ss.kmUnit}>km</Text>
          </View>
          <Text style={ss.kmGoal}>of {goalKm}</Text>
        </View>
      </View>

      <View style={ss.dayDots}>
        {runDays.map((active, i) => (
          <View
            key={i}
            style={[
              ss.dot,
              i === todayIdx && active  ? { backgroundColor: '#D93518', height: 5 }
              : i === todayIdx          ? { backgroundColor: 'rgba(217,53,24,0.35)', height: 5 }
              : active                  ? { backgroundColor: '#FFFFFF', opacity: 0.7 }
              :                           { backgroundColor: 'rgba(255,255,255,0.1)' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  content:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  ringWrap: { position: 'relative', width: 148, height: 148, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  center:   { position: 'absolute', alignItems: 'center' },
  kmRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  km:       { fontFamily: 'Barlow_300Light', fontSize: 38, color: '#fff', letterSpacing: -1.5, lineHeight: 40 },
  kmUnit:   { fontFamily: 'Barlow_300Light', fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  kmGoal:   { fontFamily: 'Barlow_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3 },
  dayDots:  { flexDirection: 'row', gap: 4, paddingHorizontal: 18 },
  dot:      { flex: 1, height: 3, borderRadius: 2 },
});
