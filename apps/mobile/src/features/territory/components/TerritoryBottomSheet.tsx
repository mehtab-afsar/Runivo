import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TerritoryDetails } from '../types';
import type { TerritoryTier } from '@shared/types/game';

function freshnessColor(f: number): string {
  if (f >= 70) return '#D93518';
  if (f >= 40) return '#EAB308';
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
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(300);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const daysSince = Math.floor((Date.now() - new Date(polygon.claimedAt).getTime()) / 86_400_000);
  const claimedLabel = daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`;
  const fColor = freshnessColor(polygon.freshness);

  return (
    <Animated.View style={[ss.sheet, { bottom: insets.bottom + 8 }, animStyle]}>
      <View style={ss.handle} />

      <Pressable style={ss.closeBtn} onPress={onClose}>
        <X size={18} color="#7A7A7A" strokeWidth={2} />
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

const ss = StyleSheet.create({
  sheet:     { position: 'absolute', left: 16, right: 16, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, zIndex: 40, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0DFDD', alignSelf: 'center', marginBottom: 12 },
  closeBtn:  { position: 'absolute', top: 16, right: 16 },
  tierRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tierBadge: { backgroundColor: 'rgba(217,53,24,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tierText:  { fontFamily: 'Barlow_600SemiBold', fontSize: 11, color: '#D93518', letterSpacing: 0.5 },
  parkLabel: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#4CAF50' },
  ownerName: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: '#0A0A0A', marginBottom: 2 },
  meta:      { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#7A7A7A', marginBottom: 2 },
  claimed:   { fontFamily: 'Barlow_400Regular', fontSize: 12, color: '#ADADAD', marginBottom: 10 },
  trackBg:   { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#F0EDE8', overflow: 'hidden', marginBottom: 14 },
  trackFill: { height: '100%', borderRadius: 3 },
  defendBtn: { backgroundColor: '#D93518', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  defendText:{ fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: '#fff' },
});
