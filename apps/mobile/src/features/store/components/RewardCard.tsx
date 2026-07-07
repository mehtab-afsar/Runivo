import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Diamond } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { Reward } from '../types';

interface Props {
  reward: Reward;
  onPress: (r: Reward) => void;
}

export function RewardCard({ reward, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  const isPremium = reward.tier === 'premium';

  return (
    <View style={[s.card, isPremium && s.cardPremium]}>
      {/* Brand logo + value badge */}
      <View style={s.topRow}>
        <View style={[s.brandCircle, { backgroundColor: reward.brandColor + '26' }]}>
          <Text style={[s.brandInitial, { color: reward.brandColor }]}>{reward.brandInitial}</Text>
        </View>
        <View style={s.valueBadge}>
          <Text style={s.valueBadgeText}>{reward.valueLabel.toUpperCase()}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={s.title}>{reward.title}</Text>

      {/* Description */}
      <Text style={s.description} numberOfLines={2}>{reward.description}</Text>

      {/* Cost row */}
      <View style={s.costRow}>
        {reward.expiresLabel
          ? <Text style={s.expiresLabel}>{reward.expiresLabel}</Text>
          : <View />}
        <View style={s.costPill}>
          <Diamond size={12} color={C.red} weight="light" />
          <Text style={s.costText}>{reward.paceCost} PACE</Text>
        </View>
      </View>

      {/* View link */}
      <Pressable onPress={() => onPress(reward)} hitSlop={8} style={s.viewLink}>
        <Text style={s.viewLinkText}>View reward →</Text>
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:           { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16 },
    cardPremium:    { borderLeftWidth: 3, borderLeftColor: C.red },
    topRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    brandCircle:    { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    brandInitial:   { fontFamily: Fonts.display, fontSize: 22 },
    valueBadge:     { backgroundColor: C.redLo, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    valueBadgeText: { fontFamily: Fonts.medium, fontSize: 11, color: C.red, textTransform: 'uppercase', letterSpacing: 0.5 },
    title:          { fontFamily: Fonts.semiBold, fontSize: 15, color: C.black, marginBottom: 6 },
    description:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 19, marginBottom: 12 },
    costRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    expiresLabel:   { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    costPill:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
    costText:       { fontFamily: Fonts.medium, fontSize: 13, color: C.black, fontVariant: ['tabular-nums'] },
    viewLink:     { alignSelf: 'flex-start' },
    viewLinkText: { fontFamily: Fonts.medium, fontSize: 12, color: C.red },
  });
}
