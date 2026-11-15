import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

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
      fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1,
      paddingHorizontal: Spacing.gutter + 4, paddingTop: 24, paddingBottom: 10,
    },
    section: {
      marginHorizontal: Spacing.gutter, backgroundColor: C.card,
      borderRadius: 22, overflow: 'hidden',
    },
  });
}
