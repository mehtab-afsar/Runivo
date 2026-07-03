import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

interface SettingRowProps {
  label: string;
  sub?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, sub, children }: SettingRowProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.row}>
      <View style={ss.labelWrap}>
        <Text style={ss.rowLabel}>{label}</Text>
        {sub ? <Text style={ss.rowSub}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: C.border },
    labelWrap: { flex: 1, paddingRight: 12 },
    rowLabel: { fontSize: 14, color: C.black },
    rowSub: { fontSize: 11, color: C.t3, marginTop: 2 },
  });
}
