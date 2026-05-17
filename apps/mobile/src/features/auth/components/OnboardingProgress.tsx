import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { D } from './onboardingStyles';

const CHAPTERS = [
  { label: 'Goal',    steps: [1] },
  { label: 'Profile', steps: [2] },
  { label: 'Plan',    steps: [3, 4] },
  { label: 'Setup',   steps: [5, 6] },
];

interface Props {
  step: number;
  onBack: () => void;
}

export default function OnboardingProgress({ step, onBack }: Props) {
  const fillAnims = useRef(CHAPTERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const targets = CHAPTERS.map(chapter => {
      const chapterEnd = chapter.steps[chapter.steps.length - 1];
      const chapterStart = chapter.steps[0];
      if (step > chapterEnd) return 1;
      if (step >= chapterStart) return (step - chapterStart) / chapter.steps.length;
      return 0;
    });
    Animated.parallel(
      fillAnims.map((anim, i) =>
        Animated.timing(anim, { toValue: targets[i], duration: 300, useNativeDriver: false })
      )
    ).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <View style={s.header}>
        {step > 1 ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
        ) : <View style={{ minWidth: 48 }} />}
        <View style={{ flex: 1 }} />
      </View>

      <View style={s.chaptersRow}>
        {CHAPTERS.map((chapter, ci) => {
          const isActive = step >= chapter.steps[0];
          return (
            <View key={ci} style={s.chapterCol}>
              <View style={s.trackBg}>
                <Animated.View
                  style={[s.trackFill, {
                    width: fillAnims[ci].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  }]}
                />
              </View>
              <Text style={[s.chapterLabel, isActive && s.chapterLabelActive]}>
                {chapter.label}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  header:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10 },
  backText:            { fontFamily: 'DMSans_400Regular', fontSize: 13, color: D.t2 },
  chaptersRow:         { flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingBottom: 12 },
  chapterCol:          { flex: 1, alignItems: 'center' },
  trackBg:             { width: '100%', height: 2, backgroundColor: D.div, borderRadius: 1, overflow: 'hidden', marginBottom: 5 },
  trackFill:           { height: '100%', backgroundColor: D.red, borderRadius: 1 },
  chapterLabel:        { fontFamily: 'DMSans_500Medium', fontSize: 9, color: D.t3, textTransform: 'uppercase', letterSpacing: 1 },
  chapterLabelActive:  { color: D.red },
});
