/**
 * Step 2 — Body stats (gender with animated mascots, inline drum pickers).
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Animated,
} from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { OnboardingData } from '../types';
import { AGES, HEIGHTS, WEIGHTS } from '../types';
import { C, shared } from './onboardingStyles';

// ─── Animated mascots ────────────────────────────────────────────────────────

function MascotMan({ active }: { active: boolean }) {
  const bounceY    = useRef(new Animated.Value(0)).current;
  const cheekAlpha = useRef(new Animated.Value(0)).current;
  const loop       = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loop.current?.stop();
    if (!active) {
      bounceY.setValue(0);
      cheekAlpha.setValue(0);
      return;
    }
    const l = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounceY, { toValue: -5, duration: 380, useNativeDriver: true }),
          Animated.timing(bounceY, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(cheekAlpha, { toValue: 0.6, duration: 760, useNativeDriver: true }),
          Animated.timing(cheekAlpha, { toValue: 0.2, duration: 760, useNativeDriver: true }),
        ]),
      ])
    );
    loop.current = l;
    l.start();
    return () => l.stop();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={{ transform: [{ translateY: bounceY }] }}>
      <Svg width={52} height={52} viewBox="0 0 52 52">
        {/* Torso */}
        <Rect x="18" y="28" width="16" height="14" rx="4" fill="#0A0A0A" />
        {/* Head */}
        <Circle cx="26" cy="20" r="10" fill="#F5C8A0" />
        {/* Hair */}
        <Path d="M16 18 Q16 10 26 10 Q36 10 36 18" fill="#3B2A1A" />
        {/* Eyes */}
        <Ellipse cx="22.5" cy="20" rx="1.5" ry="1.5" fill="#3B2A1A" />
        <Ellipse cx="29.5" cy="20" rx="1.5" ry="1.5" fill="#3B2A1A" />
        {/* Smile */}
        <Path d="M22 24 Q26 27 30 24" stroke="#3B2A1A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* Arms */}
        <Rect x="10" y="28" width="8" height="4" rx="2" fill="#0A0A0A" />
        <Rect x="34" y="28" width="8" height="4" rx="2" fill="#0A0A0A" />
        {/* Legs */}
        <Rect x="19" y="41" width="5" height="7" rx="2.5" fill="#555" />
        <Rect x="28" y="41" width="5" height="7" rx="2.5" fill="#555" />
      </Svg>
      {/* Animated cheeks overlay */}
      <Animated.View
        style={{
          position: 'absolute', top: 19, left: 10, right: 10,
          flexDirection: 'row', justifyContent: 'space-between',
          opacity: cheekAlpha, pointerEvents: 'none',
        } as any}
      >
        <View style={s.cheek} />
        <View style={s.cheek} />
      </Animated.View>
    </Animated.View>
  );
}

function MascotWoman({ active }: { active: boolean }) {
  const bounceY    = useRef(new Animated.Value(0)).current;
  const cheekAlpha = useRef(new Animated.Value(0)).current;
  const loop       = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loop.current?.stop();
    if (!active) {
      bounceY.setValue(0);
      cheekAlpha.setValue(0);
      return;
    }
    const l = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounceY, { toValue: -5, duration: 420, useNativeDriver: true }),
          Animated.timing(bounceY, { toValue: 0, duration: 420, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(cheekAlpha, { toValue: 0.7, duration: 840, useNativeDriver: true }),
          Animated.timing(cheekAlpha, { toValue: 0.25, duration: 840, useNativeDriver: true }),
        ]),
      ])
    );
    loop.current = l;
    l.start();
    return () => l.stop();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={{ transform: [{ translateY: bounceY }] }}>
      <Svg width={52} height={52} viewBox="0 0 52 52">
        {/* Dress */}
        <Path d="M16 28 Q18 42 26 42 Q34 42 36 28 Z" fill="#D93518" />
        {/* Torso */}
        <Rect x="19" y="26" width="14" height="8" rx="3" fill="#D93518" />
        {/* Head */}
        <Circle cx="26" cy="19" r="10" fill="#F5C8A0" />
        {/* Hair */}
        <Path d="M16 17 Q16 8 26 8 Q36 8 36 17 Q34 14 26 15 Q18 14 16 17Z" fill="#5C3A1E" />
        <Path d="M34 12 Q40 14 38 20" stroke="#5C3A1E" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Eyes */}
        <Ellipse cx="22.5" cy="19" rx="1.5" ry="1.8" fill="#3B2A1A" />
        <Ellipse cx="29.5" cy="19" rx="1.5" ry="1.8" fill="#3B2A1A" />
        {/* Smile */}
        <Path d="M22 23.5 Q26 26.5 30 23.5" stroke="#3B2A1A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* Arms */}
        <Rect x="10" y="27" width="9" height="4" rx="2" fill="#D93518" />
        <Rect x="33" y="27" width="9" height="4" rx="2" fill="#D93518" />
        {/* Legs */}
        <Rect x="20" y="41" width="4" height="7" rx="2" fill="#F5C8A0" />
        <Rect x="28" y="41" width="4" height="7" rx="2" fill="#F5C8A0" />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute', top: 18, left: 10, right: 10,
          flexDirection: 'row', justifyContent: 'space-between',
          opacity: cheekAlpha, pointerEvents: 'none',
        } as any}
      >
        <View style={s.cheek} />
        <View style={s.cheek} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── Inline Drum Column ──────────────────────────────────────────────────────

interface InlineDrumColumnProps {
  values: number[];
  value: number;
  onSelect: (v: number) => void;
}

function InlineDrumColumn({ values, value, onSelect }: InlineDrumColumnProps) {
  const ITEM_H = 44;
  const idx = values.indexOf(value);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollRef.current && idx !== -1) {
      scrollRef.current.scrollTo({ y: Math.max(0, idx - 2) * ITEM_H, animated: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ overflow: 'hidden', height: 5 * ITEM_H }}>
      <View style={ds.selectorBand} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: 2 * ITEM_H }}
      >
        {values.map(v => {
          const isSel = v === value;
          return (
            <Pressable
              key={v}
              style={[ds.drumItem, { height: ITEM_H }]}
              onPress={() => onSelect(v)}
            >
              <Text style={[ds.drumItemText, isSel && ds.drumItemActive]}>{v}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={ds.fadeTop} pointerEvents="none" />
      <View style={ds.fadeBot} pointerEvents="none" />
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
  data: Pick<OnboardingData, 'gender' | 'age' | 'heightCm' | 'weightKg'>;
  onChange: <K extends 'gender' | 'age' | 'heightCm' | 'weightKg'>(key: K, val: OnboardingData[K]) => void;
}

export default function AvatarStep({ data, onChange }: Props) {
  const [htUnit, setHtUnit] = useState<'cm' | 'ft'>('cm');
  const [wtUnit, setWtUnit] = useState<'kg' | 'lbs'>('kg');

  const htValues = htUnit === 'cm' ? HEIGHTS : HEIGHTS.map(h => Math.round(h / 30.48 * 10) / 10);
  const wtValues = wtUnit === 'kg' ? WEIGHTS : WEIGHTS.map(w => Math.round(w * 2.205));

  return (
    <ScrollView contentContainerStyle={shared.stepContent}>
      <Text style={shared.eyebrow}>Your body</Text>
      <Text style={shared.heroTitle}>Body stats.</Text>
      <Text style={shared.subtitle}>Used for accurate pace and calorie estimates.</Text>

      {/* Gender mascot cards */}
      <View style={s.genderRow}>
        {(['male', 'female'] as const).map(g => {
          const sel = data.gender === g;
          return (
            <Pressable
              key={g}
              style={[s.genderCard, sel && s.genderCardSel]}
              onPress={() => onChange('gender', g)}
            >
              {g === 'male' ? <MascotMan active={sel} /> : <MascotWoman active={sel} />}
              <Text style={[s.genderLabel, sel && s.genderLabelSel]}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Age drum */}
      <View style={s.drumSection}>
        <View style={s.drumColHeader}>
          <Text style={s.drumColLabel}>Age</Text>
          <Text style={s.drumColUnit}>years</Text>
        </View>
        <View style={s.drumPanel}>
          <InlineDrumColumn
            values={AGES}
            value={data.age}
            onSelect={v => onChange('age', v)}
          />
        </View>
      </View>

      {/* Height + Weight drums side by side */}
      <View style={s.drumTwoCol}>
        <View style={{ flex: 1 }}>
          <View style={s.drumColHeader}>
            <Text style={s.drumColLabel}>Height</Text>
            <View style={s.unitToggle}>
              {(['cm', 'ft'] as const).map(u => (
                <Pressable
                  key={u}
                  style={[s.unitToggleBtn, htUnit === u && s.unitToggleBtnSel]}
                  onPress={() => setHtUnit(u)}
                >
                  <Text style={[s.unitToggleLabel, htUnit === u && s.unitToggleLabelSel]}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={s.drumPanel}>
            <InlineDrumColumn
              values={htValues}
              value={htUnit === 'cm' ? data.heightCm : Math.round(data.heightCm / 30.48 * 10) / 10}
              onSelect={v => onChange('heightCm', htUnit === 'cm' ? v : Math.round(v * 30.48))}
            />
          </View>
        </View>
        <View style={{ width: 8 }} />
        <View style={{ flex: 1 }}>
          <View style={s.drumColHeader}>
            <Text style={s.drumColLabel}>Weight</Text>
            <View style={s.unitToggle}>
              {(['kg', 'lbs'] as const).map(u => (
                <Pressable
                  key={u}
                  style={[s.unitToggleBtn, wtUnit === u && s.unitToggleBtnSel]}
                  onPress={() => setWtUnit(u)}
                >
                  <Text style={[s.unitToggleLabel, wtUnit === u && s.unitToggleLabelSel]}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={s.drumPanel}>
            <InlineDrumColumn
              values={wtValues}
              value={wtUnit === 'kg' ? data.weightKg : Math.round(data.weightKg * 2.205)}
              onSelect={v => onChange('weightKg', wtUnit === 'kg' ? v : Math.round(v / 2.205))}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cheek:          { width: 12, height: 8, borderRadius: 6, backgroundColor: '#E8A090' },
  genderRow:      { flexDirection: 'row', gap: 10, marginBottom: 20 },
  genderCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6,
    borderRadius: 16, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.stone,
  },
  genderCardSel:  { backgroundColor: '#FFF6F7', borderColor: C.red },
  genderLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.t3, marginTop: 6 },
  genderLabelSel: { color: C.red },
  drumSection:    { marginBottom: 12 },
  drumTwoCol:     { flexDirection: 'row', marginBottom: 12 },
  drumColHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  drumColLabel:   { fontFamily: 'Barlow_400Regular', fontSize: 8, color: C.t3, textTransform: 'uppercase', letterSpacing: 2 },
  drumColUnit:    { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3 },
  drumPanel:      { backgroundColor: C.stone, borderRadius: 16, overflow: 'hidden' },
  unitToggle:     { flexDirection: 'row', backgroundColor: '#ECEAE7', borderRadius: 8, padding: 2 },
  unitToggleBtn:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  unitToggleBtnSel: { backgroundColor: C.white },
  unitToggleLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 10, color: C.t3 },
  unitToggleLabelSel: { color: C.red },
});

const ds = StyleSheet.create({
  drumItem:       { alignItems: 'center', justifyContent: 'center' },
  drumItemText:   { fontFamily: 'Barlow_300Light', fontSize: 16, color: C.t3 },
  drumItemActive: { fontFamily: 'Barlow_400Regular', fontSize: 20, color: C.black },
  selectorBand:   {
    position: 'absolute', top: 2 * 44, left: 0, right: 0, height: 44,
    borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.border, zIndex: 1,
  },
  fadeTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 40,
    backgroundColor: 'rgba(240,237,232,0.75)',
  },
  fadeBot: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
    backgroundColor: 'rgba(240,237,232,0.75)',
  },
});
