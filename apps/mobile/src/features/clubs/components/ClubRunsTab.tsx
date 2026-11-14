/** Club runs (PRD C1): upcoming group runs with RSVP; owners and admins schedule them. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { CalendarBlank, MapPin, Check, MapTrifold } from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { getSavedRoutes, type StoredSavedRoute } from '@shared/services/store';
import * as Location from 'expo-location';
import { createTerritoryEvent } from '@features/events/services/eventService';
import { useTheme, Fonts, type AppColors } from '@theme';
import { toggleEventJoin } from '@features/events/services/eventService';
import { fetchClubRuns, scheduleClubRun, type ClubRun } from '../services/clubService';

const TIMES = ['06:00', '06:30', '07:00', '17:30', '18:00', '18:30', '19:00'];
const WEEKS = [1, 4, 8, 12];

const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const when = (iso: string) => {
  const d = new Date(iso);
  return `${dayLabel(d)} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
};

export default function ClubRunsTab({ clubId, canSchedule }: { clubId: string; canSchedule: boolean }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [runs, setRuns] = useState<ClubRun[] | null>(null);
  const [form, setForm] = useState(false);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); d.setHours(0, 0, 0, 0); return d; }), []);
  const [title, setTitle] = useState('Club run');
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('06:30');
  const [place, setPlace] = useState('');
  const [km, setKm] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [saving, setSaving] = useState(false);
  // E6: a territory hour instead of a run.
  const [territory, setTerritory] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [radius, setRadius] = useState(800);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [routes, setRoutes] = useState<StoredSavedRoute[]>([]);
  const [routeId, setRouteId] = useState<string | null>(null);
  useEffect(() => { if (form) getSavedRoutes().then(setRoutes).catch(() => {}); }, [form]);

  const load = useCallback(() => { fetchClubRuns(clubId).then(setRuns).catch(() => setRuns([])); }, [clubId]);
  useEffect(load, [load]);

  const rsvp = async (r: ClubRun) => {
    setRuns(prev => prev?.map(x => x.id === r.id ? { ...x, isGoing: !x.isGoing, going: x.going + (x.isGoing ? -1 : 1) } : x) ?? prev);
    try { await toggleEventJoin(r.id, r.isGoing); } catch { load(); }
  };

  const schedule = async () => {
    const [h, m] = time.split(':').map(Number);
    const start = new Date(days[day]); start.setHours(h, m, 0, 0);
    setSaving(true);
    try {
      if (territory) {
        const fix = await Location.getLastKnownPositionAsync().catch(() => null);
        if (!fix) { Alert.alert('Location needed', 'The area is centred on where you are now. Turn on location and try again.'); return; }
        await createTerritoryEvent(clubId, { title: title.trim(), startsAt: start, minutes, lat: fix.coords.latitude, lng: fix.coords.longitude, radiusM: radius, place: place.trim() });
        setForm(false);
        Alert.alert('Territory hour scheduled', `Members earn double zone PACE inside ${radius} m of here for ${minutes} minutes. It's on the Events page.`);
        return;
      }
      const picked = routes.find(r => r.id === routeId);
      const n = await scheduleClubRun(clubId, {
        title: title.trim(), startsAt: start, location: place.trim(), weeks,
        distanceKm: km ? parseFloat(km) : picked ? Math.round(picked.distanceM / 100) / 10 : null,
        route: picked?.gpsPoints ?? null,
      });
      setForm(false);
      load();
      Alert.alert('Scheduled', n > 1 ? `${n} weekly runs are on the club calendar.` : 'The run is on the club calendar.');
    } catch (e) {
      Alert.alert("Couldn't schedule", e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.content}>
      {canSchedule && !form && (
        <Pressable style={s.cta} onPress={() => setForm(true)} accessibilityRole="button">
          <Text style={s.ctaTxt}>Schedule a club run</Text>
        </Pressable>
      )}

      {form && (
        <View style={s.card}>
          <View style={s.chips}>
            <Pressable style={[s.chip, !territory && s.chipOn]} onPress={() => setTerritory(false)}><Text style={[s.chipTxt, !territory && s.chipTxtOn]}>Club run</Text></Pressable>
            <Pressable style={[s.chip, territory && s.chipOn]} onPress={() => { setTerritory(true); if (title === 'Club run') setTitle('Territory hour'); }}><Text style={[s.chipTxt, territory && s.chipTxtOn]}>Territory hour · double zone PACE</Text></Pressable>
          </View>
          <Text style={s.label}>Title</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} maxLength={60} />
          <Text style={s.label}>Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {days.map((d, i) => (
              <Pressable key={i} style={[s.chip, day === i && s.chipOn]} onPress={() => setDay(i)}><Text style={[s.chipTxt, day === i && s.chipTxtOn]}>{dayLabel(d)}</Text></Pressable>
            ))}
          </ScrollView>
          <Text style={s.label}>Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {TIMES.map(t => (
              <Pressable key={t} style={[s.chip, time === t && s.chipOn]} onPress={() => setTime(t)}><Text style={[s.chipTxt, time === t && s.chipTxtOn]}>{t}</Text></Pressable>
            ))}
          </ScrollView>
          <Text style={s.label}>Meeting point</Text>
          <TextInput style={s.input} value={place} onChangeText={setPlace} placeholder="e.g. Cubbon Park main gate" placeholderTextColor={C.t3} maxLength={80} />
          {territory && (
            <>
              <Text style={s.label}>How long</Text>
              <View style={s.chips}>
                {[30, 60, 90].map(m => (
                  <Pressable key={m} style={[s.chip, minutes === m && s.chipOn]} onPress={() => setMinutes(m)}><Text style={[s.chipTxt, minutes === m && s.chipTxtOn]}>{m} min</Text></Pressable>
                ))}
              </View>
              <Text style={s.label}>Area around where you are now</Text>
              <View style={s.chips}>
                {[500, 800, 1500].map(r => (
                  <Pressable key={r} style={[s.chip, radius === r && s.chipOn]} onPress={() => setRadius(r)}><Text style={[s.chipTxt, radius === r && s.chipTxtOn]}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</Text></Pressable>
                ))}
              </View>
            </>
          )}
          {!territory && <>
          <Text style={s.label}>Distance (km, optional)</Text>
          <TextInput style={s.input} value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="10" placeholderTextColor={C.t3} maxLength={5} />
          {routes.length > 0 && (
            <>
              <Text style={s.label}>Route (optional, from your saved routes)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                <Pressable style={[s.chip, !routeId && s.chipOn]} onPress={() => setRouteId(null)}><Text style={[s.chipTxt, !routeId && s.chipTxtOn]}>None</Text></Pressable>
                {routes.map(r => (
                  <Pressable key={r.id} style={[s.chip, routeId === r.id && s.chipOn]} onPress={() => setRouteId(r.id)}>
                    <Text style={[s.chipTxt, routeId === r.id && s.chipTxtOn]} numberOfLines={1}>{r.emoji} {r.name} · {(r.distanceM / 1000).toFixed(1)} km</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
          <Text style={s.label}>Repeat weekly</Text>
          <View style={s.chips}>
            {WEEKS.map(w => (
              <Pressable key={w} style={[s.chip, weeks === w && s.chipOn]} onPress={() => setWeeks(w)}><Text style={[s.chipTxt, weeks === w && s.chipTxtOn]}>{w === 1 ? 'Once' : `${w} weeks`}</Text></Pressable>
            ))}
          </View>
          </>}
          <View style={s.formBtns}>
            <Pressable style={s.secondary} onPress={() => setForm(false)}><Text style={s.secondaryTxt}>Cancel</Text></Pressable>
            <Pressable style={[s.cta, { flex: 1, marginBottom: 0 }, (saving || !place.trim()) && { opacity: 0.5 }]} onPress={schedule} disabled={saving || !place.trim()}>
              {saving ? <ActivityIndicator color={C.alwaysLight} /> : <Text style={s.ctaTxt}>Schedule</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {runs === null ? <ActivityIndicator color={C.t2} style={{ marginTop: 24 }} />
        : runs.length === 0 ? <Text style={s.empty}>No club runs coming up.{canSchedule ? ' Schedule one so members can join.' : ''}</Text>
        : runs.map(r => (
          <View key={r.id} style={s.card}>
            <Text style={s.title}>{r.title}</Text>
            <View style={s.metaRow}><CalendarBlank size={13} color={C.t2} /><Text style={s.meta}>{when(r.startsAt)}</Text></View>
            {!!r.location && <View style={s.metaRow}><MapPin size={13} color={C.t2} /><Text style={s.meta}>{r.location}{r.distanceM ? ` · ${(r.distanceM / 1000).toFixed(r.distanceM % 1000 ? 1 : 0)} km` : ''}</Text></View>}
            {r.route && (
              <Pressable style={s.follow} onPress={() => navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', ghostRoutePoints: r.route! })} accessibilityRole="button">
                <MapTrifold size={14} color={C.t1} />
                <Text style={s.followTxt}>Follow the route</Text>
              </Pressable>
            )}
            <View style={s.foot}>
              <Text style={s.meta}>{r.going} going</Text>
              <Pressable style={[s.rsvp, r.isGoing && s.rsvpOn]} onPress={() => rsvp(r)} accessibilityRole="button" accessibilityState={{ selected: r.isGoing }}>
                {r.isGoing && <Check size={13} color={C.bg} weight="bold" />}
                <Text style={[s.rsvpTxt, r.isGoing && { color: C.bg }]}>{r.isGoing ? 'Going' : "I'm in"}</Text>
              </Pressable>
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    content: { padding: 18, gap: 10, paddingBottom: 60 },
    card:    { backgroundColor: C.card, borderRadius: 16, padding: 14 },
    title:   { fontFamily: Fonts.semiBold, fontSize: 15.5, color: C.t1, marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    meta:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    foot:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    follow:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.surface },
    followTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    rsvp:    { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: C.border },
    rsvpOn:  { backgroundColor: C.t1, borderColor: C.t1 },
    rsvpTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    cta:     { height: 48, borderRadius: 14, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    ctaTxt:  { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    label:   { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 12, marginBottom: 6 },
    input:   { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
    chips:   { flexDirection: 'row', gap: 6 },
    chip:    { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
    chipOn:  { backgroundColor: C.t1, borderColor: C.t1 },
    chipTxt: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t1 },
    chipTxtOn: { color: C.bg },
    formBtns:{ flexDirection: 'row', gap: 8, marginTop: 16 },
    secondary:{ height: 48, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
    secondaryTxt:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    empty:   { fontFamily: Fonts.regular, fontSize: 13.5, color: C.t2, textAlign: 'center', marginTop: 24 },
  });
}
