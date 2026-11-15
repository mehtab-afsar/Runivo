/**
 * The hosted-event extras in the detail sheet:
 *   E3 pace groups, the route, and who has arrived (check in at the start)
 *   E4 the result for past events, with the finisher badge
 *   E6 the territory-hour rule
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { MapTrifold, MapPin, Trophy } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { supabase } from '@shared/services/supabase';
import { Avatar } from '@mobile/shared/components/Avatar';
import type { RunEvent } from '../types';
import {
  fetchAttendees, setPaceGroup, checkInEvent, fetchEventResult, claimEventFinish,
  type Attendee, type ResultRow,
} from '../services/eventService';

function clock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function EventExtras({ event, joined, onFollowRoute }: { event: RunEvent; joined: boolean; onFollowRoute?: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const start = new Date(event.startsAt).getTime();
  const end = event.endsAt ? new Date(event.endsAt).getTime() : start + 4 * 3600e3;
  const now = Date.now();
  const past = now > end;
  const live = now >= start - 3600e3 && now <= end;
  const [people, setPeople] = useState<Attendee[] | null>(null);
  const [result, setResult] = useState<ResultRow[] | null>(null);
  const [myGroup, setMyGroup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [badge, setBadge] = useState(false);

  useEffect(() => {
    if (event.source === 'curated') return;
    if (past) { fetchEventResult(event.id).then(setResult).catch(() => setResult([])); return; }
    const load = () => fetchAttendees(event.id).then(async a => {
      setPeople(a);
      const { data: { session } } = await supabase.auth.getSession();
      const me = a.find(x => x.userId === session?.user.id);
      if (me) setMyGroup(g => g ?? me.paceGroup);
    }).catch(() => {});
    load();
    // While the event is on, arrivals refresh every 30 s.
    if (!live) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [event.id, event.source, past, live]);

  if (event.source === 'curated') return null;

  const checkIn = async () => {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const ok = await checkInEvent(event.id, fix.coords.latitude, fix.coords.longitude);
      if (!ok) Alert.alert('Not at the start yet', 'Check in within 300 m of the meeting point, from an hour before the start.');
      else setPeople(await fetchAttendees(event.id));
    } catch { /* offline */ } finally { setBusy(false); }
  };

  const groups = event.paceGroups ?? [];
  const arrived = people?.filter(p => p.arrived) ?? [];
  const byGroup = (g: string) => people?.filter(p => p.paceGroup === g).length ?? 0;

  return (
    <View style={s.wrap}>
      {event.category === 'territory-war' && (
        <View style={s.rule}>
          <Text style={s.ruleTxt}>Territory hour: zones claimed within {event.radiusM ?? 1000} m of the meeting point earn double zone PACE for club members.</Text>
        </View>
      )}

      {!!event.route && onFollowRoute && (
        <Pressable hitSlop={8} style={s.btn} onPress={onFollowRoute} accessibilityRole="button">
          <MapTrifold size={15} color={C.t1} /><Text style={s.btnTxt}>Follow the route</Text>
        </Pressable>
      )}

      {!past && joined && groups.length > 0 && (
        <>
          <Text style={s.label}>Your pace group</Text>
          <View style={s.chips}>
            {groups.map(g => (
              <Pressable hitSlop={8} key={g} style={[s.chip, myGroup === g && s.chipOn]} onPress={() => { const v = myGroup === g ? null : g; setMyGroup(v); setPaceGroup(event.id, v).catch(() => {}); }}>
                <Text style={[s.chipTxt, myGroup === g && s.chipTxtOn]}>{g} /km · {byGroup(g) + (myGroup === g && !people?.some(p => p.paceGroup === g) ? 1 : 0)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {!past && people && people.length > 0 && (
        <>
          <Text style={s.label}>{live ? `${arrived.length} here · ${people.length} going` : `${people.length} going`}</Text>
          <View style={s.faces}>
            {(live ? [...arrived, ...people.filter(p => !p.arrived)] : people).slice(0, 12).map(p => (
              <View key={p.userId} style={[s.face, live && !p.arrived && { opacity: 0.35 }]}>
                <Avatar name={p.username} color={p.avatarColor ?? undefined} size={30} />
              </View>
            ))}
          </View>
        </>
      )}

      {live && joined && (
        <Pressable hitSlop={8} style={[s.btn, s.btnDark]} onPress={checkIn} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color={C.bg} /> : <><MapPin size={15} color={C.bg} weight="fill" /><Text style={[s.btnTxt, { color: C.bg }]}>I'm here</Text></>}
        </Pressable>
      )}

      {past && (
        result === null ? <ActivityIndicator color={C.t2} /> : result.length === 0 ? (
          <Text style={s.muted}>No one recorded a run at the start during the event.</Text>
        ) : (
          <>
            <Text style={s.label}>Result · {result.length} ran</Text>
            {result.slice(0, 10).map((r, i) => (
              <View key={r.userId} style={[s.row, r.isMe && s.rowMe]}>
                <Text style={s.rank}>{i + 1}</Text>
                <Text style={s.name} numberOfLines={1}>{r.username}{r.isMe ? ' (you)' : ''}</Text>
                <Text style={s.val}>{r.distanceKm.toFixed(2)} km · {clock(r.durationSec)}</Text>
              </View>
            ))}
            {result.some(r => r.isMe) && (
              <Pressable hitSlop={8} style={[s.btn, badge && { opacity: 0.6 }]} disabled={badge} onPress={() => claimEventFinish(event.id).then(ok => setBadge(ok)).catch(() => {})} accessibilityRole="button">
                <Trophy size={15} color={C.red} weight="fill" /><Text style={s.btnTxt}>{badge ? 'Finisher badge added' : 'Get your finisher badge'}</Text>
              </Pressable>
            )}
          </>
        )
      )}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    wrap: { gap: 8, marginBottom: 12 },
    rule: { backgroundColor: C.redLo, borderRadius: 10, padding: 10 },
    ruleTxt: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t1 },
    label: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, marginTop: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
    chipOn: { backgroundColor: C.t1, borderColor: C.t1 },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    chipTxtOn: { color: C.bg },
    faces: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    face: {},
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 21, borderWidth: 1, borderColor: C.border },
    btnDark: { backgroundColor: C.t1, borderColor: C.t1 },
    btnTxt: { fontFamily: Fonts.semiBold, fontSize: 13.5, color: C.t1 },
    muted: { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    rowMe: { backgroundColor: C.redLo, borderRadius: 8, paddingHorizontal: 6 },
    rank: { width: 18, fontFamily: Fonts.bold, fontSize: 13, color: C.t2 },
    name: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 13.5, color: C.t1 },
    val: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t2 },
  });
}
