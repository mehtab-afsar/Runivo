import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { Mission, MissionType } from '@shared/services/missions';
import { useTheme, Fonts, type AppColors } from '@theme';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';
import { MissionRing } from './MissionRing';

const fmtNum = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
const missionUnit = (t: MissionType) => t === 'run_distance' ? 'km' : t === 'nutrition_streak' ? 'd' : '';

export type CardState = 'idle' | 'claiming' | 'retry';

interface Props {
  mission: Mission;
  MIcon: LucideIcon;
  accentColor: string;
  sourceLabel: string;
  state: CardState;
  onClaim: (id: string) => void;
  onSwap: (id: string) => void;
}

export function MissionCard({ mission: m, MIcon, accentColor, sourceLabel, state, onClaim, onSwap }: Props) {
  const C  = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const claimable = m.completed && !m.claimed;
  const pct = Math.min(1, m.current / Math.max(m.target, 1));
  const unit = missionUnit(m.type);
  const ringColor = m.claimed ? C.green : m.completed ? C.green : accentColor;

  // Shimmer sweep — only while a reward is actually sitting there waiting,
  // so the one card asking for a tap is the one that visibly says so.
  const shimmerX = useSharedValue(-140);
  useEffect(() => {
    if (!claimable) return;
    shimmerX.value = withRepeat(
      withSequence(
        withTiming(340, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(-140, { duration: 0 }),
        withTiming(-140, { duration: 1800 }),
      ),
      -1,
    );
  }, [claimable]); // eslint-disable-line react-hooks/exhaustive-deps
  const shimmerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shimmerX.value }] }));

  return (
    <View style={ss.card}>
      {claimable && <Animated.View style={[ss.shimmer, shimmerStyle]} pointerEvents="none" />}

      <View style={ss.topRow}>
        <MissionRing pct={pct} color={ringColor} trackColor={C.border}>
          {m.claimed
            ? <Check size={16} color={C.green} strokeWidth={2.5} />
            : <MIcon size={18} color={ringColor} strokeWidth={2} />}
        </MissionRing>

        <View style={ss.meta}>
          <Text style={ss.title} numberOfLines={1}>{m.title}</Text>
          <Text style={ss.source}>{sourceLabel}</Text>
        </View>

        <View style={ss.heroWrap}>
          <Text style={[ss.heroNum, m.claimed && { color: C.green }]}>
            {fmtNum(m.current)}{unit}
          </Text>
          <Text style={ss.heroTarget}>/ {fmtNum(m.target)}{unit}</Text>
        </View>
      </View>

      <View style={ss.footer}>
        {claimable ? (
          <>
            <Text style={state === 'retry' ? ss.retryHint : ss.readyHint}>
              {state === 'retry' ? 'Not yet — try again shortly' : '● Ready to claim'}
            </Text>
            <PrimaryButton
              label={`Claim +${m.rewards.pace}`}
              onPress={() => onClaim(m.id)}
              loading={state === 'claiming'}
              variant="dark"
              size="sm"
              style={ss.claimBtn}
            />
          </>
        ) : m.claimed ? (
          <View style={ss.claimedRow}>
            <Check size={12} color={C.green} strokeWidth={2.5} />
            <Text style={ss.claimedText}>+{m.rewards.pace} PACE claimed</Text>
          </View>
        ) : (
          <>
            <View style={[ss.rewardChip, { backgroundColor: `${accentColor}1A` }]}>
              <Text style={[ss.rewardChipText, { color: accentColor }]}>+{m.rewards.pace} PACE</Text>
            </View>
            <Pressable onPress={() => onSwap(m.id)} hitSlop={8} style={ss.swapLink}>
              <Text style={ss.swapLinkText}>Change</Text>
              <ChevronRight size={12} color={C.red} strokeWidth={2} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 16, padding: 16, overflow: 'hidden',
      backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border,
    },
    shimmer: { position: 'absolute', top: 0, bottom: 0, width: 90, backgroundColor: 'rgba(0,0,0,0.03)', transform: [{ skewX: '-20deg' }] },

    topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    meta:   { flex: 1 },
    title:  { fontFamily: Fonts.medium, fontSize: 14.5, color: C.t1, marginBottom: 2 },
    source: { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t3 },

    heroWrap:   { alignItems: 'flex-end' },
    heroNum:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1, fontVariant: ['tabular-nums'] },
    heroTarget: { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t3 },

    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 12 },
    readyHint:  { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.gold, letterSpacing: 0.2 },
    retryHint:  { fontFamily: Fonts.regular, fontSize: 11, color: C.retryAmber },
    claimedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    claimedText: { fontFamily: Fonts.medium, fontSize: 12, color: C.green },
    claimBtn:   { height: 34, paddingHorizontal: 14 },

    rewardChip: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
    rewardChipText: { fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 0.2 },
    swapLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    swapLinkText: { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.red, letterSpacing: 0.2 },
  });
}
