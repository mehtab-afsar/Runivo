import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import Svg, { Polyline, Rect } from 'react-native-svg';
import type { StoredRun } from '@shared/services/store';
import { fmtDist, fmtDuration } from '@mobile/shared/lib/formatters';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SKETCH_W = 88;
const SKETCH_H = 64;

function RouteSketch({ gpsPoints, strokeColor, bgColor }: { gpsPoints: StoredRun['gpsPoints']; strokeColor: string; bgColor: string }) {
  if (gpsPoints.length < 2) {
    return (
      <Svg width={SKETCH_W} height={SKETCH_H} viewBox={`0 0 ${SKETCH_W} ${SKETCH_H}`}>
        <Polyline
          points={`4,${SKETCH_H / 2} 16,${SKETCH_H / 2 - 10} 28,${SKETCH_H / 2} 40,${SKETCH_H / 2 + 10} 52,${SKETCH_H / 2} 64,${SKETCH_H / 2 - 10} 76,${SKETCH_H / 2} 88,${SKETCH_H / 2}`}
          fill="none"
          stroke={bgColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  const step = Math.max(1, Math.floor(gpsPoints.length / 60));
  const sampled = gpsPoints.filter((_, i) => i % step === 0);
  const lats = sampled.map(p => p.lat);
  const lngs = sampled.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const ranLat = maxLat - minLat || 0.001;
  const ranLng = maxLng - minLng || 0.001;
  const pad = 6;
  const pts = sampled
    .map(p => {
      const x = pad + ((p.lng - minLng) / ranLng) * (SKETCH_W - pad * 2);
      const y = pad + ((maxLat - p.lat) / ranLat) * (SKETCH_H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width={SKETCH_W} height={SKETCH_H} viewBox={`0 0 ${SKETCH_W} ${SKETCH_H}`}>
      <Polyline
        points={pts}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const GAP  = 4;
const COLS = 7;
const ROWS = 8;

// Day-of-week labels: Mon–Sun
const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function CalendarHeatmap({ runs, emptyColor, redColor }: { runs: StoredRun[]; emptyColor: string; redColor: string }) {
  const { width: screenWidth } = useWindowDimensions();
  // Content area: screen minus outer horizontal padding (16 each side) minus card padding (16 each side)
  const availableWidth = screenWidth - 32 - 32;
  const CELL = Math.floor((availableWidth - GAP * (COLS - 1)) / COLS);

  const cells = useMemo(() => {
    const kmByDay = new Map<string, number>();
    for (const r of runs) {
      const d = new Date(r.startTime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      kmByDay.set(key, (kmByDay.get(key) ?? 0) + r.distanceMeters / 1000);
    }
    const now = new Date();
    const result: { key: string; km: number; col: number }[] = [];
    for (let i = ROWS * COLS - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      result.push({ key, km: kmByDay.get(key) ?? 0, col: dow });
    }
    return result;
  }, [runs]);

  const svgW = COLS * (CELL + GAP) - GAP;
  const svgH = ROWS * (CELL + GAP) - GAP;

  return (
    <View>
      {/* Day-of-week labels */}
      <View style={{ flexDirection: 'row', gap: GAP, marginBottom: 6 }}>
        {DOW_LABELS.map((label, i) => (
          <View key={i} style={{ width: CELL, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: redColor + '80' }}>{label}</Text>
          </View>
        ))}
      </View>
      <Svg width={svgW} height={svgH}>
        {cells.map((cell, i) => {
          const row = Math.floor(i / COLS);
          const col = cell.col;
          const x = col * (CELL + GAP);
          const y = row * (CELL + GAP);
          const opacity = cell.km === 0 ? 1 : cell.km < 3 ? 0.3 : cell.km < 7 ? 0.6 : 1;
          const fill = cell.km === 0 ? emptyColor : redColor;
          return (
            <Rect key={cell.key} x={x} y={y} width={CELL} height={CELL} rx={4}
              fill={fill} opacity={opacity} />
          );
        })}
      </Svg>
    </View>
  );
}

function relativeDate(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const dayStr   = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const yesterdayStr = `${yest.getFullYear()}-${yest.getMonth()}-${yest.getDate()}`;

  if (dayStr === todayStr) return 'Today';
  if (dayStr === yesterdayStr) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface Props {
  runs: StoredRun[];
  isOwn?: boolean;
}

const INITIAL_COUNT = 3;

export function ActivityFeedTab({ runs, isOwn }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const [expanded, setExpanded] = useState(false);

  if (runs.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No runs yet</Text>
        <Text style={s.emptyText}>Complete your first run to see your activity here.</Text>
      </View>
    );
  }

  const visibleRuns = expanded ? runs : runs.slice(0, INITIAL_COUNT);
  const hiddenCount = runs.length - INITIAL_COUNT;

  return (
    <View>
      {isOwn && (
        <View style={s.heatmapSection}>
          <Text style={s.sectionLabel}>8-Week Activity</Text>
          <View style={s.heatmapCard}>
            <CalendarHeatmap runs={runs} emptyColor={C.stone} redColor={C.red} />
          </View>
        </View>
      )}

      <Text style={s.sectionLabel}>Recent Runs</Text>

      {visibleRuns.map(run => {
        const zonesCount = run.territoriesClaimed.length;
        return (
          <Pressable
            key={run.id}
            style={s.card}
            onPress={() => navigation.navigate('RunSummary', { runId: run.id })}
          >
            <View style={s.sketchWrap}>
              <RouteSketch gpsPoints={run.gpsPoints} strokeColor={C.red} bgColor={C.mid} />
            </View>
            <View style={s.info}>
              <Text style={s.dateText}>{relativeDate(run.startTime)}</Text>
              <Text style={s.dist}>{fmtDist(run.distanceMeters)} km</Text>
              <View style={s.metaRow}>
                <Text style={s.metaText}>{run.avgPace} /km</Text>
                <Text style={s.metaDot}>·</Text>
                <Text style={s.metaText}>{fmtDuration(run.durationSec)}</Text>
              </View>
              {zonesCount > 0 && (
                <View style={s.zonePill}>
                  <Text style={s.zonePillText}>⬡ {zonesCount} zone{zonesCount !== 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
            <Text style={s.arrow}>›</Text>
          </Pressable>
        );
      })}

      {!expanded && hiddenCount > 0 && (
        <Pressable style={s.showMore} onPress={() => setExpanded(true)}>
          <Text style={s.showMoreText}>Show {hiddenCount} more {hiddenCount === 1 ? 'run' : 'runs'}</Text>
        </Pressable>
      )}
      {expanded && runs.length > INITIAL_COUNT && (
        <Pressable style={s.showMore} onPress={() => setExpanded(false)}>
          <Text style={s.showMoreText}>Show less</Text>
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    sectionLabel:  { fontWeight: '500', fontSize: 13, color: C.black, marginBottom: 10 },
    heatmapSection:{ marginBottom: 28 },
    heatmapCard:   { backgroundColor: C.white, borderRadius: 16, borderWidth: 0.5, borderColor: C.border, padding: 16 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.white, borderRadius: 16, borderWidth: 0.5, borderColor: C.border,
      padding: 16, marginBottom: 10,
    },
    sketchWrap:    { width: SKETCH_W, height: SKETCH_H, backgroundColor: C.stone, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    info:          { flex: 1, gap: 3 },
    dateText:      { fontSize: 11, color: C.t3 },
    dist:          { fontFamily: 'Barlow_600SemiBold', fontSize: 20, color: C.black, letterSpacing: -0.5 },
    metaRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText:      { fontSize: 12, color: C.t2 },
    metaDot:       { fontSize: 12, color: C.t3 },
    zonePill:      { alignSelf: 'flex-start', backgroundColor: 'rgba(217,53,24,0.08)', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, marginTop: 2 },
    zonePillText:  { fontWeight: '500', fontSize: 11, color: C.red },
    arrow:         { fontSize: 18, color: C.t3 },
    showMore:      { backgroundColor: C.stone, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
    showMoreText:  { fontWeight: '500', fontSize: 13, color: C.t2 },
    empty:         { alignItems: 'center', paddingVertical: 40 },
    emptyTitle:    { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black, marginBottom: 6 },
    emptyText:     { fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 19 },
  });
}
