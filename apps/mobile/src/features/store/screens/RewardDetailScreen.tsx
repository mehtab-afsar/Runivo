import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CaretLeft, SealCheck } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { getPlayer, savePlayer } from '@shared/services/store';
import { HARDCODED_REWARDS } from '../rewards';
import { redeemReward } from '../services/rewardService';
import type { RootStackParamList } from '@navigation/AppNavigator';

export default function RewardDetailScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'RewardDetail'>>();
  const { rewardId, reward: passedReward } = route.params;

  const [paceBalance, setPaceBalance] = useState(0);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedMsg, setRedeemedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    getPlayer().then(p => { if (p) setPaceBalance(p.paceBalance ?? 0); }).catch(() => {});
  }, []);

  // Prefer the object passed by PACEStoreScreen — covers both DB-sourced and
  // HARDCODED_REWARDS-fallback rewards. Falls back to a hardcoded-only lookup
  // for any other way this screen might be reached (there's no deep link to
  // it today, but route params alone shouldn't be assumed complete).
  const reward = passedReward ?? HARDCODED_REWARDS.find(r => r.id === rewardId);

  if (!reward) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <CaretLeft size={20} color={C.black} weight="light" />
        </Pressable>
      </View>
    );
  }

  const canAfford = paceBalance >= reward.paceCost;
  const afterRedemption = paceBalance - reward.paceCost;

  const handleClaim = async () => {
    if (redeeming || redeemedMsg) return;
    setErrorMsg(null);
    setRedeeming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await redeemReward(reward.id);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result.newBalance != null) {
          setPaceBalance(result.newBalance);
          // Keep the locally-cached player balance in sync so the dashboard/
          // store hero doesn't show a stale number until the next pull.
          const player = await getPlayer();
          if (player) await savePlayer({ ...player, paceBalance: result.newBalance });
        }
        setRedeemedMsg("Redeemed! We'll email your code within 24 hours.");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMsg(result.message);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg('Redemption failed. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <Pressable style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
        <CaretLeft size={20} color={C.black} weight="light" />
      </Pressable>

      <View style={s.content}>
        {/* Brand circle */}
        <View style={[s.brandCircle, { backgroundColor: reward.brandColor + '26' }]}>
          <Text style={[s.brandInitial, { color: reward.brandColor }]}>{reward.brandInitial}</Text>
        </View>

        <Text style={s.brand}>{reward.brand}</Text>
        <Text style={s.title}>{reward.title}</Text>
        <Text style={s.description}>{reward.description}</Text>

        <View style={s.divider} />

        {/* Cost breakdown */}
        <View style={s.breakdown}>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Cost</Text>
            <Text style={s.breakdownValue}>{reward.paceCost} PACE</Text>
          </View>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Your balance</Text>
            <Text style={s.breakdownValue}>{paceBalance} PACE</Text>
          </View>
          <View style={[s.breakdownRow, s.breakdownRowLast]}>
            <Text style={s.breakdownLabel}>After redemption</Text>
            <Text style={[s.breakdownValue, !canAfford && s.breakdownNegative]}>
              {afterRedemption} PACE
            </Text>
          </View>
        </View>

        <View style={s.divider} />

        {redeemedMsg ? (
          <View style={s.redeemedRow}>
            <SealCheck size={18} color={C.green} weight="fill" />
            <Text style={s.redeemedText}>{redeemedMsg}</Text>
          </View>
        ) : (
          <>
            {/* Claim button */}
            <Pressable
              style={[s.claimBtn, (!canAfford || redeeming) && s.claimBtnDisabled]}
              onPress={handleClaim}
              disabled={!canAfford || redeeming}
            >
              {redeeming
                ? <ActivityIndicator size="small" color={C.white} />
                : <Text style={s.claimBtnText}>{canAfford ? 'Claim Reward' : 'Not enough PACE'}</Text>}
            </Pressable>
            {errorMsg ? <Text style={s.errorText}>{errorMsg}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:               { flex: 1, backgroundColor: C.bg },
    backBtn:            { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginTop: 4 },
    content:            { flex: 1, paddingHorizontal: Spacing.gutter, paddingTop: 20 },
    brandCircle:        { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    brandInitial:       { fontFamily: Fonts.display, fontSize: 28 },
    brand:              { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, marginBottom: 4, letterSpacing: 0.8 },
    title:              { fontFamily: Fonts.semiBold, fontSize: 22, color: C.black, lineHeight: 28, marginBottom: 10 },
    description:        { fontFamily: Fonts.regular, fontSize: 14, color: C.t2, lineHeight: 21, marginBottom: 4 },
    divider:            { height: 0.5, backgroundColor: C.border, marginVertical: 20 },
    breakdown:          { gap: 14 },
    breakdownRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    breakdownRowLast:   {},
    breakdownLabel:     { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    breakdownValue:     { fontFamily: Fonts.semiBold, fontSize: 14, color: C.black, fontVariant: ['tabular-nums'] },
    breakdownNegative:  { color: C.red },
    claimBtn:           { backgroundColor: C.red, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    claimBtnDisabled:   { opacity: 0.5 },
    claimBtnText:       { fontFamily: Fonts.semiBold, fontSize: 15, color: C.white },
    errorText:          { fontFamily: Fonts.regular, fontSize: 12, color: C.red, textAlign: 'center' },
    redeemedRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.greenLo, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16 },
    redeemedText:       { fontFamily: Fonts.medium, fontSize: 14, color: C.green, flexShrink: 1, textAlign: 'center' },
  });
}
