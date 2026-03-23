/**
 * Step 2 — Body stats (gender, age, height, weight).
 * Named AvatarStep to match spec (avatar/body data setup step).
 */
import React, { useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { OnboardingData } from '../types';
import { AGES, HEIGHTS, WEIGHTS } from '../types';
import { C, shared } from './onboardingStyles';

interface DrumPickerProps {
  title: string; values: number[]; value: number;
  onSelect: (v: number) => void; onClose: () => void; unit?: string;
}

function DrumPicker({ title, values, value, onSelect, onClose, unit = '' }: DrumPickerProps) {
  const ITEM_H = 44;
  const idx = values.indexOf(value);
  const scrollRef = useRef<ScrollView>(null);

  React.useEffect(() => {
    if (scrollRef.current && idx !== -1) {
      scrollRef.current.scrollTo({ y: Math.max(0, idx - 2) * ITEM_H, animated: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Pressable style={s.drumOverlay} onPress={onClose}>
      <Pressable style={s.drumSheet} onPress={() => {}}>
        <View style={s.drumHeader}>
          <Text style={s.drumTitle}>{title}</Text>
          <Pressable onPress={onClose}><Text style={s.drumDone}>Done</Text></Pressable>
        </View>
        <View style={{ height: 5 * ITEM_H, overflow: 'hidden' }}>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_H}
            decelerationRate="fast"
            contentContainerStyle={{ paddingTop: 2 * ITEM_H, paddingBottom: 2 * ITEM_H }}
          >
            {values.map(v => (
              <Pressable
                key={v}
                style={[s.drumItem, { height: ITEM_H }]}
                onPress={() => { onSelect(v); onClose(); }}
              >
                <Text style={[s.drumItemText, v === value && s.drumItemActive]}>
                  {v}{v === value && unit ? ` ${unit}` : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.drumSelectorLine} pointerEvents="none" />
        </View>
      </Pressable>
    </Pressable>
  );
}

interface Props {
  data: Pick<OnboardingData, 'gender' | 'age' | 'heightCm' | 'weightKg'>;
  picker: null | 'age' | 'height' | 'weight';
  setPicker: (v: null | 'age' | 'height' | 'weight') => void;
  onChange: <K extends 'gender' | 'age' | 'heightCm' | 'weightKg'>(key: K, val: OnboardingData[K]) => void;
}

export default function AvatarStep({ data, picker, setPicker, onChange }: Props) {
  return (
    <ScrollView contentContainerStyle={shared.stepContent}>
      <Text style={shared.eyebrow}>Your body</Text>
      <Text style={shared.heroTitle}>Body stats.</Text>
      <Text style={shared.subtitle}>Used for accurate pace and calorie estimates.</Text>

      <Text style={shared.fieldLabel}>Gender</Text>
      <View style={s.segmented}>
        {(['male', 'female', 'other'] as const).map(g => (
          <Pressable
            key={g}
            style={[s.segmentBtn, data.gender === g && s.segmentBtnSel]}
            onPress={() => onChange('gender', g)}
          >
            <Text style={[s.segmentLabel, data.gender === g && s.segmentLabelSel]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.statsGrid}>
        <Pressable style={s.statCard} onPress={() => setPicker('age')}>
          <Text style={s.statCardLabel}>Age</Text>
          <View style={s.statCardValue}>
            <Text style={s.statCardNum}>{data.age}</Text>
            <Text style={s.statCardUnit}>yrs</Text>
          </View>
        </Pressable>
        <Pressable style={s.statCard} onPress={() => setPicker('weight')}>
          <Text style={s.statCardLabel}>Weight</Text>
          <View style={s.statCardValue}>
            <Text style={s.statCardNum}>{data.weightKg}</Text>
            <Text style={s.statCardUnit}>kg</Text>
          </View>
        </Pressable>
      </View>
      <Pressable style={[s.statCard, { marginBottom: 0 }]} onPress={() => setPicker('height')}>
        <Text style={s.statCardLabel}>Height</Text>
        <View style={s.statCardValue}>
          <Text style={s.statCardNum}>{data.heightCm}</Text>
          <Text style={s.statCardUnit}>cm</Text>
        </View>
      </Pressable>

      {picker === 'age' && (
        <DrumPicker title="Age" values={AGES} value={data.age} unit="yrs"
          onSelect={v => onChange('age', v)} onClose={() => setPicker(null)} />
      )}
      {picker === 'height' && (
        <DrumPicker title="Height" values={HEIGHTS} value={data.heightCm} unit="cm"
          onSelect={v => onChange('heightCm', v)} onClose={() => setPicker(null)} />
      )}
      {picker === 'weight' && (
        <DrumPicker title="Weight" values={WEIGHTS} value={data.weightKg} unit="kg"
          onSelect={v => onChange('weightKg', v)} onClose={() => setPicker(null)} />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  segmented: {
    flexDirection: 'row', backgroundColor: C.stone,
    borderRadius: 8, padding: 3, gap: 3, marginBottom: 20,
  },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center' },
  segmentBtnSel: { backgroundColor: C.black, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segmentLabel: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  segmentLabelSel: { fontFamily: 'Barlow_400Regular', color: '#fff' },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  statCardLabel: {
    fontFamily: 'Barlow_400Regular', fontSize: 8, color: C.t3,
    textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6,
  },
  statCardValue: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statCardNum: { fontFamily: 'Barlow_300Light', fontSize: 32, color: C.black, letterSpacing: -1, lineHeight: 36 },
  statCardUnit: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  drumOverlay: {
    position: 'absolute', top: -800, left: -20, right: -20, bottom: -200,
    backgroundColor: 'rgba(10,10,10,0.4)', justifyContent: 'flex-end',
  },
  drumSheet: {
    backgroundColor: C.white, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: 32,
  },
  drumHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  drumTitle: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2 },
  drumDone: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.red },
  drumItem: { alignItems: 'center', justifyContent: 'center' },
  drumItemText: { fontFamily: 'Barlow_300Light', fontSize: 16, color: C.t3 },
  drumItemActive: { fontFamily: 'Barlow_400Regular', fontSize: 20, color: C.black },
  drumSelectorLine: {
    position: 'absolute', top: '50%', left: 18, right: 18,
    height: 44, marginTop: -22,
    borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.border,
  },
});
