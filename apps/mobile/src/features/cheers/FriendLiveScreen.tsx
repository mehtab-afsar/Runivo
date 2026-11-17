/**
 * Friend running (mock "FriendLive"): a friend's live run on the map, how far
 * they are, and the cheers you can send. Opens from a friend's marker, the
 * "N friends running" chip, or Home's "Watch live". Live data comes from the
 * same shared row as the map marker (mutual follows who share, fresh in 30 s).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ML from '@maplibre/maplibre-react-native';
import { X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import * as Haptics from '@theme/hapticsGated';
import { MAP_STYLES } from '@theme/maps';
import { useRunivoMapStyle } from '@theme/runivoMapStyle';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useLiveFriendRuns } from '@features/run/hooks/useLiveFriendRuns';
import { LiveFriendMarker } from '@features/run/components/LiveFriendMarker';
import { fmtClock, fmtPace } from '@mobile/shared/lib/formatters';
import { CHEERS, sendCheer, type CheerKey } from './cheerService';
import { RESULT_TEXT } from './CheerSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FriendLiveScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'FriendLive'>>();
  const friends = useLiveFriendRuns();
  const friend = friends.find(f => f.userId === params.userId);
  const baseStyle = useRunivoMapStyle(MAP_STYLES[0].url);

  // Seconds since the last update, ticking so "updated 4 s ago" stays true.
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Keep the last known friend so the page doesn't blank when they pause.
  const last = useRef(friend);
  if (friend) last.current = friend;
  const f = friend ?? last.current;
  const ended = !friend && !!last.current;

  const [pick, setPick] = useState<CheerKey>('go');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [note, setNote] = useState('');
  const send = async () => {
    if (!f || state === 'sending' || state === 'sent') return;
    setState('sending');
    try {
      const r = await sendCheer(f.userId, pick);
      if (r === 'sent') { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setState('sent'); }
      else { setNote(RESULT_TEXT[r]); setState('failed'); }
    } catch { setNote("Couldn't reach Runivo. Try again."); setState('failed'); }
  };

  const close = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'Map' } as never));
  const name = f?.username ?? params.username ?? 'Your friend';
  const ago = f ? Math.max(0, Math.round((now - f.updatedAt) / 1000)) : 0;
  const km = f?.distanceM != null ? f.distanceM / 1000 : null;
  const pace = km && km > 0.05 && f?.elapsedSec ? fmtPace(f.elapsedSec / km) : null;
  const started = f?.startedAt ? new Date(f.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <View style={s.root}>
      {f ? (
        <ML.MapView style={StyleSheet.absoluteFill} mapStyle={baseStyle} logoEnabled={false} attributionEnabled={false}>
          <ML.Camera centerCoordinate={[f.lng, f.lat]} zoomLevel={15} animationDuration={800} />
          <LiveFriendMarker runner={f} />
        </ML.MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, s.loading]}><ActivityIndicator color={C.t2} /></View>
      )}

      <View style={[s.top, { top: insets.top + 8 }]}>
        <Pressable style={s.round} onPress={close} accessibilityRole="button" accessibilityLabel="Close">
          <X size={18} color="#17181A" weight="bold" />
        </Pressable>
        <View style={s.livePill}>
          <View style={[s.liveDot, ended && { backgroundColor: C.t3 }]} />
          <Text style={s.liveTxt}>{ended ? 'Run ended' : `LIVE · updated ${ago} s ago`}</Text>
        </View>
      </View>

      <View style={[s.sheet, { paddingBottom: insets.bottom + 14 }]}>
        <Text style={s.title}>{name} is running</Text>
        {!!started && <Text style={s.sub}>Started {started}</Text>}

        <View style={s.stats}>
          <View style={s.stat}><Text style={s.statLbl}>Distance</Text><Text style={s.statVal}>{km != null ? `${km.toFixed(2)} km` : '–'}</Text></View>
          <View style={s.stat}><Text style={s.statLbl}>Pace</Text><Text style={s.statVal}>{pace ?? '–'}</Text></View>
          <View style={s.stat}><Text style={s.statLbl}>Time</Text><Text style={s.statVal}>{f?.elapsedSec != null ? fmtClock(f.elapsedSec) : '–'}</Text></View>
        </View>

        {state === 'sent' ? (
          <View style={s.sent} accessibilityLiveRegion="polite">
            <Text style={s.sentTitle}>Cheer sent 👏</Text>
            <Text style={s.sentSub}>{name} hears "{CHEERS.find(c => c.key === pick)?.label(name)}" right now.</Text>
          </View>
        ) : (
          <>
            <Text style={s.label}>Send a cheer</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} accessibilityRole="radiogroup">
              {CHEERS.map(c => {
                const on = c.key === pick;
                return (
                  <Pressable key={c.key} onPress={() => setPick(c.key)} style={[s.chip, on && s.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                    <Text style={[s.chipTxt, on && { color: C.alwaysLight }]}>{c.emoji} {c.label(name)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {state === 'failed' && <Text style={s.note}>{note}</Text>}
            <Pressable style={[s.cta, (ended || state === 'sending') && { opacity: 0.5 }]} onPress={send} disabled={ended || state === 'sending'} accessibilityRole="button">
              {state === 'sending' ? <ActivityIndicator color="#17181A" /> : <Text style={s.ctaTxt}>👏 Cheer</Text>}
            </Pressable>
          </>
        )}
        <Text style={s.foot}>They hear it straight away as a voice cue. One cheer per run.</Text>
      </View>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    loading:  { alignItems: 'center', justifyContent: 'center' },
    top:      { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
    round:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    livePill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.alwaysDark },
    liveDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.lime },
    liveTxt:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight },
    sheet:    { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 20, paddingHorizontal: 20, gap: 10 },
    title:    { fontFamily: Fonts.semiBold, fontSize: 24, color: C.t1 },
    sub:      { fontFamily: Fonts.regular, fontSize: 14, color: C.t2, marginTop: -6 },
    stats:    { flexDirection: 'row', gap: 8, marginTop: 4 },
    stat:     { flex: 1, borderRadius: 18, backgroundColor: C.bg, padding: 12 },
    statLbl:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    statVal:  { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1, fontVariant: ['tabular-nums'] },
    label:    { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1, marginTop: 6 },
    chips:    { gap: 8, paddingRight: 20 },
    chip:     { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.bg, justifyContent: 'center' },
    chipOn:   { backgroundColor: C.alwaysDark },
    chipTxt:  { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    note:     { fontFamily: Fonts.regular, fontSize: 13, color: C.danger },
    cta:      { height: 56, borderRadius: 28, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    ctaTxt:   { fontFamily: Fonts.semiBold, fontSize: 16, color: '#17181A' },
    sent:     { borderRadius: 20, backgroundColor: C.mint, padding: 16, gap: 4 },
    sentTitle:{ fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    sentSub:  { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    foot:     { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, textAlign: 'center' },
  });
}
