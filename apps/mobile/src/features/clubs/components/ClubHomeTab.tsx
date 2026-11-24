/**
 * Club Home (mock "ClubDetail"): the next club run with Going, the club's
 * ground and standing, and the latest chat. Runs and territory open in full
 * from here, so the tab row stays Home · Chat · Members · Board.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Clock, MapPin, Check, CaretRight } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { RunnerFace } from '@mobile/shared/components/RunnerFace';
import { toggleEventJoin } from '@features/events/services/eventService';
import { fetchClubRuns, fetchClubTerritory, fetchClubTerritoryRank, type ClubRun, type ClubZone } from '../services/clubService';

const fmtArea = (m2: number) => (m2 >= 1_000_000 ? `${(m2 / 1_000_000).toFixed(2)} km²` : m2 >= 1000 ? `${(m2 / 1000).toFixed(m2 >= 100_000 ? 0 : 1)}K m²` : `${Math.round(m2)} m²`);

function whenLine(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  return `${day} · ${time}`;
}

export interface ChatPreview { id: string; text: string; mine: boolean }

export default function ClubHomeTab({ clubId, chat, onOpenChat, onOpenRuns, onOpenGround, canSchedule }: {
  clubId: string;
  chat: ChatPreview[];
  onOpenChat: () => void;
  onOpenRuns: () => void;
  onOpenGround: () => void;
  canSchedule: boolean;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [runs, setRuns] = useState<ClubRun[] | null>(null);
  const [zones, setZones] = useState<ClubZone[] | null>(null);
  const [rank, setRank] = useState<{ rank: number; of: number } | null>(null);

  const load = useCallback(() => {
    fetchClubRuns(clubId).then(setRuns).catch(() => setRuns([]));
    fetchClubTerritory(clubId).then(setZones).catch(() => setZones([]));
    fetchClubTerritoryRank(clubId).then(setRank).catch(() => {});
  }, [clubId]);
  useEffect(load, [load]);

  const next = useMemo(() => (runs ?? [])
    .filter(r => Date.parse(r.startsAt) > Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0] ?? null, [runs]);
  const area = (zones ?? []).reduce((t, z) => t + z.areaM2, 0);

  const going = async () => {
    if (!next) return;
    setRuns(rs => (rs ?? []).map(r => r.id === next.id ? { ...r, isGoing: !r.isGoing, going: r.going + (r.isGoing ? -1 : 1) } : r));
    try { await toggleEventJoin(next.id, next.isGoing); } catch { /* RSVP failed (offline): reload so the screen shows the server state. */ load(); }
  };

  return (
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Next club run */}
      <Pressable style={s.card} onPress={onOpenRuns} accessibilityRole="button">
        <Text style={s.eyebrow}>NEXT CLUB RUN</Text>
        {runs === null ? <ActivityIndicator color={C.t2} style={{ alignSelf: 'flex-start', marginTop: 10 }} /> : next ? (
          <>
            <Text style={s.runTitle}>{next.title}{next.distanceM ? ` · ${Math.round(next.distanceM / 100) / 10} km` : ''}</Text>
            <View style={s.metaRow}><Clock size={15} color={C.t2} /><Text style={s.meta}>{whenLine(next.startsAt)}</Text></View>
            {!!next.location && <View style={s.metaRow}><MapPin size={15} color={C.t2} /><Text style={s.meta} numberOfLines={2}>{next.location}</Text></View>}
            <View style={s.goingRow}>
              <View style={s.faces}>
                {Array.from({ length: Math.min(2, next.going) }, (_, i) => (
                  <View key={i} style={[s.face, i > 0 && { marginLeft: -10 }]}><RunnerFace seed={`${next.id}-${i}`} size={30} /></View>
                ))}
                {next.going > 2 && <View style={[s.face, s.more, { marginLeft: -10 }]}><Text style={s.moreTxt}>+{next.going - 2}</Text></View>}
                {next.going === 0 && <Text style={s.meta}>Be the first in</Text>}
              </View>
              <Pressable style={[s.goingBtn, next.isGoing && s.goingOn]} onPress={going} accessibilityRole="button" accessibilityState={{ selected: next.isGoing }}>
                <Text style={[s.goingTxt, next.isGoing && s.goingTxtOn]}>{next.isGoing ? 'Going' : "I'm going"}</Text>
                {next.isGoing && <Check size={14} color={C.alwaysDark} weight="bold" />}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={s.runTitle}>No club run yet</Text>
            <Text style={s.meta}>{canSchedule ? 'Schedule one and members are told.' : 'Admins post club runs here.'}</Text>
          </>
        )}
      </Pressable>

      {/* Ground and standing */}
      <View style={s.tiles}>
        <Pressable style={[s.tile, { backgroundColor: '#E9F2DD' }]} onPress={onOpenGround} accessibilityRole="button">
          <Text style={s.tileLabel}>Club territory</Text>
          <Text style={s.tileBig} numberOfLines={1}>{zones === null ? '…' : fmtArea(area)}</Text>
          <Text style={s.tileSub}>{(zones ?? []).length} {(zones ?? []).length === 1 ? 'zone' : 'zones'} held by members</Text>
        </Pressable>
        <Pressable style={[s.tile, { backgroundColor: '#FDF0DF' }]} onPress={onOpenGround} accessibilityRole="button">
          <Text style={s.tileLabel}>Club rank</Text>
          <Text style={[s.tileBig, { color: '#7A5525' }]}>{rank ? `#${rank.rank}` : '–'}</Text>
          <Text style={[s.tileSub, { color: '#7A5525' }]}>{rank ? `of ${rank.of} clubs by ground` : 'Claim ground to rank'}</Text>
        </Pressable>
      </View>

      {/* Latest chat */}
      <Pressable style={s.card} onPress={onOpenChat} accessibilityRole="button">
        <View style={s.chatHead}>
          <Text style={s.chatLabel}>Club chat</Text>
          <CaretRight size={14} color={C.t3} weight="bold" />
        </View>
        {chat.length === 0 ? <Text style={s.meta}>No messages yet. Say hello.</Text> : chat.slice(-2).map(m => (
          <View key={m.id} style={[s.bubble, m.mine ? s.bubbleMine : s.bubbleThem]}>
            <Text style={[s.bubbleTxt, m.mine && { color: C.alwaysLight }]} numberOfLines={3}>{m.text}</Text>
          </View>
        ))}
      </Pressable>
    </ScrollView>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    content:   { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 40, gap: 12 },
    card:      { backgroundColor: C.card, borderRadius: 24, padding: 18, gap: 6 },
    eyebrow:   { fontFamily: Fonts.semiBold, fontSize: 12.5, letterSpacing: 0.6, color: '#4E7A1E' },
    runTitle:  { fontFamily: Fonts.semiBold, fontSize: 20, letterSpacing: -0.3, color: C.t1, marginTop: 4, marginBottom: 4 },
    metaRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    meta:      { flex: 1, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 19, color: C.t2 },
    goingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    faces:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
    face:      { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: C.card, overflow: 'hidden', backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    more:      { backgroundColor: '#E4E1F8' },
    moreTxt:   { fontFamily: Fonts.semiBold, fontSize: 11.5, color: '#3C3577' },
    goingBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: C.alwaysDark },
    goingOn:   { backgroundColor: '#C9F06B' },
    goingTxt:  { fontFamily: Fonts.semiBold, fontSize: 15, color: C.alwaysLight },
    goingTxtOn:{ color: C.alwaysDark },
    tiles:     { flexDirection: 'row', gap: 12 },
    tile:      { flex: 1, borderRadius: 24, padding: 16, gap: 4, minHeight: 120 },
    tileLabel: { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    tileBig:   { fontFamily: Fonts.semiBold, fontSize: 28, letterSpacing: -0.6, color: C.t1 },
    tileSub:   { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 17, color: C.t2 },
    chatHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    chatLabel: { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    bubble:    { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleThem:{ alignSelf: 'flex-start', backgroundColor: C.bg },
    bubbleMine:{ alignSelf: 'flex-end', backgroundColor: C.alwaysDark },
    bubbleTxt: { fontFamily: Fonts.regular, fontSize: 14.5, lineHeight: 20, color: C.t1 },
  });
}
