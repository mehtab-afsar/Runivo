/** Live screen: where the zone you're defending or attacking is (PRD M1). */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationArrow, Crosshair } from 'phosphor-react-native';
import { useTheme, Fonts, feedback, type AppColors } from '@theme';
import { targetProgress, type TargetZone } from '@shared/engine/targetZone';

interface Props { zone: TargetZone; position: { lat: number; lng: number } | null; running: boolean }

export default function TargetZoneChip({ zone, position, running }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const p = position ? targetProgress(position, zone) : null;
  const wasInside = useRef(false);

  // One strong cue on entering the zone.
  useEffect(() => {
    if (!p || !running) return;
    if (p.inside && !wasInside.current) feedback.workoutStep();
    wasInside.current = p.inside;
  }, [p?.inside, running]); // eslint-disable-line react-hooks/exhaustive-deps

  const verb = zone.mode === 'defend' ? 'Defend' : 'Take';
  const line = !p
    ? 'Directions appear once GPS locks'
    : p.inside
      ? zone.mode === 'defend' ? "You're in. Run through it to refresh it." : "You're in. Close a loop around it to take it."
      : `${p.distanceM >= 1000 ? `${(p.distanceM / 1000).toFixed(1)} km` : `${Math.round(p.distanceM / 10) * 10} m`} ${p.direction}`;

  return (
    <View style={[s.chip, p?.inside && { backgroundColor: C.greenLo }]} accessibilityLiveRegion="polite">
      {p && !p.inside
        ? <View style={{ transform: [{ rotate: `${p.bearing - 45}deg` }] }}><NavigationArrow size={18} color={C.t1} weight="fill" /></View>
        : <Crosshair size={18} color={p?.inside ? C.green : C.t2} weight="bold" />}
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{verb} {zone.name}</Text>
        <Text style={s.sub} numberOfLines={1}>{line}</Text>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    chip:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
    title: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    sub:   { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 1 },
  });
}
