/**
 * You → Gallery: every activity as its route shape, three across, like
 * Strava's gallery but drawn from the GPS trace (no photos needed).
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import type { StoredRun } from '@shared/services/store';
import { useTheme, Fonts, type AppColors } from '@theme';
import { useDistanceUnit } from '@mobile/shared/hooks/useDistanceUnit';
import { convertKm } from '@mobile/shared/lib/formatters';
import { fmtKm } from './YouSections';
import { routePolyline } from '../utils/routeShape';

const COLS = 3;
const GAP = 2;
const TILE_BG = ['card', 'mint', 'lavender', 'surface', 'amberBg'] as const;

export function RouteGallery({ runs, onOpen }: { runs: StoredRun[]; onOpen: (run: StoredRun) => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const { width } = useWindowDimensions();
  const unit = useDistanceUnit();
  const size = Math.floor((width - GAP * (COLS - 1)) / COLS);
  const list = useMemo(
    () => runs.filter(r => !r.excluded && r.gpsPoints.length > 1).sort((a, b) => b.startTime - a.startTime),
    [runs],
  );

  if (list.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No routes yet</Text>
        <Text style={s.emptySub}>Every run you record shows up here as its shape.</Text>
      </View>
    );
  }

  return (
    <View style={s.grid}>
      {list.map((r, i) => {
        const line = routePolyline(r.gpsPoints, size);
        const bg = C[TILE_BG[i % TILE_BG.length]];
        const ink = (r.territoriesClaimed?.length ?? 0) > 0 ? C.brandGreen : C.t1;
        return (
          <Pressable
            key={r.id} onPress={() => onOpen(r)} style={[s.tile, { width: size, height: size, backgroundColor: bg }]}
            accessibilityRole="button" accessibilityLabel={`${fmtKm(convertKm(r.distanceMeters / 1000, unit))} ${unit === 'km' ? 'kilometre' : 'mile'} ${r.activityType}, ${new Date(r.startTime).toDateString()}`}
          >
            {line && (
              <Svg width={size} height={size}>
                <Polyline points={line} fill="none" stroke={ink} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
            <Text style={s.label}>{fmtKm(convertKm(r.distanceMeters / 1000, unit))} {unit}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    tile:       { overflow: 'hidden' },
    label:      { position: 'absolute', left: 7, bottom: 6, fontFamily: Fonts.semiBold, fontSize: 11, color: C.t1 },
    empty:      { marginHorizontal: 18, padding: 24, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', gap: 4 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    emptySub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center' },
  });
}
