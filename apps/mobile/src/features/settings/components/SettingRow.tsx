import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@theme';

const C = Colors;

interface SettingRowProps {
  label: string;
  sub?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, sub, children }: SettingRowProps) {
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

const ss = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: C.border },
  labelWrap: { flex: 1, paddingRight: 12 },
  rowLabel: { fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black },
  rowSub: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
});
