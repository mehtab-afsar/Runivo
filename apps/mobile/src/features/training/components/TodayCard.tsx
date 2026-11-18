/**
 * Home's plan block (PRD H1, race-first daily mocks A, B, F): with a plan, the
 * week strip and today's session with Start (or the next one on a rest day),
 * and a sheet when a key session was missed. Without a plan, the "Make my
 * plan" card that opens plan setup.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowRight, Check } from 'phosphor-react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, Fonts, type AppColors } from '@theme';
import {
  sessionOn, nextSession, weekday, daysBetween, RACE_LABEL, missedKeySession, canDoMissedToday, doMissedToday, setStatus, type Session,
} from '@shared/engine/training';
import { fetchActivePlan, getCachedPlan, savePlan, localToday, type ActivePlan } from '../services/planService';
import WeekStrip from './WeekStrip';
import MissedSessionSheet, { missedAlreadySeen, markMissedSeen } from './MissedSessionSheet';
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
    // The cache is written the moment a plan starts or changes, so show it at once;
    // the server copy replaces it when it lands (no "No plan yet" flash after setup).
    getCachedPlan().then(c => setAp(prev => (c ? c : prev === undefined ? null : prev)));
    fetchActivePlan().then(setAp).catch(() => {});
  }, []));

  // A key session missed earlier this week: ask once what to do.
  const [missed, setMissed] = useState<Session | null>(null);
  const missedId = ap ? missedKeySession(ap.plan, localToday())?.id ?? null : null;
  useEffect(() => {
    if (!ap || !missedId) { setMissed(null); return; }
    let live = true;
    missedAlreadySeen(missedId).then(seen => {
      if (live && !seen) setMissed(ap.plan.weeks.flatMap(w => w.sessions).find(x => x.id === missedId) ?? null);
    });
    return () => { live = false; };
  }, [ap, missedId]);

  if (ap === undefined) return null;
  const today = localToday();

  if (!ap) {
    const invite = (
      <View style={[s.card, s.make]}>
        <Text style={s.makeEyebrow}>NO PLAN YET</Text>
        <Text style={s.makeTitle}>Training for something?</Text>
        <Text style={s.makeSub}>A race, a first 5K or just getting faster. About 90 seconds.</Text>
        <Pressable style={s.makeBtn} onPress={() => navigation.navigate('PlanBuilder')} accessibilityRole="button">
          <Text style={s.makeBtnTxt}>Make my plan</Text>
        </Pressable>
      </View>
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
  const label = plan.raceRef?.name ?? RACE_LABEL[plan.race];
  const head = `${label} · ${toRace > 0 ? `${toRace} days to go` : toRace === 0 ? 'race day' : 'race done'}`;

  const strip = <WeekStrip plan={plan} today={today} onDay={x => (x ? navigation.navigate('PlanSession', { sessionId: x.id }) : navigation.navigate('TrainingPlan'))} />;
  const missedSheet = missed && (
    <MissedSessionSheet
      session={missed}
      canToday={canDoMissedToday(plan, missed.id, today)}
      onClose={() => { markMissedSeen(missed.id); setMissed(null); }}
      onChoose={c => {
        markMissedSeen(missed.id);
        setMissed(null);
        if (c === 'pacex') { navigation.navigate('Coach'); return; }
        const updated = { ...ap, plan: c === 'today' ? doMissedToday(plan, missed.id, today) : setStatus(plan, missed.id, 'skipped') };
        setAp(updated);
        savePlan(updated).catch(() => {});
      }}
    />
  );

  // Today's session, still to do.
  if (todays && todays.status === 'planned') {
    return (
      <View style={{ gap: 10 }}>
        {strip}
        {missedSheet}
        <PaceXRow
          s={s} C={C} eyebrow={`PaceX · today · ${head}`} title={todays.title} sub={todays.summary}
          onOpen={() => navigation.navigate('PlanSession', { sessionId: todays.id })}
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
    <View style={{ gap: 10 }}>
    {strip}
    {missedSheet}
    <Pressable style={s.card} onPress={() => (next ? navigation.navigate('PlanSession', { sessionId: next.id }) : navigation.navigate('TrainingPlan'))} accessibilityRole="button">
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
    </View>
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
    make:     { backgroundColor: C.alwaysDark, padding: 18, gap: 4 },
    makeEyebrow: { fontFamily: Fonts.bold, fontSize: 11.5, letterSpacing: 0.6, color: C.lime },
    makeTitle:{ fontFamily: Fonts.semiBold, fontSize: 19, color: C.alwaysLight },
    makeSub:  { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.72)' },
    makeBtn:  { height: 44, borderRadius: 22, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    makeBtnTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysDark },
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
