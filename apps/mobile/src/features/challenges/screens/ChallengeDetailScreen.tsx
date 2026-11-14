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
import { daysLeft } from './ChallengesScreen';

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
        <Pressable style={s.back} onPress={() => navigation.goBack()} accessibilityLabel="Back"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
        <Text style={s.title} numberOfLines={1}>{c?.title ?? 'Challenge'}</Text>
      </View>
      {!c || rows === null ? <ActivityIndicator color={C.red} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 60 }}>
          <Text style={s.sub}>{METRIC_LABEL[c.metric].name}: {c.target} {unit} · {daysLeft(c.endsAt)} · set by {c.creatorName}</Text>
          {c.myStatus === 'invited' && (
            <Pressable style={s.joinBtn} onPress={() => respondChallenge(c.id, true).then(load).catch(() => {})} accessibilityRole="button">
              <Text style={s.joinTxt}>Join this challenge</Text>
            </Pressable>
          )}
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
          <Text style={s.note}>Counts activities between the start and the deadline. Rides count for distance; zones count claims and steals.</Text>
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
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: C.t1 },
    sub: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    joinBtn: { height: 48, borderRadius: 24, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    joinTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: '#fff' },
    card: { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    rank: { width: 18, fontFamily: Fonts.bold, fontSize: 14, color: C.t2, textAlign: 'center' },
    rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    name: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    val: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    track: { height: 6, borderRadius: 3, backgroundColor: C.surface, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3, backgroundColor: C.red },
    note: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
  });
}
