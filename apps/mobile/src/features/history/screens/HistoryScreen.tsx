/**
 * Activities: every activity, newest first, grouped by week with the week's
 * distance, like Strava's list. One small sport chip filters it.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { StoredRun } from '@shared/services/store';
import { useRunHistory } from '../hooks/useRunHistory';
import { useTheme, Fonts, type AppColors } from '@theme';
import { EmptyState } from '@mobile/shared/components/EmptyState';
import { ErrorState } from '@mobile/shared/components/ErrorState';
import { useDistanceUnit } from '@mobile/shared/hooks/useDistanceUnit';
import { convertKm } from '@mobile/shared/lib/formatters';
import { RouteThumb } from '@mobile/shared/components/RouteThumb';
import { SportChip, SPORT_LABEL } from '@features/profile/components/SportPicker';
import { activityMeta, activityName, zonesOf, fmtKm } from '@features/profile/components/YouSections';
import { filterBySport, weekStart, type SportFilter } from '@features/profile/utils/profileStats';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function weekTitle(start: number, now = Date.now()): string {
  const thisWeek = weekStart(now);
  if (start === thisWeek) return 'This week';
  const last = new Date(thisWeek); last.setDate(last.getDate() - 7);
  if (start === last.getTime()) return 'Last week';
  const d = new Date(start);
  return `Week of ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date(now).getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

export default function HistoryScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { runs, loading, error, refreshing, refresh } = useRunHistory();
  const unit = useDistanceUnit();
  const [sport, setSport] = useState<SportFilter>('all');

  const sections = useMemo(() => {
    const list = filterBySport(runs, sport).filter(r => r.distanceMeters >= 50).sort((a, b) => b.startTime - a.startTime);
    const byWeek = new Map<number, StoredRun[]>();
    for (const r of list) {
      const k = weekStart(r.startTime);
      const arr = byWeek.get(k);
      if (arr) arr.push(r); else byWeek.set(k, [r]);
    }
    return [...byWeek.entries()].map(([start, data]) => ({
      key: String(start),
      title: weekTitle(start),
      km: data.filter(r => !r.excluded).reduce((n, r) => n + r.distanceMeters / 1000, 0),
      data,
    }));
  }, [runs, sport]);

  const open = useCallback((r: StoredRun) => navigation.navigate('RunSummary', { runId: r.id, activityType: r.activityType }), [navigation]);

  return (
    <View style={s.root}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable style={s.back} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
        <Text style={s.title}>Activities</Text>
        <SportChip value={sport} onChange={setSport} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={r => r.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        initialNumToRender={12}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionHead}>{section.title} · {fmtKm(convertKm(section.km, unit))} {unit}</Text>
        )}
        renderItem={({ item, index, section }) => {
          const z = zonesOf(item);
          const first = index === 0, last = index === section.data.length - 1;
          return (
            <Pressable
              style={[s.row, first && s.rowFirst, last && s.rowLast, !last && s.rowBorder]}
              onPress={() => open(item)}
              accessibilityRole="button"
            >
              <RouteThumb points={item.gpsPoints} width={52} height={52} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{activityName(item)}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{item.excluded ? 'Not counted · ' : ''}{activityMeta(item, unit)}</Text>
              </View>
              {z > 0 && <Text style={s.zones}>+{z}</Text>}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: 48 }} color={C.t2} accessibilityLabel="Loading activities" />
          : error ? <ErrorState title="Couldn't load your activities" onRetry={refresh} />
          : <EmptyState
            title={sport === 'all' ? 'No activities yet' : `No ${SPORT_LABEL[sport].toLowerCase()} yet`}
            body={sport === 'all' ? 'Head out for your first run and it shows up here.' : 'Try another sport, or record one.'}
            cta={sport === 'all' ? { label: 'Start a run', onPress: () => navigation.navigate('Main', { screen: 'Run' }) } : undefined}
          />
        }
      />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: C.t1 },
    sectionHead: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, marginHorizontal: 18, paddingHorizontal: 14, backgroundColor: C.card },
    rowFirst: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
    rowLast: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    zones: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.red },
  });
}
