import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MacroBarsProps {
  proteinConsumed: number;
  proteinGoal: number;
  carbsConsumed: number;
  carbsGoal: number;
  fatConsumed: number;
  fatGoal: number;
}

const MACROS = [
  { key: 'protein', label: 'Protein', color: '#D93518' },
  { key: 'carbs',   label: 'Carbs',   color: '#9E6800' },
  { key: 'fat',     label: 'Fat',     color: '#1A6B40' },
] as const;

export function MacroBars({
  proteinConsumed, proteinGoal,
  carbsConsumed,   carbsGoal,
  fatConsumed,     fatGoal,
}: MacroBarsProps) {
  const data = [
    { consumed: proteinConsumed, goal: proteinGoal },
    { consumed: carbsConsumed,   goal: carbsGoal },
    { consumed: fatConsumed,     goal: fatGoal },
  ];

  return (
    <View style={s.row}>
      {MACROS.map((m, i) => {
        const ratio = Math.min(data[i].consumed / Math.max(data[i].goal, 1), 1);
        return (
          <View key={m.key} style={{ flex: 1 }}>
            <Text style={s.label}>{m.label}</Text>
            <View style={s.bar}>
              <View style={[s.fill, { flex: ratio, backgroundColor: m.color }]} />
              <View style={{ flex: Math.max(0, 1 - ratio) }} />
            </View>
            <Text style={s.value}>{Math.round(data[i].consumed)}g / {data[i].goal}g</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  label: {
    fontFamily: 'Barlow_300Light', fontSize: 9, color: '#ADADAD',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, textAlign: 'center',
  },
  bar: {
    height: 4, backgroundColor: '#E8E4DF', borderRadius: 2,
    overflow: 'hidden', flexDirection: 'row', marginBottom: 4,
  },
  fill: { height: 4 },
  value: { fontFamily: 'Barlow_300Light', fontSize: 9, color: '#6B6B6B', textAlign: 'center' },
});
