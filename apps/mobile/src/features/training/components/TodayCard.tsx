/**
 * Home's "Today" card (PRD H1): today's planned session with Start, or the
 * next one on a rest day. Without a plan, a one-line invitation to build one.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowRight, Check, Play, CalendarBlank } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { sessionOn, nextSession, weekday, daysBetween, RACE_LABEL } from '@shared/engine/training';
import { fetchActivePlan, getCachedPlan, localToday, type ActivePlan } from '../services/planService';
import { useTerritorySuggestion } from '../hooks/useTerritorySuggestion';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TodayCard() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const [ap, setAp] = useState<ActivePlan | null | undefined>(undefined);
  // No plan: suggest a run for the territory (H1).
  const suggestion = useTerritorySuggestion(ap === null);

  useFocusEffect(useCallback(() => {
    getCachedPlan().then(c => setAp(prev => (prev === undefined ? c : prev)));
    fetchActivePlan().then(setAp).catch(() => {});
  }, []));

  if (ap === undefined) return null;
  const today = localToday();

  if (!ap) {
    const invite = (
      <Pressable style={[s.card, s.invite]} onPress={() => navigation.navigate('PlanBuilder')} accessibilityRole="button">
        <CalendarBlank size={18} color={C.t1} weight="regular" />
        <Text style={s.inviteTxt}>Training for a race? Get a plan built around your week</Text>
        <ArrowRight size={14} color={C.t2} weight="bold" />
      </Pressable>
    );
    if (!suggestion) return invite;
    return (
      <View style={{ gap: 12 }}>
        <View style={s.card}>
          <Text style={s.eyebrow}>Today</Text>
          <Text style={s.title}>{suggestion.title}</Text>
          <Text style={s.sub} numberOfLines={2}>{suggestion.sub}</Text>
          <Pressable
            style={s.start}
            onPress={() => navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', ghostRoutePoints: suggestion.points })}
            accessibilityRole="button"
          >
            <Play size={14} color={C.alwaysLight} weight="fill" />
            <Text style={s.startTxt}>Start this loop</Text>
          </Pressable>
        </View>
        {invite}
      </View>
    );
  }

  const plan = ap.plan;
  const todays = sessionOn(plan, today);
  const next = nextSession(plan, today);
  const toRace = daysBetween(today, plan.raceDate);
  const head = `${RACE_LABEL[plan.race]} · ${toRace > 0 ? `${toRace} days to go` : toRace === 0 ? 'race day' : 'race done'}`;

  // Today's session, still to do.
  if (todays && todays.status === 'planned') {
    return (
      <View style={s.card}>
        <Pressable onPress={() => navigation.navigate('TrainingPlan')} accessibilityRole="button">
          <Text style={s.eyebrow}>Today · {head}</Text>
          <Text style={s.title}>{todays.title}</Text>
          <Text style={s.sub} numberOfLines={2}>{todays.summary}</Text>
        </Pressable>
        <Pressable
          style={s.start}
          onPress={() => navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', sessionId: todays.id })}
          accessibilityRole="button"
        >
          <Play size={14} color={C.alwaysLight} weight="fill" />
          <Text style={s.startTxt}>Start session</Text>
        </Pressable>
      </View>
    );
  }

  // Done today, or a rest day: show what's next.
  return (
    <Pressable style={s.card} onPress={() => navigation.navigate('TrainingPlan')} accessibilityRole="button">
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{todays?.status === 'done' ? 'Done today' : 'Rest day'} · {head}</Text>
          <Text style={s.title}>{next ? `Next: ${next.title}` : 'Plan complete'}</Text>
          {next && <Text style={s.sub}>{next.date === today ? 'Today' : DAY[weekday(next.date)]} · {next.summary}</Text>}
        </View>
        {todays?.status === 'done' ? <Check size={20} color={C.green} weight="bold" /> : <ArrowRight size={14} color={C.t2} weight="bold" />}
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:     { backgroundColor: C.card, borderRadius: 16, padding: 16 },
    invite:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
    inviteTxt:{ flex: 1, fontFamily: Fonts.medium, fontSize: 13.5, color: C.t1 },
    row:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eyebrow:  { fontFamily: Fonts.medium, fontSize: 12, color: C.red },
    title:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1, marginTop: 4 },
    sub:      { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 17, color: C.t2, marginTop: 3 },
    start:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 20, backgroundColor: C.t1, marginTop: 12 },
    startTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
  });
}
