import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';

interface MacroBarsProps {
  proteinConsumed: number;
  proteinGoal: number;
  carbsConsumed: number;
  carbsGoal: number;
  fatConsumed: number;
  fatGoal: number;
}

function mkMacros(C: AppColors) {
  return [
    { key: 'protein', label: 'Protein', color: C.blue },
    { key: 'carbs',   label: 'Carbs',   color: C.amber },
    { key: 'fat',     label: 'Fat',     color: C.green },
  ] as const;
}

export function MacroBars({
  proteinConsumed, proteinGoal,
  carbsConsumed,   carbsGoal,
  fatConsumed,     fatGoal,
}: MacroBarsProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const MACROS = useMemo(() => mkMacros(C), [C]);
  const data = [
    { consumed: proteinConsumed, goal: proteinGoal },
    { consumed: carbsConsumed,   goal: carbsGoal },
    { consumed: fatConsumed,     goal: fatGoal },
  ];

  return (
    <View style={s.row}>
      {MACROS.map((m, i) => {
        const ratio = Math.min(data[i].consumed / Math.max(data[i].goal, 1), 1);
        const over  = data[i].consumed > data[i].goal;
        return (
          <View key={m.key} style={{ flex: 1 }}>
            <Text style={s.label}>{m.label}</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${ratio * 100}%` as `${number}%`, backgroundColor: over ? C.orange : m.color }]} />
            </View>
            <Text style={s.value}>{Math.round(data[i].consumed)}<Text style={s.goal}>/{data[i].goal}g</Text></Text>
          </View>
        );
      })}
    </View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  row:   { flexDirection: 'row', gap: 12 },
  label: { ...Type.overline, color: C.t3, marginBottom: 5, textAlign: 'center' },
  track: { height: 5, backgroundColor: C.mid, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  fill:  { height: '100%', borderRadius: 3 },
  value: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.t1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  goal:  { fontFamily: Fonts.regular, fontSize: 10, color: C.t3 },
}); }
