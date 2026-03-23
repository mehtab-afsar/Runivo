import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = { green: '#1A6B40', greenLo: '#EDF7F2' };

interface CurrentPlanBadgeProps {
  tier: string;
}

export function CurrentPlanBadge({ tier }: CurrentPlanBadgeProps) {
  return (
    <View style={ss.card}>
      <Text style={ss.title}>✓ You're on Runivo Plus</Text>
      <Text style={ss.sub}>Enjoy all premium features.</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  card: {
    backgroundColor: C.greenLo, borderRadius: 14, borderWidth: 0.5,
    borderColor: C.green + '44', padding: 20, alignItems: 'center', marginBottom: 8,
  },
  title: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: C.green, marginBottom: 4 },
  sub: { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.green },
});
