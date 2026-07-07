import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Diamond } from 'phosphor-react-native';
import { useTheme, Fonts } from '@theme';
import { FontSize } from '@theme';

interface PACEPillProps {
  amount: number;
  prefix?: '+' | '';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function PACEPill({ amount, prefix = '', size = 'md', style }: PACEPillProps) {
  const C = useTheme();
  const fontSize  = size === 'sm' ? FontSize.caption1 : FontSize.footnote;
  const iconSize  = fontSize - 2;
  const padH      = size === 'sm' ? 7 : 9;
  const padV      = size === 'sm' ? 3 : 4;

  return (
    <View style={[styles.pill, {
      backgroundColor:   C.accentMuted,
      paddingHorizontal: padH,
      paddingVertical:   padV,
    }, style]}>
      <Diamond size={iconSize} color={C.accent} weight="light" />
      <Text style={[styles.text, { color: C.accent, fontSize }]}>
        {prefix}{amount} PACE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontFamily: Fonts.semiBold, fontVariant: ['tabular-nums'] },
});
