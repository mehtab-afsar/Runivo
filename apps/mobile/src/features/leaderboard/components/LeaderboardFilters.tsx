import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendUp, NavigationArrow, Lightning, Globe, Flag, CaretDown } from 'phosphor-react-native';
import type { LeaderboardTab, LeaderboardTimeFrame, LeaderboardScope } from '../types';
import { useTheme, Type, Fonts, Spacing, haptic, type AppColors } from '@theme';
import { BottomSheet } from '@mobile/shared/components/BottomSheet';

interface Props {
  tab: LeaderboardTab;
  timeFrame: LeaderboardTimeFrame;
  scope: LeaderboardScope;
  onTabChange: (t: LeaderboardTab) => void;
  onTimeFrameChange: (tf: LeaderboardTimeFrame) => void;
  onScopeChange: (s: LeaderboardScope) => void;
}

const METRIC_TABS: { value: LeaderboardTab; label: string; Icon: typeof TrendUp }[] = [
  { value: 'territory_score', label: 'Territory', Icon: NavigationArrow },
  { value: 'distance',        label: 'Distance',  Icon: TrendUp         },
  { value: 'weekly_pace',     label: 'PACE',      Icon: Lightning       },
];

const TIMEFRAMES: { value: LeaderboardTimeFrame; label: string }[] = [
  { value: 'week',  label: 'This Week'  },
  { value: 'month', label: 'This Month' },
  { value: 'all',   label: 'All Time'   },
];

const SCOPE_DEFS: { value: LeaderboardScope; label: string; Icon: typeof Globe }[] = [
  { value: 'global',   label: 'Global',   Icon: Globe },
  { value: 'national', label: 'National', Icon: Flag  },
];

// Collapses the old 3 stacked pill rows (metric / timeframe / scope) into one:
// a segmented metric switch (the dimension people actually flip between) plus
// a single "This Week · Global" chip that opens a sheet for the other two —
// the board is visible on first paint instead of three rows down.
export function LeaderboardFilters({ tab, timeFrame, scope, onTabChange, onTimeFrameChange, onScopeChange }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const timeFrameLabel = TIMEFRAMES.find(t => t.value === timeFrame)?.label ?? 'This Week';
  const scopeLabel = SCOPE_DEFS.find(sc => sc.value === scope)?.label ?? 'Global';

  return (
    <>
      <View style={s.bar}>
        <View style={s.seg}>
          {METRIC_TABS.map(t => {
            const active = tab === t.value;
            const Icon = t.Icon;
            return (
              <Pressable
                key={t.value}
                style={[s.segItem, active && s.segItemActive]}
                onPress={() => { if (!active) { haptic.light(); onTabChange(t.value); } }}
                hitSlop={4}
              >
                <Icon size={13} color={active ? C.red : C.t3} weight={active ? 'fill' : 'light'} />
                <Text style={[s.segLabel, active && s.segLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={s.scopeChip}
          onPress={() => { haptic.light(); setSheetOpen(true); }}
          hitSlop={4}
        >
          <Text style={s.scopeChipText} numberOfLines={1}>{timeFrameLabel} · {scopeLabel}</Text>
          <CaretDown size={9} color={C.t3} weight="bold" />
        </Pressable>
      </View>

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
                  <Text style={[s.sheetPillLabel, active && s.sheetPillLabelActive]}>{sc.label}</Text>
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
    bar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: Spacing.gutter, marginBottom: 10,
    },
    seg: {
      flex: 1, flexDirection: 'row', backgroundColor: C.surface,
      borderRadius: Spacing.radius.md, padding: 3, gap: 2,
    },
    segItem: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, paddingVertical: 7, borderRadius: Spacing.radius.sm - 2,
    },
    segItemActive: {
      backgroundColor: C.card,
      shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    segLabel:       { fontFamily: Fonts.medium, fontSize: 11, color: C.t3 },
    segLabelActive: { color: C.red },
    scopeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.surface, borderRadius: Spacing.radius.md,
      paddingHorizontal: 10, paddingVertical: 9, maxWidth: 128,
    },
    scopeChipText: { fontFamily: Fonts.medium, fontSize: 11, color: C.t2 },
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
