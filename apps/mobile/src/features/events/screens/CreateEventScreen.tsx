// Create an event, on the shared form kit (mock onboarding style). Day and
// time are chips (next two weeks; common start times), not typed dates.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useCreateEvent, EVENT_TYPES } from '../hooks/useCreateEvent';
import { DISCIPLINE_LABEL, type Discipline } from '../types';
import {
  FormScreen, FormField, ChipGroup, ToggleRow, FormButton, FormTip, dayOptions, TIME_OPTIONS,
} from '@mobile/shared/components/form/FormKit';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DISTANCES = [
  { value: '', label: 'No set distance' }, { value: '3', label: '3 km' }, { value: '5', label: '5 km' },
  { value: '10', label: '10 km' }, { value: '21.1', label: 'Half' }, { value: '42.2', label: 'Marathon' },
];
const DISCIPLINES = (Object.entries(DISCIPLINE_LABEL) as [Discipline, string][]).map(([value, label]) => ({ value, label }));
const DAYS = dayOptions(21);

export default function CreateEventScreen() {
  const navigation = useNavigation<Nav>();
  const f = useCreateEvent();

  const submit = async () => { if (await f.submit()) navigation.goBack(); };

  return (
    <FormScreen
      title="Host an"
      accent="event."
      subtitle="Runners near you see it in Events and can say they're going."
      onClose={() => navigation.goBack()}
      footer={<>
        {!!f.error && <FormTip lead="Couldn't post it:">{f.error}</FormTip>}
        <FormButton label="Post event" onPress={submit} disabled={!f.canSubmit} busy={f.saving} />
      </>}
    >
      <FormField label="Name" value={f.title} onChangeText={f.setTitle} placeholder="Saturday 10K at Cubbon Park" maxLength={80} autoCapitalize="sentences" />
      <ChipGroup label="Kind" options={EVENT_TYPES.filter(t => t.value !== 'brand-challenge' && t.value !== 'survival')} value={f.eventType} onChange={f.setEventType} />
      <ChipGroup label="Day" options={DAYS} value={f.date || null} onChange={f.setDate} wrap={false} />
      <ChipGroup label="Start" options={TIME_OPTIONS} value={f.time || null} onChange={f.setTime} wrap={false} />
      <FormField label="Meeting point" value={f.location} onChangeText={f.setLocation} placeholder="Cubbon Park main gate" maxLength={120} />
      <ToggleRow
        title="Use where I am now"
        sub="Pins the meeting point, so runners can check in and get a result"
        value={f.useHere}
        onChange={f.setUseHere}
      />
      <ChipGroup label="Distance" options={DISTANCES} value={f.distanceKm} onChange={f.setDistanceKm} />
      <ChipGroup label="Sport" optional options={DISCIPLINES} value={f.discipline || null} onChange={v => f.setDiscipline(f.discipline === v ? '' : v)} />
      <FormField label="Pace groups" optional value={f.paceGroups} onChangeText={f.setPaceGroups} placeholder="5:30, 6:30" keyboardType="numbers-and-punctuation" maxLength={40} />
      <FormField label="Details" optional value={f.description} onChangeText={f.setDescription} placeholder="Route, what to bring, where to park…" multiline maxLength={500} counter />
    </FormScreen>
  );
}
