import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, Fonts, Type, type AppColors } from '@theme';
import { Lock, Crown, Check } from 'lucide-react-native';
import type { Reward } from '../types';
import { lockStateFor } from '../lockState';

interface Props {
  reward: Reward;
  onPress: (r: Reward) => void;
}

/**
 * The store's featured reward: a big band in the partner's colour with the
 * offer, then one line of detail and the price pill. Locked rewards say why
 * instead of the detail line; redeemed ones show a green pill.
 */
export function RewardCard({ reward, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  const lock = lockStateFor(reward);
  const LockIcon = lock.kind === 'plus' ? Crown : Lock;

  return (
    <Pressable
      onPress={() => onPress(reward)}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${reward.brand}: ${reward.title}, ${reward.paceCost} PACE${lock.label ? `, ${lock.label}` : ''}`}
    >
      <View style={[s.band, { backgroundColor: reward.brandColor }, lock.blocked && s.bandMuted]}>
        <Text style={s.brandName} numberOfLines={1}>{reward.brand} · Featured</Text>
        <Text style={s.valueLabel} numberOfLines={1} adjustsFontSizeToFit>{reward.valueLabel}</Text>
      </View>

      <View style={s.footer}>
        {lock.blocked ? (
          <View style={s.lockRow}>
            <LockIcon size={13} color={lock.kind === 'plus' ? C.gold : C.t2} strokeWidth={2.2} />
            <Text style={[s.footerText, lock.kind === 'plus' && { color: C.gold }]} numberOfLines={1}>{lock.label}</Text>
          </View>
        ) : (
          <Text style={s.footerText} numberOfLines={1}>{reward.description}</Text>
        )}
        {lock.kind === 'redeemed' ? (
          <View style={[s.pricePill, s.pricePillDone]}>
            <Check size={13} color={C.green} strokeWidth={2.6} />
            <Text style={[s.priceText, { color: C.green }]}>Redeemed</Text>
          </View>
        ) : (
          <View style={[s.pricePill, lock.blocked && s.pricePillMuted]}>
            <Text style={[s.priceText, lock.blocked && { color: C.t2 }]}>{reward.paceCost} PACE</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.card, borderRadius: 16, overflow: 'hidden',
      shadowColor: '#14120F', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    cardPressed:   { transform: [{ scale: 0.99 }] },
    band:          { height: 120, paddingHorizontal: 16, paddingBottom: 14, justifyContent: 'flex-end' },
    bandMuted:     { opacity: 0.55 },
    brandName:     { fontFamily: Fonts.semiBold, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
    valueLabel:    { ...Type.hero, fontSize: 40, lineHeight: 36, color: C.alwaysLight, marginTop: 6 },
    footer:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
    footerText:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, flexShrink: 1 },
    lockRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    pricePill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.red, borderRadius: 999, paddingHorizontal: 12, height: 30 },
    pricePillMuted:{ backgroundColor: C.border },
    pricePillDone: { backgroundColor: C.greenLo },
    priceText:     { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.alwaysLight },
  });
}
