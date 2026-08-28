import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SealCheck } from 'phosphor-react-native';
import type { Plan } from '../types';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  displayPrice: string;
  onSelect: () => void;
}

// Both plans get the identical selected treatment now — previously only
// Annual got the dark+gold-glow card when picked, so choosing Monthly looked
// like settling for the plain, unselected version of itself.
export function PlanCard({ plan, isSelected, displayPrice, onSelect }: PlanCardProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const isAnnual = plan.id === 'annual';

  const inner = (
    <>
      {plan.badge && (
        <View style={[ss.planBadge, isSelected && ss.planBadgeSelected]}>
          <Text style={[ss.planBadgeText, isSelected && ss.planBadgeTextSelected]}>{plan.badge}</Text>
        </View>
      )}
      {isSelected && (
        <View style={ss.checkWrap}>
          <SealCheck size={18} color={C.gold} weight="fill" />
        </View>
      )}
      <Text style={[ss.planLabel, isSelected && ss.planLabelActive]}>{plan.label}</Text>
      <Text style={[ss.planPrice, isSelected && ss.planPriceActive]}>{displayPrice}</Text>
      <Text style={[ss.planPeriod, isSelected && ss.planPeriodActive]}>
        {isAnnual ? 'per month, billed yearly' : plan.period}
      </Text>
    </>
  );

  if (isSelected) {
    return (
      <Pressable onPress={onSelect} style={ss.planBtnOuter}>
        <LinearGradient
          colors={['#2A2410', C.alwaysDark]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={[ss.planBtn, ss.planBtnGlow]}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable style={ss.planBtn} onPress={onSelect}>
      {inner}
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    planBtnOuter: { flex: 1 },
    planBtn: {
      flex: 1, backgroundColor: C.card, borderRadius: Spacing.radius.lg,
      borderWidth: 1, borderColor: C.border, padding: 16, alignItems: 'center',
      position: 'relative', minHeight: 116, justifyContent: 'center',
    },
    planBtnGlow: {
      shadowColor: C.gold, shadowOpacity: 0.25, shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    checkWrap: { position: 'absolute', top: 10, right: 10 },
    planBadge: { position: 'absolute', top: -9, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    planBadgeSelected: { backgroundColor: C.gold, borderColor: C.gold },
    planBadgeText: { fontFamily: Fonts.bold, fontSize: 9.5, color: C.t2, letterSpacing: 0.5 },
    planBadgeTextSelected: { color: C.alwaysDark },
    planLabel: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginBottom: 6, marginTop: 8 },
    planLabelActive: { color: 'rgba(255,255,255,0.6)' },
    planPrice: { fontFamily: Fonts.bold, fontSize: 24, color: C.t1, letterSpacing: -0.5 },
    planPriceActive: { color: C.alwaysLight },
    planPeriod: { fontFamily: Fonts.regular, fontSize: 10.5, color: C.t3, marginTop: 2, textAlign: 'center' },
    planPeriodActive: { color: 'rgba(255,255,255,0.45)' },
  });
}
