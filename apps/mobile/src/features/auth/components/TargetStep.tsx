/**
 * Step 4 — Weekly plan (run days + distance chips + summary card).
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { OnboardingData } from '../types';
import { DAY_LABELS, DIST_CHIPS } from '../types';
import { C, shared } from './onboardingStyles';

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
  const dayScales = useRef(DAY_LABELS.map(() => new Animated.Value(1))).current;

  const summaryAnim = useRef(new Animated.Value(1)).current;
  const summaryKey = useRef(`${selectedDays.length}-${data.preferredDistance}`);

  useEffect(() => {
    const key = `${selectedDays.length}-${data.preferredDistance}`;
    if (summaryKey.current === key) return;
    summaryKey.current = key;
    summaryAnim.setValue(0);
    Animated.spring(summaryAnim, { toValue: 1, damping: 24, useNativeDriver: true }).start();
  }, [selectedDays.length, data.preferredDistance]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleDay = (i: number) => {
    Animated.sequence([
      Animated.spring(dayScales[i], { toValue: 1.08, useNativeDriver: true }),
      Animated.spring(dayScales[i], { toValue: 1, useNativeDriver: true }),
    ]).start();
    onToggleDay(i);
  };

  return (
    <ScrollView contentContainerStyle={shared.stepContent}>
      <Text style={shared.eyebrow}>Your rhythm</Text>
      <Text style={shared.heroTitle}>Set your weekly plan.</Text>
      <Text style={shared.subtitle}>Pick your run days and typical distance.</Text>

      <View style={s.dayRow}>
        {DAY_LABELS.map((d, i) => {
          const sel = selectedDays.includes(i);
          const isToday = i === todayIdx;
          return (
            <Animated.View key={i} style={{ flex: 1, transform: [{ scale: dayScales[i] }] }}>
              <Pressable style={s.dayTileWrap} onPress={() => handleToggleDay(i)}>
                {sel ? (
                  <LinearGradient
                    colors={[C.gradStart, C.gradEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.dayTile}
                  >
                    <Text style={[s.dayLetter, { color: '#fff' }]}>{d[0]}</Text>
                    <Text style={[s.dayLetterSub, { color: 'rgba(255,255,255,0.5)' }]}>{d.slice(1)}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[s.dayTile, isToday ? s.dayTileToday : s.dayTileUnsel]}>
                    <Text style={[s.dayLetter, isToday ? { color: C.red } : null]}>{d[0]}</Text>
                    <Text style={[s.dayLetterSub, isToday ? { color: C.red } : null]}>{d.slice(1)}</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <Text style={[shared.fieldLabel, { marginBottom: 8, marginTop: 16 }]}>Typical run distance</Text>
      <View style={s.distGrid}>
        {DIST_CHIPS.map(c => {
          const sel = data.preferredDistance === c.key;
          return (
            <Pressable key={c.key} style={s.distChipWrap} onPress={() => onDistanceChange(c.key)}>
              {sel ? (
                <LinearGradient
                  colors={[C.gradStart, C.gradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.distChip}
                >
                  <Text style={[s.distChipLabel, { color: '#fff' }]}>{c.label}</Text>
                  <Text style={[s.distChipSub, { color: 'rgba(255,255,255,0.7)' }]}>{c.sub}</Text>
                </LinearGradient>
              ) : (
                <View style={[s.distChip, s.distChipUnsel]}>
                  <Text style={s.distChipLabel}>{c.label}</Text>
                  <Text style={s.distChipSub}>{c.sub}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Animated.View
        style={[
          s.summaryCard,
          {
            opacity: summaryAnim,
            transform: [{
              translateY: summaryAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
            }],
          },
        ]}
      >
        <View>
          <Text style={s.summaryLabel}>Weekly goal</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={s.summaryNum}>{weeklyKmDisplay.toFixed(0)}</Text>
            <Text style={s.summaryUnit}>km / week</Text>
          </View>
        </View>
        <Text style={s.summaryRight}>
          {selectedDays.length} run{selectedDays.length !== 1 ? 's' : ''}{'\n'}~{distKm} km each
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  dayRow:         { flexDirection: 'row', gap: 5 },
  dayTileWrap:    { flex: 1 },
  dayTile:        { paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 2 },
  dayTileUnsel:   { borderWidth: 0.5, borderColor: C.border },
  dayTileToday:   { backgroundColor: C.redLo, borderWidth: 0.5, borderColor: C.red },
  dayLetter:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, lineHeight: 13 },
  dayLetterSub:   { fontFamily: 'Barlow_300Light', fontSize: 8, color: C.border, letterSpacing: 0.2 },
  distGrid:       { flexDirection: 'row', gap: 6, marginBottom: 16 },
  distChipWrap:   { flex: 1 },
  distChip:       { padding: 14, borderRadius: 12, alignItems: 'flex-start' },
  distChipUnsel:  { borderWidth: 0.5, borderColor: C.border, backgroundColor: C.white },
  distChipLabel:  { fontFamily: 'Barlow_300Light', fontSize: 15, color: C.black, letterSpacing: -0.2, marginBottom: 2 },
  distChipSub:    { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 },
  summaryCard: {
    backgroundColor: C.redFaint, borderWidth: 1, borderColor: 'rgba(217,53,24,0.12)',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  summaryLabel:  { fontFamily: 'Barlow_500Medium', fontSize: 10, color: C.red, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  summaryNum:    { fontFamily: 'Barlow_300Light', fontSize: 32, color: C.black, letterSpacing: -1, lineHeight: 36 },
  summaryUnit:   { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  summaryRight:  { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'right', lineHeight: 16 },
});
