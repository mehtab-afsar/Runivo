import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Colors } from '@theme';

const C = Colors;

interface CurrentPlanBadgeProps {
  tier: string;
}

export function CurrentPlanBadge({ tier }: CurrentPlanBadgeProps) {
  return (
    <View style={ss.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Check size={14} color={C.green} strokeWidth={2} />
        <Text style={[ss.title, { marginBottom: 0 }]}>You're on Runivo Plus</Text>
      </View>
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
