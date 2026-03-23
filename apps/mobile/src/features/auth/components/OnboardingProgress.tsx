import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { TOTAL_STEPS } from '../types';

const C = {
  black: '#0A0A0A', t3: '#ADADAD', mid: '#E8E4DF', red: '#D93518', border: '#DDD9D4',
};

interface Props {
  step: number;
  onBack: () => void;
}

export default function OnboardingProgress({ step, onBack }: Props) {
  return (
    <>
      <View style={s.header}>
        {step > 1 ? (
          <Pressable onPress={onBack} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
        ) : <View style={s.backBtn} />}
        <Text style={s.counter}>{step} of {TOTAL_STEPS}</Text>
      </View>
      <View style={s.progressRow}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              s.segment,
              { backgroundColor: i < step - 1 ? C.black : i === step - 1 ? C.red : C.mid },
            ]}
          />
        ))}
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
  counter: {
    fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  progressRow: { flexDirection: 'row', gap: 3, paddingHorizontal: 18, marginBottom: 8 },
  segment: { flex: 1, height: 1.5, borderRadius: 1 },
});
