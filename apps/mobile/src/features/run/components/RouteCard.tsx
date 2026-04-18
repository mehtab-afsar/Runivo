import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Activity, Flame, Waves, Mountain, Star, Target, TreePine, RefreshCw, Zap, Route as RouteIcon, Map, Trophy, type LucideIcon } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';

const ROUTE_ICON_MAP: Record<string, { Icon: LucideIcon; color: string }> = {
  run:      { Icon: Activity,  color: '#D93518' },
  flame:    { Icon: Flame,     color: '#EA580C' },
  waves:    { Icon: Waves,     color: '#0EA5E9' },
  mountain: { Icon: Mountain,  color: '#78716C' },
  star:     { Icon: Star,      color: '#F59E0B' },
  target:   { Icon: Target,    color: '#D93518' },
  tree:     { Icon: TreePine,  color: '#15803D' },
  loop:     { Icon: RefreshCw, color: '#7C3AED' },
  zap:      { Icon: Zap,       color: '#EAB308' },
  route:    { Icon: RouteIcon, color: '#6B6B6B' },
  map:      { Icon: Map,       color: '#0284C7' },
  trophy:   { Icon: Trophy,    color: '#D97706' },
};

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
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
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
        {(() => { const entry = ROUTE_ICON_MAP[route.emoji]; return entry ? <entry.Icon size={18} color={entry.color} strokeWidth={1.5} /> : <Activity size={18} color="#D93518" strokeWidth={1.5} />; })()}
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
    icon:  { width: 40, height: 40, borderRadius: 10, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    emoji: { fontSize: 18 },
    info:  { flex: 1 },
    name:  { fontFamily: FONT_MED, fontSize: 13, color: C.black },
    meta:  { fontFamily: FONT_LIGHT, fontSize: 11, color: C.muted, marginTop: 1 },
  });
}
