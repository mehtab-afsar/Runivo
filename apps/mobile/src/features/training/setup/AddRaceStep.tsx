/**
 * Add your race (PRD mock 4): name, day, distance, city, website. Saved as a
 * pending race only its author sees until it's checked; the plan works now.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { FormField, ChipGroup, FieldLabel } from '@mobile/shared/components/form/FormKit';
import MonthGrid, { monthOf } from '@mobile/shared/components/MonthGrid';
import { addDays } from '@shared/engine/training';
import { fmtRaceDate } from '../services/raceService';

export interface NewRace { name: string; startsOn: string | null; distanceM: number | null; city: string; url: string }

export const ADD_DISTANCES = [
  { value: 5000, label: '5K' }, { value: 10000, label: '10K' }, { value: 21097, label: 'Half' }, { value: 42195, label: 'Marathon' },
];

export const newRaceProblem = (r: NewRace): string | null =>
  r.name.trim().length < 3 ? 'Add the race name.'
  : !r.startsOn ? 'Pick the race day.'
  : !r.distanceM ? 'Pick your distance.'
  : r.url.trim() && !/^https:\/\/\S+$/.test(r.url.trim()) ? 'The website must start with https://'
  : null;

export default function AddRaceStep({ value, onChange, today }: { value: NewRace; onChange: (v: NewRace) => void; today: string }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [month, setMonth] = useState(monthOf(value.startsOn ?? addDays(today, 30)));
  const set = <K extends keyof NewRace>(k: K, v: NewRace[K]) => onChange({ ...value, [k]: v });
  return (
    <View style={{ gap: 18 }}>
      <FormField label="Name" value={value.name} onChangeText={t => set('name', t)} placeholder="e.g. Lakeside 10K" maxLength={80} autoCapitalize="words" />
      <View>
        <FieldLabel hint={value.startsOn ? fmtRaceDate(value.startsOn) : undefined}>Race day</FieldLabel>
        <MonthGrid month={month} onMonth={setMonth} selected={value.startsOn} today={today}
          minDate={addDays(today, 1)} maxDate={addDays(today, 730)} onSelect={d => set('startsOn', d)} />
      </View>
      <ChipGroup label="Your distance" options={ADD_DISTANCES} value={value.distanceM} onChange={d => set('distanceM', d)} />
      <FormField label="City" optional value={value.city} onChangeText={t => set('city', t)} placeholder="Where it starts" maxLength={60} autoCapitalize="words" />
      <FormField label="Website" optional value={value.url} onChangeText={t => set('url', t)} placeholder="https://" autoCapitalize="none" keyboardType="url" autoCorrect={false} />
      <Text style={s.note}>Only you see this race until we check it. Then other runners can find it too.</Text>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    note: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2 },
  });
}
