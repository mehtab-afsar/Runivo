import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import type { StoredRun } from '@shared/services/store';
import { fmtDist, fmtDuration } from '@mobile/shared/lib/formatters';
import { Colors } from '@theme';

const C = Colors;

const SKETCH_W = 72;
const SKETCH_H = 48;

function RouteSketch({ gpsPoints }: { gpsPoints: StoredRun['gpsPoints'] }) {
  if (gpsPoints.length < 2) {
    // Placeholder wavy line
    return (
      <Svg width={SKETCH_W} height={SKETCH_H} viewBox={`0 0 ${SKETCH_W} ${SKETCH_H}`}>
        <Polyline
          points={`4,${SKETCH_H / 2} 14,${SKETCH_H / 2 - 8} 24,${SKETCH_H / 2} 34,${SKETCH_H / 2 + 8} 44,${SKETCH_H / 2} 54,${SKETCH_H / 2 - 8} 64,${SKETCH_H / 2} 72,${SKETCH_H / 2}`}
          fill="none"
          stroke={C.border}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // Downsample to max 60 points for perf
  const step = Math.max(1, Math.floor(gpsPoints.length / 60));
  const sampled = gpsPoints.filter((_, i) => i % step === 0);

  const lats = sampled.map(p => p.lat);
  const lngs = sampled.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const ranLat = maxLat - minLat || 0.001;
  const ranLng = maxLng - minLng || 0.001;

  const pad = 4;
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
        stroke={C.red}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface Props {
  runs: StoredRun[];
}

export function ActivityFeedTab({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <View style={ss.empty}>
        <Text style={ss.emptyTitle}>No runs yet</Text>
        <Text style={ss.emptyText}>Complete your first run to see your activity here.</Text>
      </View>
    );
  }

  return (
    <>
      <Text style={ss.sectionTitle}>Recent activity</Text>
      {runs.slice(0, 10).map(run => {
        const date = new Date(run.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const zonesCount = run.territoriesClaimed.length;
        return (
          <View key={run.id} style={ss.card}>
            <View style={ss.sketchWrap}>
              <RouteSketch gpsPoints={run.gpsPoints} />
            </View>
            <View style={ss.info}>
              <Text style={ss.date}>{date}</Text>
              <Text style={ss.dist}>{fmtDist(run.distanceMeters)} km</Text>
              <Text style={ss.pace}>{run.avgPace} /km</Text>
              <Text style={ss.duration}>{fmtDuration(run.durationSec)}</Text>
              {zonesCount > 0 && (
                <Text style={ss.zones}>⬡ {zonesCount} zone{zonesCount !== 1 ? 's' : ''}</Text>
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}

const ss = StyleSheet.create({
  sectionTitle: {
    fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.t3,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  sketchWrap: {
    width: SKETCH_W, height: SKETCH_H,
    backgroundColor: '#F8F6F3', borderRadius: 8, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  date: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  dist: { fontFamily: 'Barlow_600SemiBold', fontSize: 18, color: C.black, letterSpacing: -0.5 },
  pace: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2 },
  duration: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.black },
  zones: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.red, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18 },
});
