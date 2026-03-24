import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W } = Dimensions.get('window');

import type { RootStackParamList } from '@navigation/AppNavigator';
import { useDashboard } from '../hooks/useDashboard';
import { XPRing } from '../components/XPRing';
import { TerritoryStats } from '../components/TerritoryStats';
import { MissionRow } from '../components/MissionRow';
import { RecentRunRow } from '../components/RecentRunRow';
import { DashboardPills } from '../components/DashboardPills';
import { BentoCard } from '../components/BentoCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = { bg: '#F8F6F3', red: '#D93518', t3: '#ADADAD', black: '#0A0A0A', white: '#FFFFFF', border: '#DDD9D4' };

function HeroCarousel({
  weeklyKm, weeklyGoal, caloriesConsumed, calorieGoal,
  onGoCalories,
}: {
  weeklyKm: number; weeklyGoal: number;
  caloriesConsumed: number; calorieGoal: number;
  onGoCalories: () => void;
}) {
  const [page, setPage] = useState(0);
  const sw = SCREEN_W - 44; // padded card width
  const weeklyPct = Math.min(weeklyKm / Math.max(weeklyGoal, 1), 1);
  const calPct    = Math.min(caloriesConsumed / Math.max(calorieGoal, 1), 1);
  const calColor  = calPct > 1.05 ? '#C25A00' : calPct >= 0.9 ? '#D93518' : '#1A6B40';

  return (
    <View style={{ marginHorizontal: 22, marginBottom: 18 }}>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        style={{ borderRadius: 16, overflow: 'hidden' }}
        onScroll={e => setPage(Math.round(e.nativeEvent.contentOffset.x / sw))}
        scrollEventThrottle={16}
        snapToInterval={sw}
        decelerationRate="fast"
      >
        {/* Card 1: Weekly Goal */}
        <View style={[hc.card, { width: sw }]}>
          <Text style={hc.cardLabel}>WEEKLY GOAL</Text>
          <View style={hc.row}>
            <Text style={hc.bigVal}>{weeklyKm.toFixed(1)}</Text>
            <Text style={hc.unit}> / {weeklyGoal} km</Text>
          </View>
          <View style={hc.track}>
            <View style={[hc.fill, { width: `${weeklyPct * 100}%` as `${number}%`, backgroundColor: C.red }]} />
          </View>
          <Text style={hc.sub}>{weeklyPct >= 1 ? '✓ Goal reached!' : `${(weeklyGoal - weeklyKm).toFixed(1)} km remaining`}</Text>
        </View>

        {/* Card 2: Calorie Tracker */}
        <Pressable style={[hc.card, { width: sw }]} onPress={onGoCalories}>
          <Text style={hc.cardLabel}>TODAY'S CALORIES</Text>
          <View style={hc.row}>
            <Text style={[hc.bigVal, { color: calColor }]}>{caloriesConsumed.toLocaleString()}</Text>
            <Text style={hc.unit}> / {calorieGoal} kcal</Text>
          </View>
          <View style={hc.track}>
            <View style={[hc.fill, { width: `${Math.min(calPct, 1) * 100}%` as `${number}%`, backgroundColor: calColor }]} />
          </View>
          <Text style={hc.sub}>Tap to log food →</Text>
        </Pressable>
      </ScrollView>

      {/* Dots */}
      <View style={hc.dots}>
        {[0, 1].map(i => (
          <View key={i} style={[hc.dot, page === i && hc.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const hc = StyleSheet.create({
  card:     { backgroundColor: C.white, borderRadius: 16, borderWidth: 0.5, borderColor: C.border, padding: 16 },
  cardLabel:{ fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1, color: C.t3, marginBottom: 8 },
  row:      { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  bigVal:   { fontFamily: 'Barlow_600SemiBold', fontSize: 28, color: C.black },
  unit:     { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t3 },
  track:    { height: 4, backgroundColor: '#E8E4DF', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  fill:     { height: '100%', borderRadius: 2 },
  sub:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  dots:     { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot:      { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.border },
  dotActive:{ backgroundColor: C.black },
});

export default function DashboardScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const dash       = useDashboard();

  const go = (screen: string) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(screen as any); };

  if (dash.loading || !dash.player) {
    return <View style={[ss.fill, { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }]}><Text style={ss.loadText}>runivo</Text></View>;
  }

  const initials = dash.player.username?.slice(0, 2).toUpperCase() ?? 'RU';
  const h = new Date().getHours();
  const greeting = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';

  return (
    <View style={[ss.fill, { backgroundColor: C.bg }]}>

      <ScrollView style={ss.fill} contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }} showsVerticalScrollIndicator={false}>
        <View style={ss.header}>
          <View style={{ flex: 1 }}>
            <Text style={ss.greeting}>{greeting.toUpperCase()}</Text>
            <Text style={ss.username}>{dash.player.username}</Text>
          </View>
          <XPRing initials={initials} xpPct={dash.xpProgress.percent} />
        </View>

        <DashboardPills xp={dash.player.xp} energy={dash.player.energy} streakDays={dash.player.streakDays || 0} />

        <HeroCarousel
          weeklyKm={dash.weeklyKm} weeklyGoal={dash.weeklyGoal}
          caloriesConsumed={dash.caloriesConsumed} calorieGoal={dash.calorieGoal}
          onGoCalories={() => go('CalorieTracker')}
        />

        <BentoCard weeklyKm={dash.weeklyKm} goalKm={dash.weeklyGoal} runDays={dash.runDays} onNavigate={go} onStartRun={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Run' as any); }} />

        <View style={ss.section}>
          <View style={ss.sectionHead}><Text style={ss.sectionTitle}>EMPIRE</Text><Pressable onPress={() => go('TerritoryMap')}><Text style={ss.sectionAction}>View map →</Text></Pressable></View>
          <TerritoryStats ownedCount={dash.ownedCount} weakZones={dash.weakZones.length} avgDefense={dash.avgDefense} dailyIncome={dash.dailyIncome} />
        </View>

        <View style={ss.section}>
          <View style={ss.sectionHead}><Text style={ss.sectionTitle}>MISSIONS</Text><Pressable onPress={() => go('Missions')}><Text style={ss.sectionAction}>Change →</Text></Pressable></View>
          <View style={ss.missionCard}>
            <Text style={ss.cardLabel}>TODAY'S CHALLENGE</Text>
            {dash.missions.map((m, i) => <MissionRow key={m.id} mission={m} isLast={i === dash.missions.length - 1} />)}
          </View>
        </View>

        <View style={ss.section}>
          <View style={ss.sectionHead}><Text style={ss.sectionTitle}>RECENT RUNS</Text><Pressable onPress={() => go('History')}><Text style={ss.sectionAction}>See all →</Text></Pressable></View>
          <View style={ss.runsCard}>
            {dash.recentRuns.length > 0
              ? dash.recentRuns.map((r, i) => <RecentRunRow key={r.id} run={r} isLast={i === dash.recentRuns.length - 1} onPress={run => navigation.navigate('RunSummary' as any, { runId: run.id })} />)
              : <View style={ss.empty}><Text style={ss.emptyText}>No runs yet</Text><Pressable onPress={() => navigation.navigate('Run' as any)}><Text style={ss.emptyCta}>Start running →</Text></Pressable></View>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  fill:         { flex: 1 },
  loadText:     { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, fontStyle: 'italic' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 20, marginBottom: 18 },
  greeting:     { fontFamily: 'Barlow_400Regular', fontSize: 10, letterSpacing: 1, color: '#ADADAD', marginBottom: 4 },
  username:     { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 26, color: '#0A0A0A', lineHeight: 30, fontStyle: 'italic' },
  section:      { paddingHorizontal: 22, marginBottom: 28 },
  sectionHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: 'Barlow_500Medium', fontSize: 11, letterSpacing: 1, color: C.t3 },
  sectionAction:{ fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
  missionCard:  { backgroundColor: '#0A0A0A', borderRadius: 20, padding: 18 },
  cardLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.35)', marginBottom: 14 },
  runsCard:     { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 0.5, borderColor: '#DDD9D4', overflow: 'hidden' },
  empty:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  emptyText:    { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t3 },
  emptyCta:     { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.red },
});
