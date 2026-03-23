import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { EVENT_TYPES } from '../hooks/useCreateEvent';

const C = { white: '#FFFFFF', border: '#DDD9D4', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518' };

interface Props {
  saving: boolean; error: string; canSubmit: boolean;
  title: string; setTitle: (v: string) => void;
  eventType: string; setEventType: (v: string) => void;
  date: string; setDate: (v: string) => void;
  time: string; setTime: (v: string) => void;
  location: string; setLocation: (v: string) => void;
  distanceKm: string; setDistanceKm: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  onSubmit: () => void;
}

export function EventForm({ saving, error, canSubmit, title, setTitle, eventType, setEventType, date, setDate, time, setTime, location, setLocation, distanceKm, setDistanceKm, description, setDescription, onSubmit }: Props) {
  return (
    <>
      <Text style={s.label}>Event Title</Text>
      <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Saturday 5K" placeholderTextColor={C.t3} maxLength={80} />

      <Text style={s.label}>Event Type</Text>
      <View style={s.typeGrid}>
        {EVENT_TYPES.map(t => (
          <Pressable key={t.value} style={[s.typeBtn, eventType === t.value && s.typeBtnActive]} onPress={() => setEventType(t.value)}>
            <Text style={[s.typeLabel, eventType === t.value && s.typeLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Date (YYYY-MM-DD)</Text>
      <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="2026-04-15" placeholderTextColor={C.t3} keyboardType="numbers-and-punctuation" maxLength={10} />

      <Text style={s.label}>Time (HH:MM)</Text>
      <TextInput style={s.input} value={time} onChangeText={setTime} placeholder="08:00" placeholderTextColor={C.t3} keyboardType="numbers-and-punctuation" maxLength={5} />

      <Text style={s.label}>Location</Text>
      <TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="Central Park, NYC" placeholderTextColor={C.t3} maxLength={120} />

      <Text style={s.label}>Distance (km) — optional</Text>
      <TextInput style={s.input} value={distanceKm} onChangeText={setDistanceKm} placeholder="5.0" placeholderTextColor={C.t3} keyboardType="decimal-pad" maxLength={6} />

      <Text style={s.label}>Description — optional</Text>
      <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="Tell people what to expect..." placeholderTextColor={C.t3} multiline maxLength={500} />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Pressable style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]} onPress={onSubmit} disabled={!canSubmit || saving}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.submitLabel}>Create Event</Text>}
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: C.white, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border },
  typeBtnActive: { backgroundColor: C.black, borderColor: C.black },
  typeLabel: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2 },
  typeLabelActive: { color: '#fff', fontFamily: 'Barlow_500Medium' },
  error: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.red, marginTop: 8 },
  submitBtn: { backgroundColor: C.black, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnDisabled: { opacity: 0.4 },
  submitLabel: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
