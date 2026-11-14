import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, useIsDark, Type, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';
import { convertKm, convertPaceStringPerKm } from '@mobile/shared/lib/formatters';

interface RunHUDProps {
  distance: number;
  pace: string;
  elapsed: number;
  liveAreaM2?: number;
  unit?: 'km' | 'mi';
  /** Shown after "Distance ·" in the eyebrow, e.g. "Running" / "Paused". */
  stateLabel?: string;
  /** Current lap (whole km/mi + 1) and its pace, shown on the right. */
  lap?: { n: number; pace: string } | null;
  /** Pace on foot, average speed on a ride. */
  metric?: 'pace' | 'speed';
  /** For the tap-to-switch slot (L5): current pace and climb. */
  gpsPoints?: { lat: number; lng: number; timestamp: number }[];
  elevationGainM?: number;
  /** The zone column: off for rides, which don't claim. */
  showZone?: boolean;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatArea(m2: number): string {
  if (m2 >= 100_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  return `${Math.round(m2).toLocaleString()} m²`;
}

type SlotMode = 'avg' | 'now' | 'climb';
let lastMode: SlotMode = 'avg'; // remembered across runs in this session

/** Pace or speed over the last ~30 s of GPS (L5). */
function recentRate(points: { lat: number; lng: number; timestamp: number }[] | undefined): number | null {
  if (!points || points.length < 2) return null;
  const end = points[points.length - 1];
  let i = points.length - 2;
  while (i > 0 && end.timestamp - points[i].timestamp < 30_000) i--;
  const sec = (end.timestamp - points[i].timestamp) / 1000;
  if (sec < 8) return null;
  let m = 0;
  for (let j = i + 1; j < points.length; j++) {
    const a = points[j - 1], b = points[j];
    const dLat = (b.lat - a.lat) * 111_320, dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
    m += Math.sqrt(dLat * dLat + dLng * dLng);
  }
  return m > 5 ? m / sec : null; // metres per second
}

export default function RunHUD({ distance, pace, elapsed, liveAreaM2, unit = 'km', stateLabel, lap, metric = 'pace', showZone = true, gpsPoints, elevationGainM }: RunHUDProps) {
  const [mode, setMode] = useState<SlotMode>(lastMode);
  const cycle = () => { const n: SlotMode = mode === 'avg' ? 'now' : mode === 'now' ? 'climb' : 'avg'; lastMode = n; setMode(n); Haptics.selectionAsync(); };
  const mps = mode === 'now' ? recentRate(gpsPoints) : null;
  const perUnitM = unit === 'mi' ? 1609.344 : 1000;
  const nowValue = mps == null ? '—' : metric === 'speed'
    ? (mps * 3.6 * (unit === 'mi' ? 0.621371 : 1)).toFixed(1)
    : (() => { const sp = perUnitM / mps; return sp > 1800 ? '—' : `${Math.floor(sp / 60)}:${String(Math.round(sp % 60)).padStart(2, '0')}`; })();
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const ss = useMemo(() => mkStyles(C), [C]);
  const displayDistance = convertKm(distance, unit);
  const displayPace = convertPaceStringPerKm(pace, unit);
  const hasArea = !!liveAreaM2 && liveAreaM2 > 0;
  const speed = elapsed > 0 ? displayDistance / (elapsed / 3600) : 0;

  return (
    <View style={ss.container}>
      {/*
        maxFontSizeMultiplier caps are deliberate: this panel is read mid-stride
        in a fixed-height sheet. Capping still lets numbers grow ~20-30% for
        larger accessibility sizes (Apple HIG allows capping large numerics).
      */}
      <View style={ss.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={ss.eyebrow} maxFontSizeMultiplier={1.3}>
            Distance{stateLabel ? ` · ${stateLabel}` : ''}
          </Text>
          <View style={ss.distanceBlock}>
            <Text style={ss.distanceValue} maxFontSizeMultiplier={1.15}>{displayDistance.toFixed(2)}</Text>
            <Text style={ss.distanceUnit} maxFontSizeMultiplier={1.2}>{unit}</Text>
          </View>
        </View>
        {lap && (
          <View style={ss.lap}>
            <Text style={ss.lapLabel} maxFontSizeMultiplier={1.2}>Lap {lap.n}{metric === 'speed' ? ` · ${unit}/h` : ''}</Text>
            <Text style={ss.lapPace} maxFontSizeMultiplier={1.2}>{lap.pace}</Text>
          </View>
        )}
      </View>

      <View style={ss.stats}>
        <Pressable style={ss.stat} onPress={cycle} accessibilityRole="button" accessibilityHint="Tap to switch between average, current and climb">
          <Text style={ss.statValue} maxFontSizeMultiplier={1.3}>
            {mode === 'climb' ? `${Math.round((elevationGainM ?? 0) * (unit === 'mi' ? 3.28084 : 1))}`
              : mode === 'now' ? nowValue
              : metric === 'speed' ? (speed > 0 ? speed.toFixed(1) : '0.0') : displayPace}
          </Text>
          <Text style={ss.statLabel} maxFontSizeMultiplier={1.3}>
            {mode === 'climb' ? `Climb ${unit === 'mi' ? 'ft' : 'm'} ⇄`
              : mode === 'now' ? (metric === 'speed' ? `Now ${unit}/h ⇄` : `Now /${unit} ⇄`)
              : metric === 'speed' ? `Avg ${unit}/h ⇄` : `Avg /${unit} ⇄`}
          </Text>
        </Pressable>
        <View style={[ss.stat, ss.statDivided]}>
          <Text style={ss.statValue} maxFontSizeMultiplier={1.3}>{formatElapsed(elapsed)}</Text>
          <Text style={ss.statLabel} maxFontSizeMultiplier={1.3}>Time</Text>
        </View>
        {showZone && <View style={[ss.stat, ss.statDivided]}>
          <Text style={[ss.statValue, hasArea && { color: zone.own }]} maxFontSizeMultiplier={1.3}>
            {hasArea ? formatArea(liveAreaM2!).replace(/ (k?m²)$/, '') : '—'}
          </Text>
          <Text style={ss.statLabel} maxFontSizeMultiplier={1.3}>{hasArea && liveAreaM2! >= 100_000 ? 'Zone km²' : 'Zone m²'}</Text>
        </View>}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container:     { backgroundColor: C.card, paddingTop: 0, paddingHorizontal: 20 },
    // stats: no bottom rule; the loop row sits under it in the sheet.
    topRow:        { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    eyebrow:       { ...Type.labelSm, color: C.t2 },
    distanceBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
    distanceValue: { fontFamily: Fonts.numeric, fontSize: 96, lineHeight: 84, letterSpacing: -1, color: C.t1, fontVariant: ['tabular-nums'] },
    distanceUnit:  { fontFamily: Fonts.bold, fontSize: 22, letterSpacing: -0.5, color: C.t3 },
    lap:           { alignItems: 'flex-end', paddingBottom: 10 },
    lapLabel:      { ...Type.labelSm, color: C.t2 },
    lapPace:       { fontFamily: Fonts.numeric, fontSize: 24, lineHeight: 24, color: C.t1, marginTop: 4, fontVariant: ['tabular-nums'] },
    stats:         { flexDirection: 'row', marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
    stat:          { flex: 1, paddingVertical: 12 },
    statDivided:   { borderLeftWidth: 1, borderColor: C.border, paddingLeft: 14 },
    statValue:     { fontFamily: Fonts.numeric, fontSize: 28, lineHeight: 26, color: C.t1, fontVariant: ['tabular-nums'] },
    statLabel:     { ...Type.labelSm, color: C.t2, marginTop: 5 },
  });
}
