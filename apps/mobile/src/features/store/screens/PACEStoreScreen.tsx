import { ENGINE } from '@shared/engine/runEngine';
import { SponsoredChallenges } from '../components/SponsoredChallenges';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from '@mobile/shared/icons/lucideCompat';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import * as Haptics from '@theme/hapticsGated';
import { usePACEStore } from '../hooks/usePACEStore';
import { RewardCard } from '../components/RewardCard';
import { RewardTile } from '../components/RewardTile';
import type { Reward } from '../types';
import type { RootStackParamList } from '@navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Store chips, in the mock's order. Only categories that have rewards are shown. */
const CATEGORY_CHIPS: { key: Reward['category']; label: string }[] = [
  { key: 'gear',      label: 'Gear' },
  { key: 'nutrition', label: 'Fuel' },
  { key: 'events',    label: 'Races' },
  { key: 'tech',      label: 'Tech' },
];

export default function PACEStoreScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { paceBalance, paceWeeklyEarned, capLimit, weeklyPct, runnerRank, rewards, rewardsLoaded, refresh } = usePACEStore();
  // Back from a reward: pick up its new state (redeemed, code, stock left).
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [category, setCategory] = useState<Reward['category'] | 'all'>('all');
  const chips = useMemo(
    () => CATEGORY_CHIPS.filter(c => rewards.some(r => r.category === c.key)),
    [rewards],
  );
  const shown = category === 'all' ? rewards : rewards.filter(r => r.category === category);
  const [featured, ...rest] = shown;
  // The cheapest reward still out of reach: what the next runs are for.
  const savingFor = rewards
    .filter(r => !r.redeemed && r.paceCost > paceBalance)
    .sort((x, y) => x.paceCost - y.paceCost)[0];
  const displayRank = runnerRank.charAt(0).toUpperCase() + runnerRank.slice(1);

  const open = (reward: Reward) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('RewardDetail', { rewardId: reward.id, reward });
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.closeBtn} accessibilityLabel="Close">
          <X size={18} color={C.t1} strokeWidth={2.2} />
        </Pressable>
        <View style={s.headerRight}>
          <Pressable style={s.mineBtn} onPress={() => navigation.navigate('MyRewards')} accessibilityRole="button" hitSlop={6}>
            <Text style={s.mineTxt}>My rewards</Text>
          </Pressable>
          <View style={s.rankChip}>
            <Text style={s.rankChipText}>{displayRank}</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <Text style={s.title}>PACE Store</Text>

        {/* Balance card (mock): to spend, this week, and what you're saving for. */}
        <View style={s.balCard}>
          <Text style={s.balLbl}>To spend</Text>
          <View style={s.balanceRow}>
            <Text style={s.balanceNum} numberOfLines={1}>{paceBalance.toLocaleString()}</Text>
            <Text style={s.balanceUnit}>PACE</Text>
          </View>
          <View style={s.progressBarBg}>
            <View style={[s.progressBarFill, { width: `${Math.round(weeklyPct * 100)}%` }]} />
          </View>
          <Text style={s.weekNumbers}>
            <Text style={s.weekStrong}>{paceWeeklyEarned}</Text> of {capLimit} this week · resets Monday
          </Text>
          {savingFor && (
            <Text style={s.saving} numberOfLines={2}>
              Saving for {savingFor.title} at {savingFor.brand} · {savingFor.paceCost - paceBalance} to go
            </Text>
          )}
        </View>

        {/* S4: brand challenges */}
        <SponsoredChallenges />

        {/* Categories */}
        {chips.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {[{ key: 'all' as const, label: 'All' }, ...chips].map(c => {
              const active = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[s.chip, active && s.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Featured + grid */}
        {featured && (
          <View style={s.section}>
            <RewardCard reward={featured} onPress={open} />
          </View>
        )}
        {rewardsLoaded && shown.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No rewards in your area yet</Text>
            <Text style={s.emptyBody}>Partner rewards open city by city. Keep running to build your PACE, and offers will appear here when they reach you.</Text>
          </View>
        )}
        {rest.length > 0 && (
          <View style={s.grid}>
            {rest.map(r => (
              <View key={r.id} style={s.gridCell}>
                <RewardTile reward={r} onPress={open} />
              </View>
            ))}
          </View>
        )}

        {/* How you earn PACE */}
        <View style={s.howCard}>
          <Text style={s.howTitle}>How you earn PACE</Text>
          <HowRow label="Every km you run" value={`+${ENGINE.PACE_PER_KM}`} color={C.t1} styles={s} />
          <HowRow label="Claim a new zone" value="+5" color={C.red} styles={s} />
          <HowRow label="Steal a rival's zone" value="+10" color={C.blue} styles={s} />
          <HowRow label="Keep your streak" value="+3" color={C.t1} styles={s} last />
        </View>
      </ScrollView>
    </View>
  );
}

function HowRow({ label, value, color, styles: s, last }: {
  label: string; value: string; color: string; styles: ReturnType<typeof mkStyles>; last?: boolean;
}) {
  return (
    <View style={[s.howRow, !last && s.howRowBorder]}>
      <Text style={s.howLabel}>{label}</Text>
      <Text style={[s.howValue, { color }]}>{value}</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  const card = {
    backgroundColor: C.card, borderRadius: Spacing.radius.lg,
    shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  } as const;
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: C.bg },
    headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mineBtn:         { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.card, justifyContent: 'center' },
    mineTxt:         { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    headerBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
    closeBtn:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
    rankChip:        { backgroundColor: C.t1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    rankChipText:    { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.bg },
    title:           { fontFamily: Fonts.semiBold, fontSize: 30, color: C.t1, paddingHorizontal: 18, marginBottom: 14 },
    balCard:         { backgroundColor: C.alwaysDark, borderRadius: 28, marginHorizontal: 18, marginBottom: 14, padding: 20, gap: 8 },
    balLbl:          { fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.65)' },
    saving:          { fontFamily: Fonts.regular, fontSize: 13.5, color: C.lime, marginTop: 2 },
    balanceRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    balanceNum:      { fontFamily: Fonts.numeric, fontSize: 56, lineHeight: 58, color: C.alwaysLight, fontVariant: ['tabular-nums'] },
    balanceUnit:     { fontFamily: Fonts.semiBold, fontSize: 20, color: C.lime, paddingBottom: 8 },
    weekNumbers:     { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.65)', fontVariant: ['tabular-nums'] },
    weekStrong:      { fontFamily: Fonts.semiBold, color: C.alwaysLight },
    progressBarBg:   { height: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
    progressBarFill: { height: 8, backgroundColor: C.lime, borderRadius: 4 },
    chips:           { paddingHorizontal: 18, gap: 8, marginBottom: 12 },
    chip:            { height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    chipActive:      { backgroundColor: C.t1, borderColor: C.t1 },
    chipText:        { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    chipTextActive:  { color: C.bg },
    section:         { paddingHorizontal: 18, marginBottom: 12 },
    emptyCard:       { ...card, marginHorizontal: 18, marginBottom: 12, padding: 18 },
    emptyTitle:      { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    emptyBody:       { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: C.t2, marginTop: 6 },
    grid:            { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 13, marginBottom: 2 },
    gridCell:        { width: '50%', paddingHorizontal: 5, marginBottom: 10 },
    howCard:         { ...card, marginHorizontal: 18, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 },
    howTitle:        { ...Type.labelSm, color: C.t2, paddingTop: 10, paddingBottom: 4 },
    howRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    howRowBorder:    { borderBottomWidth: 1, borderBottomColor: C.border },
    howLabel:        { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    howValue:        { fontFamily: Fonts.numeric, fontSize: 20, lineHeight: 20, fontVariant: ['tabular-nums'] },
  });
}
