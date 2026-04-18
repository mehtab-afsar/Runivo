import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';

interface CurrentPlanBadgeProps {
  tier: string;
}

export function CurrentPlanBadge({ tier }: CurrentPlanBadgeProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
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

function mkStyles(C: AppColors) { return StyleSheet.create({
  card: {
    backgroundColor: C.greenLo, borderRadius: 14, borderWidth: 0.5,
    borderColor: C.green + '44', padding: 20, alignItems: 'center', marginBottom: 8,
  },
  title: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: C.green, marginBottom: 4 },
  sub: { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.green },
}); }
