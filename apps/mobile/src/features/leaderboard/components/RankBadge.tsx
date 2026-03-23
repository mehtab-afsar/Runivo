import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MEDAL_COLORS = ['#C9920A', '#7A7A8A', '#9A5C30'];

interface Props { rank: number }

export function RankBadge({ rank }: Props) {
  if (rank <= 3) {
    return (
      <View style={[s.badge, { backgroundColor: MEDAL_COLORS[rank - 1] + '22' }]}>
        <Text style={[s.medal, { color: MEDAL_COLORS[rank - 1] }]}>
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
        </Text>
      </View>
    );
  }
  return (
    <View style={[s.badge, { backgroundColor: '#F0EDE8' }]}>
      <Text style={s.num}>#{rank}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  medal: { fontSize: 18 },
  num: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: '#6B6B6B' },
});
