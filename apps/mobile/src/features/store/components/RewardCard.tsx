import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Diamond } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';
import type { Reward } from '../types';

interface Props {
  reward: Reward;
  paceBalance: number;
  onRedeem: (r: Reward) => void;
}

export function RewardCard({ reward, paceBalance, onRedeem }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  const canAfford  = paceBalance >= reward.paceCost;
  const available  = reward.status === 'available';
  const isPremium  = reward.tier === 'premium';

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
          <Diamond size={12} color={C.red} strokeWidth={1.5} />
          <Text style={s.costText}>{reward.paceCost} PACE</Text>
        </View>
      </View>

      {/* CTA */}
      {!available ? (
        <View style={[s.ctaBtn, s.ctaDisabled]}>
          <Text style={[s.ctaText, s.ctaTextDisabled, { fontStyle: 'italic' }]}>Coming Soon</Text>
        </View>
      ) : canAfford ? (
        <Pressable style={s.ctaBtn} onPress={() => onRedeem(reward)}>
          <Text style={s.ctaText}>Redeem →</Text>
        </Pressable>
      ) : (
        <View style={[s.ctaBtn, s.ctaDisabled]}>
          <Text style={[s.ctaText, s.ctaTextDisabled]}>
            Need {reward.paceCost - paceBalance} more PACE
          </Text>
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:           { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16 },
    cardPremium:    { borderLeftWidth: 3, borderLeftColor: C.red },
    topRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    brandCircle:    { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    brandInitial:   { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22 },
    valueBadge:     { backgroundColor: C.redLo, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    valueBadgeText: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.red, textTransform: 'uppercase', letterSpacing: 0.5 },
    title:          { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: C.black, marginBottom: 6 },
    description:    { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.t2, lineHeight: 19, marginBottom: 12 },
    costRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    expiresLabel:   { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
    costPill:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
    costText:       { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
    ctaBtn:         { backgroundColor: C.black, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    ctaDisabled:    { backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border },
    ctaText:        { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.white },
    ctaTextDisabled:{ fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.t3 },
  });
}
