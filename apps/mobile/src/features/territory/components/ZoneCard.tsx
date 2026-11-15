/**
 * Map: the compact card for a tapped zone (mock), sitting above the tab bar.
 * Tap it for the full sheet with history; the button defends or attacks.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X } from 'phosphor-react-native';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';
import { ENGINE } from '@shared/engine/runEngine';
import { ZonePreview } from '@mobile/shared/components/ZonePreview';
import type { TerritoryDetails } from '../types';
import { useZoneName, TIER_LABELS } from './TerritoryBottomSheet';

export function ZoneCard({ polygon, bottom, onOpen, onClose, onDefend }: {
  polygon: TerritoryDetails;
  bottom: number;
  onOpen: () => void;
  onClose: () => void;
  onDefend: (name: string) => void;
}) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const s = useMemo(() => mk(C), [C]);
  const name = useZoneName(polygon);
  const fresh = Math.max(0, Math.min(100, Math.round(polygon.freshness)));
  const fading = polygon.freshness < ENGINE.FRESHNESS_STALE_AT;
  const area = polygon.areaM2 >= 100_000 ? `${(polygon.areaM2 / 1_000_000).toFixed(2)} km²` : `${Math.round(polygon.areaM2).toLocaleString()} m²`;
  const ring = polygon.ring && polygon.ring.length >= 3 ? [polygon.ring] : [];

  return (
    <Pressable style={[s.card, { bottom }]} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${name}, ${polygon.isOwn ? 'yours' : `held by ${polygon.ownerName}`}. Open details`}>
      <View style={s.thumb}>
        {ring.length > 0 && (polygon.isOwn
          ? <ZonePreview own={fading ? [] : ring} fading={fading ? ring : []} width={104} height={122} />
          : <ZonePreview own={[]} rivals={ring} width={104} height={122} />)}
      </View>
      <View style={s.body}>
        <View style={s.top}>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><X size={16} color={C.t2} weight="bold" /></Pressable>
        </View>
        <View style={s.metaRow}>
          <View style={[s.tag, { backgroundColor: polygon.isOwn ? C.mint2 : C.amberBg }]}>
            <Text style={[s.tagTxt, { color: polygon.isOwn ? C.green : C.amber }]} numberOfLines={1}>{polygon.isOwn ? 'Yours' : polygon.ownerName || 'Rival'}</Text>
          </View>
          <Text style={s.meta} numberOfLines={1}>{TIER_LABELS[polygon.tier]} · {area}</Text>
        </View>
        <Text style={s.sub}>{fresh}% fresh · fades {ENGINE.FRESHNESS_DECAY_PER_DAY}% a day</Text>
        <Pressable onPress={() => onDefend(name)} hitSlop={6} accessibilityRole="button">
          <Text style={[s.cta, { color: polygon.isOwn ? C.green : zone.rival }]}>{polygon.isOwn ? 'Defend · run a loop here' : 'Take it · run a loop here'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    card:   { position: 'absolute', left: 12, right: 12, borderRadius: 26, backgroundColor: C.card, flexDirection: 'row', overflow: 'hidden', shadowColor: '#17181A', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
    thumb:  { width: 104, backgroundColor: C.bg },
    body:   { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
    top:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    name:   { flex: 1, fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    metaRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
    tag:    { height: 22, paddingHorizontal: 8, borderRadius: 6, justifyContent: 'center', maxWidth: 120 },
    tagTxt: { fontFamily: Fonts.semiBold, fontSize: 13 },
    meta:   { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    sub:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    cta:    { fontFamily: Fonts.semiBold, fontSize: 13 },
  });
}
