/**
 * Privacy controls (PRD X1): every visibility choice on one page. Changes
 * apply to past activities and zones too; the server enforces all of them.
 */
import { ErrorState } from '@mobile/shared/components/ErrorState';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { ArrowLeft, HouseLine, Trash, MapPin } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { RowChevron } from '@mobile/shared/components/RowChevron';
import { MapSearchBar } from '@features/territory/components/MapSearchBar';
import { SegmentedControl } from '../components/SettingToggle';
import { useSettings } from '../hooks/useSettings';
import { chooseExport } from '../services/exportService';
import { radiusLabel, effectiveRadius, MAP_HIDE_RADII } from '@shared/services/mapVisibility';
import { fetchDefaultAudience, saveDefaultAudience, type Audience } from '@features/run/services/activityEditService';
import {
  fetchPrivatePlaces, addPrivatePlace, removePrivatePlace, fetchPrivacyControls, savePrivacyControls,
  type PrivatePlace, type PrivacyControls,
} from '../services/privacyService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const AUD_LABEL: Record<Audience, string> = { everyone: 'Everyone', followers: 'Followers', only_me: 'Only you' };
const LABELS = ['Home', 'Work', 'Other'];

export default function PrivacyScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { settings, updateSetting } = useSettings();
  const sw = { trackColor: { true: C.black, false: C.border }, thumbColor: C.white };

  const [audience, setAudience] = useState<Audience | null>(null);
  const [places, setPlaces] = useState<PrivatePlace[] | null>(null);
  const [controls, setControls] = useState<PrivacyControls | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('Home');
  const [radius, setRadius] = useState(400);
  const [busy, setBusy] = useState(false);

  const [loadFailed, setLoadFailed] = useState(false);
  const load = useCallback(() => {
    setLoadFailed(false);
    // A failed load must NOT fall back to "Everyone / nothing hidden": that showed a
    // private runner as fully visible. Leave the values unknown (controls stay disabled)
    // and say so.
    const failed = () => setLoadFailed(true);
    fetchDefaultAudience().then(setAudience).catch(failed);
    fetchPrivatePlaces().then(setPlaces).catch(() => { setPlaces([]); failed(); });
    fetchPrivacyControls().then(setControls).catch(failed);
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeAudience = (l: string) => {
    const next = (Object.keys(AUD_LABEL) as Audience[]).find(k => AUD_LABEL[k] === l) ?? 'everyone';
    const prev = audience; setAudience(next);
    saveDefaultAudience(next).catch(() => { setAudience(prev); Alert.alert("Couldn't save", 'Check your connection and try again.'); });
  };

  const toggle = (k: keyof PrivacyControls, v: boolean) => {
    if (!controls) return;
    const prev = controls; setControls({ ...controls, [k]: v });
    savePrivacyControls({ [k]: v }).catch(() => { setControls(prev); Alert.alert("Couldn't save", 'Check your connection and try again.'); });
  };

  const add = async (lat: number, lng: number) => {
    setBusy(true);
    try { setPlaces(await addPrivatePlace(label, lat, lng, radius)); setAdding(false); }
    catch (e) { Alert.alert("Couldn't add the place", e instanceof Error ? e.message : 'Try again.'); }
    finally { setBusy(false); }
  };
  const addHere = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('Location is off', 'Search for the address instead, or allow location for Runivo.'); return; }
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
    if (!fix) { Alert.alert('No GPS fix', 'Try again outside, or search for the address.'); return; }
    await add(fix.coords.latitude, fix.coords.longitude);
  };
  const remove = (p: PrivatePlace) => Alert.alert(`Remove ${p.label}?`, 'Zones and routes near it will be visible to others again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { try { setPlaces(await removePrivatePlace(p.id)); } catch { Alert.alert("Couldn't remove it", 'Try again.'); } } },
  ]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>Privacy</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {loadFailed && (
          <ErrorState title="Couldn't load your privacy settings" body="What you see below may be out of date, so changes are paused. Try again." onRetry={load} />
        )}
        <Text style={s.section}>Activities</Text>
        <View style={s.card}>
          <View style={s.rowCol}>
            <Text style={s.label}>Who sees new activities</Text>
            <Text style={s.sub}>You can still change it on each activity.</Text>
            {audience && <View style={{ marginTop: 10 }}><SegmentedControl options={['Everyone', 'Followers', 'Only you']} value={AUD_LABEL[audience]} onChange={changeAudience} /></View>}
          </View>
          <Pressable style={[s.row, s.border]} onPress={() => navigation.navigate('MapVisibility')} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Map visibility</Text>
              <Text style={s.sub}>{settings.mapHideAll ? 'All maps hidden' : `Start and end hidden · ${radiusLabel(effectiveRadius(settings.mapHideRadiusM))}`}</Text>
            </View>
            <RowChevron />
          </Pressable>
        </View>

        <Text style={s.section}>Private places</Text>
        <View style={s.card}>
          <View style={s.rowCol}>
            <Text style={s.sub}>Others never see a zone of yours that comes near these places, and no part of a route inside them. The zones still count for you.</Text>
          </View>
          {places === null ? <ActivityIndicator color={C.t2} style={{ margin: 14 }} /> : places.map(p => (
            <View key={p.id} style={[s.row, s.border]}>
              <HouseLine size={18} color={C.t1} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{p.label}</Text>
                <Text style={s.sub}>Within {radiusLabel(p.radiusM)}</Text>
              </View>
              <Pressable onPress={() => remove(p)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${p.label}`}>
                <Trash size={18} color={C.red} />
              </Pressable>
            </View>
          ))}
          {!adding && (places?.length ?? 0) < 5 && (
            <Pressable style={[s.row, s.border]} onPress={() => setAdding(true)} accessibilityRole="button">
              <MapPin size={18} color={C.t1} />
              <Text style={[s.label, { flex: 1 }]}>Add a private place</Text>
              <RowChevron />
            </Pressable>
          )}
          {adding && (
            <View style={[s.rowCol, s.border]}>
              <View style={s.chips}>
                {LABELS.map(l => (
                  <Pressable hitSlop={8} key={l} style={[s.chip, label === l && s.chipOn]} onPress={() => setLabel(l)}><Text style={[s.chipTxt, label === l && s.chipTxtOn]}>{l}</Text></Pressable>
                ))}
              </View>
              <View style={[s.chips, { marginTop: 8 }]}>
                {MAP_HIDE_RADII.map(r => (
                  <Pressable hitSlop={8} key={r} style={[s.chip, radius === r && s.chipOn]} onPress={() => setRadius(r)}><Text style={[s.chipTxt, radius === r && s.chipTxtOn]}>{radiusLabel(r)}</Text></Pressable>
                ))}
              </View>
              <Pressable style={s.cta} onPress={addHere} disabled={busy} accessibilityRole="button">
                {busy ? <ActivityIndicator color={C.alwaysLight} /> : <Text style={s.ctaTxt}>Use where I am now</Text>}
              </Pressable>
              <Text style={[s.sub, { marginTop: 10, marginBottom: 6 }]}>Or search for the address</Text>
              <MapSearchBar onFound={([lng, lat]) => { void add(lat, lng); }} />
              <Pressable onPress={() => setAdding(false)} style={{ marginTop: 10 }}><Text style={s.link}>Cancel</Text></Pressable>
            </View>
          )}
        </View>

        <Text style={s.section}>Game</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Hide me from leaderboards</Text>
              <Text style={s.sub}>Others don't see you on any board. You still see your own rank.</Text>
            </View>
            <Switch value={!!controls?.hideFromLeaderboards} onValueChange={v => toggle('hideFromLeaderboards', v)} disabled={!controls} {...sw} />
          </View>
          <View style={[s.row, s.border]}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Hide my zones from the map</Text>
              <Text style={s.sub}>Others don't see your zones on the map. They still count for you, and rivals can still run through them.</Text>
            </View>
            <Switch value={!!controls?.hideZonesFromMap} onValueChange={v => toggle('hideZonesFromMap', v)} disabled={!controls} {...sw} />
          </View>
          <View style={[s.row, s.border]}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Live run sharing</Text>
              <Text style={s.sub}>Mutual friends see you move on the map while you run; off between runs.</Text>
            </View>
            <Switch value={settings.liveRunSharingEnabled} onValueChange={v => updateSetting({ liveRunSharingEnabled: v })} {...sw} />
          </View>
        </View>

        <Text style={s.section}>People and data</Text>
        <View style={s.card}>
          <Pressable style={s.row} onPress={() => navigation.navigate('BlockedRunners')} accessibilityRole="button">
            <Text style={[s.label, { flex: 1 }]}>Blocked and muted</Text>
            <RowChevron />
          </Pressable>
          <Pressable style={[s.row, s.border]} onPress={chooseExport} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Export my data</Text>
              <Text style={s.sub}>Activities as GPX or CSV, zones as GeoJSON</Text>
            </View>
            <RowChevron />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bg },
    header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
    backBtn: { width: 32, height: 32, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    title:   { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    scroll:  { paddingHorizontal: 18, paddingBottom: 48 },
    section: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 20, marginBottom: 8 },
    card:    { backgroundColor: C.card, borderRadius: 22 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
    rowCol:  { paddingHorizontal: 14, paddingVertical: 14 },
    border:  { borderTopWidth: 1, borderTopColor: C.border },
    label:   { fontFamily: Fonts.semiBold, fontSize: 14.5, color: C.t1 },
    sub:     { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 2, lineHeight: 17 },
    chips:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    chip:    { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
    chipOn:  { backgroundColor: C.t1, borderColor: C.t1 },
    chipTxt: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t1 },
    chipTxtOn: { color: C.bg },
    cta:     { height: 44, borderRadius: 12, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    ctaTxt:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
    link:    { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t2, textAlign: 'center' },
  });
}
