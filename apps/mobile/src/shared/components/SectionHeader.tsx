import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useTheme, Type } from '@theme';

interface SectionHeaderProps {
  title: string;
  /** Small leading glyph (e.g. an 11px phosphor icon) rendered before the title. */
  icon?: React.ReactNode;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

/**
 * The app-wide section eyebrow: tracked-uppercase overline + optional trailing action.
 * Use this instead of hand-rolling `fontSize: 11, letterSpacing: 1` rows per screen.
 */
export function SectionHeader({ title, icon, action, style }: SectionHeaderProps) {
  const C = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleRow}>
        {icon}
        <Text style={[Type.overline, { color: C.t3 }]}>{title}</Text>
      </View>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          {({ pressed }) => (
            <Text style={[Type.labelSm, { color: C.t2, opacity: pressed ? 0.6 : 1 }]}>
              {action.label}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
