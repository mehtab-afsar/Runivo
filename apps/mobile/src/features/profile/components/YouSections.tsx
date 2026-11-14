/**
 * The "You" profile, Strava-style (see the Runivo profile redesign canvas):
 * compact identity, one This week card with a sport chip, a pinned activity,
 * menu rows that open full pages, a trophy strip and clubs.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { CaretRight, PushPin, PencilSimple } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import { RouteThumb } from '@mobile/shared/components/RouteThumb';
import { GlyphIcon } from '@mobile/shared/components/GlyphIcon';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import type { AwardId } from '@shared/types/game';
import type { StoredRun } from '@shared/services/store';
import { sportFor } from '@features/run/constants/activities';
import { filterBySport, weeklyTotals, sportGroup, type SportFilter } from '../utils/profileStats';
import { SportChip } from './SportPicker';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtKm(km: number): string { return km >= 100 ? Math.round(km).toString() : km.toFixed(1); }
export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export function activityMeta(r: StoredRun): string {
  const km = r.verifiedDistanceKm ?? r.distanceMeters / 1000;
  const d = new Date(r.startTime);
  const g = sportGroup(r.activityType);
  let pace = '';
  if (km > 0.05 && r.durationSec > 0) {
    if (g === 'ride') pace = ` · ${(km / (r.durationSec / 3600)).toFixed(1)} km/h`;
    else { const p = r.durationSec / km; pace = ` · ${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')} /km`; }
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${fmtKm(km)} km · ${fmtClock(r.durationSec)}${pace}`;
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
  rankLabel: string; rankNext: string | null;
  following: number; followers: number; zonesHeld: number; score: number;
  onFollowing: () => void; onFollowers: () => void; onZones: () => void; onScore: () => void;
  onEdit: () => void; onShare: () => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const Count = ({ label, value, red, onPress }: { label: string; value: string; red?: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${value} ${label}`}>
      <Text style={s.countLabel}>{label}</Text>
      <Text style={[s.countNum, red && { color: C.red }]}>{value}</Text>
    </Pressable>
  );
  return (
    <View style={s.headWrap}>
      <View style={s.idRow}>
        <View style={s.avatarRing}><Avatar uri={p.avatarUri} name={p.name} color={p.avatarColor} size={68} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={s.name} numberOfLines={1}>{p.name}</Text>
          {!!p.location && <Text style={s.loc} numberOfLines={1}>{p.location}</Text>}
          <View style={s.rankRow}>
            <View style={s.rankChip}><Text style={s.rankChipTxt}>{p.rankLabel}</Text></View>
            {p.rankNext && <Text style={s.rankNext} numberOfLines={1}>{p.rankNext}</Text>}
          </View>
        </View>
      </View>
      <View style={s.countRow}>
        <Count label="Following" value={String(p.following)} onPress={p.onFollowing} />
        <Count label="Followers" value={String(p.followers)} onPress={p.onFollowers} />
        <Count label="Zones held" value={String(p.zonesHeld)} red onPress={p.onZones} />
        <Count label="Score" value={p.score.toLocaleString()} onPress={p.onScore} />
      </View>
      <View style={s.btnRow}>
        <Pressable style={s.btnOutline} onPress={p.onEdit} accessibilityRole="button"><Text style={s.btnTxt}>Edit profile</Text></Pressable>
        <Pressable style={s.btnFill} onPress={p.onShare} accessibilityRole="button"><Text style={s.btnTxt}>Share</Text></Pressable>
      </View>
    </View>
  );
}

// ── This week ───────────────────────────────────────────────────────────────
export function WeekCard({ runs, sport, onSport, goalKm, onEditGoal }: {
  runs: StoredRun[]; sport: SportFilter; onSport: (s: SportFilter) => void; goalKm: number; onEditGoal: () => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const filtered = useMemo(() => filterBySport(runs, sport), [runs, sport]);
  const weeks = useMemo(() => weeklyTotals(filtered), [filtered]);
  const allWeeks = useMemo(() => weeklyTotals(runs), [runs]);
  const thisWeek = weeks[weeks.length - 1];
  const weekStartMs = thisWeek?.start ?? 0;
  const zones = useMemo(() => filtered.filter(r => !r.excluded && r.startTime >= weekStartMs).reduce((n, r) => n + zonesOf(r), 0), [filtered, weekStartMs]);
  const max = Math.max(1, ...weeks.map(w => w.km));
  // The goal counts every sport, so it reads the same whatever the chip says.
  const goalDone = allWeeks[allWeeks.length - 1]?.km ?? 0;
  const goalPct = goalKm > 0 ? Math.min(1, goalDone / goalKm) : 0;
  const monthLabels = weeks.map((w, i) => {
    const m = new Date(w.start).getMonth();
    const prev = i > 0 ? new Date(weeks[i - 1].start).getMonth() : -1;
    return m !== prev ? MONTHS[m] : '';
  });

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>This week</Text>
        <SportChip value={sport} onChange={onSport} note="Applies to This week, the 12-week chart and Statistics." />
      </View>
      <View style={s.weekGrid}>
        <View style={s.weekCell}><Text style={s.statLabel}>Distance</Text><Text style={s.statNum}>{fmtKm(thisWeek?.km ?? 0)}<Text style={s.statUnit}> km</Text></Text></View>
        <View style={s.weekCell}><Text style={s.statLabel}>Time</Text><Text style={s.statNum}>{fmtDuration(thisWeek?.sec ?? 0)}</Text></View>
        <View style={s.weekCell}><Text style={s.statLabel}>Zones</Text><Text style={[s.statNum, zones > 0 && { color: C.red }]}>{zones > 0 ? `+${zones}` : '0'}</Text></View>
      </View>
      <Pressable style={s.goalHead} onPress={onEditGoal} accessibilityRole="button" accessibilityLabel={`Weekly goal ${goalKm} km. Edit`}>
        <Text style={s.small}>Weekly goal</Text>
        <View style={s.goalRight}>
          <Text style={s.smallStrong}>{fmtKm(goalDone)} / {goalKm} km</Text>
          <PencilSimple size={12} color={C.t1} weight="bold" />
        </View>
      </Pressable>
      <View style={s.track}><View style={[s.fill, { width: `${Math.round(goalPct * 100)}%` }]} /></View>
      <Text style={[s.small, { marginTop: 16 }]}>Last 12 weeks</Text>
      <View style={s.bars}>
        {weeks.map((w, i) => (
          <View key={w.start} style={[s.bar, { height: w.km > 0 ? `${Math.max(6, Math.round((w.km / max) * 100))}%` : 0, backgroundColor: i === weeks.length - 1 ? C.red : C.surface }]} />
        ))}
      </View>
      <View style={s.months}>
        {monthLabels.map((m, i) => <Text key={i} style={s.monthTxt}>{m}</Text>)}
      </View>
    </View>
  );
}

// ── Pinned activity ─────────────────────────────────────────────────────────
export function PinnedCard({ run, onOpen, onUnpin }: { run: StoredRun; onOpen: () => void; onUnpin?: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const z = zonesOf(run);
  return (
    <Pressable style={[s.card, { padding: 0, overflow: 'hidden' }]} onPress={onOpen} onLongPress={onUnpin} accessibilityRole="button" accessibilityHint={onUnpin ? 'Long-press to unpin' : undefined}>
      <View>
        <RouteThumb points={run.gpsPoints} width={Dimensions.get('window').width - 36} height={120} radius={0} stroke={3.5} />
        <View style={s.pinTag}><PushPin size={11} color={C.bg} weight="fill" /><Text style={s.pinTagTxt}>Pinned</Text></View>
      </View>
      <View style={s.pinBody}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle} numberOfLines={1}>{activityName(run)}</Text>
          <Text style={s.rowSub} numberOfLines={1}>{activityMeta(run)}</Text>
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
          const bg = !g ? C.surface : STEAL_AWARDS.has(id) ? C.red : def.category === 'territory' ? C.redLo : C.t1;
          const fg = !g ? C.t3 : def.category === 'territory' && !STEAL_AWARDS.has(id) ? C.red : C.alwaysLight;
          return (
            <View key={id} style={s.trophy}>
              <View style={[s.trophyBadge, { backgroundColor: bg }]}><GlyphIcon glyph={def.icon} size={22} color={fg} weight="regular" /></View>
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
              <View style={s.clubBadge}><Text style={s.clubEmoji}>{c.emoji || c.name.slice(0, 2).toUpperCase()}</Text></View>
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
    headWrap: { paddingHorizontal: 18 },
    idRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
    avatarRing: { borderWidth: 2, borderColor: C.red, borderRadius: 40, padding: 2 },
    name: { fontFamily: Fonts.bold, fontSize: 20, color: C.t1, letterSpacing: -0.3 },
    loc: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    rankChip: { backgroundColor: C.t1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    rankChipTxt: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.bg },
    rankNext: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, flexShrink: 1 },
    countRow: { flexDirection: 'row', gap: 22, marginTop: 16 },
    countLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    countNum: { fontFamily: Fonts.bold, fontSize: 17, color: C.t1 },
    btnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    btnOutline: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.t1, alignItems: 'center', justifyContent: 'center' },
    btnFill: { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    btnTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },

    card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginHorizontal: 18 },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontFamily: Fonts.bold, fontSize: 15, color: C.t1 },
    weekGrid: { flexDirection: 'row', marginTop: 14 },
    weekCell: { flex: 1, gap: 2 },
    statLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    statNum: { fontFamily: Fonts.numeric, fontSize: 24, color: C.t1 },
    statUnit: { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
    goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, minHeight: 24 },
    goalRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    small: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
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
    trophyBadge: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
    trophyName: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2, textAlign: 'center' },
    clubRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, marginTop: 10 },
    club: { width: 60, alignItems: 'center', gap: 6 },
    clubBadge: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
    clubEmoji: { fontFamily: Fonts.bold, fontSize: 20, color: C.bg },
  });
}
