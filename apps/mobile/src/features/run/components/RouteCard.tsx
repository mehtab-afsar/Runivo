import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Pulse } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { fmtDist, fmtDistShort } from '@mobile/shared/lib/formatters';
import { ROUTE_ICON_MAP } from '@mobile/shared/constants/routeIcons';


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
      <View style={[ss.icon, highlighted && { backgroundColor: C.blueBg }]}>
        {(() => { const entry = ROUTE_ICON_MAP[route.emoji]; return entry ? <entry.Icon size={18} color={entry.color} weight="light" /> : <Pulse size={18} color={C.red} weight="light" />; })()}
      </View>
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
    icon:  { width: 40, height: 40, borderRadius: 10, backgroundColor: C.alwaysLight, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    emoji: { fontSize: 18 },
    info:  { flex: 1 },
    name:  { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
    meta:  { fontFamily: Fonts.light, fontSize: 11, color: C.muted, marginTop: 1 },
  });
}
