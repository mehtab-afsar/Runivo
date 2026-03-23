import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Difficulty = 'easy' | 'medium' | 'hard';

const DIFF_COLORS: Record<Difficulty, { bg: string; fg: string }> = {
  easy:   { bg: '#EDF7F2', fg: '#1A6B40' },
  medium: { bg: '#FDF6E8', fg: '#9E6800' },
  hard:   { bg: '#FEF0EE', fg: '#D93518' },
};

interface DifficultyBadgeProps {
  difficulty: Difficulty;
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const colors = DIFF_COLORS[difficulty] ?? DIFF_COLORS.medium;
  return (
    <View style={[ss.badge, { backgroundColor: colors.bg }]}>
      <Text style={[ss.text, { color: colors.fg }]}>{difficulty}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontFamily: 'Barlow_400Regular', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
});
