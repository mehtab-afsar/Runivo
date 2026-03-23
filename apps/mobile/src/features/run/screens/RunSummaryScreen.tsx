/**
 * RunSummaryScreen — post-run results. ≤80 lines.
 * Fetches: shoes, health sync via useRunSummary.
 * Renders: RunStatGrid, SplitsList, RewardsCard, PostRunInsightsCard,
 *          ShoeChip, ShoeDrawer, FuelCard, PostRunActions.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, Flame } from 'lucide-react-native';

import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useRunSummary } from '../hooks/useRunSummary';
import RunStatGrid          from '../components/RunStatGrid';
import SplitsList           from '../components/SplitsList';
import RewardsCard          from '../components/RewardsCard';
import PostRunInsightsCard  from '../components/PostRunInsightsCard';
import ShoeChip             from '../components/ShoeChip';
import ShoeDrawer           from '../components/ShoeDrawer';
import PostRunActions       from '../components/PostRunActions';
import LevelUpOverlay      from '../components/LevelUpOverlay';

const C = { bg: '#EDEAE5', black: '#0A0A0A', white: '#FFFFFF', t3: '#A39E98', red: '#E8435A', orange: '#F97316' };
const FI = 'PlayfairDisplay_400Regular_Italic';
const FS = 'Barlow_600SemiBold'; const FL = 'Barlow_300Light'; const FM = 'Barlow_500Medium';
type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'RunSummary'>;

function fmt(s: number) { const m = Math.floor(s/60); return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function pace(p: number) { const m = Math.floor(p); return `${m}:${String(Math.floor((p-m)*60)).padStart(2,'0')}`; }

export default function RunSummaryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { player, xpProgress } = usePlayerStats();
  const { runId, runData: passedData } = route.params;

  const { runData, splits, runShoe, allShoes, showShoeDrawer, setShowShoeDrawer, selectShoe } =
    useRunSummary(runId, passedData);

  const [showLevelUp, setShowLevelUp] = useState(true);

  const calories   = Math.round(runData.distance * 60 * 0.95);
  const heading    = !runData.success ? `${runData.actionType || 'Action'} Failed`
    : runData.actionType === 'attack' ? 'Territory Conquered'
    : runData.actionType === 'defend' ? 'Territory Defended'
    : runData.actionType === 'fortify' ? 'Territory Fortified' : 'Run Complete';
  const actionLbl  = runData.actionType === 'attack' ? 'Attack Run'
    : runData.actionType === 'defend' ? 'Defence Run'
    : runData.actionType === 'fortify' ? 'Fortify Run' : 'Training Run';
  const dateLbl    = new Date(runData.startTime ?? Date.now()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const xpPct      = xpProgress.percent;
  const xpPrevPct  = Math.max(0, xpPct - ((runData.xpEarned ?? 0) / Math.max(xpProgress.needed, 1)) * 100);

  const gridStats = [
    { label: 'Distance', value: runData.distance.toFixed(2), unit: 'km' },
    { label: 'Time',     value: fmt(runData.duration) },
    { label: 'Avg Pace', value: pace(runData.pace), unit: '/km' },
    { label: 'Claimed',  value: String(runData.success ? (runData.territoriesClaimed || 0) : 0) },
  ];

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      <Pressable onPress={() => navigation.navigate('Main')} style={[ss.close, { top: insets.top + 12 }]} hitSlop={12}>
        <X size={14} strokeWidth={2.5} color={C.black} />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={ss.title}>
          <Text style={ss.type}>{actionLbl.toUpperCase()}</Text>
          <Text style={[ss.heading, { color: runData.success ? C.black : C.red }]}>{heading}</Text>
          <Text style={ss.date}>{dateLbl}</Text>
        </View>

        <View style={ss.card}><RunStatGrid stats={gridStats} /></View>
        {splits.length > 0 && <View style={ss.card}><SplitsList splits={splits} /></View>}
        {runData.success && (
          <RewardsCard
            xp={runData.xpEarned ?? 0} coins={runData.coinsEarned ?? 0} bonusCoins={runData.bonusCoins ?? 0}
            level={player?.level ?? 1} xpProgress={xpProgress.progress} xpNeeded={xpProgress.needed}
            xpPercent={xpPct} xpPrevPercent={xpPrevPct}
            leveledUp={runData.leveledUp} preRunLevel={runData.preRunLevel} newLevel={runData.newLevel}
            completedMissions={runData.completedMissions}
          />
        )}
        <PostRunInsightsCard distance={runData.distance} pace={runData.pace} duration={runData.duration} />
        <ShoeChip shoe={runShoe} onPress={() => allShoes.length > 0 && setShowShoeDrawer(true)} />
        {runData.distance >= 1 && (
          <View style={ss.fuel}>
            <View style={ss.fuelIcon}><Flame size={16} color={C.orange} strokeWidth={1.5} /></View>
            <View style={{ flex: 1 }}>
              <Text style={ss.fuelTitle}>You burned ~{calories} kcal</Text>
              <Text style={ss.fuelSub}>Priority next 2hrs: 35-40g protein + 60-80g carbs</Text>
            </View>
            <Pressable style={ss.fuelBtn} onPress={() => navigation.navigate('CalorieTracker')}>
              <Text style={ss.fuelBtnText}>+ LOG</Text>
            </Pressable>
          </View>
        )}
        <PostRunActions
          onDone={() => navigation.navigate('Main')}
          onShare={() => Alert.alert('Share', 'Share functionality coming soon')}
          onSave={() => {}}
        />
      </ScrollView>

      {showShoeDrawer && (
        <ShoeDrawer shoes={allShoes} selectedShoe={runShoe} bottomInset={insets.bottom} onSelect={selectShoe} onClose={() => setShowShoeDrawer(false)} />
      )}

      <LevelUpOverlay
        visible={showLevelUp && !!runData.leveledUp}
        fromLevel={runData.preRunLevel ?? 1}
        toLevel={runData.newLevel ?? 2}
        onDone={() => setShowLevelUp(false)}
      />
    </View>
  );
}

const ss = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  close:      { position: 'absolute', right: 16, zIndex: 20, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  title:      { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 20 },
  type:       { fontFamily: FS, fontSize: 10, letterSpacing: 1.4, color: C.t3, marginBottom: 4 },
  heading:    { fontFamily: FI, fontSize: 28, lineHeight: 32, marginBottom: 6 },
  date:       { fontFamily: FL, fontSize: 12, color: C.t3 },
  card:       { marginHorizontal: 16, marginBottom: 12 },
  fuel:       { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(249,115,22,0.06)', borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(249,115,22,0.2)' },
  fuelIcon:   { width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  fuelTitle:  { fontFamily: FM, fontSize: 13, color: C.black },
  fuelSub:    { fontFamily: FL, fontSize: 11, color: C.t3, marginTop: 1 },
  fuelBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.black },
  fuelBtnText:{ fontFamily: FS, fontSize: 10, color: C.white, letterSpacing: 0.4 },
});
