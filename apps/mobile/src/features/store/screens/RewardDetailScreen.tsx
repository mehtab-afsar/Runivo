import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CaretLeft } from 'phosphor-react-native';
import { useTheme, type AppColors } from '@theme';
import { getPlayer } from '@shared/services/store';
import { HARDCODED_REWARDS } from '../rewards';
import type { RootStackParamList } from '@navigation/AppNavigator';

export default function RewardDetailScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'RewardDetail'>>();
  const { rewardId } = route.params;

  const [paceBalance, setPaceBalance] = useState(0);

  useEffect(() => {
    getPlayer().then(p => { if (p) setPaceBalance(p.paceBalance ?? 0); }).catch(() => {});
  }, []);

  const reward = HARDCODED_REWARDS.find(r => r.id === rewardId);

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

        {/* Claim button */}
        <Pressable
          style={[s.claimBtn, !canAfford && s.claimBtnDisabled]}
          onPress={() => Alert.alert('Coming Soon', 'Reward claiming is coming soon. Keep earning PACE!')}
        >
          <Text style={s.claimBtnText}>Claim Reward</Text>
        </Pressable>
        <Text style={s.comingSoon}>Coming soon — claim will be available shortly</Text>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:               { flex: 1, backgroundColor: C.bg },
    backBtn:            { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginTop: 4 },
    content:            { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
    brandCircle:        { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    brandInitial:       { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 28 },
    brand:              { fontSize: 12, color: C.t3, marginBottom: 4, letterSpacing: 0.8 },
    title:              { fontWeight: '600', fontSize: 22, color: C.black, lineHeight: 28, marginBottom: 10 },
    description:        { fontSize: 14, color: C.t2, lineHeight: 21, marginBottom: 4 },
    divider:            { height: 0.5, backgroundColor: C.border, marginVertical: 20 },
    breakdown:          { gap: 14 },
    breakdownRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    breakdownRowLast:   {},
    breakdownLabel:     { fontSize: 14, color: C.t2 },
    breakdownValue:     { fontWeight: '600', fontSize: 14, color: C.black },
    breakdownNegative:  { color: C.red },
    claimBtn:           { backgroundColor: C.red, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    claimBtnDisabled:   { opacity: 0.5 },
    claimBtnText:       { fontWeight: '600', fontSize: 15, color: '#fff' },
    comingSoon:         { fontSize: 12, color: C.t3, textAlign: 'center' },
  });
}
