import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface GoalOptionProps {
  goal: string;
  label: string;
  description?: string;
  emoji?: string;
  iconNode?: React.ReactNode;
  selected: boolean;
  onSelect: (goal: string) => void;
}

export function GoalOption({ goal, label, emoji, iconNode, selected, onSelect }: GoalOptionProps) {
  return (
    <Pressable
      style={[s.btn, selected && s.btnActive]}
      onPress={() => onSelect(goal)}
    >
      {iconNode ?? (emoji ? <Text style={{ fontSize: 18 }}>{emoji}</Text> : null)}
      <Text style={[s.label, selected && s.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#DDD9D4',
    alignItems: 'center', gap: 4,
  },
  btnActive: { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  label: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#6B6B6B' },
  labelActive: { color: '#fff', fontFamily: 'Barlow_500Medium' },
});
