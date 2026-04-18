import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendingUp, Navigation, Zap, Globe, Flag, MapPin } from 'lucide-react-native';
import type { LeaderboardTab, LeaderboardTimeFrame, LeaderboardScope } from '../types';
import { useTheme, type AppColors } from '@theme';

interface Props {
  tab: LeaderboardTab;
  timeFrame: LeaderboardTimeFrame;
  scope: LeaderboardScope;
  onTabChange: (t: LeaderboardTab) => void;
  onTimeFrameChange: (tf: LeaderboardTimeFrame) => void;
  onScopeChange: (s: LeaderboardScope) => void;
}

const METRIC_TABS: { value: LeaderboardTab; label: string; Icon: typeof TrendingUp }[] = [
  { value: 'distance',    label: 'Distance', Icon: TrendingUp },
  { value: 'territories', label: 'Zones',    Icon: Navigation },
  { value: 'xp',          label: 'XP',       Icon: Zap        },
];

const TIMEFRAMES: { value: LeaderboardTimeFrame; label: string }[] = [
  { value: 'week',  label: 'This Week'  },
  { value: 'month', label: 'This Month' },
  { value: 'all',   label: 'All Time'   },
];

const SCOPE_DEFS: { value: LeaderboardScope; label: string; Icon: typeof Globe }[] = [
  { value: 'global',   label: 'Global',   Icon: Globe  },
  { value: 'national', label: 'National', Icon: Flag   },
  { value: 'local',    label: 'Local',    Icon: MapPin },
];

export function LeaderboardFilters({ tab, timeFrame, scope, onTabChange, onTimeFrameChange, onScopeChange }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <>
      {/* Metric tabs — icon + label pills */}
      <View style={s.row}>
        {METRIC_TABS.map(t => {
          const active = tab === t.value;
          const Icon = t.Icon;
          return (
            <Pressable
              key={t.value}
              style={[s.pill, active && s.pillActive]}
              onPress={() => onTabChange(t.value)}
            >
              <Icon size={11} color={active ? C.red : C.t3} strokeWidth={1.5} />
              <Text style={[s.pillLabel, active && s.pillLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Time-frame — text pills, active = redLo */}
      <View style={s.tfRow}>
        {TIMEFRAMES.map(tf => {
          const active = timeFrame === tf.value;
          return (
            <Pressable
              key={tf.value}
              style={[s.tfBtn, active && s.tfBtnActive]}
              onPress={() => onTimeFrameChange(tf.value)}
            >
              <Text style={[s.tfLabel, active && s.tfLabelActive]}>{tf.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Scope pills */}
      <View style={s.row}>
        {SCOPE_DEFS.map(sc => {
          const active = scope === sc.value;
          const Icon = sc.Icon;
          return (
            <Pressable
              key={sc.value}
              style={[s.pill, active && s.pillActive]}
              onPress={() => onScopeChange(sc.value)}
            >
              <Icon size={11} color={active ? C.red : C.t3} strokeWidth={1.5} />
              <Text style={[s.pillLabel, active && s.pillLabelActive]}>{sc.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:             { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 8 },
    pill:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 20, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bg },
    pillActive:      { backgroundColor: C.redLo, borderColor: 'rgba(217,53,24,0.3)' },
    pillLabel:       { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t3 },
    pillLabelActive: { fontFamily: 'Barlow_500Medium', color: C.red },
    tfRow:           { flexDirection: 'row', paddingHorizontal: 16, gap: 4, marginBottom: 8 },
    tfBtn:           { flex: 1, paddingVertical: 6, borderRadius: 4, alignItems: 'center' },
    tfBtnActive:     { backgroundColor: C.redLo },
    tfLabel:         { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.6 },
    tfLabelActive:   { fontFamily: 'Barlow_500Medium', color: C.red },
  });
}
