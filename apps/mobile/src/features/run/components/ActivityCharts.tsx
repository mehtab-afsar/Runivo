/**
 * Pace (speed for rides) and elevation over distance (PRD A4), drawn from the
 * stored GPS trace. Pace is drawn with faster higher, like Strava.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { useTheme, Fonts, type AppColors } from '@theme';
import { getRunById, getRuns } from '@shared/services/store';
import { activitySeries, climbM, type SeriesPoint } from '@shared/engine/activitySeries';
import { hrZones, estimateMaxHr, type HrZone } from '@shared/engine/hrZones';
import { fmtPace } from '@shared/engine/training';

const H = 96;

function chartPath(xs: number[], ys: (number | null)[], w: number, lo: number, hi: number, invert: boolean, area: boolean): string {
  const span = hi - lo || 1;
  const maxX = xs[xs.length - 1] || 1;
  let d = '';
  let started = false, firstX = 0, lastX = 0;
  xs.forEach((x, i) => {
    const v = ys[i];
    if (v == null) return;
    const px = (x / maxX) * w;
    const t = (v - lo) / span;
    const py = 4 + (invert ? t : 1 - t) * (H - 8);
    d += `${started ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
    if (!started) firstX = px;
    lastX = px; started = true;
  });
  return area && started ? `${d}L${lastX.toFixed(1)},${H}L${firstX.toFixed(1)},${H}Z` : d;
}

export default function ActivityCharts({ runId, isRide }: { runId: string; isRide: boolean }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [w, setW] = useState(0);
  const [zones, setZones] = useState<HrZone[] | null>(null);

  useEffect(() => {
    getRunById(runId).then(async r => {
      setSeries(r?.gpsPoints?.length ? activitySeries(r.gpsPoints) : []);
      // Heart-rate zones (A4): only when the activity has per-sample heart rate (a watch run).
      const pts = r?.gpsPoints ?? [];
      if (pts.some(p => typeof p.hr === 'number')) {
        const all = await getRuns(300).catch(() => []);
        const max = estimateMaxHr([...all.map(x => x.heartRateMax), ...pts.map(p => p.hr)]);
        setZones(hrZones(pts, max));
      }
    }).catch(() => {});
  }, [runId]);

  const zoneBlock = zones ? (
    <View style={{ marginTop: series.length >= 4 ? 18 : 0 }}>
      <View style={s.head}>
        <Text style={s.title}>Heart rate zones</Text>
        <Text style={s.range}>{Math.round(zones.reduce((t, z) => t + z.seconds, 0) / 60)} min</Text>
      </View>
      {[...zones].reverse().map(z => (
        <View key={z.zone} style={s.zRow}>
          <Text style={s.zLabel}>Z{z.zone} {z.label}</Text>
          <View style={s.zTrack}><View style={[s.zBar, { width: `${Math.max(1, Math.round(z.share * 100))}%`, opacity: 0.35 + z.zone * 0.13 }]} /></View>
          <Text style={s.zVal}>{Math.round(z.share * 100)}%</Text>
        </View>
      ))}
      <Text style={s.axisTxt}>Zones from your max heart rate of {zones[4].fromBpm ? Math.round(zones[4].fromBpm / 0.9) : '—'} bpm</Text>
    </View>
  ) : null;

  if (series.length < 4) return zoneBlock ? <View style={s.card}>{zoneBlock}</View> : null;
  const xs = series.map(p => p.km);
  const paces = series.map(p => p.secPerKm);
  const valid = paces.filter((p): p is number => p != null).sort((a, b) => a - b);
  // Trim the extremes so one GPS hiccup doesn't flatten the chart.
  const lo = valid[Math.floor(valid.length * 0.05)] ?? 0;
  const hi = valid[Math.ceil(valid.length * 0.95) - 1] ?? 1;
  const clamped = paces.map(p => (p == null ? null : Math.max(lo, Math.min(hi, p))));
  const alts = series.map(p => p.altitudeM);
  const altVals = alts.filter((a): a is number => a != null);
  const hasAlt = altVals.length >= 4 && Math.max(...altVals) - Math.min(...altVals) >= 3;
  const aLo = hasAlt ? Math.min(...altVals) : 0, aHi = hasAlt ? Math.max(...altVals) : 1;
  const total = xs[xs.length - 1];

  const speed = (spk: number) => `${(3600 / spk).toFixed(1)} km/h`;
  const fmt = (spk: number) => (isRide ? speed(spk) : `${fmtPace(spk)}/km`);

  return (
    <View style={s.card} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 32)}>
      <View style={s.head}>
        <Text style={s.title}>{isRide ? 'Speed' : 'Pace'}</Text>
        <Text style={s.range}>{fmt(lo)} best · {fmt(hi)} slowest</Text>
      </View>
      {w > 0 && (
        <Svg width={w} height={H} accessibilityLabel={`${isRide ? 'Speed' : 'Pace'} chart`}>
          <Line x1={0} y1={H - 0.5} x2={w} y2={H - 0.5} stroke={C.border} strokeWidth={1} />
          <Path d={chartPath(xs, clamped, w, lo, hi, true, true)} fill={C.red} opacity={0.12} />
          <Path d={chartPath(xs, clamped, w, lo, hi, true, false)} stroke={C.red} strokeWidth={2} fill="none" strokeLinejoin="round" />
        </Svg>
      )}

      {hasAlt && (
        <>
          <View style={[s.head, { marginTop: 16 }]}>
            <Text style={s.title}>Elevation</Text>
            <Text style={s.range}>{Math.round(aLo)}–{Math.round(aHi)} m · +{climbM(series)} m climb</Text>
          </View>
          {w > 0 && (
            <Svg width={w} height={H} accessibilityLabel="Elevation chart">
              <Path d={chartPath(xs, alts, w, aLo, aHi, false, true)} fill={C.t2} opacity={0.15} />
              <Path d={chartPath(xs, alts, w, aLo, aHi, false, false)} stroke={C.t2} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
            </Svg>
          )}
        </>
      )}
      <View style={s.axis}>
        <Text style={s.axisTxt}>0 km</Text>
        <Text style={s.axisTxt}>{total.toFixed(total >= 10 ? 0 : 1)} km</Text>
      </View>
      {zoneBlock}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:    { backgroundColor: C.card, borderRadius: 16, padding: 16 },
    head:    { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
    title:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    range:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    axis:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    axisTxt: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    zRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    zLabel:  { width: 104, fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    zTrack:  { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.surface, overflow: 'hidden' },
    zBar:    { height: 10, borderRadius: 5, backgroundColor: C.red },
    zVal:    { width: 34, textAlign: 'right', fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1 },
  });
}
