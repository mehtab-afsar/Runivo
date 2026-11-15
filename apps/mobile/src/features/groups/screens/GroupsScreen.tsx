/**
 * Groups tab (2026 redesign): Challenges, Clubs and Events under one roof,
 * like Strava's Groups. Each segment is the existing screen in its
 * `embedded` form, so the logic stays in one place.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { RootStackParamList } from '@navigation/AppNavigator';
import ChallengesScreen from '@features/challenges/screens/ChallengesScreen';
import ClubScreen from '@features/clubs/screens/ClubScreen';
import EventsScreen from '@features/events/screens/EventsScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Segment = 'challenges' | 'clubs' | 'events';
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'challenges', label: 'Challenges' },
  { key: 'clubs',      label: 'Clubs' },
  { key: 'events',     label: 'Events' },
];

export default function GroupsScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [seg, setSeg] = useState<Segment>('challenges');

  return (
    <View style={s.root}>
      <View style={[s.head, { paddingTop: insets.top + 10 }]}>
        <View style={s.titleRow}>
          <Text style={s.title} accessibilityRole="header">Groups</Text>
          <View style={s.actions}>
            <Pressable style={s.iconBtn} onPress={() => navigation.navigate('Feed')} accessibilityLabel="Your feed" accessibilityRole="button">
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M4 6h16M4 12h16M4 18h10" stroke={C.t1} strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <Pressable style={s.iconBtn} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Notifications" accessibilityRole="button">
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9.5a6 6 0 0 1 12 0c0 4.6 1.6 6.7 2.4 7.5H3.6c.8-.8 2.4-2.9 2.4-7.5Z" stroke={C.t1} strokeWidth={1.7} strokeLinejoin="round" />
                <Circle cx={12} cy={20} r={1.2} fill={C.t1} />
              </Svg>
            </Pressable>
          </View>
        </View>
        <View style={s.tabs} accessibilityRole="tablist">
          {SEGMENTS.map(t => {
            const on = t.key === seg;
            return (
              <Pressable
                key={t.key} style={[s.tab, on && s.tabOn]} onPress={() => setSeg(t.key)}
                accessibilityRole="tab" accessibilityState={{ selected: on }}
              >
                <Text style={[s.tabTxt, on && s.tabTxtOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {seg === 'challenges' && <ChallengesScreen embedded />}
        {seg === 'clubs' && <ClubScreen embedded />}
        {seg === 'events' && <EventsScreen embedded />}
      </View>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    head:     { backgroundColor: C.card, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    title:    { fontFamily: Fonts.semiBold, fontSize: 28, letterSpacing: -0.6, color: C.t1 },
    actions:  { flexDirection: 'row', gap: 8 },
    iconBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    tabs:     { flexDirection: 'row', marginHorizontal: -20 },
    tab:      { flex: 1, alignItems: 'center', paddingTop: 12, paddingBottom: 11, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabOn:    { borderBottomColor: C.t1 },
    tabTxt:   { fontFamily: Fonts.regular, fontSize: 15, color: C.t2 },
    tabTxtOn: { fontFamily: Fonts.semiBold, color: C.t1 },
  });
}
