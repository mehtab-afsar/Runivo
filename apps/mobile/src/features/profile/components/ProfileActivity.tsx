/**
 * Strava-style profile sections: sport filter, This week with a 12-week
 * volume chart, year / all-time statistics, recent activities, best efforts
 * and the territory card. All from the runner's stored runs.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { CaretRight, Hexagon, PushPin } from 'phosphor-react-native';
import { useTheme, Fonts, Type, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';
import { useIsDark } from '@theme';
import type { StoredRun } from '@shared/services/store';
import { sportFor } from '@features/run/constants/activities';
import {
  type SportFilter, filterBySport, weeklyTotals, periodStats, activityTitle,
  paceOrSpeed, fmtHours, fmtKm, fmtClock, sportGroup,
} from '../utils/profileStats';
import { Segmented } from '@mobile/shared/components/Segmented';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── This week + 12-week chart ──────────────────────────────────────────────
export function ThisWeekCard({ runs, sport, weeklyGoalKm }: { runs: StoredRun[]; sport: SportFilter; weeklyGoalKm?: number }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const weeks = useMemo(() => weeklyTotals(filterBySport(runs, sport)), [runs, sport]);
  const [picked, setPicked] = useState<number | null>(null);
  const idx = picked ?? weeks.length - 1;
  const w = weeks[idx];
  const max = Math.max(1, ...weeks.map(x => x.km));
  const isThisWeek = idx === weeks.length - 1;
  const label = isThisWeek ? 'This week'
    : `Week of ${new Date(w.start).getDate()} ${MONTHS[new Date(w.start).getMonth()]}`;
  const showGoal = isThisWeek && sport !== 'ride' && !!weeklyGoalKm && weeklyGoalKm > 0;

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardLabel}>{label}</Text>
        {showGoal && <Text style={s.cardLabel}>Goal {fmtKm(weeklyGoalKm!)} km</Text>}
      </View>
      <View style={s.weekStats}>
        <Stat value={fmtKm(w.km)} unit="km" label="Distance" s={s} big />
        <Stat value={fmtHours(w.sec)} label="Time" s={s} />
        <Stat value={String(w.count)} label={w.count === 1 ? 'Activity' : 'Activities'} s={s} />
      </View>
      {showGoal && (
        <View style={s.goalTrack}>
          <View style={[s.goalFill, { width: `${Math.round(Math.min(1, w.km / weeklyGoalKm!) * 100)}%` }]} />
        </View>
      )}

      {/* 12 weeks of volume; tap a bar to see that week. */}
      <View style={s.chart}>
        {weeks.map((x, i) => {
          const on = i === idx;
          const h = x.km > 0 ? Math.max(4, Math.round((x.km / max) * 64)) : 2;
          return (
            <Pressable
              key={x.start}
              style={s.barHit}
              onPress={() => setPicked(i === weeks.length - 1 ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={`${fmtKm(x.km)} km, week of ${new Date(x.start).toDateString()}`}
            >
              <View style={[s.bar, { height: h, backgroundColor: on ? C.red : x.km > 0 ? C.t1 : C.border }]} />
            </Pressable>
          );
        })}
      </View>
      <View style={s.chartAxis}>
        <Text style={s.axisTxt}>{MONTHS[new Date(weeks[0].start).getMonth()]}</Text>
        <Text style={s.axisTxt}>12 weeks</Text>
        <Text style={s.axisTxt}>Now</Text>
      </View>
    </View>
  );
}

// ── Statistics: this year / all time ───────────────────────────────────────
export function StatsCard({ runs, sport }: { runs: StoredRun[]; sport: SportFilter }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [period, setPeriod] = useState<'year' | 'all'>('year');
  const st = useMemo(() => periodStats(filterBySport(runs, sport), period), [runs, sport, period]);
  // "All" mixes sports, so it shows time rather than an average pace.
  const avg = sport === 'all' ? null : paceOrSpeed(st.km, st.sec, sport);
  const year = new Date().getFullYear();
  const longestLabel = sport === 'ride' ? 'Longest ride' : sport === 'walk' ? 'Longest walk' : sport === 'run' ? 'Longest run' : 'Longest';

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardLabel}>Statistics</Text>
        <Segmented size="sm" fit options={[{ value: 'year', label: String(year) }, { value: 'all', label: 'All time' }]} value={period} onChange={setPeriod} />
      </View>
      <View style={s.statsGrid}>
        <GridStat label="Activities" value={st.count.toLocaleString('en-US')} s={s} />
        <GridStat label="Distance" value={fmtKm(st.km)} unit="km" s={s} />
        <GridStat label="Time" value={fmtHours(st.sec)} s={s} />
        {avg
          ? <GridStat label={sport === 'ride' ? 'Avg speed' : 'Avg pace'} value={avg.value} unit={avg.unit} s={s} />
          : <GridStat label="Longest" value={fmtKm(st.longestKm)} unit="km" s={s} />}
        {avg && <GridStat label={longestLabel} value={fmtKm(st.longestKm)} unit="km" s={s} />}
      </View>
    </View>
  );
}

// ── Recent activities ──────────────────────────────────────────────────────
export function RecentActivities({ runs, sport, onOpen, onAll, emptyText, pinnedId, onPin }: {
  runs: StoredRun[]; sport: SportFilter;
  /** The run pinned to the top of the profile, if any (P4). */
  pinnedId?: string | null;
  /** Own profile only: long-press a row to pin or unpin it. */
  onPin?: (runId: string | null) => void;
  /** Omitted on someone else's profile: rows are not tappable. */
  onOpen?: (run: StoredRun) => void; onAll?: () => void;
  emptyText?: string;
}) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const zone = territoryPalette(useIsDark());
  const list = useMemo(
    // Under 50 m is a false start, not an activity worth listing.
    () => filterBySport(runs, sport).filter(r => r.distanceMeters >= 50).sort((a, b) => b.startTime - a.startTime),
    [runs, sport],
  );
  const pinned = pinnedId ? list.find(r => r.id === pinnedId) : undefined;
  const recent = pinned ? [pinned, ...list.filter(r => r.id !== pinned.id).slice(0, 2)] : list.slice(0, 3);
  const askPin = (r: StoredRun) => {
    if (!onPin) return;
    const isPinned = r.id === pinnedId;
    Alert.alert(isPinned ? 'Unpin this activity?' : 'Pin to your profile?',
      isPinned ? 'It goes back to its place by date.' : 'It stays at the top of Recent activities, for you and anyone who views your profile.',
      [{ text: 'Cancel', style: 'cancel' }, { text: isPinned ? 'Unpin' : 'Pin', onPress: () => onPin(isPinned ? null : r.id) }]);
  };

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardLabel}>Recent activities</Text>
        {list.length > 0 && (
          <Pressable onPress={onAll} disabled={!onAll} hitSlop={8} accessibilityRole={onAll ? 'button' : 'text'}>
            <Text style={s.seeAll}>{onAll ? `All ${list.length}` : `${list.length} shown`}</Text>
          </Pressable>
        )}
      </View>
      {recent.length === 0 ? (
        <Text style={s.empty}>{emptyText ?? 'Nothing yet. Your activities show up here.'}</Text>
      ) : recent.map((r, i) => {
        const sp = sportFor(r.activityType);
        const Icon = sp.icon;
        const km = (r.verifiedDistanceKm ?? r.distanceMeters / 1000);
        const ps = paceOrSpeed(km, r.durationSec, sportGroup(r.activityType));
        const zones = r.serverResult ? r.serverResult.newZones + r.serverResult.stolenZones : r.territoriesClaimed.length;
        const d = new Date(r.startTime);
        return (
          <Pressable key={r.id} style={[s.actRow, i > 0 && s.actRowBorder]} onPress={onOpen ? () => onOpen(r) : undefined} onLongPress={onPin ? () => askPin(r) : undefined} disabled={!onOpen && !onPin} accessibilityRole={onOpen ? 'button' : 'text'} accessibilityHint={onPin ? 'Long-press to pin or unpin' : undefined}>
            <View style={s.actIcon}><Icon size={18} color={C.t1} weight="regular" /></View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                {r.id === pinnedId && <PushPin size={12} color={C.red} weight="fill" />}
                <Text style={[s.actTitle, { flexShrink: 1 }]} numberOfLines={1}>{r.title || activityTitle(r)}</Text>
              </View>
              <Text style={s.actMeta} numberOfLines={1}>
                {r.excluded ? 'Not counted · ' : ''}{d.getDate()} {MONTHS[d.getMonth()]} · {fmtKm(km)} km · {fmtClock(r.durationSec)} · {ps.value}{ps.unit === 'km/h' ? ' km/h' : ps.unit}
              </Text>
            </View>
            {zones > 0 && (
              <View style={[s.zoneChip, { backgroundColor: C.redLo }]}>
                <Hexagon size={10} color={zone.own} weight="fill" />
                <Text style={[s.zoneChipTxt, { color: zone.own }]}>{zones}</Text>
              </View>
            )}
            {onOpen && <CaretRight size={14} color={C.t3} weight="bold" />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Best efforts ───────────────────────────────────────────────────────────
const EFFORTS: { label: string; title: string }[] = [
  { label: 'Fastest 1K', title: '1 km' },
  { label: 'Fastest 5K', title: '5 km' },
  { label: 'Fastest 10K', title: '10 km' },
  { label: 'Longest Run', title: 'Longest run' },
  { label: 'Best Pace', title: 'Best pace' },
];

/** Mock: "Best efforts" as label / time rows with hairlines. */
export function BestEfforts({ records }: { records: { label: string; value: string }[] }) {
  const C = useTheme();
  const byLabel = new Map(records.map(r => [r.label, r.value]));
  if (!EFFORTS.some(e => byLabel.has(e.label))) return null;
  return (
    <View style={{ marginHorizontal: 20, borderRadius: 26, backgroundColor: C.card, padding: 18, gap: 12 }}>
      <Text style={{ fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1 }}>Best efforts</Text>
      {EFFORTS.map((e, i) => (
        <View key={e.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: i < EFFORTS.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
          <Text style={{ fontFamily: Fonts.regular, fontSize: 15, color: C.t1 }}>{e.title}</Text>
          <Text style={{ fontFamily: Fonts.semiBold, fontSize: 15, color: byLabel.has(e.label) ? C.t1 : C.t2 }}>{byLabel.get(e.label) ?? '–'}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Bits ───────────────────────────────────────────────────────────────────
function Stat({ value, unit, label, s, big, color }: {
  value: string; unit?: string; label: string; s: ReturnType<typeof mkStyles>; big?: boolean; color?: string;
}) {
  return (
    <View style={s.stat}>
      <Text style={s.statLine} numberOfLines={1}>
        <Text style={[big ? s.statBig : s.statNum, color ? { color } : null]}>{value}</Text>
        {unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function GridStat({ label, value, unit, s }: { label: string; value: string; unit?: string; s: ReturnType<typeof mkStyles> }) {
  return (
    <View style={s.gridCell}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statLine} numberOfLines={1}>
        <Text style={s.statNum}>{value}</Text>
        {unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16,
      shadowColor: '#14120F', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    cardHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    cardLabel:    { ...Type.labelSm, color: C.t2 },
    seeAll:       { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    empty:        { ...Type.bodySm, color: C.t3, paddingVertical: 6 },
    rowCenter:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footnote:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 10 },

    // Segmented control (mock: 3pt padding, 32pt items).

    weekStats:    { flexDirection: 'row', alignItems: 'flex-end' },
    stat:         { flex: 1 },
    statLine:     { flexDirection: 'row' },
    statBig:      { fontFamily: Fonts.numeric, fontSize: 34, lineHeight: 34, color: C.t1, fontVariant: ['tabular-nums'] },
    statNum:      { fontFamily: Fonts.numeric, fontSize: 22, lineHeight: 24, color: C.t1, fontVariant: ['tabular-nums'] },
    statUnit:     { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    statLabel:    { ...Type.labelSm, color: C.t2, marginTop: 4 },
    goalTrack:    { height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: 12, overflow: 'hidden' },
    goalFill:     { height: 4, borderRadius: 2, backgroundColor: C.red },

    chart:        { flexDirection: 'row', alignItems: 'flex-end', height: 72, marginTop: 16, gap: 4 },
    barHit:       { flex: 1, height: 72, justifyContent: 'flex-end' },
    bar:          { borderRadius: 3 },
    chartAxis:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    axisTxt:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },

    statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
    gridCell:     { width: '50%' },

    actRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    actRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
    actIcon:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    actTitle:     { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    actMeta:      { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 2 },
    zoneChip:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, height: 20, borderRadius: 10 },
    zoneChipTxt:  { fontFamily: Fonts.semiBold, fontSize: 11 },

    effortGrid:   { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
    effort:       { width: '33.33%' },
    effortTitle:  { ...Type.labelSm, color: C.t2 },
    effortVal:    { fontFamily: Fonts.numeric, fontSize: 20, lineHeight: 22, color: C.t1, marginTop: 4, fontVariant: ['tabular-nums'] },
  });
}
