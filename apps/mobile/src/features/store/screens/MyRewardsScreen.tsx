/**
 * My rewards: every code you redeemed with PACE, newest first, with its
 * status, how to use it, copy/share, and "Mark as used".
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Gift } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { fetchMyRewards, setRewardUsed, type MyReward, type MyRewardStatus } from '../services/myRewardsService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_LABEL: Record<MyRewardStatus, string> = {
  unused: 'Ready to use', pending: 'Code on its way', used: 'Used', expired: 'Expired',
  review: 'Being checked', refunded: 'Refunded',
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function MyRewardsScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const [rows, setRows] = useState<MyReward[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchMyRewards().then(setRows).catch(() => { setFailed(true); setRows([]); });
  }, []);
  useFocusEffect(load);

  const toggleUsed = async (r: MyReward) => {
    const used = r.status !== 'used';
    setRows(prev => (prev ?? []).map(x => x.id === r.id ? { ...x, status: used ? 'used' : (x.code ? 'unused' : 'pending'), usedAt: used ? new Date().toISOString() : null } : x));
    try { await setRewardUsed(r.id, used); }
    catch { Alert.alert("Couldn't save", 'Check your connection and try again.'); load(); }
  };

  const tone = (st: MyRewardStatus) =>
    st === 'unused' ? { bg: C.greenLo, fg: C.green } : st === 'pending' || st === 'review' ? { bg: C.amberBg, fg: C.amber } : { bg: C.surface, fg: C.t3 };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>My rewards</Text>
        <View style={{ width: 32 }} />
      </View>

      {rows === null ? (
        <View style={s.center}><ActivityIndicator color={C.t2} /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Gift size={36} color={C.t3} weight="light" />
              <Text style={s.emptyTitle}>{failed ? "Couldn't load your rewards" : 'No rewards yet'}</Text>
              <Text style={s.emptyText}>{failed ? 'Check your connection and try again.' : 'Spend PACE in the store and your codes will be kept here.'}</Text>
              {!failed && (
                <Pressable style={s.cta} onPress={() => navigation.navigate('PACEStore')} accessibilityRole="button">
                  <Text style={s.ctaTxt}>Open the store</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const t = tone(item.status);
            const dim = item.status === 'used' || item.status === 'expired' || item.status === 'refunded';
            return (
              <Pressable
                style={[s.card, dim && { opacity: 0.6 }]}
                onPress={() => navigation.navigate('RewardDetail', { rewardId: item.rewardId })}
                accessibilityRole="button"
              >
                <View style={s.top}>
                  <View style={[s.brandDot, { backgroundColor: item.brandColor }]}><Text style={s.brandInitial}>{item.brand.slice(0, 1)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.brand} numberOfLines={1}>{item.brand}</Text>
                    <Text style={s.rewardTitle} numberOfLines={2}>{item.title}</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: t.bg }]}><Text style={[s.pillTxt, { color: t.fg }]}>{STATUS_LABEL[item.status]}</Text></View>
                </View>

                {item.code ? (
                  <View style={s.codeRow}>
                    <Text style={s.code} selectable>{item.code}</Text>
                    <Pressable onPress={() => Share.share({ message: `${item.brand}: ${item.code}` }).catch(() => {})} hitSlop={8} accessibilityRole="button">
                      <Text style={s.link}>Share</Text>
                    </Pressable>
                  </View>
                ) : item.status === 'pending' ? (
                  <Text style={s.meta}>We'll email your code within 24 hours of redeeming.</Text>
                ) : item.status === 'review' ? (
                  <Text style={s.meta}>Some recent GPS looked unusual, so we're checking before sending your code. It takes up to 48 hours.</Text>
                ) : item.status === 'refunded' ? (
                  <Text style={s.meta}>This one didn't pass our check. Your {item.paceSpent} PACE was returned.</Text>
                ) : null}
                {!!item.howToUse && item.status === 'unused' && <Text style={s.meta} numberOfLines={3}>{item.howToUse}</Text>}

                <View style={s.foot}>
                  <Text style={s.meta}>
                    {item.paceSpent} PACE · {shortDate(item.redeemedAt)}
                    {item.expiresAt ? ` · ${item.status === 'expired' ? 'ended' : 'use by'} ${shortDate(item.expiresAt)}` : ''}
                  </Text>
                  {item.code && item.status !== 'expired' && (
                    <Pressable onPress={() => toggleUsed(item)} hitSlop={8} accessibilityRole="button">
                      <Text style={s.link}>{item.status === 'used' ? 'Mark unused' : 'Mark as used'}</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
    backBtn:  { width: 32, height: 32, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    title:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list:     { paddingHorizontal: 18, paddingBottom: 40, gap: 10 },
    card:     { backgroundColor: C.card, borderRadius: 22, padding: 14 },
    top:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandDot: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    brandInitial: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    brand:    { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    rewardTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, marginTop: 1 },
    pill:     { height: 22, paddingHorizontal: 9, borderRadius: 11, justifyContent: 'center' },
    pillTxt:  { fontFamily: Fonts.semiBold, fontSize: 11 },
    codeRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
    code:     { fontFamily: Fonts.numeric, fontSize: 18, color: C.t1, letterSpacing: 1 },
    link:     { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1, textDecorationLine: 'underline' },
    meta:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 8, flexShrink: 1 },
    foot:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    empty:    { alignItems: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 24 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    emptyText:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center' },
    cta:      { marginTop: 10, height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.t1, justifyContent: 'center' },
    ctaTxt:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
  });
}
