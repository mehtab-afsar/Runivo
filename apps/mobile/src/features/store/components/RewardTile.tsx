import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { Reward } from '../types';
import { lockStateFor } from '../lockState';

interface Props {
  reward: Reward;
  onPress: (r: Reward) => void;
}

/** A reward in the store's two-column grid: colour block, title, partner, price. */
export function RewardTile({ reward, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const lock = lockStateFor(reward);
  const muted = lock.blocked;

  return (
    <Pressable
      onPress={() => onPress(reward)}
      style={({ pressed }) => [s.card, muted && s.cardMuted, pressed && s.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${reward.title} from ${reward.brand}, ${reward.paceCost} PACE${lock.label ? `, ${lock.label}` : ''}`}
    >
      <View style={[s.band, { backgroundColor: muted ? C.t2 : reward.brandColor }]} />
      <View style={s.body}>
        <Text style={[s.title, muted && { color: C.t2 }]} numberOfLines={2}>{reward.title}</Text>
        <Text style={s.partner} numberOfLines={1}>
          {lock.blocked || lock.kind === 'redeemed' ? lock.label : reward.brand}
        </Text>
        <Text style={s.priceRow}>
          <Text style={[s.price, muted && { color: C.t3 }]}>{reward.paceCost.toLocaleString()}</Text>
          <Text style={s.unit}> PACE</Text>
        </Text>
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', flex: 1,
      shadowColor: '#14120F', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    cardMuted:   { opacity: 0.6 },
    cardPressed: { transform: [{ scale: 0.98 }] },
    band:        { height: 72 },
    body:        { paddingHorizontal: 12, paddingVertical: 10 },
    title:       { fontFamily: Fonts.semiBold, fontSize: 13, lineHeight: 17, color: C.t1 },
    partner:     { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t2, marginTop: 2 },
    priceRow:    { marginTop: 8 },
    price:       { fontFamily: Fonts.numeric, fontSize: 20, color: C.t1, fontVariant: ['tabular-nums'] },
    unit:        { fontFamily: Fonts.numeric, fontSize: 12, color: C.t3 },
  });
}
