import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = { black: '#0A0A0A', t3: '#ADADAD', border: '#DDD9D4', white: '#FFFFFF' };

interface StatRowProps {
  label: string;
  value: string;
}

export function StatRow({ label, value }: StatRowProps) {
  return (
    <View style={ss.card}>
      <Text style={ss.value}>{value}</Text>
      <Text style={ss.label}>{label}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: C.border,
    padding: 12,
    alignItems: 'center',
  },
  value: { fontFamily: 'Barlow_300Light', fontSize: 28, color: C.black, letterSpacing: -1 },
  label: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 },
});
