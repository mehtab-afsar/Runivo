/**
 * The Profile page's middle sections, in the order of the design mock:
 * 12-week activity heatmap, awards strip, best 5K / 10K, the Plus zone-cap
 * card (free runners only) and the settings list. Everything comes from the
 * runner's real data; a section with nothing to show is left out.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ArrowRight, ChevronRight, Crown } from 'lucide-react-native';
import { useTheme, Fonts, Type, type AppColors } from '@theme';
import { GlyphIcon } from '@mobile/shared/components/GlyphIcon';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import type { StoredRun } from '@shared/services/store';
import type { AwardId } from '@shared/types/game';

/** Steal-and-defend awards are red, other territory awards blue, the rest black. */
const STEAL_AWARDS: ReadonlySet<string> = new Set(['first_blood', 'defender']);
/** Order locked badges appear in: the easiest to unlock first. */
const NEXT_UP: AwardId[] = ['first_claim', 'first_5k', 'first_10k', 'streak_7', 'first_blood', 'district_owner', 'sub_5', 'km_100', 'defender'];

const DAY_MS = 86_400_000;
const WEEKS = 12;

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** km per local day for the last 12 weeks, Monday-first columns. */
export function heatmapGrid(runs: StoredRun[], now = Date.now()) {
  const kmByDay = new Map<string, number>();
  for (const r of runs) {
    const k = dayKey(r.startTime);
    kmByDay.set(k, (kmByDay.get(k) ?? 0) + r.distanceMeters / 1000);
  }
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const start = today.getTime() - (dow + (WEEKS - 1) * 7) * DAY_MS;
  const cols: { km: number; future: boolean }[][] = [];
  let active = 0;
  for (let w = 0; w < WEEKS; w++) {
    const col: { km: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const t = start + (w * 7 + d) * DAY_MS;
      const km = kmByDay.get(dayKey(t)) ?? 0;
      if (km > 0) active++;
      col.push({ km, future: t > today.getTime() });
    }
    cols.push(col);
  }
  return { cols, active };
}

interface Props {
  runs: StoredRun[];
  earnedAwards: { awardId: string; unlockedAt: string }[];
  personalRecords: { label: string; value: string }[];
  /** Zones held right now, and the plan's limit (Infinity on Plus). */
  zonesHeld: number;
  zoneLimit: number;
  isPlus: boolean;
  clubCount: number | null;
  onSeeAllAwards: () => void;
  onUpgrade: () => void;
  onClubs: () => void;
  onConnected: () => void;
  onPrivacy: () => void;
  /** The page shows Best efforts elsewhere; skip the 5K / 10K card. */
  hideBest?: boolean;
}

export function ProfileMockSections(p: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { cols, active } = useMemo(() => heatmapGrid(p.runs), [p.runs]);

  const shade = (km: number, future: boolean) => {
    if (future) return 'transparent';
    if (km <= 0) return C.border;
    if (km < 3) return C.redLo;
    if (km < 6) return 'rgba(255,69,24,0.45)';
    if (km < 10) return 'rgba(255,69,24,0.7)';
    return C.red;
  };

  const totalAwards = Object.keys(AWARD_DEFINITIONS).length;
  const earned = p.earnedAwards
    .filter(a => a.awardId in AWARD_DEFINITIONS)
    .sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt));
  // Six badges, as in the mock: what you've earned, then what's next, greyed.
  const earnedIds = new Set(earned.map(a => a.awardId));
  const strip: { id: AwardId; got: boolean }[] = [
    ...earned.slice(0, 6).map(a => ({ id: a.awardId as AwardId, got: true })),
    ...NEXT_UP.filter(id => !earnedIds.has(id)).map(id => ({ id, got: false })),
  ].slice(0, 6);
  const best5k = p.personalRecords.find(r => r.label === 'Fastest 5K');
  const best10k = p.personalRecords.find(r => r.label === 'Fastest 10K');

  return (
    <View style={s.wrap}>
      {/* Last 12 weeks */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardLabel}>Last 12 weeks</Text>
          <Text style={s.cardLabel}>{active} active {active === 1 ? 'day' : 'days'}</Text>
        </View>
        <View style={s.heatmap}>
          {cols.map((col, w) => (
            <View key={w} style={s.heatCol}>
              {col.map((cell, d) => (
                <View key={d} style={[s.heatCell, { backgroundColor: shade(cell.km, cell.future) }]} />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Awards */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardLabel}>Awards · {earned.length} of {totalAwards}</Text>
          <Pressable onPress={p.onSeeAllAwards} hitSlop={8}>
            <Text style={s.seeAll}>See all</Text>
          </Pressable>
        </View>
        <View style={s.awardRow}>
          {strip.map(({ id, got }) => {
            const def = AWARD_DEFINITIONS[id];
            const bg = !got ? 'transparent'
              : STEAL_AWARDS.has(id) ? C.red
              : def.category === 'territory' ? C.blue
              : C.t1;
            return (
              <View key={id} style={s.award}>
                <View style={[s.awardBadge, { backgroundColor: bg }, !got && s.awardLocked]}>
                  <GlyphIcon glyph={def.icon} size={20} color={got ? C.alwaysLight : C.t3} weight="regular" />
                </View>
                <Text style={[s.awardName, !got && { color: C.t3 }]} numberOfLines={2}>{def.title}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Best 5K / 10K */}
      {!p.hideBest && (best5k || best10k) && (
        <View style={[s.card, s.bestRow]}>
          <View style={s.bestCell}>
            <Text style={s.cardLabel}>Best 5K</Text>
            <Text style={s.bestNum}>{best5k?.value ?? '–'}</Text>
          </View>
          <View style={[s.bestCell, s.bestDivider]}>
            <Text style={s.cardLabel}>Best 10K</Text>
            <Text style={s.bestNum}>{best10k?.value ?? '–'}</Text>
          </View>
        </View>
      )}

      {/* Zone cap: free runners only */}
      {!p.isPlus && Number.isFinite(p.zoneLimit) && (
        <Pressable style={s.plusCard} onPress={p.onUpgrade} accessibilityRole="button">
          <Crown size={20} color={C.red} strokeWidth={1.8} />
          <View style={{ flex: 1 }}>
            <Text style={s.plusTitle}>{Math.min(p.zonesHeld, p.zoneLimit)} of {p.zoneLimit} zones used</Text>
            <Text style={s.plusSub}>Runivo Plus removes the cap</Text>
          </View>
          <ArrowRight size={16} color={C.alwaysLight} strokeWidth={1.8} />
        </Pressable>
      )}

      {/* Settings list */}
      <View style={[s.card, s.list]}>
        <ListRow label="Clubs" value={p.clubCount == null ? undefined : `${p.clubCount} ${p.clubCount === 1 ? 'club' : 'clubs'}`} onPress={p.onClubs} styles={s} />
        <ListRow label="Connected" onPress={p.onConnected} styles={s} chevron />
        <ListRow label="Privacy and live sharing" onPress={p.onPrivacy} styles={s} arrow last />
      </View>
    </View>
  );
}

function ListRow({ label, value, onPress, styles: s, last, arrow, chevron }: {
  label: string; value?: string; onPress: () => void; styles: ReturnType<typeof mkStyles>;
  last?: boolean; arrow?: boolean; chevron?: boolean;
}) {
  const C = useTheme();
  return (
    <Pressable style={[s.row, !last && s.rowBorder]} onPress={onPress} accessibilityRole="button">
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      {arrow ? <ArrowRight size={16} color={C.t2} strokeWidth={1.8} /> : null}
      {chevron && !value ? <ChevronRight size={16} color={C.t3} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:        { paddingHorizontal: 18, gap: 12 },
    card:        {
      backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16,
      shadowColor: '#14120F', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    cardHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    cardLabel:   { ...Type.labelSm, color: C.t2 },
    seeAll:      { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    empty:       { ...Type.bodySm, color: C.t3 },
    // 12 weeks × 7 days in a 100pt-tall grid, 3pt gaps, as in the mock.
    heatmap:     { flexDirection: 'row', gap: 3, height: 100 },
    heatCol:     { flex: 1, gap: 3 },
    heatCell:    { flex: 1, borderRadius: 2 },
    awardRow:    { flexDirection: 'row', gap: 6, marginTop: 2 },
    award:       { flex: 1, alignItems: 'center', gap: 6 },
    awardBadge:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
    awardLocked: { borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed' },
    awardName:   { fontFamily: Fonts.regular, fontSize: 11, lineHeight: 13, color: C.t2, textAlign: 'center' },
    bestRow:     { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 0 },
    bestCell:    { flex: 1, paddingHorizontal: 16 },
    bestDivider: { borderLeftWidth: 1, borderLeftColor: C.border },
    bestNum:     { fontFamily: Fonts.numeric, fontSize: 28, lineHeight: 26, color: C.t1, marginTop: 6, fontVariant: ['tabular-nums'] },
    plusCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.alwaysDark, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
    plusTitle:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    plusSub:     { fontFamily: Fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    list:        { paddingVertical: 0 },
    row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
    rowBorder:   { borderBottomWidth: 1, borderBottomColor: C.border },
    rowLabel:    { fontFamily: Fonts.medium, fontSize: 14, color: C.t1, flex: 1 },
    rowValue:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
  });
}
