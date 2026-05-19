import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useTheme } from '@theme';
import { FontSize } from '@theme';

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  const C = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: C.t3 }]}>{title.toUpperCase()}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.action, { color: C.red }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:  { fontWeight: '600', fontSize: FontSize.caption2, letterSpacing: 1.2 },
  action: { fontWeight: '500', fontSize: FontSize.footnote },
});
