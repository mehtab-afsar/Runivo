import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import { Check, CaretRight, type Icon } from 'phosphor-react-native';
import type { Mission, MissionType } from '@shared/services/missions';
import { useTheme, Fonts, type AppColors } from '@theme';
import { MissionRing } from './MissionRing';

const GLOW = '#6DE8A8';

const fmtNum = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
const missionUnit = (t: MissionType) => t === 'run_distance' ? 'km' : t === 'nutrition_streak' ? 'd' : '';

export type CardState = 'idle' | 'claiming' | 'retry';

interface Props {
  mission: Mission;
  MIcon: Icon;
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
  const ringColor = m.claimed ? GLOW : m.completed ? GLOW : accentColor;

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
    <LinearGradient colors={['#201D19', '#0A0A0A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ss.card}>
      {claimable && <Animated.View style={[ss.shimmer, shimmerStyle]} pointerEvents="none" />}

      <View style={ss.topRow}>
        <MissionRing pct={pct} color={ringColor}>
          {m.claimed
            ? <Check size={16} color={GLOW} weight="bold" />
            : <MIcon size={18} color={ringColor} weight="light" />}
        </MissionRing>

        <View style={ss.meta}>
          <Text style={ss.title} numberOfLines={1}>{m.title}</Text>
          <Text style={ss.source}>{sourceLabel}</Text>
        </View>

        <View style={ss.heroWrap}>
          <Text style={[ss.heroNum, m.claimed && { color: GLOW }]}>
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
            <Pressable
              onPress={() => onClaim(m.id)}
              disabled={state === 'claiming'}
              style={({ pressed }) => [ss.claimBtn, pressed && { opacity: 0.85 }]}
            >
              {state === 'claiming'
                ? <ActivityIndicator size="small" color={C.alwaysDark} />
                : <Text style={ss.claimBtnText}>Claim +{m.rewards.pace}</Text>}
            </Pressable>
          </>
        ) : m.claimed ? (
          <View style={ss.claimedRow}>
            <Check size={12} color={GLOW} weight="bold" />
            <Text style={ss.claimedText}>+{m.rewards.pace} PACE claimed</Text>
          </View>
        ) : (
          <>
            <View style={[ss.rewardChip, { backgroundColor: `${accentColor}26` }]}>
              <Text style={[ss.rewardChipText, { color: accentColor }]}>+{m.rewards.pace} PACE</Text>
            </View>
            <Pressable onPress={() => onSwap(m.id)} hitSlop={8} style={ss.swapLink}>
              <Text style={ss.swapLinkText}>Swap</Text>
              <CaretRight size={10} color="rgba(255,255,255,0.4)" weight="bold" />
            </Pressable>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 20, padding: 16, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 14, elevation: 6,
    },
    shimmer: { position: 'absolute', top: 0, bottom: 0, width: 90, backgroundColor: 'rgba(255,255,255,0.06)', transform: [{ skewX: '-20deg' }] },

    topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    meta:   { flex: 1 },
    title:  { fontFamily: Fonts.medium, fontSize: 14.5, color: C.alwaysLight, marginBottom: 2 },
    source: { fontFamily: Fonts.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.4)' },

    heroWrap:   { alignItems: 'flex-end' },
    heroNum:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.alwaysLight, fontVariant: ['tabular-nums'] },
    heroTarget: { fontFamily: Fonts.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.4)' },

    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
    readyHint:  { fontFamily: Fonts.semiBold, fontSize: 11.5, color: GLOW, letterSpacing: 0.2 },
    retryHint:  { fontFamily: Fonts.regular, fontSize: 11, color: '#EF9F27' },
    claimedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    claimedText: { fontFamily: Fonts.medium, fontSize: 12, color: GLOW },
    claimBtn:   { backgroundColor: C.alwaysLight, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, minWidth: 90, alignItems: 'center' },
    claimBtnText: { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.alwaysDark, letterSpacing: 0.3 },

    rewardChip: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
    rewardChipText: { fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 0.2 },
    swapLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    swapLinkText: { fontFamily: Fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.2 },
  });
}
