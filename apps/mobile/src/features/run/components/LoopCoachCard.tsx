/**
 * First run only (PRD O5): shows the territory rule as a picture. A route
 * leaves a start point and comes back to it; the ground inside fills in.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Fonts, type AppColors } from '@theme';

const KEY = 'runivo.coach.loopSeen';
const LOOP = 'M14 46 C 8 24, 30 6, 52 10 S 90 30, 80 50 S 40 70, 14 46 Z';

/** Visible on the first claiming run until 300 m or a tap; never again after. */
export function useLoopCoach(active: boolean, distanceKm: number): { show: boolean; dismiss: () => void } {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => { AsyncStorage.getItem(KEY).then(v => setSeen(v === '1')).catch(() => setSeen(true)); }, []);
  const dismiss = () => { setSeen(true); AsyncStorage.setItem(KEY, '1').catch(() => {}); };
  useEffect(() => { if (active && seen === false && distanceKm >= 0.3) dismiss(); }, [active, seen, distanceKm]);  
  return { show: active && seen === false, dismiss };
}

export default function LoopCoachCard({ onDismiss }: { onDismiss: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  return (
    <Pressable style={s.card} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="How claiming works. Tap to hide.">
      <Svg width={94} height={64} viewBox="0 0 94 64">
        <Path d={LOOP} fill={C.red} opacity={0.18} />
        <Path d={LOOP} stroke={C.red} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="0" />
        <Circle cx={14} cy={46} r={5} fill={C.t1} />
      </Svg>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Close a loop to claim it</Text>
        <Text style={s.body}>Run out and come back near where you started. Everything inside your loop becomes your zone.</Text>
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, padding: 12, marginBottom: 12 },
    title: { fontFamily: Fonts.semiBold, fontSize: 14.5, color: C.t1 },
    body:  { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 2, lineHeight: 17 },
  });
}
