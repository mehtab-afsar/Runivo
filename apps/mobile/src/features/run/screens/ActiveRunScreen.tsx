/**
 * ActiveRunScreen — live run view.
 * Data: useActiveRun (GPS, distance, pace, claim progress).
 * Navigation: buildRunSummaryParams helper.
 * UI: RunHUD, RunControls, ClaimToast, ClaimProgressRing, FinishConfirmSheet.
 * Gate: useFeatureGate enforces territory cap for free-tier users.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Play, Zap, Crown } from 'lucide-react-native';
import { useActiveRun }         from '../hooks/useActiveRun';
import { postRunSync }          from '@shared/services/sync';
import { buildRunSummaryParams } from '../services/runNavigationHelper';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useFeatureGate }     from '@features/subscription/hooks/useFeatureGate';
import ClaimToast         from '../components/ClaimToast';
import RunHUD             from '../components/RunHUD';
import RunControls        from '../components/RunControls';
import ClaimProgressRing  from '../components/ClaimProgressRing';
import FinishConfirmSheet from '../components/FinishConfirmSheet';
import BeatPacerChip      from '../components/BeatPacerChip';
import ActiveRunMapView   from '../components/ActiveRunMapView';
import { useBeatPacer }   from '../hooks/useBeatPacer';

const C = { bg:'#F7F6F4', black:'#0A0A0A', red:'#D93518', muted:'#6B6B6B', white:'#FFFFFF', mid:'#E0DFDD', green:'#1A6B40', amber:'#F59E0B' };
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ActiveRun'>;

export default function ActiveRunScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const ghostRoutePoints = route.params?.ghostRoutePoints;
  const run  = useActiveRun(route.params?.activityType ?? 'run');
  const gate = useFeatureGate();
  const flashAnim = useRef(new Animated.Value(0)).current;

  // When claim progress reaches 100% and user is at territory limit, navigate to
  // the subscription screen instead of silently failing on the server.
  const atTerritoryLimit =
    !gate.loading &&
    !gate.isPremium &&
    !gate.canClaimTerritory(run.playerTerritoryCount ?? 0);

  useEffect(() => {
    if (atTerritoryLimit && run.claimProgress >= 100 && run.isRunning) {
      Alert.alert(
        'Territory Limit Reached',
        `Free plan is capped at ${gate.territoryLimit} zones. Upgrade to claim unlimited territory.`,
        [
          { text: 'Keep Running', style: 'cancel' },
          { text: 'Upgrade', onPress: () => nav.navigate('Subscription') },
        ],
      );
    }
  // Only re-trigger when progress first hits 100 while at limit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atTerritoryLimit, run.claimProgress >= 100]);

  // Flash red border when territory is claimed
  useEffect(() => {
    if (!run.lastClaimEvent || run.lastClaimEvent.type !== 'claimed') return;
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [run.lastClaimEvent]);
  const [showConfirm, setShowConfirm] = useState(false);
  const pacer = useBeatPacer();

  const doFinish = async () => {
    setShowConfirm(false);
    const result = await run.finishRun();
    if (!result) return;
    await postRunSync();
    nav.replace('RunSummary', buildRunSummaryParams(result as Parameters<typeof buildRunSummaryParams>[0]));
  };

  const handleFinish = () => {
    if (run.distance < 0.05 && run.elapsed < 30) {
      Alert.alert('End Run?', "You haven't run far enough. End anyway?", [
        { text: 'Keep Running', style: 'cancel' },
        { text: 'End Run', style: 'destructive', onPress: doFinish },
      ]);
      return;
    }
    setShowConfirm(true);
  };

  const handleBack = () => {
    if (!run.isRunning) { nav.goBack(); return; }
    Alert.alert('Cancel Run?', 'Your run will be lost.', [
      { text: 'Keep Running', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: () => nav.goBack() },
    ]);
  };

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      <View style={ss.header}>
        <Pressable onPress={handleBack} style={ss.back} hitSlop={12}><Text style={ss.backTxt}>✕</Text></Pressable>
        <Text style={ss.title}>{!run.isRunning ? 'Ready to Run' : run.isPaused ? 'Paused' : 'Running'}</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={ss.map}>
        <ActiveRunMapView gpsPoints={run.gpsPoints} isRunning={run.isRunning} ghostRoutePoints={ghostRoutePoints} />
        {run.isRunning && (
          <View style={ss.gpsTag}>
            <View style={ss.gpsDot} />
            <Text style={ss.gpsTxt}>GPS Active · {run.gpsPoints.length} pts</Text>
          </View>
        )}
      </View>
      {/* Claim flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[ss.claimFlash, { opacity: flashAnim }]}
      />

      {run.isRunning && run.claimProgress > 0 && (
        <View style={ss.claimBar}>
          <View style={[ss.claimFill, { width: `${run.claimProgress}%` as `${number}%`, backgroundColor: atTerritoryLimit ? C.amber : C.red }]} />
          {atTerritoryLimit
            ? <View style={ss.claimLblRow}><Crown size={8} color={C.amber} strokeWidth={2} /><Text style={[ss.claimLbl, { color: C.amber }]}> UPGRADE TO CLAIM</Text></View>
            : <Text style={ss.claimLbl}>{Math.round(run.claimProgress)}% CLAIMING</Text>}
        </View>
      )}
      <ClaimToast event={run.lastClaimEvent} onDismiss={() => {}} />
      {run.gpsError && <View style={ss.errBanner}><Text style={ss.errTxt}>{run.gpsError}</Text></View>}
      {run.energyBlocked && run.isRunning && (
        <View style={ss.energyBanner}><Zap size={12} color={C.amber} strokeWidth={1.5} /><Text style={ss.energyTxt}>Energy depleted — run to regenerate</Text></View>
      )}
      <RunHUD distance={run.distance} pace={run.pace} elapsed={run.elapsed} energy={run.sessionEnergy ?? 0} claimProgress={run.claimProgress} />
      {run.isRunning && (
        <View style={ss.pacerWrap}>
          <BeatPacerChip bpm={pacer.bpm} enabled={pacer.enabled} onToggle={() => pacer.setEnabled(!pacer.enabled)} />
        </View>
      )}
      <ClaimProgressRing progress={run.claimProgress / 100} visible={run.isRunning && run.claimProgress > 0} />
      <View style={[ss.controls, { paddingBottom: insets.bottom + 16 }]}>
        {!run.isRunning
          ? <Pressable style={ss.startBtn} onPress={run.startRun}><Play size={28} color={C.white} strokeWidth={2} fill={C.white} /></Pressable>
          : <RunControls isPaused={run.isPaused} onPause={run.pauseRun} onResume={run.resumeRun} onStop={handleFinish} />}
      </View>
      {showConfirm && (
        <FinishConfirmSheet distance={run.distance} elapsed={run.elapsed} territoriesClaimed={run.territoriesClaimed}
          bottomInset={insets.bottom} onKeepRunning={() => setShowConfirm(false)} onFinish={doFinish} />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backTxt:     { fontFamily: 'Barlow_700Bold', fontSize: 16, color: C.muted },
  title:       { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: C.black, letterSpacing: 0.3 },
  map:         { flex: 1, overflow: 'hidden' },
  gpsTag:      { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  gpsDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  gpsTxt:      { fontFamily: 'Barlow_500Medium', fontSize: 10, color: C.white },
  claimBar:    { height: 4, backgroundColor: C.mid, flexDirection: 'row', alignItems: 'center' },
  claimFill:   { height: '100%', backgroundColor: C.red },
  claimLbl:    { position: 'absolute', right: 8, fontFamily: 'Barlow_600SemiBold', fontSize: 8, letterSpacing: 0.6, color: C.red },
  claimLblRow: { position: 'absolute', right: 8, flexDirection: 'row', alignItems: 'center' },
  errBanner:   { backgroundColor: '#FEF0EE', padding: 10, alignItems: 'center' },
  errTxt:      { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.red },
  energyBanner:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FDF6E8', padding: 8, paddingHorizontal: 16 },
  energyTxt:   { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#9E6800' },
  pacerWrap:   { position: 'absolute', top: 56, right: 16 },
  controls:    { backgroundColor: C.black, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 20, paddingHorizontal: 24 },
  startBtn:    { width: 72, height: 72, borderRadius: 36, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', shadowColor: C.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  claimFlash:  { ...StyleSheet.absoluteFillObject, borderWidth: 4, borderColor: '#D93518', borderRadius: 2, zIndex: 40, pointerEvents: 'none' } as any,
});
