/**
 * You → Gallery: every activity as its route shape, three across, like
 * Strava's gallery but drawn from the GPS trace (no photos needed).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, useWindowDimensions } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import type { StoredRun } from '@shared/services/store';
import { useTheme, Fonts, type AppColors } from '@theme';
import { useDistanceUnit } from '@mobile/shared/hooks/useDistanceUnit';
import { convertKm } from '@mobile/shared/lib/formatters';
import { fmtKm } from './YouSections';
import { routePolyline } from '../utils/routeShape';
import { signPhotoUrls } from '@features/run/services/activityEditService';
import { Segmented } from '@mobile/shared/components/Segmented';

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

  const [mode, setMode] = useState<'routes' | 'photos'>('routes');
  const photoRuns = useMemo(() => runs.filter(r => (r.photoPaths?.length ?? 0) > 0).sort((a, b) => b.startTime - a.startTime), [runs]);
  const [photos, setPhotos] = useState<{ uri: string; run: StoredRun }[] | null>(null);
  useEffect(() => {
    if (mode !== 'photos' || photos !== null) return;
    const items = photoRuns.flatMap(r => (r.photoPaths ?? []).map(path => ({ path, run: r })));
    signPhotoUrls(items.map(i => i.path))
      .then(m => setPhotos(items.flatMap(i => (m.has(i.path) ? [{ uri: m.get(i.path)!, run: i.run }] : []))))
      .catch(() => setPhotos([]));
  }, [mode, photos, photoRuns]);

  const header = (
    <View style={s.head}>
      <Text style={s.headTxt}>Routes and photos · {list.length}</Text>
      <Segmented size="sm" fit options={[{ value: 'routes', label: 'Routes' }, { value: 'photos', label: 'Photos' }]} value={mode} onChange={setMode} />
    </View>
  );

  if (mode === 'photos') {
    return (
      <View style={{ gap: 12 }}>
        {header}
        {photos && photos.length > 0 ? (
          <View style={s.grid}>
            {photos.map((p, i) => (
              <Pressable key={`${p.run.id}-${i}`} onPress={() => onOpen(p.run)} style={{ width: size, height: size }} accessibilityRole="button" accessibilityLabel="Open activity">
                <Image source={{ uri: p.uri }} style={{ width: size, height: size }} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{photos === null ? 'Loading photos…' : 'No photos yet'}</Text>
            <Text style={s.emptySub}>Add photos to an activity from its page and they show up here.</Text>
          </View>
        )}
      </View>
    );
  }

  if (list.length === 0) {
    return (
      <View style={{ gap: 12 }}>
        {header}
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No routes yet</Text>
          <Text style={s.emptySub}>Every run you record shows up here as its shape.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {header}
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
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
    head:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    headTxt:    { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    tile:       { overflow: 'hidden' },
    label:      { position: 'absolute', left: 7, bottom: 6, fontFamily: Fonts.semiBold, fontSize: 11, color: C.t1 },
    empty:      { marginHorizontal: 18, padding: 24, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', gap: 4 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    emptySub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center' },
  });
}
