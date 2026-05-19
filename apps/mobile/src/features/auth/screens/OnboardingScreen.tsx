import React, { useRef, useEffect, useState } from 'react';
import {
  View, StyleSheet, Pressable, Text,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import * as Notifications from 'expo-notifications';

import { useOnboarding } from '../hooks/useOnboarding';
import OnboardingProgress from '../components/OnboardingProgress';
import GoalStep from '../components/GoalStep';
import TargetStep from '../components/TargetStep';
import ProfileStep from '../components/ProfileStep';
import CityMapPreviewStep from '../components/CityMapPreviewStep';
import FirstMissionStep from '../components/FirstMissionStep';
import NotificationPermissionStep from '../components/NotificationPermissionStep';
import LaunchStep from '../components/LaunchStep';
import type { OnboardingData } from '../types';

const D = { bg: '#F7F5F2', t1: '#111110', t2: '#7A7873', t3: '#B8B5B0', red: '#C8391A' };
const todayIdx = (new Date().getDay() + 6) % 7;
const { width: SCREEN_W } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Loading quotes ───────────────────────────────────────────────────────────

const GOAL_QUOTES: Record<string, string[]> = {
  get_fit: [
    "Your city awaits its new conqueror.",
    "Territories don't claim themselves.",
    "The streets you know are about to become yours.",
    "Every run is a border redrawn.",
  ],
  lose_weight: [
    "Every hexagon is a calorie that never knew what hit it.",
    "The best weight to lose? The distance between you and a territory.",
    "Running to something. Not from it.",
    "Your map is about to get a lot more colourful.",
  ],
  run_faster: [
    "Speed is territory claimed per second.",
    "Faster runners. Wider empires.",
    "The clock is ticking. So are the hexagons.",
    "Personal bests are made one conquest at a time.",
  ],
  explore: [
    "The best routes haven't been discovered yet — by you.",
    "Every corner is a potential conquest.",
    "Explorer mode: activated.",
    "Maps are better when they're yours.",
  ],
  compete: [
    "Someone, somewhere, is already defending their turf.",
    "Champions don't wait. They conquer.",
    "The leaderboard has your name. It just doesn't know it yet.",
    "Your rivals haven't heard of you yet.",
  ],
};

const LEVEL_QUOTES: Record<string, string[]> = {
  new:         ["Every empire started with a single step.", "The world's greatest runners all had a first run."],
  casual:      ["Casual pace. Serious territory.", "Consistency beats intensity. Every hexagon counts."],
  regular:     ["You know the drill. Now own the streets.", "Routine runners build the biggest empires."],
  competitive: ["Elite mode: on.", "Your pace. Your rules. Your empire.", "The territory won't defend itself."],
};

function getQuotes(goal: OnboardingData['primaryGoal'], level: OnboardingData['experienceLevel']): string[] {
  return [
    ...(GOAL_QUOTES[goal] ?? GOAL_QUOTES.get_fit),
    ...(LEVEL_QUOTES[level] ?? []),
  ];
}

// ─── Loading overlay ──────────────────────────────────────────────────────────

function LoadingOverlay({ visible, goal, level }: {
  visible: boolean;
  goal: OnboardingData['primaryGoal'];
  level: OnboardingData['experienceLevel'];
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const quotes  = useRef(getQuotes(goal, level)).current;
  const [qIdx, setQIdx]         = useState(() => Math.floor(Math.random() * quotes.length));
  const [quoteOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!visible) return;
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();

    const cycle = setInterval(() => {
      Animated.timing(quoteOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setQIdx(i => (i + 1) % quotes.length);
        Animated.timing(quoteOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2800);

    return () => clearInterval(cycle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[lo.root, { opacity }]}>
      <View style={lo.inner}>
        <ActivityIndicator color={D.t3} size="small" style={{ marginBottom: 32 }} />
        <Text style={lo.eyebrow}>Setting up your profile</Text>
        <Animated.Text style={[lo.quote, { opacity: quoteOpacity }]}>
          "{quotes[qIdx]}"
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const lo = StyleSheet.create({
  root:   { ...StyleSheet.absoluteFillObject, backgroundColor: D.bg, zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  inner:  { paddingHorizontal: 40, alignItems: 'center' },
  eyebrow:{ fontWeight: '500', fontSize: 9, color: D.t3, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 20 },
  quote:  { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: D.t1, textAlign: 'center', lineHeight: 30 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const ob = useOnboarding(() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }));

  const slideX = useRef(new Animated.Value(0)).current;
  const prevStep = useRef(ob.step);
  const transitioning = useRef(false);

  useEffect(() => {
    if (prevStep.current === ob.step) return;
    const goingForward = ob.step > prevStep.current;
    prevStep.current = ob.step;
    transitioning.current = true;
    slideX.setValue(goingForward ? SCREEN_W : -SCREEN_W);
    Animated.timing(slideX, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => {
      transitioning.current = false;
    });
  }, [ob.step, slideX]);

  const handleNext = async () => {
    if (transitioning.current) return;
    if (ob.step === 6) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        ob.update('notificationsEnabled', status === 'granted');
      } catch {
        ob.update('notificationsEnabled', false);
      }
    }
    ob.goNext();
  };

  const renderStep = () => {
    switch (ob.step) {
      case 1: return <GoalStep primaryGoal={ob.data.primaryGoal} onChange={v => ob.update('primaryGoal', v)} />;
      case 2: return <ProfileStep data={ob.data} onChange={(k, v) => ob.update(k, v)} />;
      case 3: return (
        <TargetStep
          data={ob.data}
          selectedDays={ob.selectedDays}
          distKm={ob.distKm}
          weeklyKmDisplay={ob.weeklyKmDisplay}
          todayIdx={todayIdx}
          onToggleDay={ob.toggleDay}
          onDistanceChange={v => ob.update('preferredDistance', v)}
        />
      );
      case 4: return <CityMapPreviewStep />;
      case 5: return <FirstMissionStep primaryGoal={ob.data.primaryGoal} />;
      case 6: return <NotificationPermissionStep />;
      case 7: return (
        <LaunchStep
          weeklyKmDisplay={ob.weeklyKmDisplay}
          primaryGoal={ob.data.primaryGoal}
          experienceLevel={ob.data.experienceLevel}
          error={ob.error}
        />
      );
      default: return null;
    }
  };

  const isLast   = ob.step === 7;
  const ctaLabel = isLast ? 'Start running  →' : 'Continue  →';

  return (
    <View style={ss.root}>
      <View style={ss.topBar} />
      <View style={{ height: insets.top }} />

      {ob.step < 7 && <OnboardingProgress step={ob.step} onBack={ob.goBack} />}

      <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideX }] }]}>
        {renderStep()}
      </Animated.View>

      <View style={[ss.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable
          style={[ss.cta, (!ob.canContinue() || ob.loading) && ss.ctaDisabled]}
          onPress={isLast ? ob.submit : handleNext}
          disabled={!ob.canContinue() || ob.loading}
        >
          <Text style={ss.ctaLabel}>{ctaLabel}</Text>
        </Pressable>
      </View>

      {/* Full-screen loading overlay with cycling quotes — shown after "Start running" */}
      <LoadingOverlay
        visible={ob.loading}
        goal={ob.data.primaryGoal}
        level={ob.data.experienceLevel}
      />
    </View>
  );
}

const ss = StyleSheet.create({
  root:        { flex: 1, backgroundColor: D.bg },
  topBar:      { height: 2, backgroundColor: D.red },
  footer:      { paddingHorizontal: 24, paddingTop: 12 },
  cta:         { backgroundColor: D.t1, borderRadius: 10, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.4 },
  ctaLabel:    { fontWeight: '500', fontSize: 13, color: '#fff', letterSpacing: 0.8 },
});
