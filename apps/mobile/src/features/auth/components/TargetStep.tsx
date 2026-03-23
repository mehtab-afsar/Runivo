/**
 * Step 4 — Weekly plan (run days + distance chips + summary card).
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
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
            <Pressable
              key={i}
              style={[s.dayTile, sel ? s.dayTileSel : isToday ? s.dayTileToday : null]}
              onPress={() => onToggleDay(i)}
            >
              <Text style={[s.dayLetter, sel ? s.dayLetterSel : isToday ? { color: C.red } : null]}>
                {d[0]}
              </Text>
              <Text style={[s.dayLetterSub, sel ? s.dayLetterSubSel : isToday ? { color: C.red } : null]}>
                {d[1]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[shared.fieldLabel, { marginBottom: 8, marginTop: 16 }]}>Typical run distance</Text>
      <View style={s.distGrid}>
        {DIST_CHIPS.map(c => {
          const sel = data.preferredDistance === c.key;
          return (
            <Pressable
              key={c.key}
              style={[s.distChip, sel && s.distChipSel]}
              onPress={() => onDistanceChange(c.key)}
            >
              <Text style={[s.distChipLabel, sel && { color: '#fff' }]}>{c.label}</Text>
              <Text style={[s.distChipSub, sel && { color: 'rgba(255,255,255,0.45)' }]}>{c.sub}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.summaryCard}>
        <View>
          <Text style={shared.fieldLabel}>Weekly goal</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={s.summaryNum}>{weeklyKmDisplay.toFixed(0)}</Text>
            <Text style={s.summaryUnit}>km / week</Text>
          </View>
        </View>
        <Text style={s.summaryRight}>
          {selectedDays.length} run{selectedDays.length !== 1 ? 's' : ''}{'\n'}~{distKm} km each
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  dayRow: { flexDirection: 'row', gap: 5 },
  dayTile: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 0.5, borderColor: C.border, alignItems: 'center', gap: 2,
  },
  dayTileSel: { backgroundColor: C.black, borderColor: C.black },
  dayTileToday: { backgroundColor: C.redLo, borderColor: C.red },
  dayLetter: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, lineHeight: 13 },
  dayLetterSel: { fontFamily: 'Barlow_500Medium', color: '#fff' },
  dayLetterSub: { fontFamily: 'Barlow_300Light', fontSize: 8, color: C.border, letterSpacing: 0.2 },
  dayLetterSubSel: { color: 'rgba(255,255,255,0.5)' },
  distGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  distChip: {
    width: '47%', padding: 14, borderRadius: 12,
    borderWidth: 0.5, borderColor: C.border, backgroundColor: C.white,
  },
  distChipSel: { backgroundColor: C.black, borderColor: C.black },
  distChipLabel: { fontFamily: 'Barlow_300Light', fontSize: 15, color: C.black, letterSpacing: -0.2, marginBottom: 2 },
  distChipSub: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 },
  summaryCard: {
    backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border,
    borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  summaryNum: { fontFamily: 'Barlow_300Light', fontSize: 32, color: C.black, letterSpacing: -1, lineHeight: 36 },
  summaryUnit: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  summaryRight: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'right', lineHeight: 16 },
});
