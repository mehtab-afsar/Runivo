import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useTheme, Fonts } from '@theme';
import { FontSize, Spacing } from '@theme';

interface RunStatRowProps {
  distance: string;
  pace?: string;
  duration: string;
  elevation?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const VALUE_SIZE  = { sm: FontSize.subhead, md: FontSize.headline, lg: FontSize.title3 } as const;
const LABEL_SIZE  = { sm: 11, md: 12, lg: 13 } as const;

export function RunStatRow({ distance, pace, duration, elevation, size = 'md', style }: RunStatRowProps) {
  const C = useTheme();
  const valSize   = VALUE_SIZE[size];
  const lblSize   = LABEL_SIZE[size];

  const stats = [
    { label: 'Distance', value: distance },
    ...(pace      ? [{ label: 'Pace',      value: pace      }] : []),
    { label: 'Duration', value: duration },
    ...(elevation ? [{ label: 'Elevation', value: elevation }] : []),
  ];

  return (
    <View style={[styles.row, style]}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={[styles.statItem, i > 0 && styles.separator]}>
          <Text style={[styles.value, { fontSize: valSize, color: C.black }]}>{stat.value}</Text>
          <Text style={[styles.label, { fontSize: lblSize, color: C.t3 }]}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:       { flexDirection: 'row', gap: Spacing.lg },
  statItem:  { alignItems: 'flex-start' },
  separator: { paddingLeft: Spacing.lg },
  value:     { fontFamily: Fonts.semiBold, marginBottom: 2, fontVariant: ['tabular-nums'] },
  label:     { fontFamily: Fonts.medium },
});
