import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Type, Spacing, type AppColors } from '@theme';

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingSection({ title, children }: SettingSectionProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <>
      <Text style={ss.header}>{title}</Text>
      <View style={ss.section}>{children}</View>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header: {
      ...Type.overline, color: C.t3,
      paddingHorizontal: Spacing.gutter, paddingTop: 20, paddingBottom: 8,
    },
    section: {
      marginHorizontal: Spacing.gutter, backgroundColor: C.white,
      borderRadius: 12, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden',
    },
  });
}
