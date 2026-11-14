/**
 * R5: log a treadmill run by hand — when, how long, how far. No GPS, so it
 * counts for distance, goals and your log, but never claims zones or PACE.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { saveRun } from '@shared/services/store';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const DAYS = [{ label: 'Today', back: 0 }, { label: 'Yesterday', back: 1 }, { label: '2 days ago', back: 2 }];

export default function LogTreadmillScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [day, setDay] = useState(0);
  const [mins, setMins] = useState('');
  const [km, setKm] = useState('');
  const [saving, setSaving] = useState(false);

  const minutes = Number(mins.replace(',', '.'));
  const dist = Number(km.replace(',', '.'));
  const ok = minutes > 0 && minutes <= 600 && dist > 0 && dist <= 100;
  const pace = ok ? (minutes * 60) / dist : null;
  const tooFast = pace != null && pace < 1000 / 6.5;

  const save = async () => {
    if (!ok || tooFast) return;
    setSaving(true);
    try {
      const end = new Date(); end.setDate(end.getDate() - day);
      if (day > 0) end.setHours(19, 0, 0, 0);
      const durationSec = Math.round(minutes * 60);
      const start = end.getTime() - durationSec * 1000;
      const p = durationSec / dist;
      await saveRun({
        id: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`) as string,
        activityType: 'treadmill', startTime: start, endTime: end.getTime(),
        distanceMeters: Math.round(dist * 1000), durationSec,
        avgPace: `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`,
        gpsPoints: [], territoriesClaimed: [], territoriesFortified: [], enemyCaptured: 0, preRunLevel: 0, synced: false,
        title: 'Treadmill run',
      });
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save it", 'Try again.');
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable style={s.back} onPress={() => navigation.goBack()} accessibilityLabel="Back"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
        <Text style={s.title}>Log a treadmill run</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }} keyboardShouldPersistTaps="handled">
        <Text style={s.note}>Counts toward your distance, goals and training log. Treadmill runs don't claim zones or earn PACE.</Text>
        <Text style={s.lbl}>When</Text>
        <View style={s.chips}>
          {DAYS.map(d => (
            <Pressable key={d.back} style={[s.chip, day === d.back && s.chipOn]} onPress={() => setDay(d.back)}>
              <Text style={[s.chipTxt, day === d.back && s.chipTxtOn]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.lbl}>Time (minutes)</Text>
        <TextInput style={s.input} value={mins} onChangeText={setMins} keyboardType="decimal-pad" placeholder="30" placeholderTextColor={C.t3} maxLength={5} />
        <Text style={s.lbl}>Distance (km, from the treadmill)</Text>
        <TextInput style={s.input} value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="5.0" placeholderTextColor={C.t3} maxLength={5} />
        {pace != null && (
          <Text style={[s.note, tooFast && { color: C.red }]}>
            {tooFast ? "That's faster than anyone runs. Check the numbers." : `Pace ${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')} /km`}
          </Text>
        )}
        <Pressable style={[s.cta, (!ok || tooFast || saving) && { opacity: 0.4 }]} disabled={!ok || tooFast || saving} onPress={save} accessibilityRole="button">
          <Text style={s.ctaTxt}>{saving ? 'Saving…' : 'Save run'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: C.t1 },
    note: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    lbl: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, marginTop: 8 },
    chips: { flexDirection: 'row', gap: 8 },
    chip: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
    chipOn: { backgroundColor: C.t1, borderColor: C.t1 },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    chipTxtOn: { color: C.bg },
    input: { height: 48, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 14, fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    cta: { marginTop: 18, height: 52, borderRadius: 26, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
    ctaTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.bg },
  });
}
