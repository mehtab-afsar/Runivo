/**
 * Build a race plan: distance, race day, current 5K, optional goal, run days.
 * The plan itself comes from the tested engine (packages/shared/src/engine/training.ts).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowLeft, Minus, Plus } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import {
  buildPlan, predictSec, fmtDuration, addDays, mondayOf, weekday, daysBetween,
  RACE_KM, RACE_LABEL, PLAN_WEEKS, type RaceDistance,
} from '@shared/engine/training';
import { parseFiveKTime } from '@shared/engine/onboarding';
import { createPlan, fetchPlanDefaults, localToday } from '../services/planService';
import { useFeatureGate } from '@features/subscription/hooks/useFeatureGate';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const RACES: RaceDistance[] = ['5k', '10k', 'half', 'marathon'];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1:52:30" or "48:10" → seconds; null when blank or invalid. */
function parseDuration(s: string): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const sec = Number(m[3]), min = Number(m[2]), h = m[1] ? Number(m[1]) : 0;
  if (sec >= 60 || (m[1] && min >= 60)) return null;
  return h * 3600 + min * 60 + sec;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday(d)]} ${day} ${MONTHS[m - 1]} ${y}`;
}

export default function PlanBuilderScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const gate = useFeatureGate();
  const params = useRoute<RouteProp<RootStackParamList, 'PlanBuilder'>>().params;
  const today = localToday();
  // From a race in Events: its distance and date are fixed.
  const fixedDate = params?.raceDate && params.raceDate > today ? params.raceDate : null;

  const [race, setRace] = useState<RaceDistance>(params?.race ?? '10k');
  const firstMonday = weekday(today) === 0 ? today : mondayOf(addDays(today, 7));
  // Race day = Sunday of the plan's last week; weeks counted from the first Monday.
  const [weekPick, setWeeks] = useState(10);
  const weeks = fixedDate ? Math.max(1, Math.floor(daysBetween(firstMonday, mondayOf(fixedDate)) / 7) + 1) : weekPick;
  const raceDate = fixedDate ?? addDays(firstMonday, weekPick * 7 - 1);
  const [fiveK, setFiveK] = useState('');
  const [goal, setGoal] = useState('');
  const [runDays, setRunDays] = useState<number[]>([1, 3, 6]);
  const [longDay, setLongDay] = useState(6);
  const [weeklyKm, setWeeklyKm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlanDefaults().then(d => {
      if (d.fiveKSec) setFiveK(fmtDuration(d.fiveKSec));
      setWeeklyKm(d.weeklyKm);
    }).catch(() => {});
  }, []);

  // Keep the race date inside what the distance allows.
  const { min, max } = PLAN_WEEKS[race];
  useEffect(() => { setWeeks(w => Math.max(min, Math.min(max + 8, w))); }, [min, max]);

  const fiveKParsed = parseFiveKTime(fiveK);
  const fiveKSec = fiveKParsed.ok ? fiveKParsed.seconds : null;
  const predicted = fiveKSec ? predictSec(fiveKSec, RACE_KM[race]) : null;
  const goalSec = goal.trim() ? parseDuration(goal) : null;

  const toggleDay = (d: number) => {
    setRunDays(prev => {
      const next = prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b);
      if (next.length > 5) return prev;
      if (!next.includes(longDay) && next.length) setLongDay(next[next.length - 1]);
      return next;
    });
  };

  const problems: string[] = [];
  if (!fiveKSec) problems.push('Enter your current 5K time, like 27:30.');
  if (goal.trim() && !goalSec) problems.push('Goal time: use 48:30 or 1:52:00, or leave it blank.');
  if (runDays.length < 3) problems.push('Pick at least 3 run days.');

  const create = async () => {
    if (problems.length || !fiveKSec) return;
    // X6: plans are a Plus feature (one switch in entitlements.ts).
    if (!gate.loading && !gate.canUse('training_plan')) { navigation.navigate('Subscription', { reason: 'training' }); return; }
    const result = buildPlan({
      race, raceDate, fiveKSec, goalSec, runDays, longRunDay: longDay, currentWeeklyKm: weeklyKm, today,
    });
    if ('error' in result) {
      Alert.alert("Can't build that plan",
        result.error === 'too_soon' ? (fixedDate ? `This race is ${weeks} weeks away; a ${RACE_LABEL[race]} plan needs at least ${result.minWeeks}. Pick a shorter distance or a later race.` : `A ${RACE_LABEL[race]} needs at least ${result.minWeeks} weeks. Pick a later race day.`)
        : result.error === 'bad_days' ? 'Pick 3 to 5 run days, including your long-run day.'
        : 'Check your 5K time.');
      return;
    }
    setSaving(true);
    try {
      await createPlan(result);
      navigation.replace('TrainingPlan');
    } catch {
      Alert.alert("Couldn't save the plan", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const planWeeks = Math.min(weeks, max);
  const starts = addDays(raceDate, -(planWeeks * 7 - 1));

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>New training plan</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Race</Text>
          <View style={s.chips}>
            {RACES.map(r => (
              <Pressable hitSlop={8} key={r} style={[s.chip, race === r && s.chipOn]} onPress={() => setRace(r)} accessibilityRole="button" accessibilityState={{ selected: race === r }}>
                <Text style={[s.chipTxt, race === r && s.chipTxtOn]}>{RACE_LABEL[r]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.label}>Race day</Text>
          {fixedDate ? (
            <View style={[s.card, s.stepper]}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={s.dateTxt}>{fmtDate(raceDate)}</Text>
                <Text style={s.sub} numberOfLines={1}>{params?.raceName ? `${params.raceName} · ` : ''}{weeks} weeks away</Text>
              </View>
            </View>
          ) : (
          <View style={[s.card, s.stepper]}>
            <Pressable hitSlop={8} style={s.stepBtn} onPress={() => setWeeks(w => Math.max(min, w - 1))} accessibilityRole="button" accessibilityLabel="One week earlier">
              <Minus size={16} color={C.t1} weight="bold" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.dateTxt}>{fmtDate(raceDate)}</Text>
              <Text style={s.sub}>{weeks} weeks away{weeks > max ? ` · the plan starts ${fmtDate(starts)}` : ''}</Text>
            </View>
            <Pressable hitSlop={8} style={s.stepBtn} onPress={() => setWeeks(w => Math.min(52, w + 1))} accessibilityRole="button" accessibilityLabel="One week later">
              <Plus size={16} color={C.t1} weight="bold" />
            </Pressable>
          </View>
          )}

          <Text style={s.label}>Your 5K time now</Text>
          <TextInput
            style={s.input} value={fiveK} onChangeText={setFiveK} placeholder="27:30" placeholderTextColor={C.t3}
            keyboardType="numbers-and-punctuation" maxLength={8}
          />
          <Text style={s.sub}>Sets your training paces. A recent race or hard effort is best.</Text>

          <Text style={s.label}>Goal time (optional)</Text>
          <TextInput
            style={s.input} value={goal} onChangeText={setGoal}
            placeholder={predicted ? fmtDuration(predicted) : race === 'marathon' || race === 'half' ? '1:55:00' : '50:00'}
            placeholderTextColor={C.t3} keyboardType="numbers-and-punctuation" maxLength={8}
          />
          {predicted ? (
            <Text style={s.sub}>
              Your 5K suggests about {fmtDuration(predicted)}.
              {goalSec && goalSec < predicted * 0.95 ? ' That goal is ambitious; the plan will aim for a safer target.' : ''}
            </Text>
          ) : null}

          <Text style={s.label}>Run days ({runDays.length})</Text>
          <View style={s.days}>
            {DAYS.map((d, i) => {
              const on = runDays.includes(i);
              return (
                <Pressable key={i} style={[s.day, on && s.dayOn]} onPress={() => toggleDay(i)} accessibilityRole="button" accessibilityLabel={DAY_NAMES[i]} accessibilityState={{ selected: on }}>
                  <Text style={[s.dayTxt, on && s.dayTxtOn]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.sub}>3 to 5 days. Rest days between them help.</Text>

          <Text style={s.label}>Long run on</Text>
          <View style={s.chips}>
            {runDays.map(d => (
              <Pressable hitSlop={8} key={d} style={[s.chip, longDay === d && s.chipOn]} onPress={() => setLongDay(d)} accessibilityRole="button" accessibilityState={{ selected: longDay === d }}>
                <Text style={[s.chipTxt, longDay === d && s.chipTxtOn]}>{DAY_NAMES[d].slice(0, 3)}</Text>
              </Pressable>
            ))}
          </View>

          {weeklyKm ? <Text style={[s.sub, { marginTop: 18 }]}>Starting from about {weeklyKm} km a week, based on your recent running.</Text> : null}

          {problems.length > 0 && <Text style={s.problem}>{problems[0]}</Text>}

          <Pressable
            style={[s.cta, (problems.length > 0 || saving) && { opacity: 0.45 }]}
            onPress={create} disabled={problems.length > 0 || saving} accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={C.alwaysLight} /> : <Text style={s.ctaTxt}>Build my plan</Text>}
          </Pressable>
          <Text style={s.foot}>
            The plan grows your running by at most 10% a week, adds a lighter week every fourth week and tapers before race day. You can move or ease any session.
          </Text>
          <Text style={s.foot}>{daysBetween(today, raceDate)} days to go.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bg },
    header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    backBtn: { width: 32 },
    title:   { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    scroll:  { paddingHorizontal: 18, paddingBottom: 48 },
    label:   { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 20, marginBottom: 8 },
    sub:     { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, color: C.t2, marginTop: 6 },
    chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip:    { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    chipOn:  { backgroundColor: C.t1, borderColor: C.t1 },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    chipTxtOn: { color: C.bg },
    card:    { backgroundColor: C.card, borderRadius: 22 },
    stepper: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    dateTxt: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    input:   { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.numeric, fontSize: 18, color: C.t1 },
    days:    { flexDirection: 'row', gap: 6 },
    day:     { flex: 1, height: 42, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    dayOn:   { backgroundColor: C.red, borderColor: C.red },
    dayTxt:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    dayTxtOn:{ color: C.alwaysLight },
    problem: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.red, marginTop: 18 },
    cta:     { height: 52, borderRadius: 26, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    ctaTxt:  { fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
    foot:    { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, color: C.t3, marginTop: 12 },
  });
}
