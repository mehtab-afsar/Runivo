import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { Shield, Swords, Share as ShareIcon, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import type { TerritoryDetails } from '../types';
import type { TerritoryTier } from '@shared/types/game';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette, type TerritoryPalette } from '@theme/territory';
import { ENGINE, zoneScore } from '@shared/engine/runEngine';

const TIER_LABELS: Record<TerritoryTier, string> = {
  patch: 'Patch', block: 'Block', district: 'District', quarter: 'Quarter', domain: 'Domain',
};

/** Same colour the map paints this zone, so the sheet and the map agree. */
function zoneColor(p: TerritoryDetails, z: TerritoryPalette): string {
  const fresh = p.freshness >= ENGINE.FRESHNESS_STALE_AT;
  if (p.isOwn) return fresh ? z.own : z.ownFading;
  return fresh ? z.rival : z.rivalFading;
}

/** "0.18" km² for real zones, square metres for tiny ones. */
function areaParts(m2: number): { value: string; unit: string } {
  if (m2 >= 10_000) return { value: (m2 / 1_000_000).toFixed(2), unit: 'km²' };
  return { value: Math.round(m2).toLocaleString(), unit: 'm²' };
}

function claimedOn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * A name for the zone from the phone's own geocoder (Apple / Google, through
 * expo-location): the place or street at its centre. Falls back to
 * "District zone" when there's no answer.
 */
function useZoneName(polygon: TerritoryDetails): string {
  const fallback = `${TIER_LABELS[polygon.tier]} zone`;
  const [name, setName] = useState<string>(fallback);
  useEffect(() => {
    setName(fallback);
    if (!polygon.center) return;
    let cancelled = false;
    const [lng, lat] = polygon.center;
    Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
      .then(results => {
        const r = results?.[0];
        const found = r?.name && !/^\d/.test(r.name) ? r.name : (r?.street ?? r?.district ?? null);
        if (!cancelled && found) setName(found);
      })
      .catch(() => { /* keep the fallback */ });
    return () => { cancelled = true; };
  }, [polygon.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return name;
}

interface Props {
  polygon:  TerritoryDetails;
  onClose:  () => void;
  /** Called with the zone's display name. */
  onDefend: (zoneName: string) => void;
}

export function TerritoryBottomSheet({ polygon, onClose, onDefend }: Props) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const ss = useMemo(() => mkStyles(C), [C]);
  const translateY = useSharedValue(300);
  const name = useZoneName(polygon);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const color = zoneColor(polygon, zone);
  const fading = polygon.freshness < ENGINE.FRESHNESS_STALE_AT;
  const tier = TIER_LABELS[polygon.tier];
  const area = areaParts(polygon.areaM2);
  const score = Math.round(zoneScore(polygon.areaM2, polygon.freshness));
  const freshPct = Math.max(0, Math.min(100, polygon.freshness));
  const chipText = polygon.isOwn ? `Yours · ${tier}` : `${polygon.ownerName || 'Rival'} · ${tier}`;
  const chipBg = polygon.isOwn ? C.redLo : C.bg;

  const share = () => {
    Share.share({
      message: polygon.isOwn
        ? `I hold ${name} on Runivo: ${area.value} ${area.unit}, ${freshPct}% fresh. Come and take it.`
        : `${name} on Runivo is held by ${polygon.ownerName}. I'm going to take it.`,
    }).catch(() => {});
  };

  return (
    <Animated.View style={[ss.sheet, animStyle]}>
      <View style={ss.handle} />

      <View style={ss.topRow}>
        <View style={[ss.chip, { backgroundColor: chipBg }]}>
          <Text style={[ss.chipText, { color }]} numberOfLines={1}>{chipText}</Text>
        </View>
        <View style={ss.topRight}>
          {!!claimedOn(polygon.claimedAt) && <Text style={ss.claimed}>Claimed {claimedOn(polygon.claimedAt)}</Text>}
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={ss.closeBtn}>
            <X size={16} color={C.t2} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <Text style={ss.name} numberOfLines={1}>{name}</Text>

      <View style={ss.stats}>
        <View style={ss.stat}>
          <Text style={ss.statNum}>{area.value}</Text>
          <Text style={ss.statLabel}>{area.unit}</Text>
        </View>
        <View style={ss.stat}>
          <Text style={ss.statNum}>+{score.toLocaleString()}</Text>
          <Text style={ss.statLabel}>Score</Text>
        </View>
        <View style={ss.stat}>
          <Text style={[ss.statNum, { color: zone.own }]}>−{ENGINE.FRESHNESS_DECAY_PER_DAY}%</Text>
          <Text style={ss.statLabel}>Each day</Text>
        </View>
      </View>

      <View style={ss.freshRow}>
        <Text style={ss.freshLabel}>Freshness · fading below {ENGINE.FRESHNESS_STALE_AT}%</Text>
        <Text style={ss.freshVal}>{freshPct}%</Text>
      </View>
      <View style={[ss.trackBg, { backgroundColor: '#ECEAE5' }]}>
        <View style={[ss.trackFill, { width: `${freshPct}%`, backgroundColor: color }]} />
      </View>

      <View style={ss.ctaRow}>
        <Pressable
          style={({ pressed }) => [ss.cta, { backgroundColor: polygon.isOwn ? zone.own : zone.rival }, pressed && ss.pressed]}
          onPress={() => onDefend(name)}
          accessibilityRole="button"
        >
          {polygon.isOwn
            ? <Shield size={20} color={C.alwaysLight} strokeWidth={1.8} />
            : <Swords size={20} color={C.alwaysLight} strokeWidth={1.8} />}
          <Text style={ss.ctaText}>{polygon.isOwn ? (fading ? 'Run to defend' : 'Run to keep it fresh') : 'Run here to take it'}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [ss.shareBtn, pressed && ss.pressed]} onPress={share} accessibilityLabel="Share this zone">
          <ShareIcon size={20} color={C.t1} strokeWidth={1.8} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    sheet:     {
      position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card,
      borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, zIndex: 40,
      shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 12,
    },
    handle:    { width: 38, height: 5, borderRadius: 5, backgroundColor: '#DEDCD6', alignSelf: 'center', marginBottom: 14 },
    topRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    chip:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 1 },
    chipText:  { fontFamily: Fonts.semiBold, fontSize: 11.5 },
    topRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
    claimed:   { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    closeBtn:  { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    name:      { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 26, letterSpacing: -0.6, color: C.t1, marginTop: 10 },
    stats:     { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
    stat:      { flex: 1 },
    statNum:   { fontFamily: Fonts.numeric, fontSize: 24, lineHeight: 24, color: C.t1, fontVariant: ['tabular-nums'] },
    statLabel: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 4 },
    freshRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
    freshLabel:{ fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    freshVal:  { fontFamily: Fonts.bold, fontSize: 12, color: C.t1 },
    trackBg:   { width: '100%', height: 6, borderRadius: 9, overflow: 'hidden', marginBottom: 16 },
    trackFill: { height: '100%', borderRadius: 9 },
    ctaRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cta:       { flex: 1, height: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    ctaText:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    shareBtn:  { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
    pressed:   { opacity: 0.9, transform: [{ scale: 0.985 }] },
  });
}
