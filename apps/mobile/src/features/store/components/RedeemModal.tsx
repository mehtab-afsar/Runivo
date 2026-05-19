import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type AppColors } from '@theme';
import type { Reward } from '../types';

interface Props {
  reward: Reward | null;
  visible: boolean;
  onClose: () => void;
}

export function RedeemModal({ reward, visible, onClose }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(0.88);

  useEffect(() => {
    if (visible) {
      scale.value = 0.88;
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
    }
  }, [visible, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!reward) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheetWrap, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Animated.View style={[s.card, animStyle]}>
          {/* Brand logo */}
          <View style={[s.brandCircle, { backgroundColor: reward.brandColor + '26' }]}>
            <Text style={[s.brandInitial, { color: reward.brandColor }]}>{reward.brandInitial}</Text>
          </View>

          <Text style={s.claimHeading}>Claim your reward</Text>
          <Text style={s.rewardTitle}>{reward.title}</Text>
          <Text style={s.rewardDesc}>{reward.description}</Text>

          <View style={s.divider} />

          <Text style={s.launchRow}>🚀  Launching very soon</Text>
          <Text style={s.launchBody}>
            Brand partnerships are coming to Runivo. Your PACE will be redeemable for real rewards — no action needed now.
          </Text>

          <Pressable style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Close</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
    sheetWrap:    { paddingHorizontal: 24 },
    card:         { backgroundColor: C.white, borderRadius: 20, padding: 24 },
    brandCircle:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
    brandInitial: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 32 },
    claimHeading: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: C.black, textAlign: 'center', marginBottom: 6 },
    rewardTitle:  { fontWeight: '500', fontSize: 15, color: C.black, textAlign: 'center', marginBottom: 8 },
    rewardDesc:   { fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    divider:      { height: 0.5, backgroundColor: C.border, marginBottom: 20 },
    launchRow:    { fontSize: 13, color: C.t2, textAlign: 'center', marginBottom: 6 },
    launchBody:   { fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    closeBtn:     { backgroundColor: C.black, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    closeBtnText: { fontWeight: '600', fontSize: 14, color: C.white },
  });
}
