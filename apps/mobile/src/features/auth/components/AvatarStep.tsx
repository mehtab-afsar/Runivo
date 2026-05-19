/**
 * Step 2 — Body stats: gender (flat rows) + age/height/weight drums in one frame.
 */
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { OnboardingData } from '../types';
import { AGES, HEIGHTS, WEIGHTS } from '../types';
import { D, shared } from './onboardingStyles';

// ─── Drum Column ──────────────────────────────────────────────────────────────

const ITEM_H = 40;
const VISIBLE = 3;

function DrumColumn({ values, value, onSelect, label, unit, toggleEl }: {
  values: number[];
  value: number;
  onSelect: (v: number) => void;
  label: string;
  unit?: string;
  toggleEl?: React.ReactNode;
}) {
  const idx = values.indexOf(value);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollRef.current && idx !== -1) {
      scrollRef.current.scrollTo({ y: Math.max(0, idx - 1) * ITEM_H, animated: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={ds.col}>
      <View style={ds.colHeader}>
        <Text style={ds.colLabel}>{label}</Text>
        {unit && !toggleEl && <Text style={ds.colUnit}>{unit}</Text>}
        {toggleEl}
      </View>
      <View style={ds.drumWrap}>
        <View style={ds.band} pointerEvents="none" />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: 1 * ITEM_H }}
          style={{ height: VISIBLE * ITEM_H }}
        >
          {values.map(v => {
            const sel = v === value;
            return (
              <Pressable
                key={v}
                style={[ds.item, { height: ITEM_H }]}
                onPress={() => onSelect(v)}
              >
                <Text style={[ds.itemText, sel && ds.itemActive]}>
                  {typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : v}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={ds.fadeT} pointerEvents="none" />
        <View style={ds.fadeB} pointerEvents="none" />
      </View>
    </View>
  );
}

function UnitToggle({ options, value, onChange }: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.unitRow}>
      {options.map(u => (
        <Pressable key={u} style={[s.unitBtn, value === u && s.unitBtnSel]} onPress={() => onChange(u)}>
          <Text style={[s.unitLabel, value === u && s.unitLabelSel]}>{u}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  data: Pick<OnboardingData, 'gender' | 'age' | 'heightCm' | 'weightKg'>;
  onChange: <K extends 'gender' | 'age' | 'heightCm' | 'weightKg'>(key: K, val: OnboardingData[K]) => void;
}

export default function AvatarStep({ data, onChange }: Props) {
  const [htUnit, setHtUnit] = useState<'cm' | 'ft'>('cm');
  const [wtUnit, setWtUnit] = useState<'kg' | 'lbs'>('kg');

  const htValues = htUnit === 'cm' ? HEIGHTS : HEIGHTS.map(h => Math.round(h / 30.48 * 10) / 10);
  const wtValues = wtUnit === 'kg' ? WEIGHTS : WEIGHTS.map(w => Math.round(w * 2.205));

  const htDisplay = htUnit === 'cm' ? data.heightCm : Math.round(data.heightCm / 30.48 * 10) / 10;
  const wtDisplay = wtUnit === 'kg' ? data.weightKg : Math.round(data.weightKg * 2.205);

  return (
    <View style={shared.stepContent}>
      <Text style={shared.eyebrow}>Your body</Text>
      <Text style={shared.heroTitle}>Body stats.</Text>
      <Text style={shared.subtitle}>Used for accurate pace and calorie estimates.</Text>

      {/* Gender — flat list rows */}
      <Text style={s.sectionLabel}>Gender</Text>
      {(['male', 'female'] as const).map(g => {
        const sel = data.gender === g;
        return (
          <Pressable key={g} style={s.optRow} onPress={() => onChange('gender', g)}>
            <View style={[s.accent, sel && s.accentSel]} />
            <Text style={[s.optText, sel && s.optTextSel]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
            {sel && <View style={s.dot} />}
          </Pressable>
        );
      })}

      {/* Age / Height / Weight in one row */}
      <View style={s.statsRow}>
        <DrumColumn
          label="Age" unit="yrs"
          values={AGES} value={data.age}
          onSelect={v => onChange('age', v)}
        />
        <DrumColumn
          label="Height"
          values={htValues} value={htDisplay}
          onSelect={v => onChange('heightCm', htUnit === 'cm' ? v : Math.round(v * 30.48))}
          toggleEl={
            <UnitToggle options={['cm', 'ft']} value={htUnit} onChange={v => setHtUnit(v as 'cm' | 'ft')} />
          }
        />
        <DrumColumn
          label="Weight"
          values={wtValues} value={wtDisplay}
          onSelect={v => onChange('weightKg', wtUnit === 'kg' ? v : Math.round(v / 2.205))}
          toggleEl={
            <UnitToggle options={['kg', 'lbs']} value={wtUnit} onChange={v => setWtUnit(v as 'kg' | 'lbs')} />
          }
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontWeight: '500', fontSize: 9, color: D.t3,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 4,
  },
  optRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: D.div,
  },
  accent:     { width: 2, height: 28, borderRadius: 1, backgroundColor: 'transparent' },
  accentSel:  { backgroundColor: D.red },
  optText:    { flex: 1, fontSize: 15, color: D.t2 },
  optTextSel: { fontWeight: '500', color: D.t1 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: D.red },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: 24 },

  unitRow:      { flexDirection: 'row', backgroundColor: D.div, borderRadius: 6, padding: 2 },
  unitBtn:      { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  unitBtnSel:   { backgroundColor: '#fff' },
  unitLabel:    { fontWeight: '500', fontSize: 9, color: D.t3 },
  unitLabelSel: { color: D.red },
});

const ds = StyleSheet.create({
  col:       { flex: 1 },
  colHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  colLabel:  { fontWeight: '500', fontSize: 9, color: D.t3, textTransform: 'uppercase', letterSpacing: 1 },
  colUnit:   { fontSize: 9, color: D.t3 },
  drumWrap:  { backgroundColor: D.surf, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  band: {
    position: 'absolute', top: 1 * ITEM_H, left: 0, right: 0, height: ITEM_H,
    borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: D.div, zIndex: 1,
  },
  item:      { alignItems: 'center', justifyContent: 'center' },
  itemText:  { fontSize: 15, color: D.t3 },
  itemActive:{ fontWeight: '500', fontSize: 18, color: D.t1 },
  fadeT: {
    position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 0.8,
    backgroundColor: 'rgba(237,233,228,0.82)',
  },
  fadeB: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 0.8,
    backgroundColor: 'rgba(237,233,228,0.82)',
  },
});
