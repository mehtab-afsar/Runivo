/**
 * Plan setup (PRD "Race-first training plans", mocks 1–8), one question per
 * screen:
 *
 *   goal → find race / add race → race & distance → fitness → week → injuries → preview
 *
 * Goals without a race skip the race steps and end in a time trial; "Start
 * running" is a walk-run plan and skips fitness and injuries. Every entry
 * point opens this screen (Home, Plan, PaceX, Events, onboarding); a race
 * passed in skips straight to its page. Answers already given in onboarding
 * are filled in.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { FormButton, FormLink, FormTip } from '@mobile/shared/components/form/FormKit';
import {
  buildPlan, buildStartPlan, goalPlanShape, planEndDate, planStartMonday, predictSec, fiveKFromTime, raceForKm, daysBetween,
  RACE_KM, RACE_LABEL, PLAN_WEEKS, type PlanGoal, type RaceDistance, type TrainingPlanV2, type PlanError,
} from '@shared/engine/training';
import { createPlan, fetchPlanDefaults, localToday } from '../services/planService';
import {
  addRunnerRace, enterRace, raceForEvent, entrantsLabel, fmtRaceDate, ADD_RACE_MESSAGE, type RaceResult, type RaceDistanceOption,
} from '../services/raceService';
import { useFeatureGate } from '@features/subscription/hooks/useFeatureGate';
import SetupShell from '../setup/SetupShell';
import RaceSearchStep from '../setup/RaceSearchStep';
import AddRaceStep, { newRaceProblem, type NewRace } from '../setup/AddRaceStep';
import FitnessStep, { BASIS_KM, type FitnessValue } from '../setup/FitnessStep';
import PreviewStep from '../setup/PreviewStep';
import { GoalStep, InjuryStep, WeekStep, PillRow, nearestWeekly, type InjuryChoice } from '../setup/steps';
import { IconText } from '@mobile/shared/icons';
import { ArrowUpRight } from 'phosphor-react-native';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type StepKey = 'goal' | 'race' | 'addRace' | 'distance' | 'fitness' | 'week' | 'injury' | 'preview';

/** The steps a goal goes through, in order (addRace is a detour off race). */
function stepsFor(goal: PlanGoal, startAt: StepKey): StepKey[] {
  const all: StepKey[] =
    goal === 'race' ? ['goal', 'race', 'distance', 'fitness', 'week', 'injury', 'preview']
    : goal === 'start' ? ['goal', 'week', 'preview']
    : goal === 'return' ? ['goal', 'fitness', 'week', 'injury', 'preview']
    : ['goal', 'distance', 'fitness', 'week', 'injury', 'preview'];
  return all.slice(Math.max(0, all.indexOf(startAt)));
}

const GOAL_DISTANCES: Record<'faster' | 'further', RaceDistance[]> = { faster: ['5k', '10k'], further: ['10k', 'half', 'marathon'] };
const SHORT: Record<RaceDistance, string> = { '5k': '5K', '10k': '10K', half: 'Half', marathon: 'Marathon' };

export default function PlanBuilderScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const navigation = useNavigation<Nav>();
  const gate = useFeatureGate();
  const params = useRoute<RouteProp<RootStackParamList, 'PlanBuilder'>>().params ?? {};
  const today = localToday();
  const prefill = params.prefill;

  // A race handed in (Events "Train for this", a club race): start on its page.
  const startAt: StepKey = params.eventId || params.race ? 'distance' : 'goal';
  const [goal, setGoal] = useState<PlanGoal>('race');
  const steps = stepsFor(goal, startAt);
  const [step, setStep] = useState<StepKey>(startAt);

  const [race, setRace] = useState<RaceResult | null>(null);
  const [raceLoading, setRaceLoading] = useState(!!params.eventId);
  const [distanceId, setDistanceId] = useState<string | null>(null);
  const [goalDistance, setGoalDistance] = useState<RaceDistance>('10k');
  const [newRace, setNewRace] = useState<NewRace>({ name: '', startsOn: null, distanceM: null, city: '', url: '' });
  const [adding, setAdding] = useState(false);

  const [fitness, setFitness] = useState<FitnessValue>({ mode: 'time', basis: '5k', sec: prefill?.fiveKSec ?? 30 * 60, level: null });
  const [estimate, setEstimate] = useState<{ fiveKSec: number; runs: number } | null>(null);
  const [days, setDays] = useState<number[]>(prefill?.runDays?.length ? prefill.runDays.slice(0, 5) : [1, 3, 6]);
  const [longDay, setLongDay] = useState(prefill?.longRunDay ?? 6);
  const [weekly, setWeekly] = useState(nearestWeekly(prefill?.weeklyKm ?? null));
  const [runsKm, setRunsKm] = useState<number | null>(null);
  const [injury, setInjury] = useState<InjuryChoice>(prefill?.cautious ? 'minor' : 'none');
  const [push, setPush] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlanDefaults().then(d => {
      if (!prefill?.fiveKSec && d.fiveKSec) setFitness(f => (f.mode === 'time' && f.basis === '5k' ? { ...f, sec: d.fiveKSec! } : f));
      if (prefill?.weeklyKm == null && d.weeklyKm != null) setWeekly(nearestWeekly(d.weeklyKm));
      if (!prefill?.runDays?.length && d.runDays) {
        const saved = d.runDays;
        setDays(saved);
        setLongDay(d.longRunDay != null && saved.includes(d.longRunDay) ? d.longRunDay : saved[saved.length - 1]);
      }
      if (prefill?.cautious == null && d.cautious) setInjury(i => (i === 'none' ? 'minor' : i));
      setRunsKm(d.runsKm);
      setEstimate(d.estimate);
    }).catch(() => {});
  }, [prefill?.fiveKSec, prefill?.weeklyKm, prefill?.runDays?.length, prefill?.cautious]);

  useEffect(() => {
    if (params.race) pickRace(params.race);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.race?.id]);

  useEffect(() => {
    if (!params.eventId) return;
    raceForEvent(params.eventId).then(r => {
      setRaceLoading(false);
      if (r) pickRace(r);
      else setStep('race');
    }).catch(() => { setRaceLoading(false); setStep('race'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.eventId]);

  // ── Race helpers ────────────────────────────────────────────────────────────
  const weeksTo = (date: string) => Math.floor(daysBetween(planStartMonday(today), date) / 7) + 1;
  const plannable = (d: RaceDistanceOption) => raceForKm(d.distanceM / 1000);
  const fits = (d: RaceDistanceOption) => {
    const r = plannable(d);
    return !!r && !!race && weeksTo(race.startsOn) >= PLAN_WEEKS[r].min;
  };
  function pickRace(r: RaceResult) {
    setRace(r);
    const ok = r.distances.filter(d => raceForKm(d.distanceM / 1000) && weeksTo(r.startsOn) >= PLAN_WEEKS[raceForKm(d.distanceM / 1000)!].min);
    setDistanceId(ok.length ? ok[0].id : null);
    setStep('distance');
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  const close = () => navigation.goBack();
  const back = () => {
    if (step === 'addRace') return setStep('race');
    const i = steps.indexOf(step);
    if (i <= 0) return close();
    setStep(steps[i - 1]);
  };
  const next = () => {
    const i = steps.indexOf(step);
    setStep(steps[Math.min(i + 1, steps.length - 1)]);
  };

  const saveNewRace = async () => {
    const problem = newRaceProblem(newRace);
    if (problem) { appAlert('Almost there', problem); return; }
    setAdding(true);
    const res = await addRunnerRace({ name: newRace.name, startsOn: newRace.startsOn!, distanceM: newRace.distanceM!, city: newRace.city, url: newRace.url });
    setAdding(false);
    if ('error' in res) { appAlert("Couldn't add the race", ADD_RACE_MESSAGE[res.error]); return; }
    const label = SHORT[raceForKm(newRace.distanceM! / 1000) ?? '10k'];
    pickRace({
      id: res.raceId, name: newRace.name.trim(), city: newRace.city.trim() || null, startsOn: newRace.startsOn!, websiteUrl: newRace.url.trim() || null,
      source: 'runner', status: 'pending', kmAway: null, entrants: 0, mine: false,
      distances: [{ id: res.distanceId, distanceM: newRace.distanceM!, label, startTime: null }],
    });
  };

  // ── The plan ────────────────────────────────────────────────────────────────
  const fiveKSec = fitness.basis === '5k' ? fitness.sec : fiveKFromTime(BASIS_KM[fitness.basis], fitness.sec);
  const chosen = race?.distances.find(d => d.id === distanceId) ?? null;
  const built: TrainingPlanV2 | { error: PlanError; minWeeks?: number } | null = useMemo(() => {
    if (step !== 'preview') return null;
    if (goal === 'start') return buildStartPlan({ runDays: days, longRunDay: longDay, today });
    const inj = injury === 'unsaid' ? 'none' : injury;
    const common = { fiveKSec, runDays: days, longRunDay: longDay, currentWeeklyKm: weekly, today, injury: inj };
    if (goal === 'race') {
      const rd = chosen ? raceForKm(chosen.distanceM / 1000) : null;
      if (!race || !chosen || !rd) return { error: 'too_soon' };
      return buildPlan({
        ...common, race: rd, raceDate: race.startsOn, goal: 'race',
        goalSec: push ? Math.round(predictSec(fiveKSec, RACE_KM[rd]) * 0.97) : null,
        raceRef: { raceId: race.id, distanceId: chosen.id, name: race.name, city: race.city },
      });
    }
    const shape = goalPlanShape(goal, goalDistance);
    return buildPlan({
      ...common, race: shape.race, raceDate: planEndDate(today, shape.weeks), goal, cautious: shape.cautious,
      goalSec: push && goal === 'faster' ? Math.round(predictSec(fiveKSec, RACE_KM[shape.race]) * 0.97) : null,
    });
  }, [step, goal, days, longDay, today, injury, fiveKSec, weekly, race, chosen, push, goalDistance]);

  const start = async () => {
    if (!built || 'error' in built) return;
    if (!gate.loading && !gate.canUse('training_plan')) { navigation.navigate('Subscription', { reason: 'training' }); return; }
    setSaving(true);
    try {
      const ap = await createPlan(built);
      if (built.raceRef) await enterRace(built.raceRef.distanceId, ap.id, built.goalSec).catch(() => false);
      navigation.replace('TrainingPlan');
    } catch {
      appAlert("Couldn't save the plan", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const justEnter = async () => {
    if (!chosen) return;
    const ok = await enterRace(chosen.id);
    appAlert(ok ? "You're in" : "Couldn't save that", ok ? `${race?.name} is on your list. Build a plan for it any time.` : 'Check your connection and try again.');
    if (ok) close();
  };

  // ── Screens ─────────────────────────────────────────────────────────────────
  const shell = (props: Omit<React.ComponentProps<typeof SetupShell>, 'step' | 'steps' | 'onBack' | 'onClose'>) => (
    <SetupShell step={Math.max(1, steps.indexOf(step === 'addRace' ? 'race' : step) + 1)} steps={steps.length} onBack={back} onClose={close} {...props} />
  );

  if (step === 'goal') {
    return shell({
      title: "What's the", accent: 'plan?', subtitle: 'Pick what fits best. You can change it later.',
      children: <GoalStep value={goal} onChange={g => { setGoal(g); if (g === 'faster') setGoalDistance('5k'); if (g === 'further') setGoalDistance('half'); }} />,
      footer: <FormButton label="Continue" onPress={next} />,
    });
  }

  if (step === 'race') {
    return shell({
      title: 'Find your', accent: 'race.', subtitle: 'Races near you come first.',
      children: <RaceSearchStep today={today} onPick={pickRace} onAdd={name => { setNewRace(r => ({ ...r, name: name || r.name })); setStep('addRace'); }} />,
    });
  }

  if (step === 'addRace') {
    return shell({
      title: 'Add your', accent: 'race.', subtitle: 'Your plan works straight away.',
      children: <AddRaceStep value={newRace} onChange={setNewRace} today={today} />,
      footer: <FormButton label="Use this race" onPress={saveNewRace} busy={adding} disabled={!!newRaceProblem(newRace)} />,
    });
  }

  if (step === 'distance' && goal === 'race') {
    if (raceLoading || !race) {
      return shell({ title: 'Loading', accent: 'race…', children: <View /> });
    }
    const who = entrantsLabel(race.entrants);
    const weeks = weeksTo(race.startsOn);
    const anyFits = race.distances.some(fits);
    return shell({
      title: race.name,
      subtitle: `${fmtRaceDate(race.startsOn)}${race.city ? ` · ${race.city}` : ''}`,
      children: (
        <>
          <View style={s.facts}>
            <Fact s={s} label="Weeks to go" value={String(Math.max(0, weeks))} />
            <Fact s={s} label="Going" value={who ? who.replace(' training', '') : 'Be first'} />
            {race.websiteUrl
              ? <Pressable style={s.fact} onPress={() => Linking.openURL(race.websiteUrl!)} accessibilityRole="link"><Text style={s.factLabel}>Entry</Text><IconText Icon={ArrowUpRight} text="Website" color={C.green} size={16} weight="bold" gap={4} textStyle={[s.factVal, { fontSize: 16 }]} style={{ justifyContent: 'flex-start' }} /></Pressable>
              : <Fact s={s} label="Entry" value="—" />}
          </View>
          {race.status === 'pending' && <Text style={s.pending}>Only you can see this race until we check it.</Text>}
          <View>
            <Text style={s.label}>Your distance</Text>
            <PillRow
              options={race.distances.map(d => ({ value: d.id, label: d.label }))}
              value={distanceId} onChange={setDistanceId} disabled={anyFits ? id => !fits(race.distances.find(d => d.id === id)!) : undefined}
            />
            {!anyFits && (
              <Text style={s.warn}>
                {race.distances.some(plannable)
                  ? `This race is ${Math.max(0, weeks)} ${weeks === 1 ? 'week' : 'weeks'} away. That's too soon for a plan. Pick your distance to mark it as a race you're running, or pick a later race.`
                  : "We can build plans for 5K, 10K, half and full marathons. You can still mark this race as one you're running."}
              </Text>
            )}
          </View>
          <FormTip lead="PaceX:">{tipFor(chosen, weeks, anyFits)}</FormTip>
        </>
      ),
      footer: (
        <>
          <FormButton label="Train for this race" onPress={next} disabled={!chosen || !fits(chosen)} />
          {chosen && <FormLink label="I'm running it, no plan" onPress={justEnter} />}
        </>
      ),
    });
  }

  if (step === 'distance') {
    const opts = GOAL_DISTANCES[goal === 'faster' ? 'faster' : 'further'];
    const shape = goalPlanShape(goal as 'faster' | 'further', goalDistance);
    return shell({
      title: goal === 'faster' ? 'Faster at' : 'Build up', accent: goal === 'faster' ? 'which distance?' : 'to what?',
      subtitle: `${shape.weeks} weeks, ending with a ${SHORT[shape.race]} time trial.`,
      children: <PillRow options={opts.map(r => ({ value: r, label: SHORT[r] }))} value={goalDistance} onChange={setGoalDistance} />,
      footer: <FormButton label="Continue" onPress={next} />,
    });
  }

  if (step === 'fitness') {
    const ok = fiveKSec >= 12 * 60 && fiveKSec <= 60 * 60;
    return shell({
      title: 'How fast are you', accent: 'right now?', subtitle: "Today's fitness, not an old best or your goal.",
      children: <FitnessStep value={fitness} onChange={setFitness} estimate={estimate} />,
      footer: (
        <>
          <FormTip lead="Why PaceX asks:">It sets every pace in your plan.</FormTip>
          <FormButton label="Continue" onPress={next} disabled={!ok} />
        </>
      ),
    });
  }

  if (step === 'week') {
    const okDays = days.length >= 3 && days.includes(longDay);
    return shell({
      title: 'Your', accent: 'week.', subtitle: goal === 'start' ? 'Pick 3 or more days. Plans use 3 of them with a rest day between.' : 'Sessions only go on these days. Your long run goes on the day you pick below.',
      children: (
        <WeekStep days={days} longDay={longDay} weeklyKm={weekly} fromRuns={runsKm} showVolume={goal !== 'start'}
          onDays={setDays} onLong={setLongDay} onWeekly={setWeekly} />
      ),
      footer: <FormButton label="Continue" onPress={next} disabled={!okDays} />,
    });
  }

  if (step === 'injury') {
    return shell({
      title: 'Any', accent: 'injuries?', subtitle: 'Optional. It changes how fast your distance builds. Not medical advice.',
      children: <InjuryStep value={injury} onChange={setInjury} />,
      footer: <FormButton label="Continue" onPress={next} />,
    });
  }

  // Preview
  const err = built && 'error' in built ? built : null;
  const plan = built && !('error' in built) ? built : null;
  const name = goal === 'race' && race ? shortName(race.name) : goal === 'start' ? 'your first 5K' : plan ? SHORT[plan.race] : '';
  return shell({
    title: 'Your plan for', accent: `${name}.`,
    children: err ? (
      <View style={{ gap: 12 }}>
        <Text style={s.warn}>{errorText(err, goal, chosen)}</Text>
        {goal === 'race' && <FormLink label="Pick another race" onPress={() => setStep('race')} />}
        <FormLink label="Change my days" onPress={() => setStep('week')} />
      </View>
    ) : plan ? (
      <>
        {(goal === 'race' || goal === 'faster') && (
          <View>
            <Text style={s.label}>How hard to aim</Text>
            <PillRow
              options={[{ value: 'steady', label: 'Steady' }, { value: 'push', label: 'Push me' }]}
              value={push ? 'push' : 'steady'} onChange={v => setPush(v === 'push')}
            />
            <Text style={s.hint}>{push ? 'Aims about 3% faster than your fitness predicts.' : 'Aims for what your fitness predicts. It speeds up as you get fitter.'}</Text>
          </View>
        )}
        <PreviewStep plan={plan} today={today} />
      </>
    ) : <View />,
    footer: plan ? (
      <>
        <FormButton label="Start plan" onPress={start} busy={saving} />
        <FormLink label="Change details" onPress={() => setStep(goal === 'start' ? 'week' : 'fitness')} />
      </>
    ) : undefined,
  });
}

function shortName(n: string): string {
  const cut = n.replace(/\b(half marathon|marathon|half|10k|5k|run)\b/gi, '').replace(/\s+/g, ' ').trim();
  return (cut.length >= 3 ? cut : n).split(' ').slice(0, 2).join(' ');
}

function tipFor(d: RaceDistanceOption | null, weeks: number, anyFits = true): string {
  const r = d ? raceForKm(d.distanceM / 1000) : null;
  if (!d) return anyFits ? 'Pick the distance you are running.' : "No plan fits in time, but you can still save it as a race you're running.";
  if (!r) return "PaceX plans 5K to marathon. You can still save this race as one you're running.";
  const { min, max } = PLAN_WEEKS[r];
  if (weeks < min) return `A ${RACE_LABEL[r]} plan needs at least ${min} weeks. Tap "I'm running it, no plan" to add it anyway.`;
  if (weeks > max) return `${weeks} weeks is plenty. The plan starts ${weeks - max} weeks from now; keep running easy until then.`;
  return `${weeks} weeks is enough for a ${RACE_LABEL[r]} if you keep to the plan.`;
}

function errorText(e: { error: PlanError; minWeeks?: number }, goal: PlanGoal, d: RaceDistanceOption | null): string {
  if (e.error === 'too_soon') {
    const r = d ? raceForKm(d.distanceM / 1000) : null;
    return goal === 'race' && r ? `This race is too soon for a ${RACE_LABEL[r]} plan, which needs at least ${e.minWeeks ?? PLAN_WEEKS[r].min} weeks. Pick a shorter distance or a later race.` : "Couldn't build a plan for that date.";
  }
  if (e.error === 'bad_days') return 'Pick 3 to 5 run days, including your long-run day.';
  return 'Check your current time and try again.';
}

function Fact({ s, label, value }: { s: ReturnType<typeof mk>; label: string; value: string }) {
  return <View style={s.fact}><Text style={s.factLabel}>{label}</Text><Text style={s.factVal} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>;
}

function mk(C: AppColors) {
  return StyleSheet.create({
    facts:     { flexDirection: 'row', gap: 8 },
    fact:      { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 14 },
    factLabel: { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2 },
    factVal:   { fontFamily: Fonts.semiBold, fontSize: 22, color: C.t1, marginTop: 2, letterSpacing: -0.5 },
    label:     { fontFamily: Fonts.medium, fontSize: 14, color: C.t1, marginBottom: 8 },
    hint:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 8 },
    warn:      { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.amber, backgroundColor: C.amberBg, borderRadius: 16, padding: 12, marginTop: 10 },
    pending:   { fontFamily: Fonts.medium, fontSize: 13, color: C.lavenderInk, backgroundColor: C.lavender, borderRadius: 14, padding: 10 },
  });
}
