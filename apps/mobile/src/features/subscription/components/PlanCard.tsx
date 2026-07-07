import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Plan } from '../types';
import { Colors, Fonts } from '@theme';

const C = Colors;

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  displayPrice: string;
  onSelect: () => void;
}

export function PlanCard({ plan, isSelected, displayPrice, onSelect }: PlanCardProps) {
  return (
    <Pressable style={[ss.planBtn, isSelected && ss.planBtnActive]} onPress={onSelect}>
      {plan.badge && (
        <View style={ss.planBadge}>
          <Text style={ss.planBadgeText}>{plan.badge}</Text>
        </View>
      )}
      <Text style={[ss.planLabel, isSelected && ss.planLabelActive]}>{plan.label}</Text>
      <Text style={[ss.planPrice, isSelected && ss.planPriceActive]}>{displayPrice}</Text>
      <Text style={[ss.planPeriod, isSelected && ss.planPeriodActive]}>{plan.period}</Text>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  planBtn: { flex: 1, backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16, alignItems: 'center', position: 'relative' },
  planBtnActive: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
  planBadge: { position: 'absolute', top: -8, backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  planBadgeText: { fontFamily: Fonts.bold, fontSize: 10, color: C.alwaysLight, letterSpacing: 0.5 },
  planLabel: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2, marginBottom: 6, marginTop: 6 },
  planLabelActive: { color: '#ffffff99' },
  planPrice: { fontFamily: Fonts.bold, fontSize: 22, color: C.black },
  planPriceActive: { color: C.alwaysLight },
  planPeriod: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
  planPeriodActive: { color: '#ffffff66' },
});
