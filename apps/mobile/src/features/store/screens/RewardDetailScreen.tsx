import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Share, Alert, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CaretLeft, SealCheck, Coffee, Flag as FlagIcon, Sneaker } from 'phosphor-react-native';
import { Lock, Crown, ArrowLeft, Gift } from '@mobile/shared/icons/lucideCompat';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from '@theme/hapticsGated';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';
import { getPlayer, savePlayer, getSettings, saveSettings } from '@shared/services/store';
import { redeemReward, logRewardView } from '../services/rewardService';
import { lockStateFor } from '../lockState';
import { fetchMyRewards, setRewardUsed, type MyReward } from '../services/myRewardsService';
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

  // Your redemption of this reward, for "Mark as used" (newest first).
  const [mine, setMine] = useState<MyReward | null>(null);
  const [markBusy, setMarkBusy] = useState(false);
  const ownsIt = reward?.redeemed === true || !!redeemedMsg;
  useEffect(() => {
    if (!ownsIt || !reward) return;
    fetchMyRewards().then(list => setMine(list.filter(r => r.rewardId === reward.id).sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt))[0] ?? null)).catch(() => {});
  }, [ownsIt, reward]);

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
  const toggleUsed = async () => {
    if (!mine) return;
    setMarkBusy(true);
    try {
      await setRewardUsed(mine.id, !mine.usedAt);
      setMine({ ...mine, usedAt: mine.usedAt ? null : new Date().toISOString() });
    } catch { Alert.alert("Couldn't update that", 'Check your connection and try again.'); }
    finally { setMarkBusy(false); }
  };
  const openDirections = () => {
    const q = encodeURIComponent(reward.brand);
    Linking.openURL(Platform.OS === 'ios' ? `maps://?q=${q}` : `geo:0,0?q=${q}`).catch(() => Linking.openURL(`https://www.google.com/maps/search/${q}`));
  };
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
      {/* Hero (mock): mint panel, status chip, icon, offer and partner. */}
      <View style={[s.hero, { paddingTop: insets.top + 8 }]}>
        <View style={s.heroTop}>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Back to store">
            <ArrowLeft size={18} color="#17181A" strokeWidth={2} />
          </Pressable>
          <View style={s.heroChip}>
            <Text style={s.heroChipText}>{alreadyMine ? `Redeemed · ${reward.paceCost} PACE` : `${reward.paceCost} PACE · ${CATEGORY_LABEL[reward.category] ?? 'Reward'}`}</Text>
          </View>
        </View>
        <View style={s.heroMid}>
          <View style={s.heroIcon}>
            {reward.category === 'nutrition' ? <Coffee size={30} color="#4E7F1F" weight="bold" />
              : reward.category === 'events' ? <FlagIcon size={30} color="#4E7F1F" weight="bold" />
              : <Sneaker size={30} color="#4E7F1F" weight="bold" />}
          </View>
          <Text style={s.heroValue} numberOfLines={2}>{reward.title}</Text>
          <Text style={s.brand}>{reward.brand}{reward.valueLabel ? ` · ${reward.valueLabel}` : ''}</Text>
        </View>
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
          <>
            <View style={s.codeCard}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.codeLabel}>Your code</Text>
                <Text style={s.codeText} selectable adjustsFontSizeToFit numberOfLines={1}>{code}</Text>
              </View>
              <Pressable style={s.copyBtn} onPress={shareCode} accessibilityRole="button" accessibilityLabel="Copy or share your code">
                <Text style={s.copyTxt}>Copy</Text>
              </Pressable>
            </View>
            {!!howToUse && (
              <View style={{ gap: 10, marginBottom: 16 }}>
                <Text style={s.howTitle}>How to use it</Text>
                {howToUse.split(/(?<=\.)\s+/).filter(Boolean).slice(0, 4).map((step, i) => (
                  <View key={i} style={s.stepRow}>
                    <View style={s.stepNum}><Text style={s.stepNumTxt}>{i + 1}</Text></View>
                    <Text style={s.stepTxt}>{step}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}

        {alreadyMine ? (
          <>
            <View style={s.redeemedRow}>
              <SealCheck size={18} color={C.green} weight="fill" />
              <Text style={s.redeemedText}>{mine?.usedAt ? 'Marked as used.' : redeemedMsg ?? (code ? 'Redeemed. Show this code at checkout.' : 'You redeemed this reward.')}</Text>
            </View>
            {/* Mock: Directions + Mark as used */}
            <View style={s.twoBtns}>
              <Pressable style={s.ghostBtn} onPress={openDirections} accessibilityRole="button" accessibilityHint={`Finds ${reward.brand} near you in Maps`}>
                <Text style={s.ghostTxt}>Directions</Text>
              </Pressable>
              {mine && (
                <Pressable style={[s.darkBtn, markBusy && { opacity: 0.6 }]} onPress={toggleUsed} disabled={markBusy} accessibilityRole="button">
                  <Text style={s.darkTxt}>{mine.usedAt ? 'Mark as unused' : 'Mark as used'}</Text>
                </Pressable>
              )}
            </View>
          </>
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
    root:               { flex: 1, backgroundColor: C.card },
    hero:               { paddingHorizontal: 20, paddingBottom: 26, backgroundColor: '#EEF5E4', borderBottomLeftRadius: 36, borderBottomRightRadius: 36, gap: 20 },
    heroMid:            { alignItems: 'center', gap: 10 },
    heroIcon:           { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    heroTop:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroChip:           { backgroundColor: '#C9F06B', borderRadius: 16, paddingHorizontal: 12, height: 32, justifyContent: 'center' },
    heroChipText:       { fontFamily: Fonts.semiBold, fontSize: 13, color: '#17181A' },
    backBtn:            { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    backBtnPlain:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.gutter, marginTop: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    heroBrandRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28 },
    brandCircle:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.alwaysLight },
    brandInitial:       { fontFamily: Fonts.bold, fontSize: 14, color: C.alwaysDark },
    brand:              { fontFamily: Fonts.regular, fontSize: 14, color: '#4E5A44', textAlign: 'center' },
    heroValue:          { fontFamily: Fonts.medium, fontSize: 28, lineHeight: 33, letterSpacing: -0.5, color: '#17181A', textAlign: 'center' },
    costRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
    costLabel:          { ...Type.labelSm, color: C.t2 },
    costNum:            { fontFamily: Fonts.numeric, fontSize: 40, lineHeight: 36, color: C.t1, marginTop: 6, fontVariant: ['tabular-nums'] },
    costUnit:           { fontFamily: Fonts.numeric, fontSize: 16, color: C.t3 },
    needMore:           { ...Type.label, color: C.red, marginTop: 10 },
    content:            { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
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
    claimBtn:           { backgroundColor: C.alwaysDark, borderRadius: 28, height: 56, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    claimBtnDisabled:   { opacity: 0.45 },
    claimBtnText:       { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    errorText:          { ...Type.caption, color: C.danger, textAlign: 'center' },
    redeemedRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.greenLo, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 18 },
    redeemedText:       { fontFamily: Fonts.medium, fontSize: 14, color: C.green, flexShrink: 1, textAlign: 'center' },
    lockBanner:         { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
    lockBannerPlus:     { backgroundColor: C.goldBg, borderColor: C.goldBg },
    lockBannerText:     { ...Type.label, color: C.t2 },
    plusBtn:            { backgroundColor: C.t1, flexDirection: 'row', gap: 8 },
    codeCard:           {
      flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, padding: 18, marginBottom: 16,
      borderWidth: 2, borderStyle: 'dashed', borderColor: '#CFD3CA',
    },
    twoBtns:            { flexDirection: 'row', gap: 10, marginTop: 12 },
    ghostBtn:           { flex: 1, height: 54, borderRadius: 27, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    ghostTxt:           { fontFamily: Fonts.medium, fontSize: 16, color: C.t1 },
    darkBtn:            { flex: 1, height: 54, borderRadius: 27, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    darkTxt:            { fontFamily: Fonts.medium, fontSize: 16, color: C.alwaysLight },
    copyBtn:            { height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: C.alwaysDark, justifyContent: 'center' },
    copyTxt:            { fontFamily: Fonts.medium, fontSize: 14, color: C.alwaysLight },
    howTitle:           { fontFamily: Fonts.medium, fontSize: 17, color: C.t1 },
    stepRow:            { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    stepNum:            { width: 26, height: 26, borderRadius: 13, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    stepNumTxt:         { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    stepTxt:            { flex: 1, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: C.t1 },
    codeLabel:          { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    codeText:           { fontFamily: Fonts.semiBold, fontSize: 26, color: C.t1, letterSpacing: 2 },
    codeHow:            { ...Type.bodySm, color: C.t2, textAlign: 'center', marginTop: 8 },
    codeShare:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.bg },
    codeShareText:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
  });
}
