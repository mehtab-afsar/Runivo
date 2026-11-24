/** Club runs (PRD C1): upcoming group runs with RSVP; owners and admins schedule them. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from 'react-native';
import { CalendarBlank, MapPin, Check, MapTrifold, PersonSimpleRun, Hexagon } from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { getSavedRoutes, type StoredSavedRoute } from '@shared/services/store';
import * as Location from 'expo-location';
import { createTerritoryEvent } from '@features/events/services/eventService';
import { useTheme, Fonts, type AppColors } from '@theme';
import { FormScreen, FormField, ChipGroup, ChoiceCards, FormButton } from '@mobile/shared/components/form/FormKit';
import { cancelEvent, toggleEventJoin } from '@features/events/services/eventService';
import { fetchClubRuns, scheduleClubRun, type ClubRun } from '../services/clubService';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertLayer } from '@mobile/shared/components/AppAlert';

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
    try { await toggleEventJoin(r.id, r.isGoing); } catch { /* RSVP failed (offline): reload so the screen shows the server state. */ load(); }
  };

  const schedule = async () => {
    const [h, m] = time.split(':').map(Number);
    const start = new Date(days[day]); start.setHours(h, m, 0, 0);
    setSaving(true);
    try {
      if (territory) {
        const fix = await Location.getLastKnownPositionAsync().catch(() => null);
        if (!fix) { appAlert('Location needed', 'The area is centred on where you are now. Turn on location and try again.'); return; }
        await createTerritoryEvent(clubId, { title: title.trim(), startsAt: start, minutes, lat: fix.coords.latitude, lng: fix.coords.longitude, radiusM: radius, place: place.trim() });
        setForm(false);
        appAlert('Territory hour scheduled', `Members earn double zone PACE inside ${radius} m of here for ${minutes} minutes. It's on the Events page.`);
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
      appAlert('Scheduled', n > 1 ? `${n} weekly runs are on the club calendar.` : 'The run is on the club calendar.');
    } catch (e) {
      appAlert("Couldn't schedule", e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Club owners/admins can cancel a run that hasn't started; people going are told.
  const cancelRun = (r: { id: string; title: string; going: number }) => {
    appAlert(`Cancel ${r.title}?`, `${r.going} going will be told. You can’t undo this.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel run', style: 'destructive', onPress: async () => {
        try {
          const res = await cancelEvent(r.id);
          if (res !== 'cancelled') appAlert(res === 'started' ? 'It has already started' : "You can't cancel this run");
        } catch { appAlert("Couldn't cancel the run", 'Check your connection and try again.'); }
        load();
      } },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={s.content}>
      {canSchedule && !form && (
        <PrimaryButton label="Schedule a club run" onPress={() => setForm(true)} fullWidth style={{ marginBottom: 4 }} />
      )}

      {/* Schedule: a full page on the shared form kit, not a cramped inline card. */}
      <Modal visible={form} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setForm(false)}>
        {/* A Modal is a new native root: give it its own safe-area measurement,
            or the content starts under the status bar. */}
        <SafeAreaProvider>
        <FormScreen
          title="Schedule a"
          accent={territory ? 'territory hour.' : 'club run.'}
          subtitle={territory
            ? 'Members earn double zone PACE inside the area while it runs.'
            : 'It goes on the club calendar and members can say they\'re going.'}
          onClose={() => setForm(false)}
          footer={<FormButton label={territory ? 'Schedule territory hour' : weeks > 1 ? `Schedule ${weeks} weekly runs` : 'Schedule run'} onPress={schedule} disabled={!place.trim() || !title.trim()} busy={saving} />}
        >
          <ChoiceCards
            options={[
              { value: 'run', title: 'Club run', sub: 'Meet up, run together, optional route', Icon: PersonSimpleRun },
              { value: 'territory', title: 'Territory hour', sub: 'Double zone PACE in an area for a set time', Icon: Hexagon },
            ]}
            value={territory ? 'territory' : 'run'}
            onChange={v => { const t = v === 'territory'; setTerritory(t); if (t && title === 'Club run') setTitle('Territory hour'); if (!t && title === 'Territory hour') setTitle('Club run'); }}
          />
          <FormField label="Title" value={title} onChangeText={setTitle} maxLength={60} autoCapitalize="sentences" />
          <ChipGroup label="Day" options={days.map((d, i) => ({ value: i, label: dayLabel(d) }))} value={day} onChange={setDay} wrap={false} />
          <ChipGroup label="Start" options={TIMES.map(t => ({ value: t, label: t }))} value={time} onChange={setTime} wrap={false} />
          <FormField label="Meeting point" value={place} onChangeText={setPlace} placeholder="Cubbon Park main gate" maxLength={80} />
          {territory ? (
            <>
              <ChipGroup label="How long" options={[30, 60, 90].map(m => ({ value: m, label: `${m} min` }))} value={minutes} onChange={setMinutes} />
              <ChipGroup label="Area around where you are now" options={[500, 800, 1500].map(r => ({ value: r, label: r >= 1000 ? `${r / 1000} km` : `${r} m` }))} value={radius} onChange={setRadius} />
            </>
          ) : (
            <>
              <FormField label="Distance (km)" optional value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="10" maxLength={5} />
              {routes.length > 0 && (
                <ChipGroup
                  label="Route"
                  optional
                  options={[{ value: '', label: 'None' }, ...routes.map(r => ({ value: r.id, label: `${r.name} · ${(r.distanceM / 1000).toFixed(1)} km` }))]}
                  value={routeId ?? ''}
                  onChange={v => setRouteId(v || null)}
                  wrap={false}
                />
              )}
              <ChipGroup label="Repeat weekly" options={WEEKS.map(w => ({ value: w, label: w === 1 ? 'Once' : `${w} weeks` }))} value={weeks} onChange={setWeeks} />
            </>
          )}
        </FormScreen>
        <AlertLayer />
        </SafeAreaProvider>
      </Modal>

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
              <Pressable onLongPress={canSchedule ? () => cancelRun(r) : undefined} delayLongPress={400} disabled={!canSchedule}>
                <Text style={s.meta}>{r.going} going{canSchedule ? ' · hold to cancel' : ''}</Text>
              </Pressable>
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
    card:    { backgroundColor: C.card, borderRadius: 22, padding: 14 },
    title:   { fontFamily: Fonts.semiBold, fontSize: 15.5, color: C.t1, marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    meta:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    foot:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    follow:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.surface },
    followTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    rsvp:    { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: C.border },
    rsvpOn:  { backgroundColor: C.t1, borderColor: C.t1 },
    rsvpTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
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
