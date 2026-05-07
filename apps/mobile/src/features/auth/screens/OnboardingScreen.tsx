import React, { useRef, useEffect } from 'react';
import {
  View, StyleSheet, Platform, Pressable, Text,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';

import { useOnboarding } from '../hooks/useOnboarding';
import OnboardingProgress from '../components/OnboardingProgress';
import UsernameStep from '../components/UsernameStep';
import AvatarStep from '../components/AvatarStep';
import GoalStep from '../components/GoalStep';
import TargetStep from '../components/TargetStep';
import PlanSelectionStep from '../components/PlanSelectionStep';
import NotificationsStep from '../components/NotificationsStep';
import ReadyStep from '../components/ReadyStep';

const D = { bg: '#F7F5F2', t1: '#111110', div: '#E2DFDA' };
const todayIdx = (new Date().getDay() + 6) % 7;
const { width: SCREEN_W } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

  const handleNext = () => { if (!transitioning.current) ob.goNext(); };

  const renderStep = () => {
    switch (ob.step) {
      case 1: return <UsernameStep experienceLevel={ob.data.experienceLevel} onChange={v => ob.update('experienceLevel', v)} />;
      case 2: return <AvatarStep data={ob.data} onChange={(k, v) => ob.update(k, v)} />;
      case 3: return <GoalStep primaryGoal={ob.data.primaryGoal} onChange={v => ob.update('primaryGoal', v)} />;
      case 4: return (
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
      case 5: return <PlanSelectionStep plan={ob.data.plan} onSelectPlan={p => { ob.update('plan', p); ob.goNext(); }} />;
      case 6: return <NotificationsStep />;
      case 7: return (
        <ReadyStep
          weeklyKmDisplay={ob.weeklyKmDisplay}
          primaryGoal={ob.data.primaryGoal}
          experienceLevel={ob.data.experienceLevel}
          error={ob.error}
        />
      );
      default: return null;
    }
  };

  const isLast = ob.step === 7;
  const isPlanStep = ob.step === 5;
  const ctaLabel = isLast ? (ob.loading ? 'Setting up…' : 'Start running  →') : 'Continue  →';

  return (
    <View style={ss.root}>
      {/* 2px red bar — flush above safe area */}
      <View style={ss.topBar} />
      <View style={{ height: insets.top }} />

      {ob.step < 7 && <OnboardingProgress step={ob.step} onBack={ob.goBack} />}

      <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideX }] }]}>
        {renderStep()}
      </Animated.View>

      {!isPlanStep && (
        <View style={[ss.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={[ss.cta, (!ob.canContinue() || ob.loading) && ss.ctaDisabled]}
            onPress={isLast ? ob.submit : handleNext}
            disabled={!ob.canContinue() || ob.loading}
          >
            {ob.loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={ss.ctaLabel}>{ctaLabel}</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F7F5F2' },
  topBar:      { height: 2, backgroundColor: '#C8391A' },
  footer:      { paddingHorizontal: 24, paddingTop: 12 },
  cta:         { backgroundColor: '#111110', borderRadius: 10, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { backgroundColor: '#999' },
  ctaLabel:    { fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8 },
});
