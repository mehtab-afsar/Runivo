import React from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import type { ActivityType } from '../types';

const C = { white: '#FFFFFF', border: '#E0DFDD', black: '#0A0A0A', muted: '#6B6B6B' };
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';

const ACTIVITIES: { id: ActivityType; label: string; emoji: string; color: string; bg: string }[] = [
  { id: 'run',      label: 'Run',       emoji: '🏃', color: '#E8391C', bg: '#FDE8E4' },
  { id: 'walk',     label: 'Walk',      emoji: '🚶', color: '#059669', bg: '#D1FAE5' },
  { id: 'cycle',    label: 'Cycle',     emoji: '🚴', color: '#0284C7', bg: '#E0F2FE' },
  { id: 'hike',     label: 'Hike',      emoji: '⛰️', color: '#B45309', bg: '#FEF3C7' },
  { id: 'trail',    label: 'Trail',     emoji: '🌲', color: '#15803D', bg: '#DCFCE7' },
  { id: 'interval', label: 'Intervals', emoji: '🔁', color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'long_run', label: 'Long Run',  emoji: '📈', color: '#EA580C', bg: '#FFEDD5' },
];

interface ActivitySelectorProps {
  selected: ActivityType;
  onSelect: (activity: ActivityType) => void;
}

export default function ActivitySelector({ selected, onSelect }: ActivitySelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.row}>
      {ACTIVITIES.map(a => {
        const isSelected = a.id === selected;
        return (
          <Pressable
            key={a.id}
            style={[ss.chip, isSelected && { backgroundColor: a.bg, borderColor: a.color }]}
            onPress={() => onSelect(a.id)}
          >
            <Text style={ss.emoji}>{a.emoji}</Text>
            <Text style={[ss.label, isSelected && { color: a.color, fontFamily: FONT_MED }]}>
              {a.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const ss = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip:  {
    alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: C.white,
    borderWidth: 0.5, borderColor: C.border,
  },
  emoji: { fontSize: 18 },
  label: { fontFamily: FONT, fontSize: 11, color: C.muted },
});
