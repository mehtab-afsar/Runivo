import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@theme';

const C = Colors;

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <>
      <Text style={ss.header}>{title}</Text>
      <View style={ss.section}>{children}</View>
    </>
  );
}

const ss = StyleSheet.create({
  header: {
    fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t3,
    textTransform: 'uppercase', letterSpacing: 2,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  section: {
    marginHorizontal: 16, backgroundColor: C.white,
    borderRadius: 12, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden',
  },
});
