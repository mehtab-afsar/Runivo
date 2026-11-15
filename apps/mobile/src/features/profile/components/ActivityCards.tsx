/**
 * You → Activities (mock): a month line, then one card per activity with
 * the time and sport, title, distance / pace / time, a zone badge, the route,
 * and a footer. Long-press pins an activity, as before.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { StoredRun } from '@shared/services/store';
import { RouteThumb } from '@mobile/shared/components/RouteThumb';
import { sportFor } from '@features/run/constants/activities';
import { filterBySport, sportGroup, paceOrSpeed, fmtClock, activityTitle, type SportFilter } from '../utils/profileStats';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function when(ms: number): string {
  const d = new Date(ms);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(ms); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? DAYS[d.getDay()] : `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return `${label}, ${t}`;
}

export function ActivityCards({ runs, sport, pinnedId, onPin, onOpen, onAll }: {
  runs: StoredRun[]; sport: SportFilter; pinnedId?: string | null;
  onPin?: (id: string | null) => void; onOpen: (r: StoredRun) => void; onAll?: () => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const { width } = useWindowDimensions();
  const [limit, setLimit] = useState(10);
  const list = useMemo(
    () => filterBySport(runs, sport).filter(r => r.distanceMeters >= 50).sort((a, b) => b.startTime - a.startTime),
    [runs, sport],
  );
  const now = new Date();
  const month = list.filter(r => { const d = new Date(r.startTime); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const monthKm = month.reduce((n, r) => n + (r.verifiedDistanceKm ?? r.distanceMeters / 1000), 0);
  const askPin = (r: StoredRun) => {
    if (!onPin) return;
    const isPinned = r.id === pinnedId;
    Alert.alert(isPinned ? 'Unpin this activity?' : 'Pin to your profile?', undefined,
      [{ text: 'Cancel', style: 'cancel' }, { text: isPinned ? 'Unpin' : 'Pin', onPress: () => onPin(isPinned ? null : r.id) }]);
  };

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.headTxt}>{MONTHS[now.getMonth()]} · {month.length} {month.length === 1 ? 'activity' : 'activities'} · {monthKm.toFixed(1)} km</Text>
        {onAll && <Pressable style={s.filter} onPress={onAll} accessibilityRole="button"><Text style={s.filterTxt}>All</Text></Pressable>}
      </View>
      {list.length === 0 && <Text style={s.empty}>Your runs show up here. Tap Record to start one.</Text>}
      {list.slice(0, limit).map(r => {
        const km = r.verifiedDistanceKm ?? r.distanceMeters / 1000;
        const ps = paceOrSpeed(km, r.durationSec, sportGroup(r.activityType));
        const zones = r.serverResult ? r.serverResult.newZones + r.serverResult.stolenZones : r.territoriesClaimed.length;
        const stolen = r.serverResult?.stolenZones ?? 0;
        return (
          <Pressable key={r.id} style={s.card} onPress={() => onOpen(r)} onLongPress={onPin ? () => askPin(r) : undefined} accessibilityRole="button">
            <View style={s.body}>
              <Text style={s.meta}>{when(r.startTime)} · {sportFor(r.activityType).label}{r.id === pinnedId ? ' · Pinned' : ''}{r.excluded ? ' · Not counted' : ''}</Text>
              <Text style={s.title} numberOfLines={2}>{r.title || activityTitle(r)}</Text>
              <View style={s.stats}>
                <View><Text style={s.statLbl}>Distance</Text><Text style={s.statVal}>{km.toFixed(2)} km</Text></View>
                <View><Text style={s.statLbl}>{ps.unit === 'km/h' ? 'Speed' : 'Pace'}</Text><Text style={s.statVal}>{ps.value} {ps.unit === 'km/h' ? 'km/h' : '/km'}</Text></View>
                <View><Text style={s.statLbl}>Time</Text><Text style={s.statVal}>{fmtClock(r.durationSec)}</Text></View>
              </View>
              {zones > 0 && (
                <View style={[s.badge, { backgroundColor: stolen > 0 ? C.amberBg : C.mint }]}>
                  <Text style={[s.badgeStrong, { color: stolen > 0 ? C.amber : C.green }]}>{stolen > 0 ? `${stolen} taken back` : `+${zones} ${zones === 1 ? 'zone' : 'zones'}`}</Text>
                  <Text style={s.badgeTxt}>{stolen > 0 ? 'Zone retaken' : 'Claimed on this run'}</Text>
                </View>
              )}
            </View>
            {(r.gpsPoints?.length ?? 0) >= 2 && (
              <View style={s.map}><RouteThumb points={r.gpsPoints} width={width - 32} height={170} radius={0} stroke={3} /></View>
            )}
            <View style={s.foot}><Text style={s.footTxt}>Start and end hidden</Text></View>
          </Pressable>
        );
      })}
      {list.length > limit && (
        <Pressable style={s.more} onPress={() => setLimit(l => l + 10)} accessibilityRole="button"><Text style={s.moreTxt}>Show more</Text></Pressable>
      )}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    wrap:   { paddingHorizontal: 16, gap: 12 },
    head:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    headTxt:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, flexShrink: 1 },
    filter: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.card, justifyContent: 'center' },
    filterTxt: { fontFamily: Fonts.regular, fontSize: 13, color: C.t1 },
    empty:  { fontFamily: Fonts.regular, fontSize: 14, color: C.t2, paddingHorizontal: 4 },
    card:   { borderRadius: 24, backgroundColor: C.card, overflow: 'hidden' },
    body:   { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 8 },
    meta:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    title:  { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1 },
    stats:  { flexDirection: 'row', gap: 22 },
    statLbl:{ fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    statVal:{ fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1, fontVariant: ['tabular-nums'] },
    badge:  { flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, paddingHorizontal: 10, borderRadius: 12 },
    badgeStrong: { fontFamily: Fonts.bold, fontSize: 13 },
    badgeTxt: { fontFamily: Fonts.regular, fontSize: 13, color: C.t1 },
    map:    { backgroundColor: C.bg },
    foot:   { flexDirection: 'row', gap: 18, paddingVertical: 10, paddingHorizontal: 16 },
    footTxt:{ fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    more:   { alignSelf: 'center', height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.card, justifyContent: 'center' },
    moreTxt:{ fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
  });
}
