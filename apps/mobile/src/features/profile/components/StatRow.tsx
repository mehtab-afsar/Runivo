import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Type, type AppColors } from '@theme';

interface StatRowProps {
  label: string;
  value: string;
}

export function StatRow({ label, value }: StatRowProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.card}>
      <Text style={ss.value}>{value}</Text>
      <Text style={ss.label}>{label}</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      width: '47%',
      backgroundColor: C.white,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: C.border,
      padding: 12,
      alignItems: 'center',
    },
    value: { ...Type.metricMd, color: C.black, letterSpacing: -1 },
    label: { ...Type.overline, color: C.t3, marginTop: 4 },
  });
}
