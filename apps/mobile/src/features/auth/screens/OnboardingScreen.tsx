/**
 * Onboarding: location → goal → race (race goal only) → your running now →
 * your week → your body → PaceX's voice → health app → about you → name and
 * photo → your people → alerts → your start (PaceX's summary and week 1, and
 * the real plan for the race goal). Never a paywall here.
 * Goal: out on a first run within 24 hours, with PaceX knowing enough to coach.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView, Platform, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from '@theme/hapticsGated';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { subscribeToPush } from '@shared/services/pushNotificationService';
import { track } from '@shared/services/analytics';
import { useTheme, Fonts, type AppColors } from '@theme';
import { useOnboarding } from '../hooks/useOnboarding';
import OnboardingProgress from '../components/OnboardingProgress';
import CityMapPreviewStep, { type LocationPhase } from '../components/CityMapPreviewStep';
import GoalStep from '../components/GoalStep';
import WatchStep from '../components/WatchStep';
import RunningNowStep from '../components/RunningNowStep';
import HealthStep from '../components/HealthStep';
import AboutYouStep from '../components/AboutYouStep';
import IdentityStep from '../components/IdentityStep';
import PeopleStep from '../components/PeopleStep';
import NotificationsStep from '../components/NotificationsStep';
import RaceStep from '../components/RaceStep';
import WeekStep from '../components/WeekStep';
import BodyStep from '../components/BodyStep';
import CoachStep from '../components/CoachStep';
import StartSummaryStep from '../components/StartSummaryStep';
import { startPreview } from '../startPlan';
import { raceDateForWeeks } from '../types';
import { paceXToneFor } from '@shared/engine/onboarding';
import { createPlan, localToday } from '@features/training/services/planService';
import { useFeatureGate } from '@features/subscription/hooks/useFeatureGate';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: SCREEN_W } = Dimensions.get('window');

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const ob = useOnboarding();
  const [locationPhase, setLocationPhase] = useState<LocationPhase>('prime');
  const [asking, setAsking] = useState(false);
  const gate = useFeatureGate();
  const today = localToday();
  const tone = ob.data.paceXTone ?? paceXToneFor(ob.data.goal ?? 'get_fit');
  const preview = useMemo(() => startPreview(ob.data, ob.weeklyTargetKm, today), [ob.data, ob.weeklyTargetKm, today]);

  useEffect(() => { track('onboarding_started'); }, []);

  // Slide between steps.
  const slideX = useRef(new Animated.Value(0)).current;
  const prev = useRef(ob.index);
  useEffect(() => {
    if (prev.current === ob.index) return;
    const forward = ob.index > prev.current;
    prev.current = ob.index;
    slideX.setValue(forward ? SCREEN_W * 0.25 : -SCREEN_W * 0.25);
    Animated.timing(slideX, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [ob.index, slideX]);

  async function finish() {
    const ok = await ob.submit();
    if (!ok) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Training for a race: the plan PaceX just showed becomes the real one (plans
    // are Plus; with Plus off, everyone has it), Home underneath.
    if (ob.data.goal === 'race') {
      if (preview.kind === 'plan' && gate.canUse('training_plan')) {
        const saved = await createPlan(preview.plan).then(() => true, () => false);
        if (saved) {
          navigation.reset({ index: 1, routes: [{ name: 'Main', params: { screen: 'Dashboard' } }, { name: 'TrainingPlan' }] });
          return;
        }
      }
      navigation.reset({ index: 1, routes: [{ name: 'Main', params: { screen: 'Dashboard' } }, { name: 'PlanBuilder', params: { fromOnboarding: true, ...(ob.data.raceDistance ? { race: ob.data.raceDistance } : {}) } }] });
      return;
    }
    // Straight to the Run tab: the first mission is one tap away.
    navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Run' } }] });
  }

  async function turnOnAlerts() {
    setAsking(true);
    try {
      const result = await subscribeToPush();
      ob.update('notificationsEnabled', result === 'granted');
      track('onboarding_notifications', { result });
    } finally {
      setAsking(false);
      ob.goNext();
    }
  }

  // Footer button per step.
  let cta: { label: string; onPress: () => void; disabled?: boolean } = {
    label: 'Continue', onPress: () => { ob.goNext(); }, disabled: !ob.canContinue(),
  };
  if (ob.stepKey === 'location') {
    cta = locationPhase === 'prime' || locationPhase === 'asking'
      ? { label: 'Allow location', onPress: () => setLocationPhase('asking'), disabled: locationPhase === 'asking' }
      : { label: 'Continue', onPress: () => { ob.goNext(); } };
  } else if (ob.stepKey === 'notifications') {
    cta = { label: 'Turn on alerts', onPress: turnOnAlerts, disabled: asking };
  } else if (ob.stepKey === 'mission') {
    cta = { label: preview.kind === 'plan' ? 'Save my plan' : ob.data.goal === 'race' ? 'Build my plan' : 'Start my first run', onPress: finish };
  }
  const busy = ob.loading || asking;

  const renderStep = () => {
    const d = ob.data;
    switch (ob.stepKey) {
      case 'location':
        return (
          <CityMapPreviewStep
            phase={locationPhase}
            onPhase={setLocationPhase}
            onLocationCaptured={(loc, country) => { ob.update('lastKnownLocation', loc); ob.update('country', country); }}
          />
        );
      case 'goal':
        return <GoalStep goal={d.goal} onChange={g => ob.update('goal', g)} />;
      case 'race':
        return (
          <RaceStep
            race={d.raceDistance} weeks={d.raceWeeks} raceDate={raceDateForWeeks(today, d.raceWeeks)} goalInput={d.raceGoalInput}
            onRace={r => ob.update('raceDistance', r)} onWeeks={w => ob.update('raceWeeks', w)} onGoal={v => ob.update('raceGoalInput', v)}
          />
        );
      case 'week':
        return (
          <WeekStep
            runDays={d.runDays} longRunDay={d.longRunDay} usualTime={d.usualTime} weekdayMinutes={d.weekdayMinutes}
            onDays={v => ob.update('runDays', v)} onLong={v => ob.update('longRunDay', v)}
            onTime={v => ob.update('usualTime', v)} onMinutes={v => ob.update('weekdayMinutes', v)}
          />
        );
      case 'body':
        return <BodyStep niggles={d.niggles} returning={d.returning} onNiggles={v => ob.update('niggles', v)} onReturning={v => ob.update('returning', v)} />;
      case 'coach':
        return <CoachStep tone={tone} onTone={t => ob.update('paceXTone', t)} />;
      case 'running':
        return (
          <RunningNowStep
            runsPerWeek={d.runsPerWeek} usualKm={d.usualKm} fiveKInput={d.fiveKInput} weeklyTargetKm={ob.weeklyTargetKm}
            onRuns={n => ob.update('runsPerWeek', n)} onKm={km => ob.update('usualKm', km)} onFiveK={v => ob.update('fiveKInput', v)}
          />
        );
      case 'health':
        return (
          <HealthStep
            consent={d.healthConsent} baseline={d.healthBaseline}
            onChange={(c, b) => { ob.update('healthConsent', c); ob.update('healthBaseline', b); }}
          />
        );
      case 'watch':
        return <WatchStep />;
      case 'about':
        return (
          <AboutYouStep
            ageRange={d.ageRange} gender={d.gender} heightCm={d.heightCm} weightKg={d.weightKg}
            onAge={v => ob.update('ageRange', v)} onGender={v => ob.update('gender', v)}
            onHeight={v => ob.update('heightCm', v)} onWeight={v => ob.update('weightKg', v)}
          />
        );
      case 'identity':
        return (
          <IdentityStep
            username={d.username} avatarUri={d.avatarUri} serverError={ob.error}
            onUsername={v => ob.update('username', v)} onAvatar={uri => ob.update('avatarUri', uri)}
          />
        );
      case 'people':
        return <PeopleStep username={d.username} />;
      case 'notifications':
        return <NotificationsStep />;
      case 'mission':
        return <StartSummaryStep data={d} preview={preview} weeklyTargetKm={ob.weeklyTargetKm} tone={tone} />;
    }
  };

  // Android hardware back steps to the previous question instead of closing the app.
  const { index: obIndex, goBack: obGoBack } = ob;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (obIndex > 0) { obGoBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [obIndex, obGoBack]);

  const skipLabel = ob.stepKey === 'notifications' ? 'Not now' : 'Skip for now';

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ height: insets.top }} />
      <OnboardingProgress
        index={ob.index}
        total={ob.total}
        label={ob.label}
        onBack={ob.goBack}
      />

      <Animated.View style={[s.body, { transform: [{ translateX: slideX }] }]}>
        {renderStep()}
      </Animated.View>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        {ob.stepKey === 'mission' && !!ob.error && <Text style={s.error}>{ob.error}</Text>}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [s.cta, (cta.disabled || busy) && s.ctaOff, pressed && s.pressed]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); cta.onPress(); }}
          disabled={cta.disabled || busy}
        >
          {busy ? <ActivityIndicator color={C.alwaysLight} /> : <Text style={s.ctaText}>{cta.label}</Text>}
        </Pressable>
        {ob.optional && (
          <Pressable onPress={ob.skip} hitSlop={8} style={s.skip} accessibilityRole="button">
            <Text style={s.skipText}>{skipLabel}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    body:     { flex: 1 },
    footer:   { paddingHorizontal: 22, paddingTop: 10 },
    cta:      { height: 56, borderRadius: 999, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    ctaOff:   { opacity: 0.4 },
    pressed:  { opacity: 0.92, transform: [{ scale: 0.985 }] },
    ctaText:  { fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
    skip:     { alignItems: 'center', paddingTop: 14, paddingBottom: 2 },
    skipText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t2 },
    error:    { fontFamily: Fonts.medium, fontSize: 13, color: C.danger, textAlign: 'center', marginBottom: 10 },
  });
}
