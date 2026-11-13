import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { StoredRun } from '@shared/services/store';
import type { PersonalRecord } from '../hooks/useProfile';
import { useIntelligence, type WeeklyConsistency } from '../hooks/useIntelligence';
import { PersonalRecordsCard } from './PersonalRecordsCard';
import { CoachMessageCard } from '@features/coach/components/CoachMessageCard';
import { isoWeekStart, parsePaceSec, fmtTime, riegelPredict } from '../utils/raceIntelligence';
import { useTheme, Fonts, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Below this many logged runs, the pace-effort breakdown is mostly noise —
// same threshold the Stats tab work established for the identical section.
const MIN_RUNS_FOR_PACE_ZONES = 3;

// ── sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label, C }: { label: string; C: AppColors }) {
  return (
    <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: C.black, marginBottom: 10, marginTop: 20 }}>
      {label}
    </Text>
  );
}

function WeeklyChart({ weeklyKm, C }: { weeklyKm: number[]; C: AppColors }) {
  const s = useMemo(() => mkChartStyles(C), [C]);
  const maxKm = Math.max(...weeklyKm, 1);
  const currentWeekKey = isoWeekStart(new Date());

  return (
    <View style={s.chartCard}>
      <View style={s.bars}>
        {weeklyKm.map((km, i) => {
          const heightPct = km / maxKm;
          const weeksBack = weeklyKm.length - 1 - i;
          const d = new Date();
          d.setDate(d.getDate() - weeksBack * 7);
          const isCurrent = isoWeekStart(d) === currentWeekKey;
          const label = d.toLocaleDateString('en-US', { month: 'short' });
          return (
            <View key={i} style={s.barCol}>
              <Text style={s.barKm}>{km > 0 ? km.toFixed(0) : ''}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { flex: heightPct, backgroundColor: isCurrent ? C.red : C.mid }]} />
                <View style={{ flex: 1 - heightPct }} />
              </View>
              <Text style={[s.barLabel, isCurrent && s.barLabelActive]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function mkChartStyles(C: AppColors) {
  return StyleSheet.create({
    chartCard: { backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 112 },
    barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 112 },
    barKm: { fontFamily: Fonts.light, fontSize: 11, color: C.t3, marginBottom: 2 },
    barTrack: { width: '100%', height: 80, justifyContent: 'flex-end', flexDirection: 'column' },
    barFill: { borderRadius: 3, width: '100%' },
    barLabel: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 4 },
    barLabelActive: { fontFamily: Fonts.medium, color: C.red },
  });
}

function PaceZones({ runs, C }: { runs: StoredRun[]; C: AppColors }) {
  const s = useMemo(() => mkZonesStyles(C), [C]);
  const zones = useMemo(() => {
    const buckets = [
      { label: 'Easy',     range: 'Under 5:30',   maxSec: Infinity, minSec: 330, totalSec: 0 },
      { label: 'Moderate', range: '5:30 – 4:30',  maxSec: 330,      minSec: 270, totalSec: 0 },
      { label: 'Tempo',    range: '4:30 – 3:30',  maxSec: 270,      minSec: 210, totalSec: 0 },
      { label: 'Hard',     range: 'Under 3:30',   maxSec: 210,      minSec: 0,   totalSec: 0 },
    ];
    for (const r of runs) {
      const paceSec = parsePaceSec(r.avgPace);
      const bucket = buckets.find(b => paceSec >= b.minSec && paceSec < b.maxSec);
      if (bucket) bucket.totalSec += r.durationSec;
    }
    const total = buckets.reduce((sum, b) => sum + b.totalSec, 0) || 1;
    return buckets.map(b => ({ ...b, pct: b.totalSec / total }));
  }, [runs]);

  return (
    <View style={s.zonesCard}>
      {zones.map(z => (
        <View key={z.label} style={s.zoneRow}>
          <View style={s.zoneLeft}>
            <Text style={s.zoneLabel}>{z.label}</Text>
            <Text style={s.zoneRange}>{z.range}</Text>
          </View>
          <View style={s.zoneBarWrap}>
            <View style={[s.zoneBarFill, { flex: Math.max(0.02, z.pct) }]} />
            <View style={{ flex: 1 - Math.max(0.02, z.pct) }} />
          </View>
          <Text style={s.zoneTime}>{z.totalSec > 0 ? fmtTime(z.totalSec) : '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function mkZonesStyles(C: AppColors) {
  return StyleSheet.create({
    zonesCard:    { backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16, gap: 12 },
    zoneRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
    zoneLeft:     { width: 72 },
    zoneLabel:    { fontFamily: Fonts.medium, fontSize: 12, color: C.black },
    zoneRange:    { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    zoneBarWrap:  { flex: 1, height: 6, backgroundColor: C.mid, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
    zoneBarFill:  { height: 6, backgroundColor: C.red, borderRadius: 3 },
    zoneTime:     { fontFamily: Fonts.light, fontSize: 11, color: C.t2, width: 32, textAlign: 'right' },
  });
}

function RacePredictions({ personalRecords, C }: { personalRecords: PersonalRecord[]; C: AppColors }) {
  const s = useMemo(() => mkRaceStyles(C), [C]);
  const fiveKRecord = personalRecords.find(r => r.label.toLowerCase().includes('5k') || r.label.toLowerCase().includes('best 5k'));

  // Properly hidden until there's a qualifying 5K — no locked placeholder.
  if (!fiveKRecord || fiveKRecord.value === '—') return null;

  const parts = fiveKRecord.value.replace('/km', '').trim().split(':').map(Number);
  let baseSec = 0;
  if (parts.length === 2) baseSec = parts[0] * 60 + parts[1];
  else if (parts.length === 3) baseSec = parts[0] * 3600 + parts[1] * 60 + parts[2];

  const predictions = [
    { label: '10K',  dist: 10 },
    { label: 'Half', dist: 21.0975 },
    { label: 'Full', dist: 42.195 },
  ];

  return (
    <View style={s.grid}>
      {predictions.map(p => (
        <View key={p.label} style={s.card}>
          <Text style={s.val}>{riegelPredict(baseSec, 5, p.dist)}</Text>
          <Text style={s.label}>{p.label}</Text>
          <Text style={s.note}>predicted</Text>
        </View>
      ))}
    </View>
  );
}

function mkRaceStyles(C: AppColors) {
  return StyleSheet.create({
    grid:  { flexDirection: 'row', gap: 8 },
    card:  { flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14, alignItems: 'center' },
    val:   { fontFamily: Fonts.semiBold, fontSize: 16, color: C.black, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    label: { fontFamily: Fonts.medium, fontSize: 11, color: C.black, marginTop: 2 },
    note:  { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 1 },
  });
}

function barColor(score: number, C: AppColors): string {
  if (score >= 75) return C.red;
  if (score >= 50) return C.amber;
  return C.mid;
}

function ConsistencyTrendChart({ history, C }: { history: WeeklyConsistency[]; C: AppColors }) {
  const s = useMemo(() => mkConsistencyStyles(C), [C]);
  // history comes newest-first from DB; reverse to show oldest→newest left to right
  const ordered  = [...history].reverse();
  const scores   = ordered.map(w => w.consistency_score);
  const avg      = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const best     = Math.max(...scores);
  const current  = scores[scores.length - 1] ?? 0;

  return (
    <View style={s.card}>
      <View style={s.bars}>
        {ordered.map((w, i) => {
          const heightPct = scores[i] / 100;
          const isLast    = i === ordered.length - 1;
          const d         = new Date(w.week_start);
          const label     = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <View key={w.week_start} style={s.barCol}>
              <View style={s.barTrack}>
                <View style={{ flex: 1 - heightPct }} />
                <View style={[s.barFill, { flex: heightPct, backgroundColor: barColor(scores[i], C), opacity: isLast ? 1 : 0.7 }]} />
              </View>
              <Text style={[s.barLabel, isLast && s.barLabelActive]} numberOfLines={1}>{label}</Text>
            </View>
          );
        })}
      </View>
      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statVal}>{avg}%</Text><Text style={s.statLbl}>avg</Text></View>
        <View style={s.stat}><Text style={[s.statVal, { color: C.red }]}>{best}%</Text><Text style={s.statLbl}>best</Text></View>
        <View style={s.stat}><Text style={s.statVal}>{current}%</Text><Text style={s.statLbl}>this week</Text></View>
      </View>
    </View>
  );
}

function mkConsistencyStyles(C: AppColors) {
  return StyleSheet.create({
    card:          { backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16 },
    bars:          { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80, marginBottom: 12 },
    barCol:        { flex: 1, alignItems: 'center', height: 80 },
    barTrack:      { width: '100%', flex: 1, flexDirection: 'column' },
    barFill:       { borderRadius: 3, width: '100%' },
    barLabel:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 4, textAlign: 'center' },
    barLabelActive:{ fontFamily: Fonts.medium, color: C.red },
    statsRow:      { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 10, gap: 0 },
    stat:          { flex: 1, alignItems: 'center' },
    statVal:       { fontFamily: Fonts.semiBold, fontSize: 15, color: C.black, fontVariant: ['tabular-nums'] },
    statLbl:       { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
  });
}

function InsightSkeleton({ C }: { C: AppColors }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        backgroundColor: C.stone,
        borderRadius: 14,
        padding: 16,
        height: 120,
        marginBottom: 10,
        opacity: anim,
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  runs: StoredRun[];
  personalRecords: PersonalRecord[];
}

export function IntelligenceTab({ runs, personalRecords }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const {
    insights, insightsLoading, weeklyKm, trendLabel, consistencyHistory,
    brief, briefLoading,
  } = useIntelligence(runs);

  // Brand new — one welcome message reusing the Coach tab's own cold-start
  // copy and card styling, nothing else in this tab. No CTA button (Profile
  // doesn't do those); a plain link into Coach instead.
  if (runs.length === 0) {
    return (
      <View>
        {briefLoading ? (
          <InsightSkeleton C={C} />
        ) : brief ? (
          <CoachMessageCard type="insight" content={JSON.stringify(brief)} style={s.welcomeCard} />
        ) : (
          <View style={s.insightEmpty}>
            <Text style={s.insightEmptyText}>Log your first run to unlock Pace intelligence.</Text>
          </View>
        )}
        <Pressable onPress={() => navigation.navigate('Coach')} hitSlop={8} style={s.coachLinkWrap}>
          <Text style={s.coachLink}>Ask Pace on the Coach tab →</Text>
        </Pressable>
      </View>
    );
  }

  const showPaceZones = runs.length >= MIN_RUNS_FOR_PACE_ZONES;
  const fiveKRecord = personalRecords.find(r => r.label.toLowerCase().includes('5k') || r.label.toLowerCase().includes('best 5k'));
  const showPredictions = !!fiveKRecord && fiveKRecord.value !== '—';

  return (
    <View>
      <SectionLabel label="Weekly km" C={C} />
      <Text style={s.trendLabel}>{trendLabel}</Text>
      <WeeklyChart weeklyKm={weeklyKm} C={C} />

      {consistencyHistory.length >= 2 && (
        <>
          <SectionLabel label="Plan consistency" C={C} />
          <ConsistencyTrendChart history={consistencyHistory} C={C} />
        </>
      )}

      <SectionLabel label="Pace Insights" C={C} />
      {insightsLoading ? (
        <>
          <InsightSkeleton C={C} />
          <InsightSkeleton C={C} />
          <InsightSkeleton C={C} />
        </>
      ) : insights.length === 0 ? (
        <View style={s.insightEmpty}>
          <Text style={s.insightEmptyText}>Log more runs to unlock Pace insights.</Text>
        </View>
      ) : (
        insights.map((card, i) => (
          <View key={i} style={s.insightCard}>
            <Text style={s.insightIcon}>{card.icon}</Text>
            <Text style={s.insightHeadline}>{card.headline}</Text>
            <Text style={s.insightBody}>{card.body}</Text>
            <Text style={s.insightRec}>Pace: {card.recommendation}</Text>
          </View>
        ))
      )}

      <SectionLabel label="Personal records" C={C} />
      <PersonalRecordsCard records={personalRecords} />

      {showPaceZones && (
        <>
          <SectionLabel label="Pace zones" C={C} />
          <PaceZones runs={runs} C={C} />
        </>
      )}

      {showPredictions && (
        <>
          <SectionLabel label="Race predictions" C={C} />
          <RacePredictions personalRecords={personalRecords} C={C} />
        </>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    trendLabel:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginBottom: 8 },
    insightCard:    { backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16, marginBottom: 10 },
    insightIcon:    { fontSize: 20 },
    insightHeadline:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.black, marginTop: 8 },
    insightBody:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 19, marginTop: 6 },
    insightRec:     { fontFamily: Fonts.regular, fontSize: 12, color: C.red, fontStyle: 'italic', marginTop: 8 },
    insightEmpty:   { backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 20, alignItems: 'center' },
    insightEmptyText:{ fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center' },

    welcomeCard:    { maxWidth: '100%' },
    coachLinkWrap:  { marginTop: 14, alignItems: 'center' },
    coachLink:      { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.red },
  });
}
