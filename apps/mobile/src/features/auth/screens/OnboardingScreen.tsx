/**
 * OnboardingScreen — 6-step profile setup wizard.
 * Slide transitions: advance = slide left, go back = slide right.
 */
import React, { useRef, useEffect } from 'react';
import {
  View, StyleSheet, SafeAreaView, Platform, Pressable, Text,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';
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
import { Colors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const C = Colors;
const todayIdx = (new Date().getDay() + 6) % 7;
const { width: SCREEN_W } = Dimensions.get('window');

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const ob = useOnboarding(() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }));

  // Slide animation
  const slideX = useRef(new Animated.Value(0)).current;
  const prevStep = useRef(ob.step);
  const transitioning = useRef(false);

  useEffect(() => {
    if (prevStep.current === ob.step) return;
    const goingForward = ob.step > prevStep.current;
    prevStep.current = ob.step;
    transitioning.current = true;

    slideX.setValue(goingForward ? SCREEN_W : -SCREEN_W);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(() => { transitioning.current = false; });
  }, [ob.step, slideX]);

  const handleNext = () => {
    if (transitioning.current) return;
    ob.goNext();
  };

  const renderStep = () => {
    switch (ob.step) {
      case 1:
        return <UsernameStep experienceLevel={ob.data.experienceLevel} onChange={v => ob.update('experienceLevel', v)} />;
      case 2:
        return (
          <AvatarStep
            data={ob.data}
            onChange={(k, v) => ob.update(k, v)}
          />
        );
      case 3:
        return <GoalStep primaryGoal={ob.data.primaryGoal} onChange={v => ob.update('primaryGoal', v)} />;
      case 4:
        return (
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
      case 5:
        return (
          <PlanSelectionStep
            plan={ob.data.plan}
            onSelectPlan={p => { ob.update('plan', p); ob.goNext(); }}
          />
        );
      case 6:
        return <NotificationsStep />;
      case 7:
        return (
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
  const ctaLabel = isLast ? (ob.loading ? 'Setting up…' : 'Start running →') : 'Continue';

  return (
    <SafeAreaView style={ss.root}>
      {ob.step < 7 && <OnboardingProgress step={ob.step} onBack={ob.goBack} />}
      <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideX }] }]}>
        {renderStep()}
      </Animated.View>
      {/* Plan step manages its own CTAs via onSelectPlan — hide the footer CTA */}
      {!isPlanStep && (
      <View style={ss.footer}>
        <Pressable
          style={[ss.cta, isLast ? ss.ctaBlack : ob.canContinue() ? ss.ctaRed : ss.ctaDisabled]}
          onPress={isLast ? ob.submit : handleNext}
          disabled={!ob.canContinue() || ob.loading}
        >
          {ob.loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={ss.ctaLabel}>{ctaLabel}</Text>}
        </Pressable>
      </View>
      )}
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  footer:      { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 28 : 20, paddingTop: 12 },
  cta:         { paddingVertical: 13, borderRadius: 4, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  ctaRed:      { backgroundColor: C.red },
  ctaBlack:    { backgroundColor: C.black },
  ctaDisabled: { backgroundColor: C.mid },
  ctaLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
