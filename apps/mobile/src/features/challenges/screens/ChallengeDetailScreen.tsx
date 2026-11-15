/** C4: one challenge — everyone's progress against the target. */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CaretLeft, Trophy } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import { fetchMyChallenges, fetchChallengeProgress, respondChallenge, METRIC_LABEL, type Challenge, type ChallengeEntry } from '../services/challengeService';
import { daysLeft, BADGE } from './ChallengesScreen';

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const COUNTS: Record<string, string> = { distance_km: 'Runs, walks, hikes and rides', zones: 'Zones claimed and taken back', active_days: 'Any day with an activity' };

export default function ChallengeDetailScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'ChallengeDetail'>>().params;
  const [c, setC] = useState<Challenge | null>(null);
  const [rows, setRows] = useState<ChallengeEntry[] | null>(null);
  const load = useCallback(() => {
    fetchMyChallenges().then(l => setC(l.find(x => x.id === id) ?? null)).catch(() => {});
    fetchChallengeProgress(id).then(setRows).catch(() => setRows([]));
  }, [id]);
  useFocusEffect(load);

  const unit = c ? METRIC_LABEL[c.metric].unit : '';
  return (
    <View style={s.root}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable style={s.back} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={() => navigation.goBack()} accessibilityLabel="Back"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
        <Text style={s.title} numberOfLines={1}>Challenge</Text>
      </View>
      {!c || rows === null ? <ActivityIndicator color={C.red} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 60 }}>
          {/* Hero (mock): badge, title, what it is, then join. */}
          <View style={s.hero}>
            <View style={[s.badge, { backgroundColor: BADGE[c.metric].bg(C) }]}>
              <Text style={[s.badgeTxt, { color: BADGE[c.metric].fg(C) }]} adjustsFontSizeToFit numberOfLines={1}>{c.target}{BADGE[c.metric].suffix}</Text>
            </View>
            <Text style={s.heroTitle}>{c.title}</Text>
            <Text style={s.heroBody}>{METRIC_LABEL[c.metric].name}: reach {c.target} {unit} between {fmtDay(c.startsAt)} and {fmtDay(c.endsAt)}. {daysLeft(c.endsAt)}.</Text>
            {c.myStatus === 'invited' && (
              <Pressable style={s.joinBtn} onPress={() => respondChallenge(c.id, true).then(load).catch(() => {})} accessibilityRole="button">
                <Text style={s.joinTxt}>Join challenge</Text>
              </Pressable>
            )}
            <View style={s.joinedRow}>
              {rows.slice(0, 3).map((r, i) => (
                <View key={r.userId} style={[s.stackAv, i > 0 && { marginLeft: -10 }]}><Avatar name={r.username} color={r.avatarColor ?? undefined} size={28} /></View>
              ))}
              <Text style={s.joinedTxt}>{c.people} {c.people === 1 ? 'runner' : 'runners'} in</Text>
            </View>
          </View>

          <View style={s.card}>
            {([
              ['Dates', `${fmtDay(c.startsAt)} – ${fmtDay(c.endsAt)}`],
              ['Goal', `${c.target} ${unit}`],
              ['Counts', COUNTS[c.metric] ?? ''],
              ['Set by', c.creatorName],
            ] as const).map(([k, v], i) => (
              <View key={k} style={[s.fact, i > 0 && s.rowBorder]}>
                <Text style={s.factKey}>{k}</Text>
                <Text style={s.factVal} numberOfLines={2}>{v}</Text>
              </View>
            ))}
          </View>

          <Text style={s.section}>Standings</Text>
          <View style={s.card}>
            {rows.map((r, i) => {
              const pct = Math.min(1, r.progress / c.target);
              const done = r.progress >= c.target;
              return (
                <View key={r.userId} style={[s.row, i > 0 && s.rowBorder]}>
                  <Text style={s.rank}>{i + 1}</Text>
                  <Avatar name={r.username} color={r.avatarColor ?? undefined} size={32} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.rowHead}>
                      <Text style={s.name} numberOfLines={1}>{r.username}{r.status === 'invited' ? ' · invited' : ''}</Text>
                      <Text style={[s.val, done && { color: C.red }]}>{r.progress} / {c.target} {unit}</Text>
                    </View>
                    <View style={s.track}><View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} /></View>
                  </View>
                  {done && <Trophy size={16} color={C.red} weight="fill" />}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    joinBtn: { height: 52, borderRadius: 26, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center', marginTop: 16, alignSelf: 'stretch' },
    hero: { backgroundColor: C.card, borderRadius: 28, padding: 20, alignItems: 'flex-start' },
    badge: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    badgeTxt: { fontFamily: Fonts.numeric, fontSize: 20 },
    heroTitle: { fontFamily: Fonts.semiBold, fontSize: 26, lineHeight: 31, color: C.t1, marginTop: 14 },
    heroBody: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: C.t2, marginTop: 6 },
    joinedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    stackAv: { borderRadius: 16, borderWidth: 2, borderColor: C.card },
    joinedTxt: { fontFamily: Fonts.regular, fontSize: 13.5, color: C.t2, marginLeft: 8 },
    fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 14 },
    factKey: { fontFamily: Fonts.regular, fontSize: 15, color: C.t2 },
    factVal: { flex: 1, textAlign: 'right', fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    section: { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1, marginTop: 6 },
    joinTxt: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
    card: { backgroundColor: C.card, borderRadius: 24, paddingHorizontal: 18 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    rank: { width: 18, fontFamily: Fonts.bold, fontSize: 14, color: C.t2, textAlign: 'center' },
    rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    name: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    val: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    track: { height: 8, borderRadius: 4, backgroundColor: C.bg, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4, backgroundColor: C.green },
  });
}
