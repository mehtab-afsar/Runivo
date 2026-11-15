import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Coffee, Flag, Watch, Sneaker } from 'phosphor-react-native';
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

  const Icon = reward.category === 'nutrition' ? Coffee : reward.category === 'events' ? Flag : reward.category === 'tech' ? Watch : Sneaker;
  return (
    <Pressable
      onPress={() => onPress(reward)}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${reward.title} from ${reward.brand}, ${reward.paceCost} PACE${lock.label ? `, ${lock.label}` : ''}`}
    >
      <View style={[s.icon, { backgroundColor: muted ? C.bg : C.mint }]}>
        <Icon size={20} color={muted ? C.t2 : C.green} weight="bold" />
      </View>
      <Text style={s.title} numberOfLines={2}>{reward.title}</Text>
      {muted || lock.kind === 'redeemed' ? (
        <View style={s.lockPill}><Text style={s.lockTxt} numberOfLines={1}>{lock.label}</Text></View>
      ) : (
        <Text style={s.partner} numberOfLines={1}>{reward.brand} · {reward.paceCost.toLocaleString()} PACE</Text>
      )}
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:        { backgroundColor: C.card, borderRadius: 24, padding: 14, gap: 6, flex: 1, minHeight: 138 },
    cardPressed: { transform: [{ scale: 0.98 }] },
    icon:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title:       { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 19, color: C.t1 },
    partner:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    lockPill:    { alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: C.lavender, justifyContent: 'center', maxWidth: '100%' },
    lockTxt:     { fontFamily: Fonts.regular, fontSize: 12, color: C.lavenderInk },
  });
}
