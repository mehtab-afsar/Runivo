/**
 * Home's "Today" card (PRD H1): today's planned session with Start, or the
 * next one on a rest day. Without a plan, a one-line invitation to build one.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowRight, Check } from 'phosphor-react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, Fonts, type AppColors } from '@theme';
import { sessionOn, nextSession, weekday, daysBetween, RACE_LABEL } from '@shared/engine/training';
import { fetchActivePlan, getCachedPlan, localToday, type ActivePlan } from '../services/planService';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
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
  // T6: an easy session can run through the zones that are fading.
  const todaysSession = ap ? sessionOn(ap.plan, localToday()) : undefined;
  const easyKm = todaysSession && todaysSession.status === 'planned' && ['easy', 'long', 'recovery'].includes(todaysSession.kind) ? todaysSession.distanceKm : undefined;
  const sessionLoop = useTerritorySuggestion(!!easyKm, easyKm);

  useFocusEffect(useCallback(() => {
    getCachedPlan().then(c => setAp(prev => (prev === undefined ? c : prev)));
    fetchActivePlan().then(setAp).catch(() => {});
  }, []));

  if (ap === undefined) return null;
  const today = localToday();

  if (!ap) {
    const invite = (
      <Pressable style={[s.card, s.invite]} onPress={() => navigation.navigate('PlanBuilder')} accessibilityRole="button">
        <PaceXOrb size={36} />
        <Text style={s.inviteTxt}>Training for a race? PaceX builds a plan around your week</Text>
        <ArrowRight size={14} color={C.t2} weight="bold" />
      </Pressable>
    );
    if (!suggestion) return invite;
    return (
      <View style={{ gap: 12 }}>
        <PaceXRow
          s={s} C={C} eyebrow="PaceX · today" title={suggestion.title} sub={suggestion.sub}
          onPlay={() => navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', ghostRoutePoints: suggestion.points })}
          playLabel="Start this loop"
        />
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
      <View style={{ gap: 0 }}>
        <PaceXRow
          s={s} C={C} eyebrow={`PaceX · today · ${head}`} title={todays.title} sub={todays.summary}
          onOpen={() => navigation.navigate('TrainingPlan')}
          onPlay={() => navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', sessionId: todays.id })}
          playLabel="Start session"
        />
        {sessionLoop && (
          <Pressable
            style={s.loopRow}
            onPress={() => navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', sessionId: todays.id, ghostRoutePoints: sessionLoop.points })}
            accessibilityRole="button"
          >
            <Text style={s.loopTxt} numberOfLines={2}>Run it as a {sessionLoop.title}: {sessionLoop.sub.charAt(0).toLowerCase()}{sessionLoop.sub.slice(1)}</Text>
            <ArrowRight size={14} color={C.t1} weight="bold" />
          </Pressable>
        )}
      </View>
    );
  }

  // Done today, or a rest day: show what's next.
  return (
    <Pressable style={s.card} onPress={() => navigation.navigate('TrainingPlan')} accessibilityRole="button">
      <View style={s.row}>
        <PaceXOrb size={44} />
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

/** The mock's PaceX card: orb, what's on today, and a black play button. */
function PaceXRow({ s, C, eyebrow, title, sub, onOpen, onPlay, playLabel }: {
  s: ReturnType<typeof mkStyles>; C: AppColors; eyebrow: string; title: string; sub: string;
  onOpen?: () => void; onPlay: () => void; playLabel: string;
}) {
  return (
    <View style={[s.card, s.row]}>
      <PaceXOrb size={44} />
      <Pressable style={{ flex: 1 }} onPress={onOpen} disabled={!onOpen} accessibilityRole={onOpen ? 'button' : undefined}>
        <Text style={s.eyebrow} numberOfLines={1}>{eyebrow}</Text>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <Text style={s.sub} numberOfLines={1}>{sub}</Text>
      </Pressable>
      <Pressable style={s.play} onPress={onPlay} accessibilityRole="button" accessibilityLabel={playLabel} hitSlop={6}>
        <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M8 5.5v13l10.5-6.5Z" fill={C.lime} /></Svg>
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:     { backgroundColor: C.card, borderRadius: 26, padding: 16 },
    invite:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    inviteTxt:{ flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    row:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
    eyebrow:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    title:    { fontFamily: Fonts.medium, fontSize: 17, color: C.t1, marginTop: 2 },
    sub:      { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2, marginTop: 2 },
    play:     { width: 44, height: 44, borderRadius: 22, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    start:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, borderRadius: 20, backgroundColor: C.t1, marginTop: 12 },
    startTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
    loopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    loopTxt: { flex: 1, fontFamily: Fonts.medium, fontSize: 12.5, color: C.t1 },
  });
}
