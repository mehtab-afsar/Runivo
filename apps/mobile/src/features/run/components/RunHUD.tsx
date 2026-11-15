import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { Lightning, PathIcon, Hexagon } from 'phosphor-react-native';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
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

  const paceValue = mode === 'climb' ? `${Math.round((elevationGainM ?? 0) * (unit === 'mi' ? 3.28084 : 1))}`
    : mode === 'now' ? nowValue
    : metric === 'speed' ? (speed > 0 ? speed.toFixed(1) : '0.0') : displayPace;
  const paceLabel = mode === 'climb' ? `Climb ${unit === 'mi' ? 'ft' : 'm'}`
    : mode === 'now' ? (metric === 'speed' ? `Now ${unit}/h` : `Now /${unit}`)
    : metric === 'speed' ? `Avg ${unit}/h` : `Pace /${unit}`;

  // maxFontSizeMultiplier caps are deliberate: read mid-stride in a fixed sheet.
  return (
    <View style={ss.container}>
      <View style={ss.tiles}>
        <Pressable style={ss.tile} onPress={cycle} accessibilityRole="button" accessibilityLabel={`${paceLabel} ${paceValue}`} accessibilityHint="Tap to switch between average, current and climb">
          <View style={[ss.tileIcon, { backgroundColor: C.mint }]}><Lightning size={16} color={C.green} weight="bold" /></View>
          <Text style={ss.tileVal} maxFontSizeMultiplier={1.3}>{paceValue}</Text>
          <Text style={ss.tileLbl} maxFontSizeMultiplier={1.3}>{paceLabel} ⇄</Text>
        </Pressable>
        <View style={ss.tile}>
          <View style={[ss.tileIcon, { backgroundColor: C.amberBg }]}><PathIcon size={16} color={C.amber} weight="bold" /></View>
          <Text style={ss.tileVal} maxFontSizeMultiplier={1.3}>{displayDistance.toFixed(2)}</Text>
          <Text style={ss.tileLbl} maxFontSizeMultiplier={1.3}>{unit === 'mi' ? 'Miles' : 'Kilometres'}</Text>
        </View>
        {showZone && (
          <View style={ss.tile}>
            <View style={[ss.tileIcon, { backgroundColor: C.lavender }]}><Hexagon size={16} color={C.lavenderInk} weight="bold" /></View>
            <Text style={[ss.tileVal, hasArea && { color: zone.own }]} maxFontSizeMultiplier={1.3}>
              {hasArea ? shortArea(liveAreaM2!) : '—'}
            </Text>
            <Text style={ss.tileLbl} maxFontSizeMultiplier={1.3}>{hasArea && liveAreaM2! >= 100_000 ? 'Zone km²' : 'Zone m²'}</Text>
          </View>
        )}
      </View>

      <View style={ss.dock}>
        <Text style={ss.dockLbl} maxFontSizeMultiplier={1.3}>Time{stateLabel ? ` · ${stateLabel}` : ''}</Text>
        <Text style={ss.time} maxFontSizeMultiplier={1.15}>{formatElapsed(elapsed)}</Text>
        <Text style={ss.dockSub} maxFontSizeMultiplier={1.3} numberOfLines={1}>
          <Text style={ss.dockStrong}>{displayDistance.toFixed(2)}</Text> {unit}
          {lap ? ` · lap ${lap.n} ${lap.pace}${metric === 'speed' ? ` ${unit}/h` : ''}` : ''}
        </Text>
      </View>
    </View>
  );
}

/** "18.2K" for big areas, as on the mock's tile. */
function shortArea(m2: number): string {
  if (m2 >= 100_000) return (m2 / 1_000_000).toFixed(2);
  if (m2 >= 10_000) return `${(m2 / 1000).toFixed(1)}K`;
  return Math.round(m2).toLocaleString();
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container:  { backgroundColor: C.card, paddingHorizontal: 16, gap: 10 },
    tiles:      { flexDirection: 'row', gap: 8 },
    tile:       { flex: 1, borderRadius: 20, backgroundColor: C.bg, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 4 },
    tileIcon:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    tileVal:    { fontFamily: Fonts.numeric, fontSize: 20, color: C.t1, fontVariant: ['tabular-nums'] },
    tileLbl:    { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    dock:       { borderRadius: 28, backgroundColor: C.bg, paddingVertical: 14, paddingHorizontal: 20, gap: 2 },
    dockLbl:    { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    time:       { fontFamily: Fonts.numeric, fontSize: 38, lineHeight: 44, letterSpacing: -1, color: C.t1, fontVariant: ['tabular-nums'] },
    dockSub:    { fontFamily: Fonts.regular, fontSize: 16, color: C.t2 },
    dockStrong: { fontFamily: Fonts.semiBold, color: C.t1 },
  });
}
