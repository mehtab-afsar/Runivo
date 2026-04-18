import React from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import type { ActivityType } from '../types';
import { Colors } from '@theme';

const C = Colors;
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';

const ACTIVITIES: { id: ActivityType; label: string; emoji: string; color: string; bg: string }[] = [
  { id: 'run',           label: 'Run',        emoji: '🏃', color: '#D93518', bg: '#FDE8E4' },
  { id: 'jog',           label: 'Jog',        emoji: '🏃', color: '#D93518', bg: '#FDE8E4' },
  { id: 'sprint',        label: 'Sprint',     emoji: '⚡', color: '#DC2626', bg: '#FEE2E2' },
  { id: 'walk',          label: 'Walk',       emoji: '🚶', color: '#059669', bg: '#D1FAE5' },
  { id: 'hike',          label: 'Hike',       emoji: '⛰️', color: '#B45309', bg: '#FEF3C7' },
  { id: 'trail_run',     label: 'Trail',      emoji: '🌲', color: '#15803D', bg: '#DCFCE7' },
  { id: 'cycle',         label: 'Cycle',      emoji: '🚴', color: '#0284C7', bg: '#E0F2FE' },
  { id: 'interval',      label: 'Intervals',  emoji: '🔁', color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'tempo',         label: 'Tempo',      emoji: '📈', color: '#EA580C', bg: '#FFEDD5' },
  { id: 'fartlek',       label: 'Fartlek',    emoji: '🔀', color: '#2563EB', bg: '#DBEAFE' },
  { id: 'race',          label: 'Race',       emoji: '🏁', color: '#E11D48', bg: '#FFE4E6' },
  { id: 'cross_country', label: 'XC',         emoji: '🌄', color: '#4338CA', bg: '#E0E7FF' },
  { id: 'stair_climb',   label: 'Stairs',     emoji: '🪜', color: '#9333EA', bg: '#F3E8FF' },
  { id: 'hiit',          label: 'HIIT',       emoji: '🔥', color: '#DC2626', bg: '#FEE2E2' },
  { id: 'strength',      label: 'Strength',   emoji: '💪', color: '#4B5563', bg: '#F3F4F6' },
  { id: 'swim',          label: 'Swim',       emoji: '🏊', color: '#0369A1', bg: '#E0F2FE' },
  { id: 'wheelchair',    label: 'Wheelchair', emoji: '♿', color: '#6D28D9', bg: '#EDE9FE' },
  { id: 'ski',           label: 'Ski',        emoji: '⛷️', color: '#0EA5E9', bg: '#E0F2FE' },
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
