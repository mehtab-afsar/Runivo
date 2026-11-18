/**
 * One planned session (PRD daily mock C): what it is, how it should feel, its
 * steps with target paces, and what you can do with it: start the guided run,
 * move it to another day this week, skip it, or send it to a watch.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Check, Play, Watch } from 'phosphor-react-native';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';
import { useTheme, Fonts, type AppColors } from '@theme';
import { FormTip } from '@mobile/shared/components/form/FormKit';
import { fmtBand, weekOf, moveSession, setStatus, addDays, weekday, allSessions } from '@shared/engine/training';
import { fetchActivePlan, getCachedPlan, savePlan, localToday, type ActivePlan } from '../services/planService';
import { appleWatchSupported, sendToAppleWatch, sendToGarmin } from '../services/sendToWatch';
import { kindColor, KIND_LABEL, KIND_FEEL, stepAmount } from '../sessionLook';
import { fmtRaceDate } from '../services/raceService';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlanSessionScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { sessionId } = useRoute<RouteProp<RootStackParamList, 'PlanSession'>>().params;
  const today = localToday();
  const [ap, setAp] = useState<ActivePlan | null | undefined>(undefined);
  const [moving, setMoving] = useState(false);
  const [watchOk, setWatchOk] = useState(false);
  useEffect(() => { appleWatchSupported().then(setWatchOk).catch(() => {}); }, []);

  useFocusEffect(useCallback(() => {
    getCachedPlan().then(c => setAp(prev => prev ?? c));
    fetchActivePlan().then(a => setAp(a ?? null)).catch(() => setAp(prev => prev ?? null));
  }, []));

  const session = ap ? allSessions(ap.plan).find(x => x.id === sessionId) ?? null : null;

  const update = (next: ActivePlan) => {
    setAp(next);
    savePlan(next).catch(() => appAlert('Saved on this phone', "We'll sync the change when you're back online."));
  };

  if (ap === undefined) return <View style={[s.root, s.center]}><ActivityIndicator color={C.t2} /></View>;
  if (!ap || !session) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 6 }]}>
        <ScreenHeader onBack={() => navigation.goBack()} />
        <View style={s.center}><Text style={s.feel}>This session isn't in your plan any more.</Text></View>
      </View>
    );
  }

  const plan = ap.plan;
  const open = session.status === 'planned' && session.date >= today;
  const week = weekOf(plan, session.date);
  const hardPace = session.steps.find(st => st.kind === 'run' && st.pace)?.pace;

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <ScreenHeader onBack={() => navigation.goBack()} title={`${DAY[weekday(session.date)]} ${fmtRaceDate(session.date).split(' ').slice(1).join(' ')}`} />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={[s.kind, { backgroundColor: session.kind === 'race' ? C.t1 : kindColor(C, session.kind) }]}>
          <Text style={[s.kindTxt, session.kind === 'race' && { color: C.bg }]}>{KIND_LABEL[session.kind].toUpperCase()}</Text>
        </View>
        <Text style={s.title}>{session.title}</Text>
        <Text style={s.feel}>{KIND_FEEL[session.kind]}</Text>
        {session.eased && <Text style={s.eased}>Eased: changed to an easy run to help you recover.</Text>}

        {session.status === 'done' && <View style={s.done}><Check size={18} color={C.green} weight="bold" /><Text style={s.doneTxt}>Done. Nice work.</Text></View>}
        {session.status === 'skipped' && <Text style={s.eased}>Skipped.</Text>}

        <View style={s.card}>
          {session.steps.map((st, i) => (
            <View key={i} style={s.step}>
              <View style={[s.bar, { backgroundColor: st.kind === 'run' ? kindColor(C, session.kind === 'race' ? 'long' : session.kind) : C.mint2 }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.stepTitle}>{st.label}</Text>
                <Text style={s.stepSub}>{[stepAmount(st), st.pace ? fmtBand(st.pace) : null].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
          ))}
          <Text style={s.total}>About {session.distanceKm} km in total</Text>
        </View>

        {hardPace && session.kind !== 'easy' && session.kind !== 'recovery' && (
          <FormTip lead="PaceX:">{`Aim for ${fmtBand(hardPace)} on the main part. If it feels too hard, ease off; finishing the session matters more than the pace.`}</FormTip>
        )}

        {open && session.kind !== 'race' && (
          <View style={s.actions}>
            <Pressable style={s.action} onPress={() => setMoving(m => !m)} accessibilityRole="button" accessibilityState={{ expanded: moving }}>
              <Text style={s.actionTxt}>Move day</Text>
            </Pressable>
            <Pressable style={s.action} onPress={() => appAlert('Skip this session?', 'The plan carries on. Nothing piles up.', [
              { text: 'Keep it', style: 'cancel' },
              { text: 'Skip', onPress: () => update({ ...ap, plan: setStatus(plan, session.id, 'skipped') }) },
            ])} accessibilityRole="button">
              <Text style={s.actionTxt}>Skip</Text>
            </Pressable>
            <Pressable style={s.action} onPress={async () => {
              const r = watchOk ? await sendToAppleWatch(session) : await sendToGarmin(session);
              appAlert(r.title, r.message);
            }} accessibilityRole="button" accessibilityLabel={watchOk ? 'Send to Apple Watch' : 'Send to Garmin'}>
              <Watch size={16} color={C.t1} />
              <Text style={s.actionTxt}>Watch</Text>
            </Pressable>
          </View>
        )}

        {moving && week && (
          <View style={s.moveRow}>
            {Array.from({ length: 7 }, (_, d) => addDays(week.startDate, d)).map(d => {
              const on = d === session.date;
              const taken = week.sessions.find(x => x.date === d && x.id !== session.id);
              const off = on || d < today || taken?.kind === 'race';
              return (
                <Pressable key={d} style={[s.moveDay, on && s.moveDayOn, off && !on && { opacity: 0.35 }]} disabled={off}
                  onPress={() => { update({ ...ap, plan: moveSession(plan, session.id, d) }); setMoving(false); }}
                  accessibilityRole="button" accessibilityLabel={`Move to ${DAY[weekday(d)]}${taken ? `, swaps with ${taken.title}` : ''}`}>
                  <Text style={[s.moveTxt, on && { color: C.bg }]}>{DAY[weekday(d)].slice(0, 1)}</Text>
                  {taken && !on && <View style={[s.moveDot, { backgroundColor: kindColor(C, taken.kind) }]} />}
                </Pressable>
              );
            })}
          </View>
        )}
        {moving && <Text style={s.feel}>Pick a day this week. A session already there swaps with this one.</Text>}

        {session.status === 'skipped' && session.date >= today && (
          <Pressable onPress={() => update({ ...ap, plan: setStatus(plan, session.id, 'planned') })} accessibilityRole="button" style={{ alignSelf: 'center', padding: 12 }}>
            <Text style={[s.actionTxt, { color: C.green }]}>Put it back</Text>
          </Pressable>
        )}
      </ScrollView>

      {open && (
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
          <PrimaryButton label={session.date === today ? 'Start guided run' : 'Start it now'} onPress={() => navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', sessionId: session.id })} icon={<Play size={16} color={C.alwaysLight} weight="fill" />} size="lg" fullWidth />
        </View>
      )}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    center:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    body:     { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 32, gap: 14 },
    kind:     { alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
    kindTxt:  { fontFamily: Fonts.bold, fontSize: 11.5, letterSpacing: 0.6, color: C.t1 },
    title:    { fontFamily: Fonts.semiBold, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: C.t1, marginTop: -4 },
    feel:     { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: C.t2 },
    eased:    { fontFamily: Fonts.medium, fontSize: 14, color: C.lavenderInk, backgroundColor: C.lavender, borderRadius: 14, padding: 10 },
    done:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.mint, borderRadius: 14, padding: 12 },
    doneTxt:  { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    card:     { backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 14 },
    step:     { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
    bar:      { width: 5, borderRadius: 3 },
    stepTitle:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    stepSub:  { fontFamily: Fonts.regular, fontSize: 13.5, color: C.t2, marginTop: 2, fontVariant: ['tabular-nums'] },
    total:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
    actions:  { flexDirection: 'row', gap: 8 },
    action:   { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    actionTxt:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    moveRow:  { flexDirection: 'row', gap: 6 },
    moveDay:  { flex: 1, height: 48, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', gap: 3 },
    moveDayOn:{ backgroundColor: C.t1 },
    moveTxt:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    moveDot:  { width: 6, height: 6, borderRadius: 3 },
    footer:   { paddingHorizontal: 22, paddingTop: 10, backgroundColor: C.bg },
  });
}
