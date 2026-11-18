import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Plan } from '../types';
import { useTheme, Fonts, type AppColors } from '@theme';

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  displayPrice: string;
  onSelect: () => void;
}

export function PlanCard({ plan, isSelected, displayPrice, onSelect }: PlanCardProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  // No made-up per-month figure: the store's annual price speaks for itself.
  const perMonth = null as string | null;

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      style={[ss.card, isSelected && ss.cardSelected]}
    >
      <View style={ss.top}>
        <View style={[ss.radio, isSelected && ss.radioOn]}>{isSelected && <View style={ss.radioDot} />}</View>
        <Text style={ss.label}>{plan.label}</Text>
        {plan.trialDays > 0 && (
          <View style={ss.trial}><Text style={ss.trialText}>{plan.trialDays}-day free trial</Text></View>
        )}
      </View>
      <View style={ss.priceRow}>
        <Text style={ss.price}>{displayPrice}</Text>
        <Text style={ss.period}>{plan.period}</Text>
      </View>
      <Text style={ss.note}>{perMonth ?? (plan.id === 'annual' ? 'Billed yearly' : 'Billed monthly, no trial')}</Text>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      flex: 1, backgroundColor: C.card, borderRadius: 24, padding: 16,
      borderWidth: 2, borderColor: 'transparent',
    },
    cardSelected: { borderColor: C.t1, backgroundColor: C.card },
    top:       { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    radio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: C.t3, alignItems: 'center', justifyContent: 'center' },
    radioOn:   { borderColor: C.red },
    radioDot:  { width: 9, height: 9, borderRadius: 5, backgroundColor: C.red },
    label:     { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    trial:     { backgroundColor: C.redLo, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    trialText: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.red },
    priceRow:  { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12 },
    price:     { fontFamily: Fonts.numeric, fontSize: 32, lineHeight: 34, color: C.t1, fontVariant: ['tabular-nums'] },
    period:    { fontFamily: Fonts.medium, fontSize: 13, color: C.t2, marginLeft: 2, marginBottom: 4 },
    note:      { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 4 },
  });
}
