import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { X } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TerritoryDetails } from '../types';
import type { TerritoryTier } from '@shared/types/game';
import { useTheme, Fonts, type AppColors } from '@theme';

function freshnessColor(f: number, C: AppColors): string {
  if (f >= 70) return C.red;
  if (f >= 40) return C.gold;
  return '#EF9F27';
}

const TIER_LABELS: Record<TerritoryTier, string> = {
  patch: 'Patch', block: 'Block', district: 'District', quarter: 'Quarter', domain: 'Domain',
};

interface Props {
  polygon:  TerritoryDetails;
  onClose:  () => void;
  onDefend: () => void;
}

export function TerritoryBottomSheet({ polygon, onClose, onDefend }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(300);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const daysSince = Math.floor((Date.now() - new Date(polygon.claimedAt).getTime()) / 86_400_000);
  const claimedLabel = daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`;
  const fColor = freshnessColor(polygon.freshness, C);

  return (
    <Animated.View style={[ss.sheet, { bottom: insets.bottom + 8 }, animStyle]}>
      <View style={ss.handle} />

      <Pressable style={ss.closeBtn} onPress={onClose}>
        <X size={18} color={C.t2} weight="regular" />
      </Pressable>

      <View style={ss.tierRow}>
        <View style={ss.tierBadge}>
          <Text style={ss.tierText}>{TIER_LABELS[polygon.tier]}</Text>
        </View>
        {polygon.isLoopFill && (
          <Text style={ss.parkLabel}>Park ●</Text>
        )}
      </View>

      <Text style={ss.ownerName}>{polygon.isOwn ? 'Your zone' : polygon.ownerName}</Text>
      <Text style={ss.meta}>{Math.round(polygon.areaM2).toLocaleString()} m² · {polygon.freshness}% fresh</Text>
      <Text style={ss.claimed}>Claimed {claimedLabel}</Text>

      <View style={ss.trackBg}>
        <View style={[ss.trackFill, { width: `${polygon.freshness}%` as any, backgroundColor: fColor }]} />
      </View>

      {polygon.isOwn && (
        <Pressable style={ss.defendBtn} onPress={onDefend}>
          <Text style={ss.defendText}>Defend this zone →</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    sheet:     { position: 'absolute', left: 16, right: 16, backgroundColor: C.white, borderRadius: 16, padding: 16, zIndex: 40, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
    handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 },
    closeBtn:  { position: 'absolute', top: 16, right: 16 },
    tierRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    tierBadge: { backgroundColor: 'rgba(217,53,24,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    tierText:  { fontFamily: Fonts.semiBold, fontSize: 11, color: C.red, letterSpacing: 0.5 },
    parkLabel: { fontFamily: Fonts.regular, fontSize: 11, color: C.green },
    ownerName: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.black, marginBottom: 2 },
    meta:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginBottom: 2 },
    claimed:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, marginBottom: 10 },
    trackBg:   { width: '100%', height: 6, borderRadius: 3, backgroundColor: C.surface, overflow: 'hidden', marginBottom: 14 },
    trackFill: { height: '100%', borderRadius: 3 },
    defendBtn: { backgroundColor: C.red, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    defendText:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.white },
  });
}
