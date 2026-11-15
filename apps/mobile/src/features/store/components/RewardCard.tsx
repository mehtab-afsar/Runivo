import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
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

  const left = reward.stockLeft != null ? ` · ${reward.stockLeft} LEFT` : '';
  return (
    <Pressable
      onPress={() => onPress(reward)}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${reward.brand}: ${reward.title}, ${reward.paceCost} PACE${lock.label ? `, ${lock.label}` : ''}`}
    >
      <Text style={s.eyebrow}>FEATURED{left}</Text>
      <Text style={s.title} numberOfLines={2}>{reward.title}</Text>
      <Text style={s.sub} numberOfLines={1}>{reward.brand}{reward.description ? ` · ${reward.description}` : ''}</Text>
      {lock.blocked && (
        <View style={s.lockRow}>
          <LockIcon size={13} color={C.lime} strokeWidth={2.2} />
          <Text style={s.lockTxt} numberOfLines={1}>{lock.label}</Text>
        </View>
      )}
      {lock.kind === 'redeemed' ? (
        <View style={[s.pricePill, { backgroundColor: C.lime }]}>
          <Check size={13} color={C.alwaysDark} strokeWidth={2.6} />
          <Text style={s.priceText}>Redeemed</Text>
        </View>
      ) : (
        <View style={[s.pricePill, lock.blocked && { opacity: 0.6 }]}>
          <Text style={s.priceText}>{reward.paceCost} PACE</Text>
        </View>
      )}
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:        { backgroundColor: C.alwaysDark, borderRadius: 28, padding: 18, gap: 8 },
    cardPressed: { transform: [{ scale: 0.99 }] },
    eyebrow:     { fontFamily: Fonts.semiBold, fontSize: 13, color: C.lime },
    title:       { fontFamily: Fonts.medium, fontSize: 22, lineHeight: 27, color: C.alwaysLight },
    sub:         { fontFamily: Fonts.regular, fontSize: 14, color: '#C9CCC4' },
    lockRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lockTxt:     { fontFamily: Fonts.medium, fontSize: 13, color: C.lime },
    pricePill:   { alignSelf: 'flex-start', marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 14, height: 36 },
    priceText:   { fontFamily: Fonts.semiBold, fontSize: 14, color: '#17181A' },
  });
}
