import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';

interface RunHUDProps {
  distance: number;
  pace: string;
  elapsed: number;
  liveAreaM2?: number;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RunHUD({ distance, pace, elapsed, liveAreaM2 }: RunHUDProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.container}>
      {/*
        maxFontSizeMultiplier caps below are deliberate, not a Dynamic Type
        opt-out: this HUD is read one-handed, mid-stride, in a fixed-height
        panel. Uncapped iOS accessibility text sizes (up to ~3x) would blow the
        72px hero number and the bordered tri-column row well past this
        container and off-screen. Capping still lets these grow ~20-30% for
        larger accessibility sizes, matching Apple's own HIG allowance for
        capping large numeric displays specifically (unlike ordinary body/label
        text elsewhere in the app, which is intentionally left uncapped).
      */}
      <View style={ss.distanceBlock}>
        <Text style={ss.distanceValue} maxFontSizeMultiplier={1.2}>{distance.toFixed(2)}</Text>
        <Text style={ss.distanceUnit} maxFontSizeMultiplier={1.2}>km</Text>
      </View>
      <View style={ss.secondaryStats}>
        <View style={ss.secondaryStat}>
          <Text style={ss.secondaryValue} maxFontSizeMultiplier={1.3}>{formatElapsed(elapsed)}</Text>
          <Text style={ss.secondaryLabel} maxFontSizeMultiplier={1.3}>TIME</Text>
        </View>
        <View style={[ss.secondaryStat, ss.secondaryStatMid]}>
          <Text style={ss.secondaryValue} maxFontSizeMultiplier={1.3}>{pace}</Text>
          <Text style={ss.secondaryLabel} maxFontSizeMultiplier={1.3}>PACE /KM</Text>
        </View>
        <View style={ss.secondaryStat}>
          <Text style={[ss.secondaryValue, { color: C.green }]} maxFontSizeMultiplier={1.3}>
            {liveAreaM2 && liveAreaM2 > 0 ? `~${Math.round(liveAreaM2).toLocaleString()}` : '—'}
          </Text>
          <Text style={ss.secondaryLabel} maxFontSizeMultiplier={1.3}>ZONE M²</Text>
        </View>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container:        { backgroundColor: C.alwaysDark, paddingTop: 24, paddingBottom: 16, paddingHorizontal: 24 },
    distanceBlock:    { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 16 },
    distanceValue:    { ...Type.metricXL, color: C.alwaysLight, letterSpacing: -2, lineHeight: 76 },
    distanceUnit:     { fontFamily: Fonts.light, fontSize: 22, color: 'rgba(255,255,255,0.4)' },
    secondaryStats:   { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 14 },
    secondaryStat:    { flex: 1, alignItems: 'center' },
    secondaryStatMid: { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
    // Sized for a one-handed glance mid-run (was 20 / 8px @ 35% — illegible while moving).
    secondaryValue:   { ...Type.metricMd, color: C.alwaysLight },
    secondaryLabel:   { fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  });
}
