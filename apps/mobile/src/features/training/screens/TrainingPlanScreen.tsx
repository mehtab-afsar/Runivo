/**
 * The active race plan: summary, paces, weeks, and each session with its
 * steps. Sessions can be started, moved within their week or skipped, and
 * "Not feeling 100%" eases the next 7 days.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowLeft, Check, DotsThree, Play, Heartbeat } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import {
  RACE_LABEL, fmtBand, fmtDuration, weekOf, isMissed, moveSession, setStatus, easeNextDays,
  addDays, weekday, daysBetween, type Session,
} from '@shared/engine/training';
import { fetchActivePlan, getCachedPlan, savePlan, endPlan, localToday, type ActivePlan } from '../services/planService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FOCUS: Record<string, string> = { base: 'Base', build: 'Build', recovery: 'Lighter week', taper: 'Taper', race: 'Race week' };

export default function TrainingPlanScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const today = localToday();
  const [ap, setAp] = useState<ActivePlan | null | undefined>(undefined);
  const [weekIdx, setWeekIdx] = useState<number | null>(null);
  const [open, setOpen] = useState<Session | null>(null);

  const load = useCallback(() => {
    getCachedPlan().then(c => { if (c) setAp(prev => prev ?? c); });
    fetchActivePlan().then(setAp).catch(() => setAp(prev => prev ?? null));
  }, []);
  useFocusEffect(load);

  const plan = ap?.plan;
  const current = plan ? (weekOf(plan, today)?.index ?? (today < plan.weeks[0].startDate ? 1 : plan.weeks.length)) : 1;
  useEffect(() => { if (plan && weekIdx == null) setWeekIdx(current); }, [plan, weekIdx, current]);

  const update = (next: ActivePlan) => {
    setAp(next);
    savePlan(next).catch(() => Alert.alert('Saved on this phone', "We'll sync the change when you're back online."));
  };

  if (ap === undefined) return <SafeAreaView style={s.root}><View style={s.center}><ActivityIndicator color={C.t2} /></View></SafeAreaView>;

  if (!plan || !ap) {
    return (
      <SafeAreaView style={s.root}>
        <Header s={s} C={C} title="Training" onBack={() => navigation.goBack()} />
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No plan yet</Text>
          <Text style={s.emptySub}>Pick a race and a date. We'll build weeks of sessions around the days you can run.</Text>
          <Pressable style={s.cta} onPress={() => navigation.replace('PlanBuilder')} accessibilityRole="button">
            <Text style={s.ctaTxt}>Build a plan</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const week = plan.weeks.find(w => w.index === (weekIdx ?? current)) ?? plan.weeks[0];
  const all = plan.weeks.flatMap(w => w.sessions);
  const done = all.filter(x => x.status === 'done').length;
  const daysToRace = daysBetween(today, plan.raceDate);

  const menu = () => Alert.alert('Plan', undefined, [
    { text: 'Build a new plan', onPress: () => navigation.navigate('PlanBuilder') },
    { text: 'End this plan', style: 'destructive', onPress: () => endPlan(ap).then(() => setAp(null)) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const notFeeling = () => Alert.alert(
    'Not feeling 100%?',
    'Every session in the next 7 days becomes an easy recovery run, about 30% shorter. Race day is never changed.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Ease my week', onPress: () => update({ ...ap, plan: easeNextDays(plan, today) }) }],
  );

  return (
    <SafeAreaView style={s.root}>
      <Header s={s} C={C} title={`${RACE_LABEL[plan.race]} plan`} onBack={() => navigation.goBack()} onMenu={menu} />
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Summary */}
        <View style={s.card}>
          <Text style={s.eyebrow}>{daysToRace > 0 ? `${daysToRace} days to race day` : daysToRace === 0 ? 'Race day' : 'Race done'}</Text>
          <Text style={s.big}>{fmtDuration(plan.targetSec)}</Text>
          <Text style={s.sub}>Target for {RACE_LABEL[plan.race]} · {plan.raceDate}</Text>
          {plan.goalCapped && plan.goalSec ? (
            <Text style={s.note}>Your goal of {fmtDuration(plan.goalSec)} is faster than your 5K suggests, so the plan aims for {fmtDuration(plan.targetSec)} to keep training safe. Update your 5K time as you get fitter.</Text>
          ) : null}
          <View style={s.track}><View style={[s.fill, { width: `${Math.round((done / Math.max(1, all.length)) * 100)}%` }]} /></View>
          <Text style={s.sub}>{done} of {all.length} sessions done · week {current} of {plan.weeks.length}</Text>
        </View>

        {/* Paces */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Your paces</Text>
          {([['Easy', plan.paces.easy], ['Long run', plan.paces.long], ['Tempo', plan.paces.tempo], ['Intervals', plan.paces.interval], ['Race', plan.paces.race]] as const).map(([k, b]) => (
            <View key={k} style={s.paceRow}><Text style={s.paceKey}>{k}</Text><Text style={s.paceVal}>{fmtBand(b)}</Text></View>
          ))}
        </View>

        {/* Week picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.weeks}>
          {plan.weeks.map(w => {
            const on = w.index === week.index;
            return (
              <Pressable key={w.index} style={[s.weekChip, on && s.weekChipOn]} onPress={() => setWeekIdx(w.index)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[s.weekChipTxt, on && s.weekChipTxtOn]}>W{w.index}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.card}>
          <View style={s.weekHead}>
            <Text style={s.cardLabel}>Week {week.index} · {FOCUS[week.focus]}</Text>
            <Text style={s.cardLabel}>{week.km} km</Text>
          </View>
          {[...week.sessions].sort((a, b) => (a.date < b.date ? -1 : 1)).map((x, i) => {
            const missed = isMissed(x, today);
            const isToday = x.date === today;
            return (
              <Pressable key={x.id} style={[s.row, i > 0 && s.rowBorder]} onPress={() => setOpen(x)} accessibilityRole="button">
                <View style={[s.dayBox, isToday && s.dayBoxToday]}>
                  <Text style={[s.dayName, isToday && s.dayTxtToday]}>{DAY_SHORT[weekday(x.date)]}</Text>
                  <Text style={[s.dayNum, isToday && s.dayTxtToday]}>{Number(x.date.slice(8))}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, (x.status !== 'planned' || missed) && { color: C.t2 }]} numberOfLines={1}>{x.title}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>{x.eased ? 'Eased · ' : ''}{x.summary}</Text>
                </View>
                {x.status === 'done' ? <Check size={18} color={C.green} weight="bold" />
                  : x.status === 'skipped' ? <Text style={s.tag}>Skipped</Text>
                  : missed ? <Text style={s.tag}>Missed</Text>
                  : isToday ? <Text style={[s.tag, { color: C.red }]}>Today</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable style={s.ease} onPress={notFeeling} accessibilityRole="button">
          <Heartbeat size={16} color={C.t1} weight="regular" />
          <Text style={s.easeTxt}>Not feeling 100%</Text>
        </Pressable>
      </ScrollView>

      {/* Session sheet */}
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(null)} />
        {open && (
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{open.title}</Text>
            <Text style={s.sub}>{DAY_SHORT[weekday(open.date)]} {open.date} · {open.distanceKm} km</Text>
            <View style={s.steps}>
              {open.steps.map((st, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={[s.stepDot, st.kind === 'run' && open.kind !== 'easy' && open.kind !== 'long' && open.kind !== 'recovery' && { backgroundColor: C.red }]} />
                  <Text style={s.stepTxt}>
                    {st.label}{st.distanceM ? ` · ${st.distanceM >= 1000 ? `${(st.distanceM / 1000).toFixed(st.distanceM % 1000 ? 1 : 0)} km` : `${st.distanceM} m`}` : ''}
                    {st.durationSec ? ` · ${Math.round(st.durationSec)} s` : ''}
                  </Text>
                  {st.pace ? <Text style={s.stepPace}>{fmtBand(st.pace)}</Text> : null}
                </View>
              ))}
            </View>

            {open.status === 'planned' && open.date >= today && (
              <Pressable
                style={s.cta}
                onPress={() => { setOpen(null); navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', sessionId: open.id }); }}
                accessibilityRole="button"
              >
                <Play size={16} color={C.alwaysLight} weight="fill" />
                <Text style={s.ctaTxt}>Start this session</Text>
              </Pressable>
            )}

            {open.status === 'planned' && open.kind !== 'race' && (
              <>
                <Text style={[s.cardLabel, { marginTop: 16 }]}>Move to</Text>
                <View style={s.moveRow}>
                  {Array.from({ length: 7 }, (_, d) => addDays(weekOf(plan, open.date)!.startDate, d)).map(d => {
                    const on = d === open.date;
                    return (
                      <Pressable
                        key={d}
                        style={[s.moveDay, on && s.moveDayOn, d < today && { opacity: 0.35 }]}
                        disabled={on || d < today}
                        onPress={() => { update({ ...ap, plan: moveSession(plan, open.id, d) }); setOpen(null); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Move to ${DAY_SHORT[weekday(d)]}`}
                      >
                        <Text style={[s.moveTxt, on && { color: C.bg }]}>{DAY_SHORT[weekday(d)].slice(0, 1)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable style={s.skip} onPress={() => { update({ ...ap, plan: setStatus(plan, open.id, 'skipped') }); setOpen(null); }} accessibilityRole="button">
                  <Text style={s.skipTxt}>Skip this session</Text>
                </Pressable>
              </>
            )}
            {open.status === 'skipped' && (
              <Pressable style={s.skip} onPress={() => { update({ ...ap, plan: setStatus(plan, open.id, 'planned') }); setOpen(null); }} accessibilityRole="button">
                <Text style={s.skipTxt}>Put it back</Text>
              </Pressable>
            )}
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function Header({ s, C, title, onBack, onMenu }: { s: ReturnType<typeof mkStyles>; C: AppColors; title: string; onBack: () => void; onMenu?: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
        <ArrowLeft size={16} color={C.t1} weight="regular" />
      </Pressable>
      <Text style={s.title}>{title}</Text>
      {onMenu ? (
        <Pressable onPress={onMenu} style={s.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Plan options">
          <DotsThree size={20} color={C.t1} weight="bold" />
        </Pressable>
      ) : <View style={{ width: 32 }} />}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    backBtn:  { width: 32 },
    title:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    scroll:   { paddingHorizontal: 18, paddingBottom: 48, gap: 12 },
    card:     { backgroundColor: C.card, borderRadius: 16, padding: 16 },
    eyebrow:  { fontFamily: Fonts.medium, fontSize: 12, color: C.red },
    big:      { fontFamily: Fonts.numeric, fontSize: 40, lineHeight: 44, color: C.t1, marginTop: 4 },
    sub:      { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 17, color: C.t2, marginTop: 4 },
    note:     { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 17, color: C.t1, backgroundColor: C.surface, borderRadius: 10, padding: 10, marginTop: 10 },
    track:    { height: 6, borderRadius: 3, backgroundColor: C.border, marginTop: 14, overflow: 'hidden' },
    fill:     { height: 6, borderRadius: 3, backgroundColor: C.red },
    cardLabel:{ fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    paceRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    paceKey:  { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    paceVal:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, fontVariant: ['tabular-nums'] },
    weeks:    { gap: 6, paddingVertical: 2 },
    weekChip: { height: 32, minWidth: 44, paddingHorizontal: 10, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    weekChipOn: { backgroundColor: C.t1 },
    weekChipTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    weekChipTxtOn: { color: C.bg },
    weekHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowBorder:{ borderTopWidth: 1, borderTopColor: C.border },
    dayBox:   { width: 42, height: 42, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    dayBoxToday: { backgroundColor: C.red },
    dayName:  { fontFamily: Fonts.medium, fontSize: 10.5, color: C.t2 },
    dayNum:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    dayTxtToday: { color: C.alwaysLight },
    rowTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    rowSub:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    tag:      { fontFamily: Fonts.medium, fontSize: 12, color: C.t3 },
    ease:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.border },
    easeTxt:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 20, color: C.t1 },
    emptySub: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, textAlign: 'center', marginTop: 8, marginBottom: 20 },
    cta:      { flexDirection: 'row', gap: 8, height: 50, paddingHorizontal: 24, borderRadius: 25, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    ctaTxt:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet:    { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
    handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 },
    sheetTitle: { fontFamily: Fonts.semiBold, fontSize: 19, color: C.t1 },
    steps:    { marginTop: 14, gap: 8 },
    stepRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.t3 },
    stepTxt:  { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    stepPace: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t2, fontVariant: ['tabular-nums'] },
    moveRow:  { flexDirection: 'row', gap: 6, marginTop: 8 },
    moveDay:  { flex: 1, height: 36, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    moveDayOn:{ backgroundColor: C.t1 },
    moveTxt:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    skip:     { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
    skipTxt:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t2 },
  });
}
