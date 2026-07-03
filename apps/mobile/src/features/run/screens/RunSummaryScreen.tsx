import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, Fire, Diamond, Play } from 'phosphor-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import type { RootStackParamList } from '@navigation/AppNavigator';
import { useRunSummary } from '../hooks/useRunSummary';
import RunStatGrid          from '../components/RunStatGrid';
import SplitsList           from '../components/SplitsList';
import PostRunInsightsCard  from '../components/PostRunInsightsCard';
import ShoeChip             from '../components/ShoeChip';
import ShoeDrawer           from '../components/ShoeDrawer';
import PostRunActions       from '../components/PostRunActions';
import SaveRouteSheet       from '../components/SaveRouteSheet';
import RunRouteMap          from '../components/RunRouteMap';
import { buildStoryDataUrl } from '../services/storyCardGenerator';
import { getNutritionProfile } from '@shared/services/store';
import { computeRunnerRank } from '@shared/services/claimEngine';
import { GAME_CONFIG } from '@shared/services/config';
import { TIER_CONFIG, formatArea } from '@shared/constants/territory';
import { useTheme, Colors, feedback, type AppColors } from '@theme';
import AwardUnlockSheet from '../components/AwardUnlockSheet';
import type { RunnerRank } from '@shared/types/game';

import MapLibreGL from '@maplibre/maplibre-react-native';

const FI = 'PlayfairDisplay_400Regular_Italic';
const FS = 'Barlow_600SemiBold';
const FL = 'Barlow_300Light';
const FM = 'Barlow_500Medium';
type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'RunSummary'>;

function fmt(s: number) { const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function pace(p: number) { const m = Math.floor(p); return `${m}:${String(Math.floor((p - m) * 60)).padStart(2, '0')}`; }

function polygonCamera(polygon: [number, number][]): { centerCoordinate: [number, number]; zoomLevel: number } {
  if (polygon.length === 0) return { centerCoordinate: [0, 0], zoomLevel: 14 };
  const lngs = polygon.map(p => p[0]);
  const lats  = polygon.map(p => p[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat  = Math.min(...lats),  maxLat  = Math.max(...lats);
  const span = Math.max(maxLng - minLng, maxLat - minLat);
  return {
    centerCoordinate: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
    zoomLevel: Math.min(17, Math.max(13, Math.log2(0.008 / (span + 0.0001)))),
  };
}

const RANK_ORDER: RunnerRank[] = ['pacer', 'strider', 'chaser', 'hunter', 'sovereign'];

function rankProgress(totalPace: number, rank: RunnerRank) {
  if (rank === 'sovereign') return { pct: 1, nextName: '', paceToNext: 0 };
  const idx      = RANK_ORDER.indexOf(rank);
  const current  = GAME_CONFIG.RUNNER_RANK_THRESHOLDS[rank];
  const nextRank = RANK_ORDER[idx + 1] as RunnerRank;
  const next     = GAME_CONFIG.RUNNER_RANK_THRESHOLDS[nextRank];
  const span     = next - current;
  return {
    pct:       span > 0 ? Math.min(1, (totalPace - current) / span) : 0,
    nextName:  nextRank.charAt(0).toUpperCase() + nextRank.slice(1),
    paceToNext: Math.max(0, next - totalPace),
  };
}

function BreakdownRow({ label, value, ss }: { label: string; value: number; ss: ReturnType<typeof mkStyles> }) {
  if (value <= 0) return null;
  return (
    <View style={ss.bdRow}>
      <Text style={ss.bdLabel}>{label}</Text>
      <Text style={ss.bdValue}>+{value} PACE</Text>
    </View>
  );
}

export default function RunSummaryScreen() {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { runId, runData: passedData } = route.params;

  const { runData, splits, runShoe, allShoes, shoeTotalKm, showShoeDrawer, setShowShoeDrawer, selectShoe } =
    useRunSummary(runId, passedData);

  const [showSaveRoute, setShowSaveRoute]             = useState(false);
  const [weightKg, setWeightKg]                       = useState(70);
  const [hasNutritionProfile, setHasNutritionProfile] = useState(false);
  const [showAward, setShowAward]                     = useState(false);

  useEffect(() => {
    getNutritionProfile().then(p => {
      if (p?.weightKg) { setWeightKg(p.weightKg); setHasNutritionProfile(true); }
    }).catch(() => {});
  }, []);

  // ── Animation refs ────────────────────────────────────────────────────────
  const [paceDisplay, setPaceDisplay] = useState(0);
  const [expanded, setExpanded]       = useState(false);
  const breakdownOpen = useRef(new Animated.Value(0)).current;
  const territoryAnim = useRef(new Animated.Value(0)).current;
  const rankUpScale   = useRef(new Animated.Value(0.85)).current;
  const rankUpOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale    = useRef(new Animated.Value(0)).current;

  const paceEarned      = runData.paceEarned ?? 0;
  const paceTotalEarned = runData.paceTotalEarned ?? 0;
  const prevRank        = computeRunnerRank(Math.max(0, paceTotalEarned - paceEarned));
  const currentRank     = runData.runnerRank ?? 'pacer';
  const rankedUp        = paceEarned > 0 && prevRank !== currentRank;

  // PACE count-up: 300ms delay, 800ms ease-out cubic
  useEffect(() => {
    if (paceEarned <= 0) return;
    const startTime = Date.now() + 300;
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) return;
      const t = Math.min(1, elapsed / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      setPaceDisplay(Math.round(eased * paceEarned));
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Territory slide-up + rank-up spring + awards
  useEffect(() => {
    if (runData.territory) {
      setTimeout(() => {
        Animated.timing(territoryAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        Animated.spring(badgeScale, { toValue: 1, damping: 12, stiffness: 200, useNativeDriver: true }).start();
      }, 700);
    }
    if (rankedUp) {
      setTimeout(() => {
        feedback.rankUp();
        Animated.parallel([
          Animated.spring(rankUpScale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
          Animated.timing(rankUpOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
      }, 900);
    }
    const newAwards = (runData as unknown as Record<string, unknown>).newAwards as string[] | undefined;
    if (newAwards && newAwards.length > 0) {
      setTimeout(() => {
        setShowAward(true);
        feedback.awardUnlock();
      }, rankedUp ? 2800 : 900);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleBreakdown = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.timing(breakdownOpen, { toValue, duration: 220, useNativeDriver: false }).start();
  };

  // ── Computed display values ───────────────────────────────────────────────
  const calories = useMemo(() => {
    const speedKmh = runData.duration > 0 ? (runData.distance / runData.duration) * 3600 : 0;
    const met = Math.max(3.5, Math.min(18, 2.5 + 0.9 * speedKmh));
    return Math.round((met * weightKg * runData.duration) / 3600);
  }, [runData.distance, runData.duration, weightKg]);

  const heading = !runData.success ? `${runData.actionType || 'Action'} Failed`
    : runData.actionType === 'attack'  ? 'Territory Conquered'
    : runData.actionType === 'defend'  ? 'Territory Defended'
    : runData.actionType === 'fortify' ? 'Territory Fortified' : 'Run Complete';
  const actionLbl = runData.actionType === 'attack'  ? 'Attack Run'
    : runData.actionType === 'defend'  ? 'Defence Run'
    : runData.actionType === 'fortify' ? 'Fortify Run' : 'Training Run';
  const dateLbl = new Date(runData.startTime ?? Date.now()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const gridStats = [
    { label: 'Distance', value: runData.distance.toFixed(2), unit: 'km' },
    { label: 'Time',     value: fmt(runData.duration) },
    { label: 'Avg Pace', value: pace(runData.pace), unit: '/km' },
    { label: 'Claimed',  value: String(runData.success ? (runData.territoriesClaimed || 0) : 0) },
    ...(runData.elevationGainM && runData.elevationGainM > 0
      ? [{ label: 'Elevation', value: `↑ ${runData.elevationGainM}`, unit: 'm' }]
      : []),
  ];

  // Runner rank progress
  const displayRank = currentRank.charAt(0).toUpperCase() + currentRank.slice(1);
  const { pct, nextName, paceToNext } = rankProgress(paceTotalEarned, currentRank);

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      <Pressable
        onPress={() => navigation.navigate('Main')}
        style={[ss.close, { top: insets.top + 12 }]}
        hitSlop={12}
      >
        <X size={14} weight="bold" color={C.black} />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={ss.titleSection}>
          <Text style={ss.type}>{actionLbl.toUpperCase()}</Text>
          <Text style={[ss.heading, { color: runData.success ? C.black : C.red }]}>{heading}</Text>
          <Text style={ss.date}>{dateLbl}</Text>
        </View>

        <View style={ss.mapWrapOuter}>
          <RunRouteMap route={runData.route ?? []} />
          {(runData.route?.length ?? 0) >= 10 && (
            <Pressable
              style={ss.replayBtn}
              onPress={() => navigation.navigate('RunReplay', {
                runId,
                route: runData.route!,
                durationSec: runData.duration,
                pace: runData.pace,
              })}
            >
              <Play size={11} color="#fff" weight="fill" />
              <Text style={ss.replayBtnText}>Replay</Text>
            </Pressable>
          )}
        </View>
        <View style={ss.card}><RunStatGrid stats={gridStats} /></View>

        {/* ── Section A: PACE Earned ─────────────────────────────────────── */}
        {paceEarned === 0 && (
          <View style={[ss.card, ss.paceCard]}>
            <Text style={ss.paceLabel}>PACE EARNED</Text>
            <Text style={ss.paceZero}>
              {runData.cappedAt != null
                ? 'Weekly cap already reached · resets Monday'
                : "Walks don’t earn PACE · start a run to earn"}
            </Text>
          </View>
        )}
        {paceEarned > 0 && (
          <Pressable style={[ss.card, ss.paceCard]} onPress={toggleBreakdown}>
            <Text style={ss.paceLabel}>PACE EARNED</Text>
            <View style={ss.paceBigRow}>
              <Text style={ss.paceBig}>{paceDisplay}</Text>
              <Text style={ss.paceSuffix}>PACE</Text>
            </View>
            <Animated.View style={{
              maxHeight: breakdownOpen.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }),
              overflow: 'hidden',
            }}>
              <View style={ss.breakdownRows}>
                <BreakdownRow label="Distance"     value={runData.paceBreakdown?.fromDistance ?? 0} ss={ss} />
                <BreakdownRow label="New zones"    value={runData.paceBreakdown?.fromNewZones ?? 0} ss={ss} />
                <BreakdownRow label="Zones stolen" value={runData.paceBreakdown?.fromStolenZones ?? 0} ss={ss} />
                <BreakdownRow label="Streak bonus" value={runData.paceBreakdown?.fromStreak ?? 0} ss={ss} />
                {runData.cappedAt != null && (
                  <Text style={ss.capRow}>Weekly cap reached · resets Monday</Text>
                )}
              </View>
            </Animated.View>
            <Text style={ss.expandHint}>{expanded ? '▲ hide' : '▼ breakdown'}</Text>
          </Pressable>
        )}

        {/* ── Section B: Territory Captured ─────────────────────────────── */}
        {runData.territory != null && (() => {
          const t   = runData.territory!;
          const tc  = TIER_CONFIG[t.tier];
          const cam = polygonCamera(t.polygon);
          const geoJSON = {
            type: 'FeatureCollection' as const,
            features: [{
              type: 'Feature' as const,
              geometry: { type: 'Polygon' as const, coordinates: [t.polygon] },
              properties: {},
            }],
          };
          return (
            <Animated.View style={[ss.card, {
              opacity: territoryAnim,
              transform: [{ translateY: territoryAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }]}>
              <View style={ss.territoryCard}>
                <Text style={ss.cardLabel}>TERRITORY CAPTURED</Text>
                <View style={ss.mapWrap}>
                  <MapLibreGL.MapView
                      style={{ flex: 1 }}
                      mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                      logoEnabled={false}
                      attributionEnabled={false}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      <MapLibreGL.Camera
                        centerCoordinate={cam.centerCoordinate}
                        zoomLevel={cam.zoomLevel}
                        animationDuration={0}
                      />
                      <MapLibreGL.ShapeSource id="territory" shape={geoJSON}>
                        <MapLibreGL.FillLayer
                          id="territory-fill"
                          style={{ fillColor: Colors.red, fillOpacity: 0.35 }}
                        />
                        <MapLibreGL.LineLayer
                          id="territory-line"
                          style={{ lineColor: Colors.red, lineWidth: 2, lineOpacity: 0.8 }}
                        />
                      </MapLibreGL.ShapeSource>
                    </MapLibreGL.MapView>
                  </View>
                <View style={ss.territoryFooter}>
                  <Text style={ss.territoryArea}>{formatArea(t.areaM2)}</Text>
                  <Animated.View style={{ transform: [{ scale: badgeScale }] }}>
                    <View style={[ss.tierBadge, { backgroundColor: tc.bg }]}>
                      <Text style={[ss.tierTxt, { color: tc.fg }]}>{tc.label}</Text>
                    </View>
                  </Animated.View>
                </View>
                {t.isLoopFill && (
                  <View style={ss.loopRow}>
                    <View style={[ss.loopDot, { backgroundColor: C.red }]} />
                    <Text style={ss.loopTxt}>Park capture — full interior claimed</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })()}

        {/* ── Section C: Runner Rank ─────────────────────────────────────── */}
        <View style={[ss.card, ss.rankCard]}>
          <Text style={ss.cardLabel}>RUNNER RANK</Text>
          {rankedUp && (
            <Animated.View style={[ss.rankUpBanner, {
              transform: [{ scale: rankUpScale }],
              opacity: rankUpOpacity,
            }]}>
              <Text style={ss.rankUpText}>Rank up — you’re now a {displayRank}</Text>
            </Animated.View>
          )}
          <View style={ss.rankRow}>
            <Diamond size={16} color={C.red} weight="light" />
            <Text style={ss.rankName}>{displayRank}</Text>
          </View>
          {currentRank !== 'sovereign' ? (
            <>
              <View style={ss.progressOuter}>
                <View style={[ss.progressInner, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={ss.rankSub}>{paceToNext} PACE to {nextName}</Text>
            </>
          ) : (
            <Text style={ss.rankSub}>Maximum rank achieved</Text>
          )}
        </View>

        {splits.length > 0 && <View style={ss.card}><SplitsList splits={splits} /></View>}
        <PostRunInsightsCard runId={runId} distance={runData.distance} pace={runData.pace} duration={runData.duration} />
        <ShoeChip
          shoe={runShoe}
          totalKm={runShoe ? shoeTotalKm : undefined}
          onPress={() => allShoes.length > 0 && setShowShoeDrawer(true)}
        />
        {runData.distance >= 1 && (
          <View style={ss.fuel}>
            <View style={ss.fuelIcon}><Fire size={16} color={C.orange} weight="light" /></View>
            <View style={{ flex: 1 }}>
              <Text style={ss.fuelTitle}>~{calories} kcal (est.)</Text>
              <Text style={ss.fuelSub}>
                {hasNutritionProfile
                  ? `~${Math.round(runData.distance * 2)}g protein · ~${Math.round(runData.distance * 4)}g carbs within 2hrs`
                  : 'Refuel within 2 hours'}
              </Text>
            </View>
            <Pressable style={ss.fuelBtn} onPress={() => navigation.navigate('CalorieTracker', { burnKcal: calories })}>
              <Text style={ss.fuelBtnText}>+ LOG</Text>
            </Pressable>
          </View>
        )}
        <PostRunActions
          onDone={() => navigation.navigate('Main')}
          onShare={async () => {
            const available = await Sharing.isAvailableAsync();
            if (!available) { Alert.alert('Sharing not available on this device'); return; }
            try {
              const dataUrl = buildStoryDataUrl({
                distance:    runData.distance.toFixed(2),
                duration:    fmt(runData.duration),
                pace:        pace(runData.pace),
                paceEarned:  runData.paceEarned ?? 0,
                heading,
                actionType:  runData.actionType,
                route:       runData.route,
                runnerRank:  currentRank,
              });
              const base64 = dataUrl.replace(/^data:image\/svg\+xml;base64,/, '');
              const fileUri = FileSystem.cacheDirectory + `run_${runId}.svg`;
              await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
              await Sharing.shareAsync(fileUri, { mimeType: 'image/svg+xml', dialogTitle: 'Share your run' });
            } catch {
              Alert.alert('Could not share', 'Please try again.');
            }
          }}
          onSaveImage={async () => {
            try {
              const dataUrl = buildStoryDataUrl({
                distance:    runData.distance.toFixed(2),
                duration:    fmt(runData.duration),
                pace:        pace(runData.pace),
                paceEarned:  runData.paceEarned ?? 0,
                heading,
                actionType:  runData.actionType,
                route:       runData.route,
                runnerRank:  currentRank,
              });
              const base64 = dataUrl.replace(/^data:image\/svg\+xml;base64,/, '');
              const fileUri = FileSystem.cacheDirectory + `runivo_run_${Date.now()}.svg`;
              await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { mimeType: 'image/svg+xml', dialogTitle: 'Save run card' });
              }
            } catch {
              Alert.alert('Could not save', 'Please try again.');
            }
          }}
          onSave={() => setShowSaveRoute(true)}
          canSave={(runData.route?.length ?? 0) >= 2}
        />
      </ScrollView>

      {showShoeDrawer && (
        <ShoeDrawer
          shoes={allShoes}
          selectedShoe={runShoe}
          bottomInset={insets.bottom}
          onSelect={selectShoe}
          onClose={() => setShowShoeDrawer(false)}
        />
      )}

      <SaveRouteSheet
        visible={showSaveRoute}
        gpsPoints={runData.route ?? []}
        distanceM={runData.distance * 1000}
        durationSec={runData.duration}
        sourceRunId={runId}
        onClose={() => setShowSaveRoute(false)}
      />

      <AwardUnlockSheet
        visible={showAward}
        onClose={() => setShowAward(false)}
        awards={((runData as unknown as Record<string, unknown>).newAwards as string[]) ?? []}
      />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: C.bg },
    close:        { position: 'absolute', right: 16, zIndex: 20, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
    titleSection: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 20 },
    type:         { fontFamily: FS, fontSize: 10, letterSpacing: 1.4, color: C.t3, marginBottom: 4 },
    heading:      { fontFamily: FI, fontSize: 28, lineHeight: 32, marginBottom: 6 },
    date:         { fontFamily: FL, fontSize: 12, color: C.t3 },
    card:         { marginHorizontal: 16, marginBottom: 12 },

    // PACE card (dark bg)
    paceCard:      { backgroundColor: C.alwaysDark, borderRadius: 12, padding: 18 },
    paceLabel:     { fontFamily: FS, fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', marginBottom: 8 },
    paceBigRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    paceBig:       { fontFamily: 'Barlow_700Bold', fontSize: 52, color: C.white, lineHeight: 56, letterSpacing: -1 },
    paceSuffix:    { fontFamily: FL, fontSize: 20, color: 'rgba(255,255,255,0.45)', paddingBottom: 8 },
    paceZero:      { fontFamily: FL, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 20 },
    expandHint:    { fontFamily: FS, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginTop: 10, textTransform: 'uppercase' },
    breakdownRows: { paddingTop: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', marginTop: 12 },
    bdRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    bdLabel:       { fontFamily: FL, fontSize: 13, color: 'rgba(255,255,255,0.55)' },
    bdValue:       { fontFamily: FM, fontSize: 13, color: C.white },
    capRow:        { fontFamily: FL, fontSize: 11, color: '#EF9F27', marginTop: 6 },

    // Light-bg card label (territory + rank sections)
    cardLabel:     { fontFamily: FS, fontSize: 9, letterSpacing: 1.5, color: C.t3, marginBottom: 10, textTransform: 'uppercase' },

    // Territory card
    territoryCard:   { borderRadius: 12, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.white, padding: 14 },
    mapWrap:         { height: 160, borderRadius: 8, overflow: 'hidden' },
    mapFallback:     { height: 160, backgroundColor: C.surface, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    mapFallbackText: { fontFamily: FM, fontSize: 14, color: C.t2 },
    territoryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    territoryArea:   { fontFamily: FL, fontSize: 26, color: C.black, letterSpacing: -0.5 },
    tierBadge:       { borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
    tierTxt:         { fontFamily: FM, fontSize: 11, letterSpacing: 1 },
    loopRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    loopDot:         { width: 6, height: 6, borderRadius: 3 },
    loopTxt:         { fontFamily: FL, fontSize: 12, color: C.t2 },

    // Rank card
    rankCard:      { borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.white },
    rankUpBanner:  { backgroundColor: C.red, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 },
    rankUpText:    { fontFamily: FM, fontSize: 13, color: '#FFFFFF' },
    rankRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 10 },
    rankName:      { fontFamily: FI, fontSize: 24, color: C.black },
    progressOuter: { height: 6, borderRadius: 3, backgroundColor: C.border, marginBottom: 6 },
    progressInner: { height: 6, borderRadius: 3, backgroundColor: C.red },
    rankSub:       { fontFamily: FL, fontSize: 12, color: C.t3 },

    // Route map + replay
    mapWrapOuter: { position: 'relative' },
    replayBtn:    { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    replayBtnText: { fontWeight: '600', fontSize: 11, color: '#fff' },

    // Fuel card
    fuel:        { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(249,115,22,0.06)', borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(249,115,22,0.2)' },
    fuelIcon:    { width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
    fuelTitle:   { fontFamily: FM, fontSize: 13, color: C.black },
    fuelSub:     { fontFamily: FL, fontSize: 11, color: C.t3, marginTop: 1 },
    fuelBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.alwaysDark },
    fuelBtnText: { fontFamily: FS, fontSize: 10, color: C.white, letterSpacing: 0.4 },
  });
}
