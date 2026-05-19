import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import { Footprints, Person, Lightning, Fire, type Icon } from 'phosphor-react-native';
import type { OnboardingData } from '../types';
import { EXP_OPTIONS, AGES, HEIGHTS, WEIGHTS } from '../types';
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

// ─── Icon map ─────────────────────────────────────────────────────────────────

type IconComp = Icon;
const ICONS: Record<OnboardingData['experienceLevel'], IconComp> = {
  new: Footprints, casual: Person, regular: Lightning, competitive: Fire,
};

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  data: Pick<OnboardingData, 'experienceLevel' | 'gender' | 'age' | 'heightCm' | 'weightKg'>;
  onChange: <K extends 'experienceLevel' | 'gender' | 'age' | 'heightCm' | 'weightKg'>(
    key: K, val: OnboardingData[K]
  ) => void;
}

export default function ProfileStep({ data, onChange }: Props) {
  const [htUnit, setHtUnit] = useState<'cm' | 'ft'>('cm');
  const [wtUnit, setWtUnit] = useState<'kg' | 'lbs'>('kg');

  const htValues  = htUnit === 'cm' ? HEIGHTS : HEIGHTS.map(h => Math.round(h / 30.48 * 10) / 10);
  const wtValues  = wtUnit === 'kg' ? WEIGHTS : WEIGHTS.map(w => Math.round(w * 2.205));
  const htDisplay = htUnit === 'cm' ? data.heightCm : Math.round(data.heightCm / 30.48 * 10) / 10;
  const wtDisplay = wtUnit === 'kg' ? data.weightKg : Math.round(data.weightKg * 2.205);

  const expAnims = useRef(EXP_OPTIONS.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(14),
  }))).current;

  useEffect(() => {
    Animated.stagger(70, expAnims.map(({ opacity, translateY }) =>
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    )).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView contentContainerStyle={shared.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={shared.eyebrow}>Who you are</Text>
      <Text style={shared.heroTitle}>Your profile.</Text>
      <Text style={shared.subtitle}>Shapes training intensity and calorie estimates.</Text>

      {/* Experience level */}
      <Text style={shared.fieldLabel}>Running experience</Text>
      <View style={s.rule} />

      {EXP_OPTIONS.map((opt, i) => {
        const sel = data.experienceLevel === opt.key;
        const Icon = ICONS[opt.key];
        return (
          <Animated.View
            key={opt.key}
            style={{ opacity: expAnims[i].opacity, transform: [{ translateY: expAnims[i].translateY }] }}
          >
            <Pressable style={s.row} onPress={() => onChange('experienceLevel', opt.key)}>
              <View style={[s.accent, sel && s.accentActive]} />
              <Icon size={18} color={sel ? D.red : D.t3} weight="light" />
              <View style={{ flex: 1 }}>
                <Text style={[s.label, sel && s.labelSel]}>{opt.label}</Text>
                <Text style={s.sub}>{opt.sub}</Text>
              </View>
              {sel && <View style={s.dot} />}
            </Pressable>
          </Animated.View>
        );
      })}

      {/* Body stats divider */}
      <View style={s.divider} />
      <Text style={shared.fieldLabel}>Body stats</Text>

      {/* Gender */}
      {(['male', 'female'] as const).map(g => {
        const sel = data.gender === g;
        return (
          <Pressable key={g} style={s.row} onPress={() => onChange('gender', g)}>
            <View style={[s.accent, sel && s.accentActive]} />
            <Text style={[s.label, sel && s.labelSel]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
            {sel && <View style={s.dot} />}
          </Pressable>
        );
      })}

      {/* Age / Height / Weight */}
      <View style={s.drumsRow}>
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rule:       { height: 1, backgroundColor: D.div, marginBottom: 0 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: D.div },
  accent:     { width: 2, height: 32, borderRadius: 1, backgroundColor: 'transparent' },
  accentActive:{ backgroundColor: D.red },
  label:      { fontSize: 15, color: D.t2, flex: 1 },
  labelSel:   { fontWeight: '500', color: D.t1 },
  sub:        { fontSize: 12, color: D.t3, marginTop: 2 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: D.red },
  divider:    { height: 1, backgroundColor: D.div, marginVertical: 24 },
  drumsRow:   { flexDirection: 'row', gap: 8, marginTop: 16 },
  unitRow:    { flexDirection: 'row', backgroundColor: D.div, borderRadius: 6, padding: 2 },
  unitBtn:    { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  unitBtnSel: { backgroundColor: '#fff' },
  unitLabel:  { fontWeight: '500', fontSize: 9, color: D.t3 },
  unitLabelSel:{ color: D.red },
});

const ds = StyleSheet.create({
  col:       { flex: 1 },
  colHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  colLabel:  { fontWeight: '500', fontSize: 9, color: D.t3, textTransform: 'uppercase', letterSpacing: 1 },
  colUnit:   { fontSize: 9, color: D.t3 },
  drumWrap:  { backgroundColor: D.surf, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  band:      { position: 'absolute', top: 1 * ITEM_H, left: 0, right: 0, height: ITEM_H, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: D.div, zIndex: 1 },
  item:      { alignItems: 'center', justifyContent: 'center' },
  itemText:  { fontSize: 15, color: D.t3 },
  itemActive:{ fontWeight: '500', fontSize: 18, color: D.t1 },
  fadeT:     { position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 0.8, backgroundColor: 'rgba(237,233,228,0.82)' },
  fadeB:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 0.8, backgroundColor: 'rgba(237,233,228,0.82)' },
});
