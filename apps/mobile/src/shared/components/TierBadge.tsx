import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TIER_CONFIG } from '@shared/constants/territory';
import type { TerritoryTier } from '@shared/types/game';


interface TierBadgeProps {
  tier: TerritoryTier;
  size?: 'xs' | 'sm' | 'md';
}

const SIZE = {
  xs: { fontSize: 9,  paddingH: 5,  paddingV: 2, radius: 4 },
  sm: { fontSize: 10, paddingH: 7,  paddingV: 3, radius: 5 },
  md: { fontSize: 11, paddingH: 10, paddingV: 4, radius: 6 },
} as const;

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  const s = SIZE[size];
  return (
    <View style={[styles.badge, {
      backgroundColor:  config.bg,
      paddingHorizontal: s.paddingH,
      paddingVertical:   s.paddingV,
      borderRadius:      s.radius,
    }]}>
      <Text style={[styles.label, { color: config.fg, fontSize: s.fontSize }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start' },
  label: { fontWeight: '600', letterSpacing: 0.4 },
});
