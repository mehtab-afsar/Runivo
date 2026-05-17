import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, withTiming, useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronDown, Diamond } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';
import * as Haptics from 'expo-haptics';
import { GAME_CONFIG } from '@shared/services/config';
import { RANK_COLORS } from '@shared/constants/territory';
import { usePACEStore } from '../hooks/usePACEStore';
import { RewardCard } from '../components/RewardCard';
import { RedeemModal } from '../components/RedeemModal';
import type { RewardTier } from '../types';

const TIER_LABELS: Record<RewardTier, string> = {
  entry:   'Quick Wins · 50–75 PACE',
  mid:     'Mid-Range · 120–150 PACE',
  premium: 'Premium Drops · 300+ PACE',
};

const HOW_ROWS = [
  '+1 PACE per km',
  '+5 PACE per new zone',
  '+10 PACE per rival zone stolen',
  '+3 PACE streak day bonus',
];

export default function PACEStoreScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { paceBalance, paceWeeklyEarned, capLimit, weeklyPct, runnerRank,
          rewards, selectedReward, isRedeemVisible, handleRedeem, closeRedeem } = usePACEStore();

  const rankColor   = RANK_COLORS[runnerRank] ?? RANK_COLORS.pacer;
  const displayRank = runnerRank.charAt(0).toUpperCase() + runnerRank.slice(1);

  // Collapsible "How do I earn PACE?"
  const [howOpen, setHowOpen] = useState(false);
  const howMaxH = useSharedValue(0);
  const chevronRotate = useSharedValue(0);

  const howAnimStyle = useAnimatedStyle(() => ({ maxHeight: howMaxH.value, overflow: 'hidden' }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotate.value}deg` }],
  }));

  function toggleHow() {
    const opening = !howOpen;
    setHowOpen(opening);
    howMaxH.value       = withTiming(opening ? 300 : 0, { duration: 220 });
    chevronRotate.value = withTiming(opening ? 180 : 0, { duration: 220 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const TIERS: RewardTier[] = ['entry', 'mid', 'premium'];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={s.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.backBtn}>
          <ChevronLeft size={20} color={C.black} strokeWidth={1.5} />
        </Pressable>
        <Text style={s.headerTitle}>PACE STORE</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Balance hero */}
        <View style={s.hero}>
          <View style={s.balanceRow}>
            <Text style={s.balanceNum}>{paceBalance}</Text>
            <Text style={s.balanceUnit}> PACE</Text>
          </View>
          <View style={[s.rankBadge, { backgroundColor: rankColor.bg }]}>
            <Diamond size={10} color={rankColor.fg} strokeWidth={1.5} />
            <Text style={[s.rankBadgeText, { color: rankColor.fg }]}>{displayRank}</Text>
          </View>
        </View>

        {/* Weekly progress card */}
        <View style={s.weekCard}>
          <Text style={s.weekLabel}>THIS WEEK</Text>
          <View style={s.progressBarBg}>
            <View style={[s.progressBarFill, { width: `${Math.round(weeklyPct * 100)}%` }]} />
          </View>
          <Text style={s.weekNumbers}>{paceWeeklyEarned} / {capLimit} PACE</Text>
          {weeklyPct < 1
            ? <Text style={s.weekHint}>Run {Math.ceil((capLimit - paceWeeklyEarned) / GAME_CONFIG.PACE_PER_KM)}km more to hit your weekly cap</Text>
            : <Text style={[s.weekHint, { color: C.amber }]}>Weekly cap reached — resets Monday 🎯</Text>}
        </View>

        {/* How do I earn PACE? collapsible */}
        <View style={s.howWrap}>
          <Pressable style={s.howHeader} onPress={toggleHow}>
            <Text style={s.howHeaderText}>How do I earn PACE?</Text>
            <Animated.View style={chevronStyle}>
              <ChevronDown size={16} color={C.black} strokeWidth={1.5} />
            </Animated.View>
          </Pressable>
          <Animated.View style={howAnimStyle}>
            <View style={s.howContent}>
              {HOW_ROWS.map(row => (
                <View key={row} style={s.howRow}>
                  <Text style={s.howRowText}>{row}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>

        {/* Reward tiers */}
        {TIERS.map(tier => {
          const tierRewards = rewards.filter(r => r.tier === tier);
          return (
            <View key={tier} style={s.tierSection}>
              <Text style={s.tierLabel}>{TIER_LABELS[tier].toUpperCase()}</Text>
              <View style={s.tierCards}>
                {tierRewards.map(reward => (
                  <View
                    key={reward.id}
                    style={reward.status === 'coming_soon' ? s.comingSoonWrap : undefined}
                  >
                    <RewardCard
                      reward={reward}
                      paceBalance={paceBalance}
                      onRedeem={r => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleRedeem(r); }}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <RedeemModal
        reward={selectedReward}
        visible={isRedeemVisible}
        onClose={closeRedeem}
      />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: C.bg },
    headerBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle:     { fontFamily: 'Barlow_500Medium', fontSize: 12, letterSpacing: 2, color: C.t3 },
    hero:            { alignItems: 'center', paddingTop: 24, paddingBottom: 28 },
    balanceRow:      { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
    balanceNum:      { fontFamily: 'Barlow_700Bold', fontSize: 52, color: C.black, lineHeight: 56, letterSpacing: -2 },
    balanceUnit:     { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t3, lineHeight: 52, marginBottom: 4 },
    rankBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    rankBadgeText:   { fontFamily: 'Barlow_500Medium', fontSize: 11, letterSpacing: 0.5 },
    weekCard:        { backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, marginHorizontal: 16, marginBottom: 12 },
    weekLabel:       { fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    progressBarBg:   { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
    progressBarFill: { height: 6, backgroundColor: C.red, borderRadius: 3 },
    weekNumbers:     { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black, marginBottom: 4 },
    weekHint:        { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t3 },
    howWrap:         { marginHorizontal: 16, marginBottom: 4, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
    howHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
    howHeaderText:   { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
    howContent:      { paddingHorizontal: 14, paddingBottom: 14 },
    howRow:          { paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: C.border },
    howRowText:      { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.t2 },
    tierSection:     { marginTop: 20, paddingHorizontal: 16 },
    tierLabel:       { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.t3, letterSpacing: 0.8, marginBottom: 12 },
    tierCards:       { gap: 12 },
    comingSoonWrap:  { opacity: 0.65 },
  });
}
