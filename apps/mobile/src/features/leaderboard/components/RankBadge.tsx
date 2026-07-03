import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

interface Props { rank: number }

export function RankBadge({ rank }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const medalColors = [C.gold, C.silver, C.bronze];
  if (rank <= 3) {
    return (
      <View style={[s.badge, { backgroundColor: medalColors[rank - 1] + '22' }]}>
        <Text style={[s.medal, { color: medalColors[rank - 1] }]}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
        </Text>
      </View>
    );
  }
  return (
    <View style={[s.badge, { backgroundColor: C.surface }]}>
      <Text style={s.num}>#{rank}</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    badge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    medal: { fontSize: 18 },
    num: { fontWeight: '600', fontSize: 12, color: C.t2 },
  });
}
