/**
 * Home → "Happening now": a sideways carousel of what's live or close —
 * friends running now (with Cheer), group challenges you're in, and the next
 * events you said you're going to. Hidden when there's nothing to show.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { LiveFriendRunner } from '@features/run/hooks/useLiveFriendRuns';
import { fetchMyChallenges, METRIC_LABEL, type Challenge } from '@features/challenges/services/challengeService';
import { fetchEvents } from '@features/events/services/eventService';
import type { RunEvent } from '@features/events/types';
import { FEATURES } from '../../../config/features';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function daysLeft(iso: string): string {
  const d = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return d <= 0 ? 'ends today' : d === 1 ? '1 day left' : `${d} days left`;
}

export function HappeningNow({ friends, onCheer }: {
  friends: LiveFriendRunner[];
  onCheer: (friend: LiveFriendRunner) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const cardW = Math.min(286, width - 74);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [events, setEvents] = useState<RunEvent[]>([]);

  useEffect(() => {
    fetchMyChallenges()
      .then(cs => setChallenges(cs.filter(c => c.myStatus === 'joined' && Date.parse(c.endsAt) > Date.now()).slice(0, 2)))
      .catch(() => {});
    if (FEATURES.EVENTS) {
      fetchEvents()
        .then(d => setEvents(d.events.filter(e => d.joinedIds.has(e.id) && Date.parse(e.startsAt) > Date.now()).slice(0, 2)))
        .catch(() => {});
    }
  }, []);

  if (friends.length === 0 && challenges.length === 0 && events.length === 0) return null;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.head}>
        <Text style={s.title} accessibilityRole="header">Happening now</Text>
        <Pressable onPress={() => navigation.navigate('Main', { screen: 'Groups' })} hitSlop={8} accessibilityRole="button">
          <Text style={s.all}>View all ›</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardW + 12} decelerationRate="fast"
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}
      >
        {friends.map(f => (
          <View key={f.userId} style={[s.card, { width: cardW, backgroundColor: C.mint }]}>
            <View style={s.row}>
              <View>
                <View style={s.liveAv}><Text style={s.liveAvTxt}>{f.username.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase()}</Text></View>
                <View style={s.liveDot} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{f.username} is running</Text>
                <Text style={[s.cardSub, { color: '#4E5A44' }]}>Live now · tap Watch to see them</Text>
              </View>
            </View>
            <View style={s.row}>
              <Pressable style={[s.pill, { backgroundColor: C.lime }]} onPress={() => onCheer(f)} accessibilityRole="button" accessibilityLabel={`Cheer ${f.username}`}>
                <Text style={[s.pillTxt, { color: C.alwaysDark, fontFamily: Fonts.bold }]}>👏 Cheer</Text>
              </Pressable>
              <Pressable style={[s.pill, { backgroundColor: C.card }]} onPress={() => navigation.navigate('Main', { screen: 'Map' })} accessibilityRole="button">
                <Text style={s.pillTxt}>Watch live</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {challenges.map(c => (
          <Pressable
            key={c.id} style={[s.card, { width: cardW, backgroundColor: C.amberBg }]}
            onPress={() => navigation.navigate('ChallengeDetail', { id: c.id })} accessibilityRole="button"
          >
            <Text style={[s.kicker, { color: C.amber }]}>CHALLENGE · {daysLeft(c.endsAt).toUpperCase()}</Text>
            <Text style={s.cardTitle} numberOfLines={2}>{c.title}</Text>
            <Text style={[s.cardSub, { color: C.amber }]}>
              {c.target} {METRIC_LABEL[c.metric].unit} · {c.people} {c.people === 1 ? 'runner' : 'runners'}
            </Text>
          </Pressable>
        ))}

        {events.map(e => (
          <Pressable key={e.id} style={[s.card, { width: cardW, backgroundColor: C.lavender }]} onPress={() => navigation.navigate('Events')} accessibilityRole="button">
            <Text style={[s.kicker, { color: C.lavenderInk }]}>{`${e.date} · ${e.time}`.toUpperCase()}</Text>
            <Text style={s.cardTitle} numberOfLines={2}>{e.title}</Text>
            <Text style={[s.cardSub, { color: C.lavenderInk }]} numberOfLines={1}>
              {e.participants} going{e.location ? ` · ${e.location}` : ''}
            </Text>
            <View style={s.goingPill}><Text style={s.goingTxt}>Going ✓</Text></View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    head:      { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    title:     { fontFamily: Fonts.semiBold, fontSize: 20, letterSpacing: -0.3, color: C.t1 },
    all:       { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    card:      { borderRadius: 26, padding: 16, gap: 10, minHeight: 132 },
    row:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
    liveDot:   { position: 'absolute', right: -1, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: C.brandGreen, borderWidth: 2, borderColor: C.mint },
    kicker:    { fontFamily: Fonts.bold, fontSize: 12 },
    liveAv:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    liveAvTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#17181A' },
    goingPill: { alignSelf: 'flex-start', height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.alwaysDark, justifyContent: 'center' },
    goingTxt:  { fontFamily: Fonts.medium, fontSize: 13, color: C.alwaysLight },
    cardTitle: { fontFamily: Fonts.medium, fontSize: 18, color: C.t1 },
    cardSub:   { fontFamily: Fonts.regular, fontSize: 13 },
    pill:      { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    pillTxt:   { fontFamily: Fonts.medium, fontSize: 13, color: C.t1 },
  });
}
