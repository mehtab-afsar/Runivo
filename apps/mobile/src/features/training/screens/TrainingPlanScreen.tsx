/**
 * The active race plan: summary, paces, weeks, and each session with its
 * steps. Sessions can be started, moved within their week or skipped, and
 * "Not feeling 100%" eases the next 7 days.
 */
import { SafetyNote } from '@mobile/shared/components/SafetyNote';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { ErrorState } from '@mobile/shared/components/ErrorState';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Check, DotsThree, Play, Heartbeat } from 'phosphor-react-native';
import { ScreenHeader, HeaderButton } from '@mobile/shared/components/ScreenHeader';
import MonthGrid, { monthOf } from '@mobile/shared/components/MonthGrid';
import { ModalSheet } from '@mobile/shared/components/ModalSheet';
import { kindColor } from '../sessionLook';
import { fmtRaceDate } from '../services/raceService';
import { useTheme, Fonts, type AppColors } from '@theme';
import {
  RACE_LABEL, fmtBand, fmtDuration, weekOf, isMissed, easeNextDays, rebuildForDate, PLAN_WEEKS,
  addDays, weekday, daysBetween, sessionOn,
} from '@shared/engine/training';
import { fetchActivePlan, getCachedPlan, savePlan, endPlan, localToday, type ActivePlan } from '../services/planService';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';
import { Segmented } from '@mobile/shared/components/Segmented';

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
  const [view, setView] = useState<'week' | 'month'>('week');
  const [month, setMonth] = useState(monthOf(today));
  const [moveRace, setMoveRace] = useState<string | null>(null);
  const [moveMonth, setMoveMonth] = useState(monthOf(today));
  const openSession = (id: string) => navigation.navigate('PlanSession', { sessionId: id });

  const [loadError, setLoadError] = useState(false);
  const load = useCallback(() => {
    setLoadError(false);
    getCachedPlan().then(c => { if (c) setAp(prev => prev ?? c); });
    // An offline failure with no cached plan must not look like "No plan yet" — that invites
    // building a second plan on top of the one we simply couldn't fetch.
    fetchActivePlan().then(setAp).catch(() => {
      setAp(prev => prev ?? null);
      setLoadError(true);
    });
  }, []);
  useFocusEffect(load);

  const plan = ap?.plan;
  const current = plan ? (weekOf(plan, today)?.index ?? (today < plan.weeks[0].startDate ? 1 : plan.weeks.length)) : 1;
  useEffect(() => { if (plan && weekIdx == null) setWeekIdx(current); }, [plan, weekIdx, current]);

  const update = (next: ActivePlan) => {
    setAp(next);
    savePlan(next).catch(() => appAlert('Saved on this phone', "We'll sync the change when you're back online."));
  };

  if (ap === undefined) return <SafeAreaView style={s.root}><View style={s.center}><ActivityIndicator color={C.t2} /></View></SafeAreaView>;

  if (!plan || !ap) {
    return (
      <SafeAreaView style={s.root}>
        <ScreenHeader title="Training" onBack={() => navigation.goBack()} />
        {loadError ? <ErrorState title="Couldn't load your plan" onRetry={load} /> : (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No plan yet</Text>
          <Text style={s.emptySub}>Pick a race and a date. We'll build weeks of sessions around the days you can run.</Text>
          <PrimaryButton label="Build a plan" onPress={() => navigation.replace('PlanBuilder')} fullWidth style={{ marginTop: 16 }} />
        </View>
        )}
      </SafeAreaView>
    );
  }

  const week = plan.weeks.find(w => w.index === (weekIdx ?? current)) ?? plan.weeks[0];
  const all = plan.weeks.flatMap(w => w.sessions);
  const done = all.filter(x => x.status === 'done').length;
  const daysToRace = daysBetween(today, plan.raceDate);

  const canMoveRace = (plan.goal ?? 'race') === 'race' && daysToRace > 7;
  const menu = () => appAlert('Plan', undefined, [
    ...(canMoveRace ? [{ text: 'Race date changed', onPress: () => { setMoveRace(plan.raceDate); setMoveMonth(monthOf(plan.raceDate)); } }] : []),
    { text: 'Build a new plan', onPress: () => navigation.navigate('PlanBuilder') },
    { text: 'End this plan', style: 'destructive', onPress: () => appAlert(
      'End this plan?',
      'Your remaining sessions are removed. Runs you already did stay in your history.',
      [
        { text: 'Keep plan', style: 'cancel' },
        { text: 'End plan', style: 'destructive', onPress: () => {
          endPlan(ap).then(() => setAp(null)).catch(() => appAlert("Couldn't end the plan", 'Check your connection and try again.'));
        } },
      ],
    ) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const todaySession = all.find(x => x.date === today);

  const notFeeling = () => appAlert(
    'Not feeling 100%?',
    'Every session in the next 7 days becomes an easy recovery run, about 30% shorter. Race day is never changed.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Ease my week', onPress: () => update({ ...ap, plan: easeNextDays(plan, today) }) }],
  );

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader title={`${RACE_LABEL[plan.race]} plan`} onBack={() => navigation.goBack()} right={<HeaderButton onPress={menu} label="Plan options"><DotsThree size={20} color={C.t1} weight="bold" /></HeaderButton>} />
      <ScrollView contentContainerStyle={s.scroll}>
        <SafetyNote kind="coach" style={{ marginTop: 0, marginBottom: 10 }} />
        {/* Summary (mock): dark card with week, race and countdown. */}
        <View style={s.hero}>
          <Text style={s.heroEyebrow}>{RACE_LABEL[plan.race]} plan · week {current} of {plan.weeks.length}</Text>
          <View style={s.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroRace} numberOfLines={2}>
                {plan.raceRef?.name ?? ((plan.goal ?? 'race') === 'race' ? 'Race day' : plan.goal === 'start' ? 'Your first 5K' : 'Time trial')}
              </Text>
              <Text style={s.heroSub}>{fmtRaceDate(plan.raceDate)}</Text>
            </View>
            <Text style={s.heroDays}>{daysToRace > 0 ? `${daysToRace} days` : daysToRace === 0 ? 'Today' : 'Done'}</Text>
          </View>
          <Text style={[s.heroSub, { marginTop: 10 }]}>Target {fmtDuration(plan.targetSec)}{plan.goalSec && !plan.goalCapped ? ` · goal ${fmtDuration(plan.goalSec)}` : ''}</Text>
          {plan.goalCapped && plan.goalSec ? (
            <Text style={s.note}>Your goal of {fmtDuration(plan.goalSec)} is faster than your 5K suggests, so the plan aims for {fmtDuration(plan.targetSec)} to keep training safe. Update your 5K time as you get fitter.</Text>
          ) : null}
          <View style={s.track}><View style={[s.fill, { width: `${Math.round((done / Math.max(1, all.length)) * 100)}%` }]} /></View>
          <Text style={s.heroSub}>{done} of {all.length} sessions done</Text>
        </View>

        {todaySession && todaySession.status === 'planned' && (
          <View style={s.todayCard}>
            <Text style={s.todayEyebrow}>Today</Text>
            <Text style={s.todayTitle}>{todaySession.title}</Text>
            <Text style={s.todaySub} numberOfLines={2}>{todaySession.summary}</Text>
            <PrimaryButton label="Start session" onPress={() => openSession(todaySession.id)} icon={<Play size={16} color={C.alwaysLight} weight="fill" />} size="sm" style={{ marginTop: 10 }} />
          </View>
        )}

        {/* Paces */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Your paces</Text>
          {([['Easy', plan.paces.easy], ['Long run', plan.paces.long], ['Tempo', plan.paces.tempo], ['Intervals', plan.paces.interval], ['Race', plan.paces.race]] as const).map(([k, b]) => (
            <View key={k} style={s.paceRow}><Text style={s.paceKey}>{k}</Text><Text style={s.paceVal}>{fmtBand(b)}</Text></View>
          ))}
        </View>

        <Segmented options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} value={view} onChange={setView} />

        {view === 'month' ? (
          <MonthGrid
            month={month} onMonth={setMonth} today={today}
            minDate={plan.weeks[0].startDate} maxDate={plan.raceDate}
            dot={d => { const x = sessionOn(plan, d); return x && x.status !== 'skipped' ? kindColor(C, x.kind) : null; }}
            done={d => sessionOn(plan, d)?.status === 'done'}
            onSelect={d => { const x = sessionOn(plan, d); if (x) openSession(x.id); }}
          />
        ) : <>
        {/* Week picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.weeks}>
          {plan.weeks.map(w => {
            const on = w.index === week.index;
            return (
              <Pressable hitSlop={8} key={w.index} style={[s.weekChip, on && s.weekChipOn]} onPress={() => setWeekIdx(w.index)} accessibilityRole="button" accessibilityState={{ selected: on }}>
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
              <Pressable key={x.id} style={[s.row, i > 0 && s.rowBorder]} onPress={() => openSession(x.id)} accessibilityRole="button">
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
                  : isToday ? <Text style={[s.tag, { color: C.green }]}>Today</Text> : null}
              </Pressable>
            );
          })}
        </View>

        </>}

        <Pressable style={s.ease} onPress={notFeeling} accessibilityRole="button">
          <Heartbeat size={16} color={C.t1} weight="regular" />
          <Text style={s.easeTxt}>Not feeling 100%</Text>
        </Pressable>
      </ScrollView>

      {/* Race date changed: pick the new day, the rest of the plan is rebuilt. */}
      <ModalSheet visible={!!moveRace} onClose={() => setMoveRace(null)} title="Race moved?"
        subtitle="Pick the new date. Weeks you've started stay as they are; the rest is rebuilt with a proper taper.">
        {moveRace && (() => {
          const rebuilt = moveRace !== plan.raceDate ? rebuildForDate(plan, moveRace, today) : null;
          const err = rebuilt && 'error' in rebuilt ? rebuilt : null;
          const ok = rebuilt && !('error' in rebuilt) ? rebuilt : null;
          return (
            <>
              <View style={{ marginTop: 12 }}>
                <MonthGrid month={moveMonth} onMonth={setMoveMonth} selected={moveRace} today={today}
                  minDate={addDays(today, 7)} maxDate={addDays(today, 7 * (PLAN_WEEKS[plan.race].max + 20))} onSelect={setMoveRace} />
              </View>
              {err && <Text style={[s.sub, { color: C.danger }]}>{err.error === 'too_soon' ? `Too soon: a ${RACE_LABEL[plan.race]} plan needs at least ${err.minWeeks} weeks.` : "Couldn't rebuild for that date."}</Text>}
              {ok && <Text style={s.sub}>{fmtRaceDate(moveRace)} · {ok.weeks.length} weeks in total · peak {Math.round(Math.max(...ok.weeks.map(w => w.km)))} km</Text>}
              <PrimaryButton label="Rebuild plan" onPress={() => { if (ok) { update({ ...ap, plan: ok }); setMoveRace(null); setWeekIdx(null); } }} disabled={!ok} fullWidth style={{ marginTop: 16 }} />
            </>
          );
        })()}
      </ModalSheet>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll:   { paddingHorizontal: 18, paddingBottom: 48, gap: 12 },
    card:     { backgroundColor: C.card, borderRadius: 24, padding: 18 },
    hero:     { backgroundColor: C.alwaysDark, borderRadius: 28, padding: 20 },
    heroEyebrow: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.lime },
    heroRow:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 8 },
    heroRace: { fontFamily: Fonts.semiBold, fontSize: 20, lineHeight: 25, color: C.alwaysLight },
    heroDays: { fontFamily: Fonts.numeric, fontSize: 30, color: C.alwaysLight },
    heroSub:  { fontFamily: Fonts.regular, fontSize: 13.5, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
    todayCard:{ backgroundColor: C.mint, borderRadius: 24, padding: 18, gap: 4 },
    todayEyebrow: { fontFamily: Fonts.bold, fontSize: 12, color: C.green },
    todayTitle: { fontFamily: Fonts.semiBold, fontSize: 19, color: C.t1 },
    todaySub: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2 },
    sub:      { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 17, color: C.t2, marginTop: 4 },
    note:     { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 17, color: C.alwaysLight, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, marginTop: 10 },
    track:    { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 14, overflow: 'hidden' },
    fill:     { height: 8, borderRadius: 4, backgroundColor: C.lime },
    cardLabel:{ fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    paceRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    paceKey:  { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    paceVal:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, fontVariant: ['tabular-nums'] },
    weeks:    { gap: 6, paddingVertical: 2 },
    weekChip: { height: 38, minWidth: 48, paddingHorizontal: 12, borderRadius: 19, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    weekChipOn: { backgroundColor: C.alwaysDark },
    weekChipTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    weekChipTxtOn: { color: C.alwaysLight },
    weekHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowBorder:{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    dayBox:   { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    dayBoxToday: { backgroundColor: C.alwaysDark },
    dayName:  { fontFamily: Fonts.medium, fontSize: 10.5, color: C.t2 },
    dayNum:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    dayTxtToday: { color: C.alwaysLight },
    rowTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    rowSub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
    tag:      { fontFamily: Fonts.medium, fontSize: 12, color: C.t3 },
    ease:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, backgroundColor: C.card },
    easeTxt:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 20, color: C.t1 },
    emptySub: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, textAlign: 'center', marginTop: 8, marginBottom: 20 },
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
