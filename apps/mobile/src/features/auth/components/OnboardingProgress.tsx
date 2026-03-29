import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated } from 'react-native';

const C = {
  black: '#0A0A0A', t3: '#ADADAD', mid: '#E8E4DF', red: '#D93518', border: '#DDD9D4',
};

const CHAPTERS = [
  { label: 'Level',    steps: [1] },
  { label: 'Body',     steps: [2] },
  { label: 'Training', steps: [3, 4] },
  { label: 'Setup',    steps: [5, 6] },
];

interface Props {
  step: number;
  onBack: () => void;
}

export default function OnboardingProgress({ step, onBack }: Props) {
  const fillAnims = useRef(CHAPTERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const targets = CHAPTERS.map(chapter => {
      const chapterStart = chapter.steps[0];
      const chapterEnd = chapter.steps[chapter.steps.length - 1];
      const stepsInChapter = chapter.steps.length;
      if (step > chapterEnd) return 1;
      if (step >= chapterStart) return (step - chapterStart) / stepsInChapter;
      return 0;
    });

    Animated.parallel(
      fillAnims.map((anim, i) =>
        Animated.timing(anim, {
          toValue: targets[i],
          duration: 300,
          useNativeDriver: false,
        })
      )
    ).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <View style={s.header}>
        {step > 1 ? (
          <Pressable onPress={onBack} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
        ) : <View style={s.backBtn} />}
        <View style={s.spacer} />
      </View>
      <View style={s.chaptersRow}>
        {CHAPTERS.map((chapter, ci) => {
          const isActive = step >= chapter.steps[0];
          return (
            <View key={ci} style={s.chapterCol}>
              <View style={s.trackBg}>
                <Animated.View
                  style={[
                    s.trackFill,
                    {
                      width: fillAnims[ci].interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    paddingBottom: 4,
  },
  backBtn: { padding: 4, minWidth: 48 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
  spacer: { minWidth: 48 },
  chaptersRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingBottom: 10 },
  chapterCol: { flex: 1, alignItems: 'center' },
  trackBg: {
    width: '100%', height: 3, backgroundColor: C.mid,
    borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  trackFill: { height: '100%', backgroundColor: C.red, borderRadius: 2 },
  chapterLabel: {
    fontFamily: 'Barlow_300Light', fontSize: 8, color: C.t3,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  chapterLabelActive: { color: C.red },
});
