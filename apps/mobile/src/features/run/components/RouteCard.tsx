import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { fmtDist, fmtDistShort } from '@mobile/shared/lib/formatters';
import { GlyphBadge } from '@mobile/shared/icons';


export interface RouteItem {
  id: string;
  name: string;
  emoji: string;
  distanceM: number;
  durationSec?: number;
  distanceAwayM?: number;
  username?: string;
}

interface RouteCardProps {
  route: RouteItem;
  onSelect: (route: RouteItem) => void;
  highlighted?: boolean;
}

export default function RouteCard({ route, onSelect, highlighted = false }: RouteCardProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const meta = [
    `${fmtDist(route.distanceM)} km`,
    route.durationSec ? `${Math.floor(route.durationSec / 60)} min` : null,
    route.username ? route.username : null,
    route.distanceAwayM != null ? `${fmtDistShort(route.distanceAwayM)} km away` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={[ss.row, highlighted && { backgroundColor: C.blueBg }]}
      onPress={() => onSelect(route)}
    >
      <GlyphBadge glyph={route.emoji || 'run'} size={40} shape="square" />
      <View style={ss.info}>
        <Text style={ss.name} numberOfLines={1}>{route.name}</Text>
        {meta ? <Text style={ss.meta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.stone, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 10 },
    emoji: { fontSize: 18 },
    info:  { flex: 1 },
    name:  { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
    meta:  { fontFamily: Fonts.light, fontSize: 11, color: C.muted, marginTop: 1 },
  });
}
