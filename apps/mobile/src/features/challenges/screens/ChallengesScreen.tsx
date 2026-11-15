/** C4: your group challenges, and a sheet to start one with people you follow. */
import { ErrorState } from '@mobile/shared/components/ErrorState';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft, CaretRight, Plus, Check, Flag } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import { SponsoredChallenges } from '@features/store/components/SponsoredChallenges';
import {
  fetchMyChallenges, createChallenge, respondChallenge, fetchFollowing, METRIC_LABEL,
  type Challenge, type ChallengeMetric,
} from '../services/challengeService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
/** The square badge on each card (mock: "5Z", "100"). */
export const BADGE: Record<ChallengeMetric, { suffix: string; bg: (C: AppColors) => string; fg: (C: AppColors) => string }> = {
  distance_km: { suffix: '', bg: C => C.mint, fg: C => C.green },
  zones:       { suffix: 'Z', bg: C => C.amberBg, fg: C => C.amber },
  active_days: { suffix: 'D', bg: C => C.lavender, fg: C => C.lavenderInk },
};
const DURATIONS = [{ label: '1 week', days: 7 }, { label: '2 weeks', days: 14 }, { label: '1 month', days: 30 }];
const TARGETS: Record<ChallengeMetric, number[]> = { distance_km: [20, 50, 100, 200], zones: [5, 10, 20, 50], active_days: [5, 10, 15, 20] };

export function daysLeft(iso: string): string {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d < 0 ? 'Finished' : d === 0 ? 'Ends today' : `${d} ${d === 1 ? 'day' : 'days'} left`;
}

/** `embedded`: shown inside the Groups tab, which supplies the title and safe area. */
export default function ChallengesScreen({ embedded = false }: { embedded?: boolean }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [list, setList] = useState<Challenge[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(() => {
    setLoadError(false);
    fetchMyChallenges().then(setList).catch(() => { setList(prev => prev ?? []); setLoadError(true); });
  }, []);
  useFocusEffect(load);

  const answer = async (c: Challenge, join: boolean) => {
    try { await respondChallenge(c.id, join); load(); } catch { Alert.alert('Could not reach Runivo', 'Try again in a moment.'); }
  };

  const topBar = (
    <View style={[s.top, embedded ? { paddingHorizontal: 0, paddingTop: 6 } : { paddingTop: insets.top + 6 }]}>
        {embedded
          ? <Text style={[s.title, { fontSize: 18, fontFamily: Fonts.semiBold }]}>Group challenges</Text>
          : <>
              <Pressable style={s.back} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={() => navigation.goBack()} accessibilityLabel="Back"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
              <Text style={s.title}>Challenges</Text>
            </>}
        <Pressable hitSlop={8} style={s.newBtn} onPress={() => setCreating(true)} accessibilityRole="button">
          <Plus size={14} color={C.bg} weight="bold" /><Text style={s.newTxt}>{embedded ? 'Create' : 'New'}</Text>
        </Pressable>
      </View>
  );

  return (
    <View style={s.root}>
      {!embedded && topBar}
      {list === null ? <ActivityIndicator color={C.red} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: embedded ? 130 : 60 }}>
          {embedded && <View style={{ marginHorizontal: -18, marginTop: -18 }}><SponsoredChallenges title="Featured" /></View>}
          {embedded && topBar}
          {list.length === 0 && loadError && <ErrorState title="Couldn't load challenges" onRetry={load} />}
          {list.length === 0 && !loadError && (
            <View style={s.empty}>
              <Flag size={36} color={C.t3} />
              <Text style={s.emptyTitle}>Race your friends</Text>
              <Text style={s.emptyBody}>Pick a target (distance, zones or days active), a deadline, and up to 19 people you follow.</Text>
              <Pressable style={s.cta} onPress={() => setCreating(true)} accessibilityRole="button"><Text style={s.ctaTxt}>Start a challenge</Text></Pressable>
            </View>
          )}
          {list.map(c => (
            <Pressable key={c.id} style={s.card} onPress={() => navigation.navigate('ChallengeDetail', { id: c.id })} accessibilityRole="button">
              <View style={[s.badge, { backgroundColor: BADGE[c.metric].bg(C) }]}>
                <Text style={[s.badgeTxt, { color: BADGE[c.metric].fg(C) }]} adjustsFontSizeToFit numberOfLines={1}>{c.target}{BADGE[c.metric].suffix}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={s.cardSub}>{c.target} {METRIC_LABEL[c.metric].unit} · {daysLeft(c.endsAt)} · {c.people} in</Text>
                {c.myStatus === 'invited' && (
                  <View style={s.inviteRow}>
                    <Text style={s.cardSub}>{c.creatorName} invited you</Text>
                    <Pressable style={s.join} onPress={() => answer(c, true)} accessibilityRole="button"><Text style={s.joinTxt}>Join</Text></Pressable>
                    <Pressable style={s.decline} onPress={() => answer(c, false)} accessibilityRole="button"><Text style={s.declineTxt}>No thanks</Text></Pressable>
                  </View>
                )}
              </View>
              {c.myStatus === 'joined'
                ? <View style={s.joinedPill}><Text style={s.joinedTxt}>Joined</Text></View>
                : <CaretRight size={14} color={C.t3} weight="bold" />}
            </Pressable>
          ))}
        </ScrollView>
      )}
      <CreateSheet visible={creating} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); load(); navigation.navigate('ChallengeDetail', { id }); }} />
    </View>
  );
}

function CreateSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<ChallengeMetric>('distance_km');
  const [target, setTarget] = useState(50);
  const [days, setDays] = useState(14);
  const [people, setPeople] = useState<{ id: string; username: string; avatarColor: string | null }[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (visible && people === null) fetchFollowing().then(setPeople).catch(() => setPeople([])); }, [visible, people]);

  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= 19 ? p : [...p, id]);
  const ok = title.trim().length > 0 && picked.length > 0;
  const save = async () => {
    setSaving(true);
    try { onCreated(await createChallenge({ title: title.trim(), metric, target, days, invitees: picked })); setTitle(''); setPicked([]); }
    catch (e) { Alert.alert("Couldn't start it", (e as Error).message ?? 'Try again.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: 16 }]}>
        <View style={s.sheetHead}>
          <Pressable onPress={onClose} hitSlop={10}><Text style={s.link}>Cancel</Text></Pressable>
          <Text style={s.sheetTitle}>New challenge</Text>
          <Pressable onPress={save} disabled={!ok || saving} hitSlop={10}><Text style={[s.link, { color: ok ? C.red : C.t3 }]}>{saving ? '…' : 'Start'}</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 10, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Name</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="November 50" placeholderTextColor={C.t3} maxLength={60} />
          <Text style={s.label}>Goal</Text>
          <View style={s.chips}>
            {(Object.keys(METRIC_LABEL) as ChallengeMetric[]).map(m => (
              <Pressable hitSlop={8} key={m} style={[s.chip, metric === m && s.chipOn]} onPress={() => { setMetric(m); setTarget(TARGETS[m][1]); }}>
                <Text style={[s.chipTxt, metric === m && s.chipTxtOn]}>{METRIC_LABEL[m].name}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.chips}>
            {TARGETS[metric].map(t => (
              <Pressable hitSlop={8} key={t} style={[s.chip, target === t && s.chipOn]} onPress={() => setTarget(t)}>
                <Text style={[s.chipTxt, target === t && s.chipTxtOn]}>{t} {METRIC_LABEL[metric].unit}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>Deadline</Text>
          <View style={s.chips}>
            {DURATIONS.map(d => (
              <Pressable hitSlop={8} key={d.days} style={[s.chip, days === d.days && s.chipOn]} onPress={() => setDays(d.days)}>
                <Text style={[s.chipTxt, days === d.days && s.chipTxtOn]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>Invite ({picked.length}/19 · people you follow)</Text>
          {people === null ? <ActivityIndicator color={C.red} /> : people.length === 0 ? (
            <Text style={s.cardSub}>Follow some runners first: challenges are for people you follow.</Text>
          ) : people.map(p => (
            <Pressable key={p.id} style={s.personRow} onPress={() => toggle(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: picked.includes(p.id) }}>
              <Avatar name={p.username} color={p.avatarColor ?? undefined} size={32} />
              <Text style={[s.cardTitle, { flex: 1, fontSize: 14 }]}>{p.username}</Text>
              <View style={[s.check, picked.includes(p.id) && s.checkOn]}>{picked.includes(p.id) && <Check size={12} color={C.bg} weight="bold" />}</View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: C.t1 },
    newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.t1 },
    newTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.bg },
    card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 24, padding: 16 },
    badge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    badgeTxt: { fontFamily: Fonts.numeric, fontSize: 18 },
    joinedPill: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.mint, justifyContent: 'center' },
    joinedTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.green },
    cardTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    cardSub: { fontFamily: Fonts.regular, fontSize: 13.5, color: C.t2 },
    inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
    join: { height: 30, paddingHorizontal: 14, borderRadius: 15, backgroundColor: C.alwaysDark, justifyContent: 'center' },
    joinTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.alwaysLight },
    decline: { height: 30, paddingHorizontal: 10, justifyContent: 'center' },
    declineTxt: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t2 },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 20 },
    emptyTitle: { fontFamily: Fonts.bold, fontSize: 17, color: C.t1 },
    emptyBody: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center' },
    cta: { marginTop: 8, height: 46, paddingHorizontal: 22, borderRadius: 23, backgroundColor: C.t1, justifyContent: 'center' },
    ctaTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
    sheetTitle: { fontFamily: Fonts.bold, fontSize: 16, color: C.t1 },
    link: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    label: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, marginTop: 8 },
    input: { height: 46, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 14, fontFamily: Fonts.medium, fontSize: 15, color: C.t1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: C.card, justifyContent: 'center' },
    chipOn: { backgroundColor: C.t1, borderColor: C.t1 },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    chipTxtOn: { color: C.bg },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
    check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    checkOn: { backgroundColor: C.red, borderColor: C.red },
  });
}
