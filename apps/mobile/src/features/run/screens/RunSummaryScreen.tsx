import { territoryPalette } from '@theme/territory';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Animated, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Diamond, CaretRight, PencilSimple } from 'phosphor-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import type { RootStackParamList } from '@navigation/AppNavigator';
import { useRunSummary } from '../hooks/useRunSummary';
import RunSummaryHero       from '../components/RunSummaryHero';
import SplitsList           from '../components/SplitsList';
import ActivityCharts       from '../components/ActivityCharts';
import PaceXSummaryCard     from '../components/PaceXSummaryCard';
import { sportFor }         from '../constants/activities';
import PostRunActions       from '../components/PostRunActions';
import SaveRouteSheet       from '../components/SaveRouteSheet';
import { buildStorySvg } from '../services/storyCardGenerator';
import { PngCapture, type PngCaptureHandle } from '../components/PngCapture';
import EditActivitySheet from '../components/EditActivitySheet';
import { AUDIENCES } from '../services/activityEditService';
import { activityTitle } from '@features/profile/utils/profileStats';
import { getNutritionProfile, getRunById, getPlayer, getRuns, type StoredRun } from '@shared/services/store';
import { isPlus } from '@shared/engine/entitlements';
import { usePaywallMoment } from '@features/subscription/hooks/usePaywallMoment';
import { computeRunnerRank } from '@shared/services/claimEngine';
import { GAME_CONFIG } from '@shared/services/config';
import { TIER_CONFIG, formatArea } from '@shared/constants/territory';
import { useDistanceUnit } from '@mobile/shared/hooks/useDistanceUnit';
import { convertKm, convertPaceMinPerKm } from '@mobile/shared/lib/formatters';
import { useTheme, feedback, Type, Fonts, Spacing, type AppColors, useIsDark } from '@theme';
import AwardUnlockSheet from '../components/AwardUnlockSheet';
import { NotificationPrimeSheet } from '../components/NotificationPrimeSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RunnerRank } from '@shared/types/game';
import { visibleRoute, radiusLabel, effectiveRadius } from '@shared/services/mapVisibility';
import { useSettings } from '@features/settings/hooks/useSettings';
import { fetchActivityMapHidden, setActivityMapHidden } from '@features/settings/services/mapVisibilityService';


type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'RunSummary'>;

function fmt(s: number) { const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function pace(p: number) { const m = Math.floor(p); return `${m}:${String(Math.floor((p - m) * 60)).padStart(2, '0')}`; }

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

export default function RunSummaryScreen() {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const ss = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { runId, runData: passedData, activityType } = route.params;
  // Map visibility: the runner's rule (Settings) plus this activity's own switch.
  const { settings } = useSettings();
  const [mapHidden, setMapHidden] = useState<boolean | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  // Off-screen renderer that turns the story card into a PNG for sharing.
  const storyCaptureRef = useRef<PngCaptureHandle>(null);
  // Edit sheet: title, description, effort, notes, audience, delete.
  const [editOpen, setEditOpen] = useState(false);
  const [edited, setEdited] = useState<{ title: string; description: string; visibility: string } | null>(null);
  useEffect(() => {
    getRunById(runId).then(r => {
      if (r && (r.title || r.description || r.visibility)) {
        setEdited({ title: r.title ?? '', description: r.description ?? '', visibility: r.visibility ?? 'everyone' });
      }
    }).catch(() => {});
  }, [runId]);
  useEffect(() => { fetchActivityMapHidden(runId).then(setMapHidden).catch(() => {}); }, [runId]);
  const toggleMapHidden = async (hide: boolean) => {
    const prev = mapHidden;
    setMapHidden(hide); setMapSaving(true);
    try {
      const ok = await setActivityMapHidden(runId, hide);
      if (!ok) { setMapHidden(prev); Alert.alert('Not posted yet', 'This activity has not reached the feed yet. Try again in a moment.'); }
    } catch {
      setMapHidden(prev);
      Alert.alert("Couldn't change the map", 'Check your connection and try again.');
    } finally {
      setMapSaving(false);
    }
  };
  // A ride is tracked only: no zone, no PACE, no rank progress.
  const sport = sportFor(activityType);
  const ride = !sport.claims;

  const { runData, splits, loading } =
    useRunSummary(runId, passedData);
  const distanceUnit = useDistanceUnit();

  const [showSaveRoute, setShowSaveRoute]             = useState(false);
  const [weightKg, setWeightKg]                       = useState(70);
  const [hasNutritionProfile, setHasNutritionProfile] = useState(false);
  const [showAward, setShowAward]                     = useState(false);
  const [showNotifPrime, setShowNotifPrime]           = useState(false);
  // The server's measured area lands on the stored run after sync; until then
  // the card shows the app's estimate and says so.
  const [serverAreaM2, setServerAreaM2]               = useState<number | null>(null);
  const [serverResult, setServerResult]               = useState<StoredRun['serverResult'] | null>(null);
  const [tier, setTier]                               = useState<string>('free');
  const [runsCompleted, setRunsCompleted]             = useState(0);
  const [recentAvgPace, setRecentAvgPace]             = useState<number | null>(null);
  const plus = isPlus(tier);
  const openPaywallMoment = usePaywallMoment();

  // The server scores the run in the background sync that starts as this
  // screen opens: check the stored run for its verdict for up to ~30 s.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const check = async () => {
      const r = await getRunById(runId).catch(() => undefined);
      if (cancelled) return;
      if (r?.serverProcessed) {
        if (typeof r.territoryAreaM2 === 'number' && r.territoryAreaM2 > 0) setServerAreaM2(r.territoryAreaM2);
        if (r.serverResult) setServerResult(r.serverResult);
        return;
      }
      if (++tries < 15) setTimeout(check, 2000);
    };
    check();
    return () => { cancelled = true; };
  }, [runId]);

  useEffect(() => {
    getPlayer().then(p => {
      if (!p) return;
      setTier(p.subscriptionTier ?? 'free');
      setRunsCompleted(p.totalRuns ?? 0);
    }).catch(() => {});
    // Recent average pace (s/km) for the free summary, excluding this run.
    getRuns(20).then(rs => {
      const prior = rs.filter(r => r.id !== runId && r.distanceMeters >= 1000 && r.durationSec > 0);
      if (prior.length === 0) return;
      const km = prior.reduce((a, r) => a + r.distanceMeters / 1000, 0);
      const sec = prior.reduce((a, r) => a + r.durationSec, 0);
      setRecentAvgPace(sec / km);
    }).catch(() => {});
  }, [runId]);

  useEffect(() => {
    getNutritionProfile().then(p => {
      if (p?.weightKg) { setWeightKg(p.weightKg); setHasNutritionProfile(true); }
    }).catch(() => {});
  }, []);

  // Ask for notification permission here — once, contextually, tied to a real
  // run — instead of a blank ask during onboarding setup. Delayed so it never
  // stacks on top of the award-unlock celebration sheet.
  const NOTIF_PRIME_KEY = 'runivo:notifPrimeSeen';
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AsyncStorage.getItem(NOTIF_PRIME_KEY).then(seen => {
      if (seen || cancelled) return;
      timer = setTimeout(() => setShowNotifPrime(true), 3500);
    }).catch(() => {});
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  const dismissNotifPrime = () => {
    setShowNotifPrime(false);
    AsyncStorage.setItem(NOTIF_PRIME_KEY, '1').catch(() => {});
  };

  // ── Animation refs ────────────────────────────────────────────────────────
  const [paceDisplay, setPaceDisplay] = useState(0);
  const rankUpScale   = useRef(new Animated.Value(0.85)).current;
  const rankUpOpacity = useRef(new Animated.Value(0)).current;

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

  // Rank-up spring + awards
  useEffect(() => {
    if (rankedUp) {
      setTimeout(() => {
        feedback.rankUp();
        Animated.parallel([
          Animated.spring(rankUpScale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
          Animated.timing(rankUpOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
      }, 900);
    }
    const newAwards = runData.newAwards;
    if (newAwards && newAwards.length > 0) {
      setTimeout(() => {
        setShowAward(true);
        feedback.awardUnlock();
      }, rankedUp ? 2800 : 900);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Paywall moments (PRD): an 11th-zone claim, or the weekly PACE cap. Once a
  // week each, never for Plus, and not while a celebration sheet is up.
  const capped = runData.cappedAt != null || serverResult?.paceCapped === true;
  const zoneLimited = serverResult?.territoryCapReached === true;
  useEffect(() => {
    if (plus || (!zoneLimited && !capped)) return;
    if ((runData.newAwards?.length ?? 0) > 0) return;
    const t = setTimeout(() => {
      openPaywallMoment(zoneLimited ? 'zone_limit' : 'pace_cap', tier, runsCompleted).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [zoneLimited, capped, plus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed display values ───────────────────────────────────────────────
  const calories = useMemo(() => {
    const speedKmh = runData.duration > 0 ? (runData.distance / runData.duration) * 3600 : 0;
    const met = Math.max(3.5, Math.min(18, 2.5 + 0.9 * speedKmh));
    return Math.round((met * weightKg * runData.duration) / 3600);
  }, [runData.distance, runData.duration, weightKg]);

  const heading = !runData.success ? `${runData.actionType || 'Action'} failed`
    : runData.actionType === 'attack'  ? 'Territory conquered'
    : runData.actionType === 'defend'  ? 'Territory defended'
    : runData.actionType === 'fortify' ? 'Territory fortified'
    : runData.territory ? 'Ground claimed' : 'Run complete';
  const stolen = serverResult?.stolenZones ?? (runData.rivalZonesStolen ?? 0);
  const newZones = serverResult?.newZones ?? (runData.territory ? 1 : 0);
  // Hero line says what the run actually did, plainest outcome last.
  const headline = ride ? 'Ride done.'
    : !runData.success && runData.actionType ? 'Loop not claimed.'
    : stolen > 0 ? `Stole ${stolen} zone${stolen === 1 ? '' : 's'}.`
    : runData.actionType === 'defend' ? 'Defended.'
    : runData.actionType === 'fortify' ? 'Fortified.'
    : runData.territory ? `Claimed ${formatArea(serverAreaM2 ?? runData.territory.areaM2)}.`
    : newZones > 0 ? 'New zone.'
    : ride ? 'Ride done.'
    : `${sport.verb.charAt(0).toUpperCase()}${sport.verb.slice(1)} done.`;
  const finishLbl = new Date((runData.startTime ?? Date.now()) + runData.duration * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  // Runner rank progress
  const displayRank = currentRank.charAt(0).toUpperCase() + currentRank.slice(1);
  const { pct, nextName, paceToNext } = rankProgress(paceTotalEarned, currentRank);

  if (loading) {
    return (
      <View style={[ss.root, ss.loadingRoot, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.t2} />
      </View>
    );
  }

  const shareRun = async () => {
    const available = await Sharing.isAvailableAsync();
    if (!available) { Alert.alert('Sharing not available on this device'); return; }
    try {
      const fileUri = await writeStoryCard(`run_${runId}.png`);
      await Sharing.shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your run' });
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    }
  };
  const writeStoryCard = async (name: string) => {
    const svg = buildStorySvg({
      distance:    runData.distance.toFixed(2),
      duration:    fmt(runData.duration),
      pace:        pace(runData.pace),
      paceEarned:  runData.paceEarned ?? 0,
      heading,
      actionType:  runData.actionType,
      // The share card shows only what others may see.
      route:       visibleRoute(runData.route ?? [], { radiusM: settings.mapHideRadiusM, hideAll: settings.mapHideAll, hidden: !!mapHidden, places: settings.privatePlaces }),
      runnerRank:  currentRank,
    });
    // A PNG at story size (1080 × 1890): apps reject SVG files.
    const capture = storyCaptureRef.current;
    if (!capture) throw new Error('capture not ready');
    const base64 = await capture.capture(svg, { viewWidth: 400, viewHeight: 700, outWidth: 1080, outHeight: 1890 });
    const fileUri = FileSystem.cacheDirectory + name;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return fileUri;
  };

  const terr = runData.territory ?? null;
  const zoneLabel = terr
    ? `${TIER_CONFIG[terr.tier].label.charAt(0)}${TIER_CONFIG[terr.tier].label.slice(1).toLowerCase()} · ${formatArea(serverAreaM2 ?? terr.areaM2)}`
    : null;

  const bd = runData.paceBreakdown;
  const paceParts = [
    { key: 'distance', label: `${Math.floor(runData.distance)} km`, value: bd?.fromDistance ?? 0, color: C.t1 },
    { key: 'stolen',   label: 'Zones stolen', value: bd?.fromStolenZones ?? 0, color: zone.rival },
    { key: 'new',      label: 'New zone',     value: bd?.fromNewZones ?? 0, color: zone.own },
    { key: 'streak',   label: 'Streak',       value: bd?.fromStreak ?? 0, color: C.t3 },
  ].filter(p => p.value > 0);

  return (
    <View style={ss.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <RunSummaryHero
          topInset={insets.top}
          eyebrow={`${sport.verb.charAt(0).toUpperCase()}${sport.verb.slice(1)} complete · ${finishLbl}`}
          headline={headline}
          route={runData.route ?? []}
          zoneRing={ride ? null : (terr?.polygon ?? null)}
          zoneLabel={zoneLabel}
          stolenLabel={stolen > 0 ? `Stole ${stolen} zone${stolen === 1 ? '' : 's'}` : null}
          distance={convertKm(runData.distance, distanceUnit).toFixed(2)}
          time={fmt(runData.duration)}
          pace={ride
            ? (runData.duration > 0 ? (convertKm(runData.distance, distanceUnit) / (runData.duration / 3600)).toFixed(1) : '0.0')
            : pace(convertPaceMinPerKm(runData.pace, distanceUnit))}
          paceLabel={ride ? `Avg ${distanceUnit}/h` : undefined}
          unit={distanceUnit}
          onClose={() => navigation.navigate('Main')}
          onShare={shareRun}
        />

        {ride && (
          <View style={[ss.card, ss.surface]}>
            <Text style={ss.cardTitle}>Tracked ride</Text>
            <Text style={ss.rideNote}>Rides are saved to your history. Only runs, walks and hikes claim zones and earn PACE.</Text>
          </View>
        )}

        {!ride && <>
        {/* ── PACE earned ───────────────────────────────────────────────── */}
        <View style={[ss.card, ss.surface, ss.paceCard]}>
          <View style={ss.cardHead}>
            <Text style={ss.cardTitle}>PACE earned</Text>
            {runData.cappedAt != null && <Text style={ss.capChip}>Weekly cap hit</Text>}
          </View>
          <View style={ss.paceBigRow}>
            <Text style={[ss.paceBig, paceEarned === 0 && { color: C.t3 }]}>{paceEarned > 0 ? `+${paceDisplay}` : '0'}</Text>
            <Text style={ss.paceSuffix}>PACE</Text>
          </View>
          {paceParts.length > 0 ? (
            <>
              <View style={ss.stackBar}>
                {paceParts.map(p => <View key={p.key} style={{ flex: p.value, backgroundColor: p.color }} />)}
              </View>
              <View style={ss.legend}>
                {paceParts.map(p => (
                  <View key={p.key} style={ss.legendItem}>
                    <View style={[ss.bdSwatch, { backgroundColor: p.color }]} />
                    <Text style={ss.legendTxt}>{p.label} <Text style={ss.legendVal}>+{p.value}</Text></Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={ss.paceZero}>
              {runData.cappedAt != null
                ? `Weekly cap of ${runData.cappedAt} reached. It resets Monday`
                : 'PACE starts at 1 per full km on a run'}
            </Text>
          )}
          {capped && !plus && (
            <Pressable style={ss.plusRow} onPress={() => navigation.navigate('Subscription', { reason: 'pace_cap' })} accessibilityRole="button">
              <Text style={ss.plusRowText}>Runivo Plus raises your weekly cap to 150</Text>
              <Text style={ss.plusRowCta}>See Plus</Text>
            </Pressable>
          )}
        </View>

        {zoneLimited && !plus && (
          <View style={[ss.card, ss.surface, ss.limitCard]}>
            <Text style={ss.limitTitle}>Your loop wasn't claimed</Text>
            <Text style={ss.limitBody}>
              Free runners hold 10 zones at once, and you hold 10. Runivo Plus has no limit, so every loop you close stays yours.
            </Text>
            <Pressable style={ss.limitBtn} onPress={() => navigation.navigate('Subscription', { reason: 'zone_limit' })} accessibilityRole="button">
              <Text style={ss.limitBtnText}>Hold more zones with Plus</Text>
            </Pressable>
          </View>
        )}

        <View style={ss.card}><ActivityCharts runId={runId} isRide={activityType === 'cycle'} /></View>
        {splits.length > 0 && <View style={ss.card}><SplitsList splits={splits} /></View>}

        <PaceXSummaryCard
          runId={runId}
          plus={plus}
          runsCompleted={runsCompleted}
          onOpenPlus={() => navigation.navigate('Subscription', { reason: 'debrief' })}
          summary={{
            distanceKm:            runData.distance,
            durationSec:           runData.duration,
            recentAvgPaceSecPerKm: recentAvgPace,
            newZones:              serverResult?.newZones ?? (runData.territory ? 1 : 0),
            stolenZones:           stolen,
            paceEarned,
            paceCapped:            capped,
            streakDays:            serverResult?.streakDays ?? (runData.newStreak ?? 0),
            streakAdvanced:        (runData.paceBreakdown?.fromStreak ?? 0) > 0 || (runData.newStreak ?? 0) > 0,
          }}
        />

        {/* ── Runner rank ───────────────────────────────────────────────── */}
        <View style={[ss.card, ss.surface, ss.rankCard]}>
          {rankedUp && (
            <Animated.View style={[ss.rankUpBanner, {
              transform: [{ scale: rankUpScale }],
              opacity: rankUpOpacity,
            }]}>
              <Text style={ss.rankUpText}>Rank up. You’re now a {displayRank}</Text>
            </Animated.View>
          )}
          <View style={ss.rankRow}>
            <View style={ss.rankPill}>
              <Diamond size={12} color={zone.own} weight="fill" />
              <Text style={ss.rankName}>{displayRank}</Text>
            </View>
            <Text style={ss.rankSub}>
              {currentRank !== 'sovereign'
                ? <>{paceToNext} PACE to <Text style={ss.rankSubStrong}>{nextName}</Text></>
                : 'Top rank'}
            </Text>
          </View>
          {currentRank !== 'sovereign' && (
            <View style={ss.progressOuter}>
              <View style={[ss.progressInner, { width: `${Math.round(pct * 100)}%`, backgroundColor: zone.own }]} />
            </View>
          )}
        </View>

        </>}

        {/* Title, notes and who can see it */}
        <Pressable style={[ss.card, ss.editRow]} onPress={() => setEditOpen(true)} accessibilityRole="button" accessibilityLabel="Edit activity">
          <PencilSimple size={18} color={C.t1} weight="regular" />
          <View style={{ flex: 1 }}>
            <Text style={ss.editTitle} numberOfLines={1}>
              {edited?.title || activityTitle({ activityType: activityType ?? 'run', startTime: runData.startTime ?? Date.now() })}
            </Text>
            <Text style={ss.editSub} numberOfLines={2}>
              {edited?.description
                || `Add a title, notes and how it felt · ${AUDIENCES.find(a => a.id === (edited?.visibility ?? 'everyone'))?.label ?? 'Everyone'}`}
            </Text>
          </View>
          <CaretRight size={14} color={C.t3} weight="bold" />
        </Pressable>

        {/* Who sees this activity's map */}
        <View style={[ss.card, ss.mapRow]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={ss.mapRowTitle}>Show map to others</Text>
            <Text style={ss.mapRowSub}>
              {settings.mapHideAll
                ? 'All maps are hidden in Map visibility'
                : `First and last ${radiusLabel(effectiveRadius(settings.mapHideRadiusM))} always private`}
            </Text>
          </View>
          <Switch
            value={!settings.mapHideAll && mapHidden === false}
            disabled={!!settings.mapHideAll || mapHidden === null || mapSaving}
            onValueChange={show => toggleMapHidden(!show)}
            trackColor={{ true: C.black, false: C.border }}
            thumbColor={C.white}
            accessibilityLabel="Show this activity's map to others"
          />
        </View>
        <Pressable onPress={() => navigation.navigate('MapVisibility')} hitSlop={6} accessibilityRole="button">
          <Text style={ss.mapLink}>Map visibility settings</Text>
        </Pressable>

        <PostRunActions
          onDone={() => navigation.navigate('Main')}
          onSave={() => setShowSaveRoute(true)}
          canSave={false}
        />
      </ScrollView>

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
        awards={runData.newAwards ?? []}
      />

      <NotificationPrimeSheet visible={showNotifPrime} onDismiss={dismissNotifPrime} />
      <PngCapture ref={storyCaptureRef} />
      <EditActivitySheet
        visible={editOpen}
        runId={runId}
        defaultTitle={activityTitle({ activityType: activityType ?? 'run', startTime: runData.startTime ?? Date.now() })}
        onClose={() => setEditOpen(false)}
        onSaved={e => setEdited({ title: e.title.trim(), description: e.description.trim(), visibility: e.visibility })}
        onDeleted={() => navigation.navigate('Main')}
      />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    plusRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    plusRowText:  { flex: 1, fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2 },
    plusRowCta:   { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red },
    limitCard:    { padding: 16, borderWidth: 1.5, borderColor: C.red },
    limitTitle:   { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    limitBody:    { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, marginTop: 6 },
    limitBtn:     { marginTop: 14, height: 46, borderRadius: 999, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    limitBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: '#FFFFFF' },
    root:         { flex: 1, backgroundColor: C.bg },
    loadingRoot:  { alignItems: 'center', justifyContent: 'center' },
    // Close sits over the dark hero.
    close:        { position: 'absolute', right: Spacing.gutter, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
    card:         { marginHorizontal: Spacing.gutter, marginBottom: 12 },
    surface:      { backgroundColor: C.card, borderRadius: 16, shadowColor: '#14120F', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
    gridCard:     { marginTop: 16 },
    cardHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabel:    { ...Type.labelSm, color: C.t2 },
    cardTitle:    { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    rideNote:    { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: C.t2, marginTop: 6 },
    mapRow:      { flexDirection: 'row', alignItems: 'center' },
    editRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    editTitle:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    editSub:     { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 17, color: C.t2, marginTop: 2 },
    mapRowTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    mapRowSub:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    mapLink:     { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t2, textAlign: 'center', marginTop: -2, marginBottom: 4 },
    legend:       { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 10 },
    legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendTxt:    { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    legendVal:    { fontFamily: Fonts.semiBold, color: C.t1 },

    // PACE card
    paceCard:      { paddingHorizontal: 18, paddingVertical: 16 },
    paceBigRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
    paceBig:       { fontFamily: Fonts.numeric, fontSize: 54, lineHeight: 48, color: C.red, fontVariant: ['tabular-nums'] },
    paceSuffix:    { fontFamily: Fonts.bold, fontSize: 18, letterSpacing: -0.4, color: C.t1 },
    paceZero:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 19, marginTop: 4 },
    stackBar:      { flexDirection: 'row', height: 10, borderRadius: 9, overflow: 'hidden', gap: 2, marginTop: 12 },
    expandHint:    { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 10 },
    breakdownRows: { paddingTop: 8 },
    bdRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    bdSwatch:      { width: 10, height: 10, borderRadius: 3 },
    bdLabel:       { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    bdValue:       { fontFamily: Fonts.numeric, fontSize: 18, color: C.t1, fontVariant: ['tabular-nums'] },
    capChip:       { fontFamily: Fonts.semiBold, fontSize: 11, color: C.amber, backgroundColor: C.amberBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
    capRow:        { fontFamily: Fonts.regular, fontSize: 12, color: C.amber, marginTop: 6 },

    // Territory card
    territoryCard:   { padding: 14 },
    mapWrap:         { height: 170, borderRadius: 12, overflow: 'hidden', marginTop: 10 },
    mapFallback:     { height: 170, backgroundColor: C.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    mapFallbackText: { fontFamily: Fonts.medium, fontSize: 14, color: C.t2 },
    territoryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    territoryArea:   { fontFamily: Fonts.numeric, fontSize: 30, lineHeight: 32, color: C.t1, fontVariant: ['tabular-nums'] },
    territorySub:    { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    tierBadge:       { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.t1 },
    tierTxt:         { fontFamily: Fonts.semiBold, fontSize: 12, color: C.bg },
    loopRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    loopDot:         { width: 8, height: 8, borderRadius: 4 },
    loopTxt:         { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },

    // Rank card
    rankCard:      { paddingHorizontal: 18, paddingVertical: 14 },
    rankUpBanner:  { backgroundColor: C.red, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
    rankUpText:    { fontFamily: Fonts.semiBold, fontSize: 13, color: C.white },
    rankRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rankPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.t1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
    rankName:      { fontFamily: Fonts.semiBold, fontSize: 12, color: C.bg },
    progressOuter: { height: 8, borderRadius: 4, backgroundColor: C.bg, marginTop: 12, overflow: 'hidden' },
    progressInner: { height: 8, borderRadius: 4 },
    rankSub:       { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    rankSubStrong: { fontFamily: Fonts.semiBold, color: C.t1 },

    // Fuel card
    fuel:        { marginHorizontal: Spacing.gutter, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    fuelIcon:    { width: 38, height: 38, borderRadius: 12, backgroundColor: C.orangeBg, alignItems: 'center', justifyContent: 'center' },
    fuelTitle:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    fuelSub:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    fuelBtn:     { paddingHorizontal: 14, height: 32, justifyContent: 'center', borderRadius: 999, backgroundColor: C.t1 },
    fuelBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.bg },
  });
}
