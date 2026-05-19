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
  { key: 'protein', label: 'Protein', color: '#1D6FB8' },
  { key: 'carbs',   label: 'Carbs',   color: '#F59E0B' },
  { key: 'fat',     label: 'Fat',     color: '#22C55E' },
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
        const over  = data[i].consumed > data[i].goal;
        return (
          <View key={m.key} style={{ flex: 1 }}>
            <Text style={s.label}>{m.label}</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${ratio * 100}%` as `${number}%`, backgroundColor: over ? '#F97316' : m.color }]} />
            </View>
            <Text style={s.value}>{Math.round(data[i].consumed)}<Text style={s.goal}>/{data[i].goal}g</Text></Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 12 },
  label: { fontSize: 9, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5, textAlign: 'center' },
  track: { height: 5, backgroundColor: '#E8E4DF', borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  fill:  { height: '100%', borderRadius: 3 },
  value: { fontWeight: '600', fontSize: 11, color: '#0A0A0A', textAlign: 'center' },
  goal:  { fontSize: 10, color: '#ADADAD' },
});
