import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Share, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CaretLeft, SealCheck } from 'phosphor-react-native';
import { Lock, Crown, Share2, ArrowLeft, Gift } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from '@theme/hapticsGated';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';
import { getPlayer, savePlayer, getSettings, saveSettings } from '@shared/services/store';
import { redeemReward, logRewardView } from '../services/rewardService';
import { lockStateFor } from '../lockState';
import type { RootStackParamList } from '@navigation/AppNavigator';

export default function RewardDetailScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RewardDetail'>>();
  const { rewardId, reward: passedReward } = route.params;

  const [paceBalance, setPaceBalance] = useState(0);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedMsg, setRedeemedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(passedReward?.myCode ?? null);
  const [howToUse, setHowToUse] = useState<string | null>(passedReward?.howToUse ?? null);

  useEffect(() => {
    getPlayer().then(p => { if (p) setPaceBalance(p.paceBalance ?? 0); }).catch(() => {});
  }, []);
  // S3: the reward the runner is saving for (one at a time).
  const [goalId, setGoalId] = useState<string | null>(null);
  useEffect(() => { getSettings().then(st => setGoalId(st.goalReward?.id ?? null)).catch(() => {}); }, []);

  // Anonymous view count for the partner's monthly report.
  useEffect(() => { logRewardView(rewardId); }, [rewardId]);

  // The reward comes from PACEStoreScreen. Reached any other way (there is no
  // deep link to this screen), it shows the "not found" state below.
  const reward = passedReward;

  if (!reward) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <Pressable style={s.backBtnPlain} onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Back">
          <CaretLeft size={18} color={C.t1} weight="bold" />
        </Pressable>
      </View>
    );
  }

  const lock = lockStateFor(reward);
  const alreadyMine = reward.redeemed === true || !!redeemedMsg;
  const canAfford = paceBalance >= reward.paceCost;
  const plusLocked = lock.kind === 'plus' || failReason === 'plus_only';
  const LockIcon = lock.kind === 'plus' ? Crown : Lock;

  const isGoal = goalId === reward.id;
  const toggleGoal = async () => {
    Haptics.selectionAsync();
    const st = await getSettings();
    const next = isGoal ? null : { id: reward.id, brand: reward.brand, valueLabel: reward.valueLabel, paceCost: reward.paceCost };
    await saveSettings({ ...st, goalReward: next });
    setGoalId(next?.id ?? null);
  };

  const shareCode = () => {
    if (!code) return;
    Haptics.selectionAsync();
    Share.share({ message: `${reward.brand}: ${code}` }).catch(() => {});
  };

  // Spending PACE is not undoable, so the button asks first rather than redeeming on one tap.
  const handleClaim = () => {
    if (redeeming || redeemedMsg || lock.blocked || reward.redeemed) return;
    Alert.alert(
      `Redeem ${reward.brand}?`,
      `${reward.valueLabel} for ${reward.paceCost} PACE. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Redeem for ${reward.paceCost} PACE`, onPress: () => { void redeemNow(); } },
      ],
    );
  };

  const redeemNow = async () => {
    if (redeeming || redeemedMsg || lock.blocked || reward.redeemed) return;
    setErrorMsg(null);
    setRedeeming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await redeemReward(reward.id);
      if (result.success) {
        setCode(result.code);
        setHowToUse(result.howToUse);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result.newBalance != null) {
          setPaceBalance(result.newBalance);
          // Keep the locally-cached player balance in sync so the dashboard/
          // store hero doesn't show a stale number until the next pull.
          const player = await getPlayer();
          if (player) await savePlayer({ ...player, paceBalance: result.newBalance });
        }
        setRedeemedMsg(result.held ? result.message
          : result.code ? 'Redeemed. Show this code at checkout.' : "Redeemed. We'll email your code within 24 hours.");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFailReason(result.reason);
        setErrorMsg(result.message);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg('Redemption failed. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  const CATEGORY_LABEL: Record<string, string> = { gear: 'Gear', nutrition: 'Fuel', events: 'Races', tech: 'Tech' };

  return (
    <View style={s.root}>
      {/* Brand hero */}
      <View style={[s.hero, { backgroundColor: reward.brandColor, paddingTop: insets.top + 8 }]}>
        <View style={[s.heroTop, { top: insets.top + 8 }]}>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Back">
            <ArrowLeft size={16} color={C.alwaysLight} strokeWidth={1.8} />
          </Pressable>
          <View style={s.heroChip}>
            <Text style={s.heroChipText}>{CATEGORY_LABEL[reward.category] ?? 'Reward'} · Partner</Text>
          </View>
        </View>
        <Text style={s.brand}>{reward.brand}</Text>
        <Text style={s.heroValue} numberOfLines={1} adjustsFontSizeToFit>{reward.valueLabel}</Text>
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {lock.blocked && !alreadyMine && (
          <View style={[s.lockBanner, lock.kind === 'plus' && s.lockBannerPlus]}>
            <LockIcon size={15} color={lock.kind === 'plus' ? C.gold : C.t2} strokeWidth={2.2} />
            <Text style={[s.lockBannerText, lock.kind === 'plus' && { color: C.gold }]}>{lock.label}</Text>
          </View>
        )}

        {/* Cost vs balance */}
        <View style={s.costRow}>
          <View>
            <Text style={s.costLabel}>Cost</Text>
            <Text style={s.costNum}>{reward.paceCost.toLocaleString()} <Text style={s.costUnit}>PACE</Text></Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.costLabel}>You have</Text>
            <Text style={s.costNum}>{paceBalance.toLocaleString()}</Text>
          </View>
        </View>

        <Text style={s.description}>{reward.description}{reward.description.trim().endsWith('.') ? '' : '.'} One code per runner.</Text>
        {!!reward.expiresLabel && <Text style={s.expires}>{reward.expiresLabel}</Text>}
        {!canAfford && !alreadyMine && !lock.blocked && (
          <>
            <Text style={s.needMore}>You need {reward.paceCost - paceBalance} more PACE</Text>
            <Pressable style={[s.codeShare, { alignSelf: 'flex-start', marginBottom: 16 }]} onPress={toggleGoal} accessibilityRole="button">
              <Text style={s.codeShareText}>{isGoal ? 'Saving for this ✓ · Stop' : 'Save for this'}</Text>
            </Pressable>
          </>
        )}

        {code ? (
          <View style={s.codeCard}>
            <Text style={s.codeLabel}>Your code</Text>
            <Text style={s.codeText} selectable adjustsFontSizeToFit numberOfLines={1}>{code}</Text>
            {!!howToUse && <Text style={s.codeHow}>{howToUse}</Text>}
            <Pressable style={s.codeShare} onPress={shareCode} accessibilityRole="button">
              <Share2 size={15} color={C.t1} strokeWidth={2.2} />
              <Text style={s.codeShareText}>Copy or share</Text>
            </Pressable>
          </View>
        ) : null}

        {alreadyMine ? (
          <View style={s.redeemedRow}>
            <SealCheck size={18} color={C.green} weight="fill" />
            <Text style={s.redeemedText}>{redeemedMsg ?? (code ? 'Redeemed. Show this code at checkout.' : 'You redeemed this reward.')}</Text>
          </View>
        ) : plusLocked ? (
          <Pressable style={[s.claimBtn, s.plusBtn]} onPress={() => navigation.navigate('Subscription')} accessibilityRole="button">
            <Crown size={16} color={C.alwaysLight} strokeWidth={2.2} />
            <Text style={s.claimBtnText}>Get Runivo Plus</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[s.claimBtn, (!canAfford || redeeming || lock.blocked) && s.claimBtnDisabled]}
              onPress={handleClaim}
              disabled={!canAfford || redeeming || lock.blocked}
            >
              {redeeming
                ? <ActivityIndicator size="small" color={C.alwaysLight} />
                : (
                  <>
                    {!lock.blocked && canAfford && <Gift size={20} color={C.alwaysLight} strokeWidth={1.8} />}
                    <Text style={s.claimBtnText}>
                      {lock.blocked ? (lock.label ?? 'Not available') : canAfford ? `Redeem for ${reward.paceCost} PACE` : 'Not enough PACE'}
                    </Text>
                  </>
                )}
            </Pressable>
            {errorMsg ? <Text style={s.errorText}>{errorMsg}</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:               { flex: 1, backgroundColor: C.bg },
    hero:               { paddingHorizontal: 18, paddingBottom: 26, height: 300, justifyContent: 'flex-end' },
    heroTop:            { position: 'absolute', top: 0, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroChip:           { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    heroChipText:       { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.alwaysLight },
    backBtn:            { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
    backBtnPlain:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.gutter, marginTop: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    heroBrandRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28 },
    brandCircle:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.alwaysLight },
    brandInitial:       { fontFamily: Fonts.bold, fontSize: 14, color: C.alwaysDark },
    brand:              { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    heroValue:          { ...Type.hero, fontSize: 52, lineHeight: 46, color: C.alwaysLight, marginTop: 8 },
    costRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
    costLabel:          { ...Type.labelSm, color: C.t2 },
    costNum:            { fontFamily: Fonts.numeric, fontSize: 40, lineHeight: 36, color: C.t1, marginTop: 6, fontVariant: ['tabular-nums'] },
    costUnit:           { fontFamily: Fonts.numeric, fontSize: 16, color: C.t3 },
    needMore:           { ...Type.label, color: C.red, marginTop: 10 },
    content:            { flex: 1, paddingHorizontal: 18, paddingTop: 18 },
    title:              { ...Type.displaySm, color: C.t1, marginBottom: 8 },
    description:        { fontFamily: Fonts.regular, fontSize: 14.5, lineHeight: 22, color: C.t2, marginBottom: 14 },
    expires:            { ...Type.caption, color: C.t3, marginTop: 8 },
    breakdownCard:      {
      backgroundColor: C.card, borderRadius: Spacing.radius.lg, padding: 16, gap: 14, marginVertical: 22,
      shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1,
    },
    breakdownRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    breakdownRowLast:   { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
    breakdownLabel:     { ...Type.bodySm, color: C.t2 },
    breakdownValue:     { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, fontVariant: ['tabular-nums'] },
    breakdownValueBig:  { fontFamily: Fonts.numeric, fontSize: 28, lineHeight: 30, color: C.t1, fontVariant: ['tabular-nums'] },
    breakdownUnit:      { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red },
    breakdownNegative:  { color: C.red },
    claimBtn:           { backgroundColor: C.red, borderRadius: 999, height: 52, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    claimBtnDisabled:   { opacity: 0.45 },
    claimBtnText:       { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    errorText:          { ...Type.caption, color: C.red, textAlign: 'center' },
    redeemedRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.greenLo, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 18 },
    redeemedText:       { fontFamily: Fonts.medium, fontSize: 14, color: C.green, flexShrink: 1, textAlign: 'center' },
    lockBanner:         { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
    lockBannerPlus:     { backgroundColor: C.goldBg, borderColor: C.goldBg },
    lockBannerText:     { ...Type.label, color: C.t2 },
    plusBtn:            { backgroundColor: C.t1, flexDirection: 'row', gap: 8 },
    codeCard:           {
      backgroundColor: C.card, borderRadius: Spacing.radius.lg, padding: 18, marginBottom: 16, alignItems: 'center',
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border,
    },
    codeLabel:          { ...Type.label, color: C.t2 },
    codeText:           { fontFamily: Fonts.numeric, fontSize: 44, lineHeight: 48, color: C.t1, letterSpacing: 1, marginTop: 6, fontVariant: ['tabular-nums'] },
    codeHow:            { ...Type.bodySm, color: C.t2, textAlign: 'center', marginTop: 8 },
    codeShare:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.bg },
    codeShareText:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
  });
}
