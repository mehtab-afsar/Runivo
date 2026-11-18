/**
 * The "You" profile, Strava-style (see the Runivo profile redesign canvas):
 * compact identity, one This week card with a sport chip, a pinned activity,
 * menu rows that open full pages, a trophy strip and clubs.
 */
import React, { useMemo } from 'react';
import { fmtClock } from '@mobile/shared/lib/formatters';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { CaretRight, PushPin } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { useDistanceUnit } from '@mobile/shared/hooks/useDistanceUnit';
import { convertKm, convertPaceMinPerKm } from '@mobile/shared/lib/formatters';
import { Avatar } from '@mobile/shared/components/Avatar';
import { RouteThumb } from '@mobile/shared/components/RouteThumb';
import { GlyphBadge } from '@mobile/shared/icons';
import { ClubInitialsTile } from '@features/clubs/components/ClubHeroCard';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import type { AwardId } from '@shared/types/game';
import type { StoredRun } from '@shared/services/store';
import { sportFor } from '@features/run/constants/activities';
import { filterBySport, weeklyTotals, sportGroup, type SportFilter } from '../utils/profileStats';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtKm(km: number): string { return km >= 100 ? Math.round(km).toString() : km.toFixed(1); }
export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
export function activityMeta(r: StoredRun, unit: 'km' | 'mi' = 'km'): string {
  const km = r.verifiedDistanceKm ?? r.distanceMeters / 1000;
  const d = new Date(r.startTime);
  const g = sportGroup(r.activityType);
  let pace = '';
  if (km > 0.05 && r.durationSec > 0) {
    if (g === 'ride') pace = ` · ${(convertKm(km, unit) / (r.durationSec / 3600)).toFixed(1)} ${unit === 'mi' ? 'mph' : 'km/h'}`;
    else {
      // Round to whole seconds first so 5:59.6 can't print "5:60".
      const total = Math.round(convertPaceMinPerKm(r.durationSec / km / 60, unit) * 60);
      pace = ` · ${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /${unit}`;
    }
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${fmtKm(convertKm(km, unit))} ${unit} · ${fmtClock(r.durationSec)}${pace}`;
}
export function zonesOf(r: StoredRun): number {
  return r.serverResult ? r.serverResult.newZones + r.serverResult.stolenZones : r.territoriesClaimed.length;
}
export function activityName(r: StoredRun): string {
  if (r.title) return r.title;
  const h = new Date(r.startTime).getHours();
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  return `${part} ${sportFor(r.activityType).label.toLowerCase()}`;
}

// ── Header ──────────────────────────────────────────────────────────────────
export function YouHeader(p: {
  name: string; location?: string; avatarUri: string | null; avatarColor: string;
  /** Seed of the illustrated face (the username), so it matches the feed and Edit profile. */
  faceSeed?: string;
  rankLabel: string; runCount: number; isPlus: boolean; bio?: string;
  following: number; followers: number;
  onFollowing: () => void; onFollowers: () => void;
  onEdit: () => void; onShare: () => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const meta = [p.location, p.rankLabel, `${p.runCount} ${p.runCount === 1 ? 'run' : 'runs'}`].filter(Boolean).join(' · ');
  return (
    <View style={s.headWrap}>
      <View style={s.idRow}>
        <View>
          <Avatar uri={p.avatarUri} name={p.name} seed={p.faceSeed} color={p.avatarColor} size={76} />
          {p.isPlus && <View style={s.plusBadge}><Text style={s.plusBadgeTxt}>PLUS</Text></View>}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={s.name} numberOfLines={1}>{p.name}</Text>
          <Text style={s.loc} numberOfLines={1}>{meta}</Text>
          <Text style={s.counts} numberOfLines={1}>
            <Text style={s.countNum} onPress={p.onFollowers}>{p.followers}</Text><Text style={s.countLbl} onPress={p.onFollowers}> followers</Text>
            <Text style={s.countLbl}> · </Text>
            <Text style={s.countNum} onPress={p.onFollowing}>{p.following}</Text><Text style={s.countLbl} onPress={p.onFollowing}> following</Text>
          </Text>
        </View>
      </View>
      {!!p.bio && <Text style={s.bio}>{p.bio}</Text>}
      <View style={s.btnRow}>
        <Pressable style={s.btnGrey} onPress={p.onEdit} accessibilityRole="button"><Text style={s.btnTxt}>Edit profile</Text></Pressable>
        <Pressable style={s.btnGrey} onPress={p.onShare} accessibilityRole="button"><Text style={s.btnTxt}>Share profile</Text></Pressable>
      </View>
    </View>
  );
}

/** Mock's sport chips above the progress cards: dark when on. */
export function SportChips({ value, onChange }: { value: SportFilter; onChange: (s: SportFilter) => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const opts: { k: SportFilter; label: string }[] = [
    { k: 'run', label: 'Run' }, { k: 'walk', label: 'Walk' }, { k: 'hike', label: 'Hike' }, { k: 'ride', label: 'Ride' }, { k: 'all', label: 'All' },
  ];
  return (
    <View style={s.chipRow}>
      {opts.map(o => {
        const on = o.k === value;
        return (
          <Pressable key={o.k} style={[s.sChip, on && s.sChipOn]} onPress={() => onChange(o.k)} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Text style={[s.sChipTxt, on && s.sChipTxtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A round chart top above `max` km: 10, 20, 40, 60, 80, 100, 150, 200… */
function niceTop(max: number): number {
  for (const t of [10, 20, 40, 60, 80, 100, 150, 200, 300, 500, 1000]) if (max <= t) return t;
  return Math.ceil(max / 500) * 500;
}

// ── This week ───────────────────────────────────────────────────────────────
export function WeekCard({ runs, sport }: { runs: StoredRun[]; sport: SportFilter }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const unit = useDistanceUnit();
  const filtered = useMemo(() => filterBySport(runs, sport), [runs, sport]);
  const weeks = useMemo(() => weeklyTotals(filtered), [filtered]);
  const thisWeek = weeks[weeks.length - 1];
  const weekStartMs = thisWeek?.start ?? 0;
  const climb = useMemo(() => filtered.filter(r => !r.excluded && r.startTime >= weekStartMs).reduce((n, r) => n + (r.elevationGainM ?? 0), 0), [filtered, weekStartMs]);
  const max = Math.max(1, ...weeks.map(w => w.km));
  const end = new Date(weekStartMs + 6 * 86_400_000);
  const range = weekStartMs ? `${new Date(weekStartMs).getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}` : '';
  // Mock YouProgress: 12 weekly bars (this week in ink), a km scale on the
  // right and month names under the first week of each month.
  const top = niceTop(max);
  const BAR_H = 104;
  const monthAt = weeks.map((w, i) => {
    const m = new Date(w.start).getMonth();
    const starts = i === 0 || new Date(weeks[i - 1].start).getMonth() !== m;
    // The first week's month is left unnamed when the next month starts right
    // after it ("AUG SEP" would overlap).
    const crowded = i === 0 && weeks.slice(1, 3).some(x => new Date(x.start).getMonth() !== m);
    return starts && !crowded ? MONTHS[m].toUpperCase() : '';
  });
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>This week</Text>
        <Text style={s.small}>{range}</Text>
      </View>
      <View style={s.weekGrid}>
        <View style={s.weekCell}><Text style={s.statLabel}>Distance</Text><Text style={s.statNum}>{fmtKm(convertKm(thisWeek?.km ?? 0, unit))} {unit}</Text></View>
        <View style={s.weekCell}><Text style={s.statLabel}>Time</Text><Text style={s.statNum}>{fmtDuration(thisWeek?.sec ?? 0)}</Text></View>
        <View style={s.weekCell}><Text style={s.statLabel}>Elevation</Text><Text style={s.statNum}>{Math.round(unit === 'mi' ? climb * 3.28084 : climb)} {unit === 'mi' ? 'ft' : 'm'}</Text></View>
      </View>
      <Text style={[s.small, { marginTop: 14 }]}>Past 12 weeks</Text>
      <View style={s.chartRow}>
        <View style={[s.wkBars, { height: BAR_H }]}>
          {[0, 0.5, 1].map(f => <View key={f} style={[s.gridLine, { bottom: f * BAR_H }]} />)}
          {weeks.map((w, i) => (
            <View key={w.start} style={s.barSlot}>
              <View style={[s.wkBar, {
                height: Math.max(w.km > 0 ? 4 : 0, (w.km / top) * BAR_H),
                backgroundColor: i === weeks.length - 1 ? C.t1 : C.brandGreen,
              }]} />
            </View>
          ))}
        </View>
        <View style={[s.axis, { height: BAR_H }]}>
          <Text style={s.axisTxt}>{Math.round(convertKm(top, unit))} {unit}</Text>
          <Text style={s.axisTxt}>{Math.round(convertKm(top / 2, unit))} {unit}</Text>
          <Text style={s.axisTxt}>0</Text>
        </View>
      </View>
      {/* Month names start under their first week and may run past it (one
          bar is too narrow for "AUG"), so they are placed, not squeezed. */}
      <View style={s.monthRow}>
        <View style={{ flex: 1, height: 14 }}>
          {monthAt.map((m, i) => m ? (
            <Text key={i} style={[s.wkMonth, { left: `${(i / weeks.length) * 100}%` }]} numberOfLines={1}>{m}</Text>
          ) : null)}
        </View>
        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

/** Weeks in a row with at least one activity, ending this week or last. */
export function weekStreak(runs: StoredRun[]): { weeks: number; last8: ('done' | 'now' | 'open')[] } {
  const w = weeklyTotals(runs.filter(r => !r.excluded), Date.now(), 26);
  const active = w.map(x => x.count > 0);
  let i = active.length - 1;
  if (!active[i]) i -= 1; // this week isn't over yet
  let n = 0;
  while (i >= 0 && active[i]) { n += 1; i -= 1; }
  const last8 = active.slice(-8).map((a, j, arr) => (j === arr.length - 1 ? (a ? 'now' : 'open') : a ? 'done' : 'open')) as ('done' | 'now' | 'open')[];
  return { weeks: n, last8 };
}

// ── Pinned activity ─────────────────────────────────────────────────────────
export function PinnedCard({ run, onOpen, onUnpin }: { run: StoredRun; onOpen: () => void; onUnpin?: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const unit = useDistanceUnit();
  const z = zonesOf(run);
  return (
    <Pressable style={[s.card, { padding: 0, overflow: 'hidden' }]} onPress={onOpen} onLongPress={onUnpin} accessibilityRole="button" accessibilityHint={onUnpin ? 'Long-press to unpin' : undefined}>
      <View>
        <RouteThumb points={run.gpsPoints} width={Dimensions.get('window').width - 40} height={120} radius={0} stroke={3.5} />
        <View style={s.pinTag}><PushPin size={11} color={C.bg} weight="fill" /><Text style={s.pinTagTxt}>Pinned</Text></View>
      </View>
      <View style={s.pinBody}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle} numberOfLines={1}>{activityName(run)}</Text>
          <Text style={s.rowSub} numberOfLines={1}>{activityMeta(run, unit)}</Text>
        </View>
        {z > 0 && <Text style={s.zoneTxt}>+{z} {z === 1 ? 'zone' : 'zones'}</Text>}
      </View>
    </Pressable>
  );
}

// ── Menu rows ───────────────────────────────────────────────────────────────
export interface MenuItem { key: string; label: string; sub?: string; Icon: React.ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'bold' | 'fill' }>; red?: boolean; onPress: () => void }

export function MenuList({ items }: { items: MenuItem[] }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <View style={[s.card, { paddingVertical: 0 }]}>
      {items.map((it, i) => (
        <Pressable key={it.key} style={[s.menuRow, i < items.length - 1 && s.rowBorder]} onPress={it.onPress} accessibilityRole="button">
          <it.Icon size={20} color={it.red ? C.red : C.t1} weight="regular" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rowTitle}>{it.label}</Text>
            {!!it.sub && <Text style={s.rowSub} numberOfLines={1}>{it.sub}</Text>}
          </View>
          <CaretRight size={14} color={C.t3} weight="bold" />
        </Pressable>
      ))}
    </View>
  );
}

// ── Trophy case ─────────────────────────────────────────────────────────────
const STEAL_AWARDS: ReadonlySet<string> = new Set(['first_blood', 'defender']);
const NEXT_UP: AwardId[] = ['first_claim', 'first_5k', 'first_10k', 'streak_7', 'first_blood', 'district_owner', 'sub_5', 'km_100', 'defender'];

export function TrophyStrip({ earned, onAll }: { earned: { awardId: string; unlockedAt: string }[]; onAll: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const got = earned.filter(a => a.awardId in AWARD_DEFINITIONS).sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));
  const gotIds = new Set(got.map(a => a.awardId));
  const strip: { id: AwardId; got: boolean }[] = [
    ...got.slice(0, 5).map(a => ({ id: a.awardId as AwardId, got: true })),
    ...NEXT_UP.filter(id => !gotIds.has(id)).map(id => ({ id, got: false })),
  ].slice(0, 5);
  return (
    <View>
      <View style={s.sectionHead}>
        <Text style={s.cardTitle}>Trophy case</Text>
        <Pressable onPress={onAll} hitSlop={8} accessibilityRole="button"><Text style={s.link}>{got.length > 0 ? `All ${got.length}` : 'See all'}</Text></Pressable>
      </View>
      <View style={s.trophyRow}>
        {strip.map(({ id, got: g }) => {
          const def = AWARD_DEFINITIONS[id];
          return (
            <View key={id} style={s.trophy}>
              <GlyphBadge glyph={def.icon} size={54} muted={!g} solid={g && STEAL_AWARDS.has(id)} />
              <Text style={[s.trophyName, !g && { color: C.t3 }]} numberOfLines={2}>{def.title}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Clubs ───────────────────────────────────────────────────────────────────
export function ClubsStrip({ clubs, onOpen, onAll }: { clubs: { id: string; name: string; emoji: string }[]; onOpen: (id: string, name: string) => void; onAll: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <View>
      <View style={s.sectionHead}>
        <Text style={s.cardTitle}>Clubs</Text>
        <Pressable onPress={onAll} hitSlop={8} accessibilityRole="button"><Text style={s.link}>{clubs.length > 0 ? 'See all' : 'Find a club'}</Text></Pressable>
      </View>
      {clubs.length === 0 ? (
        <Text style={[s.rowSub, { paddingHorizontal: 18, marginTop: 8 }]}>Join a club to run and claim ground together.</Text>
      ) : (
        <View style={s.clubRow}>
          {clubs.slice(0, 6).map(c => (
            <Pressable key={c.id} style={s.club} onPress={() => onOpen(c.id, c.name)} accessibilityRole="button" accessibilityLabel={c.name}>
              <ClubInitialsTile name={c.name} size={48} shape="hex" />
              <Text style={s.trophyName} numberOfLines={1}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}


function mk(C: AppColors) {
  return StyleSheet.create({
    headWrap: { paddingHorizontal: 20, gap: 14 },
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 18, gap: 6 },
    wkBars:   { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
    barSlot:  { flex: 1, justifyContent: 'flex-end', height: '100%' },
    wkBar:    { borderRadius: 4, width: '100%' },
    axis:     { width: 40, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: -6, marginTop: -6 },
    axisTxt:  { fontFamily: Fonts.regular, fontSize: 10, color: C.t2 },
    monthRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    wkMonth:  { position: 'absolute', top: 0, width: 40, fontFamily: Fonts.regular, fontSize: 10, color: C.t2 },
    idRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    initials: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    initialsTxt: { fontFamily: Fonts.semiBold, fontSize: 26, color: C.lime },
    plusBadge: { position: 'absolute', right: -4, bottom: -2, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: C.lime, justifyContent: 'center', borderWidth: 2, borderColor: C.card },
    plusBadgeTxt: { fontFamily: Fonts.bold, fontSize: 11, color: C.alwaysDark },
    name: { fontFamily: Fonts.semiBold, fontSize: 22, color: C.t1, letterSpacing: -0.3 },
    loc: { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    counts: { fontFamily: Fonts.regular, fontSize: 14 },
    countNum: { fontFamily: Fonts.semiBold, color: C.t1 },
    countLbl: { color: C.t2 },
    bio: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t1 },
    btnRow: { flexDirection: 'row', gap: 10 },
    btnGrey: { flex: 1, height: 42, borderRadius: 21, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    btnTxt: { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
    sChip: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: C.card, justifyContent: 'center' },
    sChipOn: { backgroundColor: C.alwaysDark },
    sChipTxt: { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    sChipTxtOn: { fontFamily: Fonts.medium, color: C.alwaysLight },

    card: { backgroundColor: C.card, borderRadius: 26, padding: 18, marginHorizontal: 20 },
    cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    cardTitle: { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1 },
    weekGrid: { flexDirection: 'row', marginTop: 14 },
    weekCell: { flex: 1, gap: 2 },
    statLabel: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    statNum: { fontFamily: Fonts.numeric, fontSize: 24, color: C.t1 },
    statUnit: { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
    goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, minHeight: 24 },
    goalRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    small: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    smallStrong: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1 },
    track: { height: 6, borderRadius: 3, backgroundColor: C.surface, marginTop: 6, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3, backgroundColor: C.red },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 72, marginTop: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
    months: { flexDirection: 'row', gap: 6, marginTop: 4 },
    monthTxt: { flex: 1, fontFamily: Fonts.regular, fontSize: 10, color: C.t2, overflow: 'visible' },

    pinTag: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.t1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    pinTagTxt: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.bg },
    pinBody: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
    zoneTxt: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.red },

    menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 8 },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 1 },

    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 18 },
    link: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    trophyRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 10 },
    trophy: { width: 62, alignItems: 'center', gap: 6 },
    trophyName: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2, textAlign: 'center' },
    clubRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, marginTop: 10 },
    club: { width: 60, alignItems: 'center', gap: 6 },
  });
}
