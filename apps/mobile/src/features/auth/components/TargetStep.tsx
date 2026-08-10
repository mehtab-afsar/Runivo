import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import type { OnboardingData } from '../types';
import { DAY_LABELS, DIST_CHIPS } from '../types';
import { mkD, mkShared, type OnboardingD } from './onboardingStyles';
import { useTheme, Fonts } from '@theme';

interface Props {
  data: Pick<OnboardingData, 'preferredDistance'>;
  selectedDays: number[];
  distKm: number;
  weeklyKmDisplay: number;
  todayIdx: number;
  onToggleDay: (i: number) => void;
  onDistanceChange: (v: OnboardingData['preferredDistance']) => void;
}

export default function TargetStep({
  data, selectedDays, distKm, weeklyKmDisplay, todayIdx, onToggleDay, onDistanceChange,
}: Props) {
  const C = useTheme();
  const D = useMemo(() => mkD(C), [C]);
  const shared = useMemo(() => mkShared(C), [C]);
  const s = useMemo(() => mkStyles(D), [D]);
  const dayScales   = useRef(DAY_LABELS.map(() => new Animated.Value(1))).current;
  const summaryAnim = useRef(new Animated.Value(1)).current;
  const summaryKey  = useRef(`${selectedDays.length}-${data.preferredDistance}`);

  useEffect(() => {
    const key = `${selectedDays.length}-${data.preferredDistance}`;
    if (summaryKey.current === key) return;
    summaryKey.current = key;
    summaryAnim.setValue(0.85);
    Animated.spring(summaryAnim, { toValue: 1, damping: 24, useNativeDriver: true }).start();
  }, [selectedDays.length, data.preferredDistance]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleDay = (i: number) => {
    Animated.sequence([
      Animated.spring(dayScales[i], { toValue: 1.1, useNativeDriver: true }),
      Animated.spring(dayScales[i], { toValue: 1,   useNativeDriver: true }),
    ]).start();
    onToggleDay(i);
  };

  return (
    <ScrollView contentContainerStyle={shared.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={shared.eyebrow}>Your rhythm</Text>
      <Text style={shared.heroTitle}>Set your weekly plan.</Text>
      <Text style={shared.subtitle}>Pick your run days and typical distance.</Text>

      {/* Day selector */}
      <View style={s.dayRow}>
        {DAY_LABELS.map((d, i) => {
          const sel     = selectedDays.includes(i);
          const isToday = i === todayIdx;
          return (
            <Animated.View key={i} style={{ flex: 1, transform: [{ scale: dayScales[i] }] }}>
              <Pressable
                style={[
                  s.dayTile,
                  sel     ? s.dayTileSel   :
                  isToday ? s.dayTileToday : s.dayTileUnsel,
                ]}
                onPress={() => handleToggleDay(i)}
              >
                <Text style={[s.dayLetter, sel ? s.dayLetterSel : isToday ? { color: D.red } : null]}>
                  {d[0]}
                </Text>
                <Text style={[s.dayLetterSub, sel ? s.dayLetterSubSel : isToday ? { color: D.red } : null]}>
                  {d.slice(1)}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* Distance chips */}
      <Text style={[shared.fieldLabel, { marginTop: 24, marginBottom: 10 }]}>Typical run distance</Text>
      <View style={s.distGrid}>
        {DIST_CHIPS.map(c => {
          const sel = data.preferredDistance === c.key;
          return (
            <Pressable
              key={c.key}
              style={[s.distChip, sel ? s.distChipSel : s.distChipUnsel]}
              onPress={() => onDistanceChange(c.key)}
            >
              <Text style={[s.distLabel, sel && s.distLabelSel]}>{c.label}</Text>
              <Text style={[s.distSub,   sel && s.distSubSel  ]}>{c.sub}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Summary */}
      <Animated.View style={[s.summaryCard, { opacity: summaryAnim, transform: [{ scale: summaryAnim }] }]}>
        <Text style={s.summaryEyebrow}>WEEKLY GOAL</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={s.summaryNum}>{weeklyKmDisplay.toFixed(0)}</Text>
          <Text style={s.summaryUnit}>km / week</Text>
        </View>
        <Text style={s.summarySub}>
          {selectedDays.length} run{selectedDays.length !== 1 ? 's' : ''} · ~{distKm}km each
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

function mkStyles(D: OnboardingD) {
  return StyleSheet.create({
    // Days
    dayRow:          { flexDirection: 'row', gap: 5 },
    dayTile:         { paddingVertical: 12, borderRadius: 8, alignItems: 'center', gap: 3, flex: 1, borderWidth: 0.5 },
    dayTileUnsel:    { borderColor: D.div, backgroundColor: 'transparent' },
    dayTileToday:    { borderColor: D.red, backgroundColor: D.redLo },
    dayTileSel:      { borderColor: D.alwaysDark, backgroundColor: D.alwaysDark },
    dayLetter:       { fontSize: 12, color: D.t3 },
    dayLetterSel:    { color: D.alwaysLight, fontFamily: Fonts.medium },
    dayLetterSub:    { fontSize: 8, color: D.div },
    dayLetterSubSel: { color: 'rgba(255,255,255,0.5)' },

    // Distance chips
    distGrid:        { flexDirection: 'row', gap: 8, marginBottom: 24 },
    distChip:        { flex: 1, padding: 14, borderRadius: 8, borderWidth: 0.5, alignItems: 'flex-start' },
    distChipUnsel:   { borderColor: D.div, backgroundColor: 'transparent' },
    distChipSel:     { borderColor: D.alwaysDark, backgroundColor: D.alwaysDark },
    distLabel:       { fontSize: 15, color: D.t1, marginBottom: 2 },
    distLabelSel:    { color: D.alwaysLight },
    distSub:         { fontSize: 9, color: D.t3, textTransform: 'uppercase', letterSpacing: 1 },
    distSubSel:      { color: 'rgba(255,255,255,0.6)' },

    // Summary
    summaryCard:     { borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: D.div, paddingVertical: 24 },
    summaryEyebrow:  { fontFamily: Fonts.medium, fontSize: 10, color: D.red, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },
    summaryNum:      { fontFamily: Fonts.display, fontSize: 52, color: D.t1, lineHeight: 52 },
    summaryUnit:     { fontSize: 14, color: D.t3 },
    summarySub:      { fontSize: 13, color: D.t3, marginTop: 6 },
  });
}
