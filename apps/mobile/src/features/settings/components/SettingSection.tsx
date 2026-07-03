import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

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
      fontSize: 10, color: C.t3,
      textTransform: 'uppercase', letterSpacing: 2,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    },
    section: {
      marginHorizontal: 16, backgroundColor: C.white,
      borderRadius: 12, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden',
    },
  });
}
