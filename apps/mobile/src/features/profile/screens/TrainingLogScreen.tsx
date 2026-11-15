/**
 * P2: training log — weeks down the page, a dot per day sized by distance and
 * coloured by sport, the week's total on the right. Tap a day to open it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { getRuns, type StoredRun } from '@shared/services/store';
import { weekStart, sportGroup } from '../utils/profileStats';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const WEEKS = 16;
const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TrainingLogScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [runs, setRuns] = useState<StoredRun[]>([]);
  useEffect(() => { getRuns(1000).then(setRuns).catch(() => {}); }, []);
  const colour = { run: C.red, walk: C.amber, ride: C.lavenderInk } as const;

  const weeks = useMemo(() => {
    const thisWeek = weekStart(Date.now());
    const out: { start: number; days: { km: number; sport: 'run' | 'walk' | 'ride'; first: StoredRun | null }[]; km: number }[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const d = new Date(thisWeek); d.setDate(d.getDate() - w * 7);
      out.push({ start: d.getTime(), days: Array.from({ length: 7 }, () => ({ km: 0, sport: 'run' as const, first: null })), km: 0 });
    }
    const index = new Map(out.map((w, i) => [w.start, i]));
    for (const r of runs) {
      if (r.excluded || r.distanceMeters < 50) continue;
      const i = index.get(weekStart(r.startTime));
      if (i === undefined) continue;
      const dow = (new Date(r.startTime).getDay() + 6) % 7;
      const cell = out[i].days[dow];
      const km = r.distanceMeters / 1000;
      // The day's colour is the sport with the most distance that day.
      if (km > cell.km) { cell.sport = sportGroup(r.activityType); }
      cell.km += km;
      cell.first = cell.first ?? r;
      out[i].km += km;
    }
    return out;
  }, [runs]);
  const max = Math.max(1, ...weeks.flatMap(w => w.days.map(d => d.km)));

  return (
    <View style={s.root}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable style={s.back} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={() => navigation.goBack()} accessibilityLabel="Back"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
        <Text style={s.title}>Training log</Text>
      </View>
      <View style={s.legend}>
        {(['run', 'walk', 'ride'] as const).map(k => (
          <View key={k} style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colour[k] }]} /><Text style={s.legendTxt}>{k === 'run' ? 'Run' : k === 'walk' ? 'Walk / hike' : 'Ride'}</Text></View>
        ))}
      </View>
      <View style={s.headRow}>
        <Text style={s.weekLbl} />
        {DAY.map((d, i) => <Text key={i} style={s.dayLbl}>{d}</Text>)}
        <Text style={s.kmLbl}>km</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {weeks.map(w => {
          const d = new Date(w.start);
          return (
            <View key={w.start} style={s.row}>
              <Text style={s.weekLbl}>{d.getDate()} {MONTHS[d.getMonth()]}</Text>
              {w.days.map((day, i) => {
                const size = day.km > 0 ? 8 + Math.round(Math.sqrt(day.km / max) * 22) : 4;
                return (
                  <Pressable
                    key={i}
                    style={s.cell}
                    disabled={!day.first}
                    onPress={() => day.first && navigation.navigate('RunSummary', { runId: day.first.id, activityType: day.first.activityType })}
                    accessibilityLabel={day.km > 0 ? `${day.km.toFixed(1)} km` : undefined}
                  >
                    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: day.km > 0 ? colour[day.sport] : C.border }} />
                  </Pressable>
                );
              })}
              <Text style={s.kmVal}>{w.km > 0 ? w.km.toFixed(w.km >= 100 ? 0 : 1) : '–'}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: C.t1 },
    legend: { flexDirection: 'row', gap: 14, paddingHorizontal: 18, marginBottom: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendTxt: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, height: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    weekLbl: { width: 52, fontFamily: Fonts.medium, fontSize: 11.5, color: C.t2 },
    dayLbl: { flex: 1, textAlign: 'center', fontFamily: Fonts.semiBold, fontSize: 11, color: C.t3 },
    kmLbl: { width: 40, textAlign: 'right', fontFamily: Fonts.semiBold, fontSize: 11, color: C.t3 },
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 },
    kmVal: { width: 40, textAlign: 'right', fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
  });
}
