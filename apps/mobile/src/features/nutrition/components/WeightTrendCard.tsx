import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { TrendUp, TrendDown, Minus } from 'phosphor-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import type { WeightLogEntry } from '@shared/services/store';

const SPARK_W = 100;
const SPARK_H = 32;

interface WeightTrendCardProps {
  logs: WeightLogEntry[]; // most recent first
  onLogWeight: () => void;
}

export function WeightTrendCard({ logs, onLogWeight }: WeightTrendCardProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  if (logs.length === 0) {
    return (
      <View style={s.card}>
        <Text style={s.cardTitle}>WEIGHT</Text>
        <Text style={s.emptyText}>No weigh-ins logged yet.</Text>
        <Pressable style={s.logBtn} onPress={onLogWeight}>
          <Text style={s.logBtnLabel}>+ Log weight</Text>
        </Pressable>
      </View>
    );
  }

  const chronological = [...logs].reverse(); // oldest -> newest for the sparkline
  const current = logs[0].weightKg;
  // Compare against the entry closest to 7 days before the latest one.
  const weekAgoCutoff = logs[0].loggedAt - 7 * 24 * 60 * 60 * 1000;
  const weekAgoEntry = [...logs].reverse().find(l => l.loggedAt <= weekAgoCutoff);
  const delta = weekAgoEntry ? current - weekAgoEntry.weightKg : null;

  const values = chronological.map(l => l.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.5); // avoid a flat divide-by-zero
  const points = chronological
    .map((l, i) => {
      const x = chronological.length > 1 ? (i / (chronological.length - 1)) * SPARK_W : SPARK_W / 2;
      const y = SPARK_H - ((l.weightKg - min) / range) * SPARK_H;
      return `${x},${y}`;
    })
    .join(' ');
  const lastX = chronological.length > 1 ? SPARK_W : SPARK_W / 2;
  const lastY = SPARK_H - ((current - min) / range) * SPARK_H;

  const TrendIcon = delta === null ? Minus : delta > 0 ? TrendUp : delta < 0 ? TrendDown : Minus;
  const trendColor = delta === null || Math.abs(delta) < 0.1 ? C.t3 : delta > 0 ? C.orange : C.green;

  return (
    <View style={s.card}>
      <View style={s.headRow}>
        <Text style={s.cardTitle}>WEIGHT</Text>
        <Pressable onPress={onLogWeight} hitSlop={8}>
          <Text style={s.logLink}>+ Log</Text>
        </Pressable>
      </View>
      <View style={s.body}>
        <View>
          <Text style={s.current}>{current.toFixed(1)}<Text style={s.unit}> kg</Text></Text>
          <View style={s.trendRow}>
            <TrendIcon size={11} color={trendColor} weight="bold" />
            <Text style={[s.trendText, { color: trendColor }]}>
              {delta === null
                ? 'Not enough history yet'
                : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg this week`}
            </Text>
          </View>
        </View>
        <Svg width={SPARK_W} height={SPARK_H}>
          <Polyline points={points} fill="none" stroke={C.red} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={lastX} cy={lastY} r={2.5} fill={C.red} />
        </Svg>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { ...Type.overline, color: C.t3 },
  logLink: { fontFamily: Fonts.medium, fontSize: 12, color: C.red },
  emptyText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, marginBottom: 10 },
  logBtn: { alignSelf: 'flex-start' },
  logBtnLabel: { fontFamily: Fonts.medium, fontSize: 12, color: C.red },
  body: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  current: { fontFamily: Fonts.bold, fontSize: 22, color: C.t1, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  trendText: { fontFamily: Fonts.regular, fontSize: 11 },
}); }
