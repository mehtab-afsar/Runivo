import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendUp, NavigationArrow, Lightning, Globe, Flag, CaretDown, Users as UsersIcon, ShieldChevron as ShieldIcon, MapPin as PinIcon } from 'phosphor-react-native';
import type { LeaderboardTab, LeaderboardTimeFrame, LeaderboardScope } from '../types';
import { useAreaNames } from '../hooks/useAreaNames';
import { useTheme, Type, Fonts, Spacing, haptic, type AppColors } from '@theme';
import { BottomSheet } from '@mobile/shared/components/BottomSheet';

interface Props {
  tab: LeaderboardTab;
  timeFrame: LeaderboardTimeFrame;
  scope: LeaderboardScope;
  onTabChange: (t: LeaderboardTab) => void;
  onTimeFrameChange: (tf: LeaderboardTimeFrame) => void;
  onScopeChange: (s: LeaderboardScope) => void;
  /** 'pill' = the "This week · Global" chip (header); 'segment' = Territory / Distance / PACE. */
  part: 'pill' | 'segment';
}

const METRIC_TABS: { value: LeaderboardTab; label: string; Icon: typeof TrendUp }[] = [
  { value: 'territory_score', label: 'Territory', Icon: NavigationArrow },
  { value: 'distance',        label: 'Distance',  Icon: TrendUp         },
  { value: 'weekly_pace',     label: 'PACE',      Icon: Lightning       },
];

const TIMEFRAMES: { value: LeaderboardTimeFrame; label: string }[] = [
  { value: 'week',  label: 'This week'  },
  { value: 'month', label: 'This month' },
  { value: 'all',   label: 'All time'   },
];

const SCOPE_DEFS: { value: LeaderboardScope; label: string; Icon: typeof Globe }[] = [
  { value: 'global',   label: 'Global',   Icon: Globe },
  { value: 'national', label: 'National', Icon: Flag  },
  { value: 'following', label: 'Following', Icon: UsersIcon },
  { value: 'clubs',    label: 'My clubs', Icon: ShieldIcon },
  { value: 'city',     label: 'Near you', Icon: PinIcon },
  { value: 'area',     label: 'Neighbourhood', Icon: PinIcon },
];

// Collapses the old 3 stacked pill rows (metric / timeframe / scope) into one:
// a segmented metric switch (the dimension people actually flip between) plus
// a single "This Week · Global" chip that opens a sheet for the other two —
// the board is visible on first paint instead of three rows down.
export function LeaderboardFilters({ tab, timeFrame, scope, onTabChange, onTimeFrameChange, onScopeChange, part }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const timeFrameLabel = TIMEFRAMES.find(t => t.value === timeFrame)?.label ?? 'This week';
  const names = useAreaNames();
  // Local boards take the place's name when the phone knows it.
  const labelFor = (v: LeaderboardScope, fallback: string) =>
    v === 'city' && names.city ? names.city : v === 'area' && names.area ? names.area : fallback;
  const scopeLabel = labelFor(scope, SCOPE_DEFS.find(sc => sc.value === scope)?.label ?? 'Global');

  return (
    <>
      {part === 'segment' ? (
        <View style={s.seg}>
          {METRIC_TABS.map(t => {
            const active = tab === t.value;
            return (
              <Pressable
                key={t.value}
                style={[s.segItem, active && s.segItemActive]}
                onPress={() => { if (!active) { haptic.light(); onTabChange(t.value); } }}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.segLabel, active && s.segLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Pressable
          style={s.scopeChip}
          onPress={() => { haptic.light(); setSheetOpen(true); }}
          hitSlop={4}
          accessibilityRole="button"
        >
          <Text style={s.scopeChipText} numberOfLines={1}>{timeFrameLabel} · {scopeLabel}</Text>
          <CaretDown size={10} color={C.t2} weight="bold" />
        </Pressable>
      )}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} maxHeight={0.42}>
        <View style={s.sheetContent}>
          <Text style={s.sheetLabel}>Time frame</Text>
          <View style={s.sheetRow}>
            {TIMEFRAMES.map(tf => {
              const active = timeFrame === tf.value;
              return (
                <Pressable
                  key={tf.value}
                  style={[s.sheetPill, active && s.sheetPillActive]}
                  onPress={() => { haptic.light(); onTimeFrameChange(tf.value); }}
                >
                  <Text style={[s.sheetPillLabel, active && s.sheetPillLabelActive]}>{tf.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[s.sheetLabel, { marginTop: Spacing.lg }]}>Scope</Text>
          <View style={s.sheetRow}>
            {SCOPE_DEFS.map(sc => {
              const active = scope === sc.value;
              const Icon = sc.Icon;
              return (
                <Pressable
                  key={sc.value}
                  style={[s.sheetPill, active && s.sheetPillActive]}
                  onPress={() => { haptic.light(); onScopeChange(sc.value); }}
                >
                  <Icon size={13} color={active ? C.red : C.t3} weight={active ? 'fill' : 'light'} />
                  <Text style={[s.sheetPillLabel, active && s.sheetPillLabelActive]}>{labelFor(sc.value, sc.label)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={s.sheetDone} onPress={() => { haptic.light(); setSheetOpen(false); }}>
            <Text style={s.sheetDoneText}>Done</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    // Underline tabs, as on the Groups tab and the mock.
    seg:            { flexDirection: 'row', marginBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    segItem:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 11, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    segItemActive:  { borderBottomColor: C.t1 },
    segLabel:       { fontFamily: Fonts.regular, fontSize: 15, color: C.t2 },
    segLabelActive: { fontFamily: Fonts.semiBold, color: C.t1 },
    scopeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.card, borderRadius: 999,
      paddingHorizontal: 14, height: 36,
    },
    scopeChipText: { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    sheetContent:  { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
    sheetLabel:    { ...Type.overline, color: C.t3, marginBottom: 10 },
    sheetRow:      { flexDirection: 'row', gap: 8 },
    sheetPill: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderRadius: Spacing.radius.md,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    sheetPillActive:      { backgroundColor: C.redLo, borderColor: 'rgba(217,53,24,0.3)' },
    sheetPillLabel:       { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
    sheetPillLabelActive: { color: C.red },
    sheetDone: {
      marginTop: Spacing.xl, backgroundColor: C.alwaysDark, borderRadius: Spacing.radius.md,
      paddingVertical: 14, alignItems: 'center',
    },
    sheetDoneText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
  });
}
