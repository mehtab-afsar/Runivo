import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { getNutritionProfile, getNutritionEntriesRange, type NutritionProfile, type NutritionEntry } from '@shared/services/store';
import { todayKey } from '../../nutrition/services/nutritionService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const C = {
  bg: '#F8F6F3', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD',
  border: '#DDD9D4', red: '#D93518', hair: '#E8E4DF',
};

function getWeekDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0 = Monday
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOfWeek + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function NutritionTab() {
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [weekEntries, setWeekEntries] = useState<Record<string, NutritionEntry[]>>({});
  const [streak, setStreak] = useState(0);
  const [avgKcal, setAvgKcal] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await getNutritionProfile();
        if (p) setProfile(p);

        const weekDates = getWeekDates();
        const fromDate = weekDates[0];
        const toDate = weekDates[6];
        const entries = await getNutritionEntriesRange(fromDate, toDate);

        const byDate: Record<string, NutritionEntry[]> = {};
        for (const e of entries) {
          if (!byDate[e.date]) byDate[e.date] = [];
          byDate[e.date].push(e);
        }
        setWeekEntries(byDate);

        // Compute streak: count consecutive days with entries going back from today
        let s = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const dayEntries = (byDate[key] ?? []).filter(e => e.source !== 'run');
          if (dayEntries.length > 0) s++;
          else if (i > 0) break;
        }
        setStreak(s);

        // Total entries (food only)
        const allFood = entries.filter(e => e.source !== 'run');
        setTotalEntries(allFood.length);

        // Avg kcal logged per day (days with at least one entry)
        const daysWithEntries = weekDates.filter(d => (byDate[d] ?? []).filter(e => e.source !== 'run').length > 0);
        if (daysWithEntries.length > 0) {
          const totalKcal = daysWithEntries.reduce((sum, d) => {
            return sum + (byDate[d] ?? []).filter(e => e.source !== 'run').reduce((s, e) => s + e.kcal, 0);
          }, 0);
          setAvgKcal(Math.round(totalKcal / daysWithEntries.length));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={ss.center}>
        <ActivityIndicator color={C.red} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={ss.empty}>
        <Text style={ss.emptyTitle}>Nutrition not set up</Text>
        <Text style={ss.emptyText}>Set up your daily nutrition goals to start tracking.</Text>
        <Pressable style={ss.btn} onPress={() => navigation.navigate('NutritionSetup')}>
          <Text style={ss.btnText}>Set up nutrition</Text>
        </Pressable>
      </View>
    );
  }

  const weekDates = getWeekDates();
  const today = todayKey();

  return (
    <View style={ss.root}>
      {/* Goal card */}
      <View style={ss.card}>
        <View style={ss.cardRow}>
          <Text style={ss.cardLabel}>Daily goal</Text>
          <Pressable onPress={() => navigation.navigate('NutritionSetup')}>
            <Text style={ss.editLink}>Edit →</Text>
          </Pressable>
        </View>
        <View style={ss.goalRow}>
          {[
            { label: 'Calories', value: `${profile.dailyGoalKcal}`, unit: 'kcal' },
            { label: 'Protein',  value: `${profile.proteinGoalG}`,  unit: 'g' },
            { label: 'Carbs',    value: `${profile.carbsGoalG}`,    unit: 'g' },
            { label: 'Fat',      value: `${profile.fatGoalG}`,      unit: 'g' },
          ].map(s => (
            <View key={s.label} style={ss.goalCell}>
              <Text style={ss.goalValue}>{s.value}<Text style={ss.goalUnit}>{s.unit}</Text></Text>
              <Text style={ss.goalCellLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Week bars */}
      <View style={[ss.card, { marginTop: 10 }]}>
        <Text style={ss.cardLabel}>This week</Text>
        <View style={ss.barsRow}>
          {weekDates.map((date, i) => {
            const dayEntries = (weekEntries[date] ?? []).filter(e => e.source !== 'run');
            const dayKcal = dayEntries.reduce((s, e) => s + e.kcal, 0);
            const isToday = date === today;
            const maxBarH = 52;
            const barPct = Math.min(dayKcal / Math.max(profile.dailyGoalKcal, 1), 1);
            const barH = dayKcal > 0 ? Math.max(barPct * maxBarH, 4) : 0;
            return (
              <View key={date} style={ss.barCol}>
                <View style={[ss.barTrack, { height: maxBarH }]}>
                  <View style={[ss.bar, {
                    height: barH,
                    backgroundColor: isToday ? C.red : dayKcal > 0 ? C.t3 : C.hair,
                  }]} />
                </View>
                <Text style={[ss.barDay, isToday && { color: C.red, fontFamily: 'Barlow_600SemiBold' }]}>{DAY_LABELS[i]}</Text>
                <Text style={ss.barKcal}>{dayKcal > 0 ? dayKcal : '—'}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Streak + avg */}
      <View style={ss.statRow}>
        <View style={[ss.card, { flex: 1 }]}>
          <Text style={ss.statCardLabel}>🔥 Streak</Text>
          <Text style={ss.statCardValue}>{streak}</Text>
          <Text style={ss.statCardSub}>days in a row</Text>
        </View>
        <View style={[ss.card, { flex: 1, marginLeft: 8 }]}>
          <Text style={ss.statCardLabel}>Avg / day</Text>
          <Text style={ss.statCardValue}>{avgKcal || '—'}</Text>
          <Text style={ss.statCardSub}>kcal logged</Text>
        </View>
      </View>

      {/* Total entries + open tracker */}
      <View style={[ss.card, ss.totalRow, { marginTop: 10, marginBottom: 16 }]}>
        <View>
          <Text style={ss.statCardLabel}>Total entries</Text>
          <Text style={ss.statCardValue}>{totalEntries}</Text>
        </View>
        <Pressable style={ss.btn} onPress={() => navigation.navigate('CalorieTracker')}>
          <Text style={ss.btnText}>Open tracker</Text>
        </Pressable>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { paddingBottom: 8 },
  center: { alignItems: 'center', paddingVertical: 32 },
  card: {
    backgroundColor: '#F8F6F3', borderRadius: 14,
    borderWidth: 0.5, borderColor: '#DDD9D4',
    padding: 14, marginHorizontal: 0,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel: { fontFamily: 'Barlow_500Medium', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: C.t3 },
  editLink: { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.red },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  goalCell: { flex: 1, alignItems: 'center' },
  goalValue: { fontFamily: 'Barlow_300Light', fontSize: 15, color: C.black, letterSpacing: -0.3 },
  goalUnit: { fontSize: 9, color: C.t3 },
  goalCellLabel: { fontFamily: 'Barlow_400Regular', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6, color: C.t3, marginTop: 2 },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '55%', borderRadius: 3 },
  barDay: { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3 },
  barKcal: { fontFamily: 'Barlow_300Light', fontSize: 8, color: C.t3 },
  statRow: { flexDirection: 'row', marginTop: 10 },
  statCardLabel: { fontFamily: 'Barlow_500Medium', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: C.t3, marginBottom: 6 },
  statCardValue: { fontFamily: 'Barlow_300Light', fontSize: 22, color: C.black, letterSpacing: -0.5, lineHeight: 26 },
  statCardSub: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btn: { backgroundColor: C.black, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 11, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 8 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
});
