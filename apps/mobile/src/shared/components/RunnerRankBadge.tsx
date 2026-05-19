import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RANK_COLORS } from '@shared/constants/territory';
import type { RunnerRank } from '@shared/types/game';


interface RunnerRankBadgeProps {
  rank: RunnerRank;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const RANK_LABELS: Record<RunnerRank, string> = {
  pacer:    'Pacer',
  strider:  'Strider',
  chaser:   'Chaser',
  hunter:   'Hunter',
  sovereign:'Sovereign',
};

const SIZE = {
  xs: { fontSize: 9,  paddingH: 6,  paddingV: 2, radius: 4 },
  sm: { fontSize: 10, paddingH: 8,  paddingV: 3, radius: 5 },
  md: { fontSize: 11, paddingH: 10, paddingV: 4, radius: 6 },
  lg: { fontSize: 12, paddingH: 12, paddingV: 5, radius: 7 },
} as const;

export function RunnerRankBadge({ rank, size = 'sm', showLabel = true }: RunnerRankBadgeProps) {
  const colors = RANK_COLORS[rank];
  const s = SIZE[size];
  return (
    <View style={[styles.badge, {
      backgroundColor:   colors.bg,
      paddingHorizontal: s.paddingH,
      paddingVertical:   s.paddingV,
      borderRadius:      s.radius,
    }]}>
      {showLabel && (
        <Text style={[styles.label, { color: colors.fg, fontSize: s.fontSize }]}>
          {RANK_LABELS[rank]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start' },
  label: { fontWeight: '600', letterSpacing: 0.4 },
});
