import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const C = { stone: '#F0EDE8', border: '#E0DFDD', black: '#0A0A0A', muted: '#6B6B6B', white: '#FFFFFF', red: '#E8391C' };
const FONT       = 'Barlow_400Regular';
const FONT_MED   = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';

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
  const distKm = (route.distanceM / 1000).toFixed(2);
  const meta = [
    `${distKm} km`,
    route.durationSec ? `${Math.floor(route.durationSec / 60)} min` : null,
    route.username ? route.username : null,
    route.distanceAwayM != null ? `${(route.distanceAwayM / 1000).toFixed(1)} km away` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={[ss.row, highlighted && { backgroundColor: '#EFF6FF' }]}
      onPress={() => onSelect(route)}
    >
      <View style={[ss.icon, highlighted && { backgroundColor: '#DBEAFE' }]}>
        <Text style={ss.emoji}>{route.emoji}</Text>
      </View>
      <View style={ss.info}>
        <Text style={ss.name} numberOfLines={1}>{route.name}</Text>
        {meta ? <Text style={ss.meta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.stone, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 10 },
  icon:  { width: 40, height: 40, borderRadius: 10, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emoji: { fontSize: 18 },
  info:  { flex: 1 },
  name:  { fontFamily: FONT_MED, fontSize: 13, color: C.black },
  meta:  { fontFamily: FONT_LIGHT, fontSize: 11, color: C.muted, marginTop: 1 },
});
