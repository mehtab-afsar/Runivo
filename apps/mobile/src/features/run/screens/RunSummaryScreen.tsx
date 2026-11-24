import { territoryPalette } from '@theme/territory';
import { appAlert } from '@mobile/shared/components/AppAlert';
import * as Haptics from '@theme/hapticsGated';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Diamond, CaretRight, PencilSimple, ShareNetwork, PathIcon, Play, Heart, ChatCircle } from 'phosphor-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import type { RootStackParamList } from '@navigation/AppNavigator';
import { useRunSummary } from '../hooks/useRunSummary';
import RunSummaryHero       from '../components/RunSummaryHero';
import SplitsList           from '../components/SplitsList';
import { AnalysisCards } from '../components/AnalysisCards';
import ShoeChip             from '../components/ShoeChip';
import ShoeDrawer           from '../components/ShoeDrawer';
import ActivityCharts       from '../components/ActivityCharts';
import PaceXSummaryCard     from '../components/PaceXSummaryCard';
import { sportFor }         from '../constants/activities';
import PostRunActions       from '../components/PostRunActions';
import SaveRouteSheet       from '../components/SaveRouteSheet';
import { buildRouteStickerSvg } from '../services/storyCardGenerator';
import { buildRunCardSvg, RUN_CARD_W, RUN_CARD_H } from '@mobile/shared/lib/runCard';
import { svgToPngFile } from '@mobile/shared/components/CaptureHost';
import { PngCapture, type PngCaptureHandle } from '../components/PngCapture';
import { useMyIdentity } from '@mobile/shared/hooks/useMyIdentity';
import { StatusBarScrim } from '@mobile/shared/components/StatusBarScrim';
import EditActivitySheet from '../components/EditActivitySheet';
import { AUDIENCES } from '../services/activityEditService';
import { activityTitle } from '@features/profile/utils/profileStats';
import { getNutritionProfile, getRunById, getPlayer, getRuns, type StoredRun } from '@shared/services/store';
import { isPlus } from '@shared/engine/entitlements';
import { usePaywallMoment } from '@features/subscription/hooks/usePaywallMoment';
import { computeRunnerRank } from '@shared/services/claimEngine';
import { TIER_CONFIG, formatArea } from '@shared/constants/territory';
import { ErrorState } from '@mobile/shared/components/ErrorState';
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
import { RunCheers } from '@features/cheers/RunCheers';
import CommentSheet from '@features/social/components/CommentSheet';
import { supabase } from '@shared/services/supabase';
import { ENGINE, tierForArea } from '@shared/engine/runEngine';


type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'RunSummary'>;

/** mm:ss, or h:mm:ss from one hour up (a 65-minute run is "1:05:00", not "65:00"). */
function fmt(s: number) {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}
/** Pace in decimal minutes → "m:ss". Zero, NaN and Infinity (zero-distance runs) show "–:––". */
function pace(p: number) {
  if (!Number.isFinite(p) || p <= 0) return '–:––';
  const total = Math.round(p * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const RANK_ORDER: RunnerRank[] = ['pacer', 'strider', 'chaser', 'hunter', 'sovereign'];

function rankProgress(totalPace: number, rank: RunnerRank) {
  if (rank === 'sovereign') return { pct: 1, nextName: '', paceToNext: 0 };
  const idx      = RANK_ORDER.indexOf(rank);
  const current  = (ENGINE.RANK_THRESHOLDS as Record<string, number>)[rank];
  const nextRank = RANK_ORDER[idx + 1] as RunnerRank;
  const next     = (ENGINE.RANK_THRESHOLDS as Record<string, number>)[nextRank];
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
      if (!ok) { setMapHidden(prev); appAlert('Not posted yet', 'This activity has not reached the feed yet. Try again in a moment.'); }
    } catch {
      setMapHidden(prev);
      appAlert("Couldn't change the map", 'Check your connection and try again.');
    } finally {
      setMapSaving(false);
    }
  };
  // A ride is tracked only: no zone, no PACE, no rank progress.
  const sport = sportFor(activityType);
  const ride = !sport.claims;

  const { runData, splits, loading, loadError, retryLoad, runShoe, allShoes, shoeTotalKm, showShoeDrawer, setShowShoeDrawer, selectShoe } =
    useRunSummary(runId, passedData, activityType);
  const distanceUnit = useDistanceUnit();

  const [showSaveRoute, setShowSaveRoute]             = useState(false);
  const [weightKg, setWeightKg]                       = useState<number | null>(null);
  const [showAward, setShowAward]                     = useState(false);
  const [showNotifPrime, setShowNotifPrime]           = useState(false);
  // The server's measured area lands on the stored run after sync; until then
  // the card shows the app's estimate and says so.
  const [serverAreaM2, setServerAreaM2]               = useState<number | null>(null);
  const [serverResult, setServerResult]               = useState<StoredRun['serverResult'] | null>(null);
  // PACE the server actually paid (cap and verified distance applied); also
  // the only PACE figure a past run opened from History has.
  const [serverPace, setServerPace]                   = useState<number | null>(null);
  const [confirm, setConfirm]                         = useState<'checking' | 'confirmed' | 'pending'>('checking');
  const [tier, setTier]                               = useState<string>('free');
  const [runsCompleted, setRunsCompleted]             = useState(0);
  const [recentAvgPace, setRecentAvgPace]             = useState<number | null>(null);
  const [authorName, setAuthorName]                   = useState('');
  const me = useMyIdentity();
  const [stored, setStored]                           = useState<StoredRun | null>(null);
  const [post, setPost]                               = useState<{ id: string; likes: number; comments: number } | null>(null);
  const [commentsOpen, setCommentsOpen]               = useState(false);
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
        if (typeof r.xpEarned === 'number') setServerPace(r.xpEarned);
        if (typeof r.territoryAreaM2 === 'number' && r.territoryAreaM2 > 0) setServerAreaM2(r.territoryAreaM2);
        if (r.serverResult) {
          setServerResult(r.serverResult);
          // L6: the capture moment fires here, once the server has confirmed it.
          if (r.serverResult.newZones + r.serverResult.stolenZones > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        setConfirm('confirmed');
        return;
      }
      if (++tries < 15) setTimeout(check, 2000);
      else setConfirm('pending');
    };
    check();
    return () => { cancelled = true; };
  }, [runId]);

  useEffect(() => {
    getPlayer().then(p => {
      if (!p) return;
      setTier(p.subscriptionTier ?? 'free');
      setRunsCompleted(p.totalRuns ?? 0);
      setAuthorName(p.username ?? '');
    }).catch(() => {});
    getRunById(runId).then(r => setStored(r ?? null)).catch(() => {});
    // Kudos and comments live on this run's feed post (mock: kudos · comments · story).
    supabase.from('feed_posts').select('id, likes, comment_count').eq('run_id', runId).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setPost({ id: data.id, likes: data.likes ?? 0, comments: data.comment_count ?? 0 }); })
      .then(undefined, () => {});
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
      if (p?.weightKg) setWeightKg(p.weightKg);
    }).catch(() => {});
  }, []);

  // Ask for notification permission here — once, contextually, tied to a real
  // run — instead of a blank ask during onboarding setup. Delayed so it never
  // stacks on top of the award-unlock celebration sheet.
  const NOTIF_PRIME_KEY = 'runivo:notifPrimeSeen';
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Not on a run that unlocks an award: that celebration sheet owns the moment, and two
    // stacked Modals can fail to present on iOS. The prime waits for the next run (the
    // "seen" flag is only set once it has actually been shown).
    if ((runData.newAwards?.length ?? 0) > 0) return;
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

  const paceEarned      = serverPace ?? runData.paceEarned ?? 0;
  const paceTotalEarned = runData.paceTotalEarned ?? 0;
  const prevRank        = computeRunnerRank(Math.max(0, paceTotalEarned - paceEarned));
  const currentRank     = runData.runnerRank ?? 'pacer';
  const rankedUp        = paceEarned > 0 && prevRank !== currentRank;

  // PACE count-up: 300ms delay, 800ms ease-out cubic. Runs again from the
  // shown figure if the server's number differs from the estimate.
  const paceShownRef = useRef(0);
  useEffect(() => {
    const from = paceShownRef.current;
    if (paceEarned === from) return;
    const startTime = Date.now() + (from === 0 ? 300 : 0);
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) return;
      const t = Math.min(1, elapsed / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + eased * (paceEarned - from));
      paceShownRef.current = v;
      setPaceDisplay(v);
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [paceEarned]);

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
  // Only with a weight on file: the story card omits kcal rather than show a guess built on an assumed weight.
  const calories = useMemo(() => {
    if (!weightKg) return null;
    const speedKmh = runData.duration > 0 ? (runData.distance / runData.duration) * 3600 : 0;
    const met = Math.max(3.5, Math.min(18, 2.5 + 0.9 * speedKmh));
    return Math.round((met * weightKg * runData.duration) / 3600);
  }, [runData.distance, runData.duration, weightKg]);

  const stolen = serverResult?.stolenZones ?? (runData.rivalZonesStolen ?? 0);
  const newZones = serverResult?.newZones ?? (runData.territory ? 1 : 0);
  // The server's verdict wins over the phone's preview: when it gave this run
  // no new or stolen ground, say so and why, and don't show a zone (T9).
  const noGain = !!serverResult && newZones + stolen === 0;
  const noGainReason = !serverResult || !noGain ? null
    : serverResult.rejectedReason ? rejectionText(serverResult.rejectedReason)
    : serverResult.territoryCapReached ? 'You hold the most zones a free account can. This run defended your ground but claimed nothing new.'
    : runData.territory ? 'All of this ground was already yours or a fresh rival zone, so nothing new was claimed. Your own zones were refreshed.'
    : null;
  const claimedArea = serverResult ? (serverResult.claimedAreaM2 ?? serverAreaM2 ?? 0) : (serverAreaM2 ?? runData.territory?.areaM2 ?? 0);
  // Hero line says what the run actually did, plainest outcome last.
  const headline = ride ? 'Ride done.'
    : serverResult?.rejectedReason ? 'Not scored.'
    : noGain && runData.territory ? 'No new ground.'
    : !runData.success && runData.actionType ? 'Loop not claimed.'
    : stolen > 0 ? `Stole ${stolen} zone${stolen === 1 ? '' : 's'}.`
    : runData.actionType === 'defend' ? 'Defended.'
    : runData.actionType === 'fortify' ? 'Fortified.'
    : runData.territory && claimedArea > 0 ? `Claimed ${formatArea(claimedArea)}.`
    : newZones > 0 ? 'New zone.'
    : ride ? 'Ride done.'
    : `${sport.verb.charAt(0).toUpperCase()}${sport.verb.slice(1)} done.`;
  const startMs = runData.startTime ?? Date.now();
  const whenLine = (() => {
    const d = new Date(startMs);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(startMs); day.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
    const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const src: Record<string, string> = { apple_health: 'Apple Health', garmin: 'Garmin', coros: 'COROS', polar: 'Polar' };
    return `${label}, ${t}${stored?.importSource ? ` · ${src[stored.importSource] ?? stored.importSource}` : ''}`;
  })();
  const elevM = stored?.elevationGainM;
  const extraStats = [
    ...(elevM != null ? [{ label: 'Elevation', value: `${Math.round(distanceUnit === 'mi' ? elevM * 3.28084 : elevM)} ${distanceUnit === 'mi' ? 'ft' : 'm'}` }] : []),
    ...(stored?.heartRateAvg ? [{ label: 'Avg HR', value: String(Math.round(stored.heartRateAvg)) }] : []),
    ...(stored?.perceivedEffort ? [{ label: 'Effort', value: stored.perceivedEffort >= 8 ? 'Hard' : stored.perceivedEffort >= 5 ? 'Moderate' : 'Easy' }] : []),
  ];
  // Honest "faster than usual" line (not a PR claim) when pace beats the recent average.
  const thisPaceSec = runData.distance > 0 ? runData.duration / runData.distance : 0;
  const prLine = !ride && recentAvgPace && runData.distance >= 1 && thisPaceSec > 0 && thisPaceSec < recentAvgPace * 0.97
    ? { title: 'Faster than your usual pace', sub: `${Math.round(recentAvgPace - thisPaceSec)} s/km quicker than your recent runs` }
    : null;
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
  if (loadError) {
    return (
      <View style={[ss.root, ss.loadingRoot, { paddingTop: insets.top }]}>
        <ErrorState title="Couldn't load this run" body="It isn't on this phone and Runivo can't be reached. Check your connection and try again." onRetry={retryLoad} />
      </View>
    );
  }

  const shareFile = async (make: () => Promise<string>, title: string) => {
    const available = await Sharing.isAvailableAsync();
    if (!available) { appAlert('Sharing not available on this device'); return; }
    try {
      const fileUri = await make();
      await Sharing.shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
    } catch {
      appAlert('Could not share', 'Please try again.');
    }
  };
  const openReplay = (runData.route?.length ?? 0) >= 2
    ? () => navigation.navigate('RunReplay', { runId, route: (runData.route ?? []).map(p => ({ lat: p.lat, lng: p.lng })), durationSec: runData.duration, pace: runData.pace })
    : undefined;
  /** Share: the full card, the transparent route sticker, or the replay. */
  const shareRun = () => {
    const options = ['Share card', 'Route sticker (transparent)', ...(openReplay ? ['Play the replay'] : []), 'Cancel'];
    const pick = (i: number) => {
      if (i === 0) shareFile(() => writeStoryCard(`run_${runId}.png`), 'Share your run');
      else if (i === 1) shareFile(writeRouteSticker, 'Share your route');
      else if (i === 2 && openReplay) openReplay();
    };
    {
      appAlert('Share', undefined, [
        ...options.slice(0, -1).map((label, i) => ({ text: label, onPress: () => pick(i) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };
  /** Route and numbers on a transparent PNG (1080 × 1350), to lay over a photo. */
  const writeRouteSticker = async () => {
    const svg = buildRouteStickerSvg({
      route: visibleRoute(runData.route ?? [], { radiusM: settings.mapHideRadiusM, hideAll: settings.mapHideAll, hidden: !!mapHidden, places: settings.privatePlaces }),
      stats: [
        { label: distanceUnit, value: convertKm(runData.distance, distanceUnit).toFixed(2) },
        ride
          ? { label: `${distanceUnit}/h`, value: runData.duration > 0 ? (convertKm(runData.distance, distanceUnit) / (runData.duration / 3600)).toFixed(1) : '0.0' }
          : { label: `/${distanceUnit}`, value: pace(convertPaceMinPerKm(runData.pace, distanceUnit)) },
        { label: 'time', value: fmt(runData.duration) },
        ...(calories != null ? [{ label: 'kcal', value: String(calories) }] : []),
      ],
    });
    const capture = storyCaptureRef.current;
    if (!capture) throw new Error('capture not ready');
    const base64 = await capture.capture(svg, { viewWidth: 400, viewHeight: 500, outWidth: 1080, outHeight: 1350 });
    const fileUri = FileSystem.cacheDirectory + `route_${runId}.png`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return fileUri;
  };
  // The story card: the same run card the feed shares, at story size (1080 × 1920).
  const writeStoryCard = async (name: string) => {
    const d = new Date(startMs);
    const svg = buildRunCardSvg({
      name: me.name || authorName || 'Runner',
      sub: `${sport.label} · ${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`,
      title: stored?.title || headline,
      stats: [
        { value: convertKm(runData.distance, distanceUnit).toFixed(2), label: distanceUnit },
        ride
          ? { value: runData.duration > 0 ? (convertKm(runData.distance, distanceUnit) / (runData.duration / 3600)).toFixed(1) : '0.0', label: `${distanceUnit}/h` }
          : { value: pace(convertPaceMinPerKm(runData.pace, distanceUnit)), label: `pace /${distanceUnit}` },
        { value: fmt(runData.duration), label: 'time' },
      ],
      // The share card shows only what others may see.
      route: visibleRoute(runData.route ?? [], { radiusM: settings.mapHideRadiusM, hideAll: settings.mapHideAll, hidden: !!mapHidden, places: settings.privatePlaces }),
      zones: newZones + stolen,
    });
    return svgToPngFile(svg, { w: RUN_CARD_W, h: RUN_CARD_H, outW: 1080 }, name);
  };

  const terr = noGain ? null : (runData.territory ?? null);
  const terrTier = terr ? (serverResult && claimedArea > 0 ? tierForArea(claimedArea) : terr.tier) : null;
  const zoneLabel = terr && terrTier
    ? `${TIER_CONFIG[terrTier].label.charAt(0)}${TIER_CONFIG[terrTier].label.slice(1).toLowerCase()} · ${formatArea(claimedArea || terr.areaM2)}`
    : null;

  // What the server paid, when it has answered; the phone's estimate until then.
  const sb = serverResult?.paceBreakdown;
  const bd = sb
    ? { fromDistance: sb.distance, fromNewZones: sb.newZones, fromStolenZones: sb.stolenZones, fromStreak: sb.streak }
    : serverResult?.rejectedReason ? { fromDistance: 0, fromNewZones: 0, fromStolenZones: 0, fromStreak: 0 }
    : runData.paceBreakdown;
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
          headline={stored?.title || headline}
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
          onClose={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
          onShare={shareRun}
          sportLabel={sport.label}
          authorName={me.name || authorName || undefined}
          authorPhoto={me.avatarUrl}
          whenLine={whenLine}
          description={stored?.description || undefined}
          pr={prLine}
          extraStats={extraStats}
          onOpenMap={() => navigation.navigate('TerritoryMap', {})}
          // The replay screen was built but never linked: the button only
          // shows when this is passed.
          onReplay={openReplay}
        />

        {/* Name and notes first (asked for): straight after the hero, so the runner
            can title the run while it's fresh, before any stats. */}
        <Pressable style={[ss.card, ss.panel, ss.editRow]} onPress={() => setEditOpen(true)} accessibilityRole="button" accessibilityLabel="Name this run and add notes">
          <View style={ss.editIcon}><PencilSimple size={18} color={C.t1} weight="regular" /></View>
          <View style={{ flex: 1 }}>
            <Text style={ss.editTitle} numberOfLines={1}>
              {edited?.title || activityTitle({ activityType: activityType ?? 'run', startTime: runData.startTime ?? Date.now() })}
            </Text>
            <Text style={ss.editSub} numberOfLines={2}>
              {edited?.description
                || `Name it, add notes and how it felt · ${AUDIENCES.find(a => a.id === (edited?.visibility ?? 'everyone'))?.label ?? 'Everyone'}`}
            </Text>
          </View>
          <CaretRight size={14} color={C.t3} weight="bold" />
        </Pressable>

        {/* L6: zones count once the server confirms them. */}
        {!ride && passedData && confirm !== 'confirmed' && (runData.territory || runData.actionType) && (
          <View style={{ marginHorizontal: 18, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {confirm === 'checking' && <ActivityIndicator size="small" color={C.t2} />}
            <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 12.5, color: C.t2 }}>
              {confirm === 'checking' ? 'Confirming your ground…' : "Can't reach Runivo right now. Your ground is confirmed as soon as you're back online."}
            </Text>
          </View>
        )}

        {!ride && noGainReason && (
          <View style={[ss.card, ss.surface]} accessibilityRole="text">
            <Text style={ss.cardTitle}>{serverResult?.rejectedReason ? 'Why this run earned nothing' : 'No new ground this time'}</Text>
            <Text style={ss.rideNote}>{noGainReason}</Text>
          </View>
        )}

        {ride && (
          <View style={[ss.card, ss.surface]}>
            <Text style={ss.cardTitle}>Tracked ride</Text>
            <Text style={ss.rideNote}>Rides are saved to your history. Only runs, walks and hikes claim zones and earn PACE.</Text>
          </View>
        )}

        {!ride && <>
        {/* The rank-up sits right under the hero with the PACE earned, where the eye already is.
            It used to be below the charts and splits, so its haptic fired for something unseen. */}
        {rankedUp && (
          <Animated.View style={[ss.rankUpBanner, { marginHorizontal: 18, marginTop: 12, marginBottom: 0 }, {
            transform: [{ scale: rankUpScale }],
            opacity: rankUpOpacity,
          }]} accessibilityRole="alert">
            <Text style={ss.rankUpText}>Rank up. You’re now a {displayRank}</Text>
          </Animated.View>
        )}

        {/* Story share row (mock: kudos · comments · story). */}
        <View style={ss.actRow}>
          {post && (
            <>
              <View style={ss.actBtn} accessibilityLabel={`${post.likes} kudos`}>
                <Heart size={20} color={C.t1} />
                <Text style={ss.actTxt}>{post.likes}</Text>
              </View>
              <Pressable style={ss.actBtn} onPress={() => setCommentsOpen(true)} accessibilityRole="button" accessibilityLabel={`${post.comments} comments`}>
                <ChatCircle size={20} color={C.t1} />
                <Text style={ss.actTxt}>{post.comments}</Text>
              </Pressable>
            </>
          )}
          <Pressable style={ss.actBtn} onPress={() => shareFile(() => writeStoryCard(`run_${runId}.png`), 'Share your run')} accessibilityRole="button">
            <ShareNetwork size={20} color={C.t1} />
            <Text style={ss.actTxt}>Story</Text>
          </Pressable>
          <Pressable style={ss.actBtn} onPress={() => shareFile(writeRouteSticker, 'Share your route')} accessibilityRole="button">
            <PathIcon size={20} color={C.t1} />
            <Text style={ss.actTxt}>Sticker</Text>
          </Pressable>
          {openReplay && (
            <Pressable style={ss.actBtn} onPress={openReplay} accessibilityRole="button">
              <Play size={18} color={C.t1} weight="fill" />
              <Text style={ss.actTxt}>Replay</Text>
            </Pressable>
          )}
        </View>

        <Text style={ss.h2}>Territory</Text>
        {/* Territory tiles, as on the mock's activity page. */}
        <View style={ss.terrRow}>
          <View style={[ss.terrTile, { backgroundColor: C.mint }]}>
            <Text style={ss.terrVal}>{stolen}</Text>
            <Text style={[ss.terrLbl, { color: '#4E5A44' }]}>Taken back</Text>
          </View>
          <View style={[ss.terrTile, { backgroundColor: C.mint }]}>
            <Text style={ss.terrVal}>{newZones}</Text>
            <Text style={[ss.terrLbl, { color: '#4E5A44' }]}>{runData.actionType === 'fortify' ? 'Refreshed' : 'New zones'}</Text>
          </View>
          <View style={[ss.terrTile, { backgroundColor: C.amberBg }]}>
            <Text style={ss.terrVal}>{paceEarned > 0 ? `+${paceDisplay}` : '0'}</Text>
            <Text style={[ss.terrLbl, { color: '#7A5525' }]}>PACE</Text>
          </View>
        </View>

        <View style={{ marginHorizontal: Spacing.gutter, marginBottom: 12 }}><RunCheers runId={runId} runStart={runData.startTime} /></View>
        {splits.length > 0 && <View style={ss.card}><SplitsList splits={splits} /></View>}
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
                : 'PACE starts at 2 per full km on a run'}
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
        <AnalysisCards runId={runId} />

        {/* P5: which shoes, and a nudge when they're near the end of their life. */}
        {allShoes.length > 0 && (
          <View style={{ gap: 6 }}>
            <ShoeChip shoe={runShoe} totalKm={runShoe ? shoeTotalKm : undefined} onPress={() => setShowShoeDrawer(true)} />
            {runShoe && shoeTotalKm >= runShoe.maxKm * 0.9 && (
              <Text style={{ fontFamily: Fonts.medium, fontSize: 12.5, color: C.red, paddingHorizontal: 4 }}>
                {shoeTotalKm >= runShoe.maxKm
                  ? `These are past ${runShoe.maxKm} km. Time to retire them.`
                  : `${Math.max(0, Math.round(runShoe.maxKm - shoeTotalKm))} km left before these hit ${runShoe.maxKm} km.`}
              </Text>
            )}
          </View>
        )}

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

        {/* Who sees this activity's map */}
        <View style={[ss.card, ss.panel, ss.mapRow]}>
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
      <StatusBarScrim />
      <EditActivitySheet
        visible={editOpen}
        runId={runId}
        defaultTitle={activityTitle({ activityType: activityType ?? 'run', startTime: runData.startTime ?? Date.now() })}
        onClose={() => setEditOpen(false)}
        onSaved={e => setEdited({ title: e.title.trim(), description: e.description.trim(), visibility: e.visibility })}
        onDeleted={() => navigation.navigate('Main')}
      />
      <CommentSheet
        postId={commentsOpen && post ? post.id : null}
        onClose={() => setCommentsOpen(false)}
        onCommentPosted={() => setPost(p => (p ? { ...p, comments: p.comments + 1 } : p))}
      />
      {showShoeDrawer && (
        <ShoeDrawer shoes={allShoes} selectedShoe={runShoe} bottomInset={insets.bottom} onSelect={selectShoe} onClose={() => setShowShoeDrawer(false)} />
      )}
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
    surface:      { backgroundColor: C.card, borderRadius: 24 },
    actRow:       { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 4 },
    actBtn:       { height: 52, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
    actTxt:       { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    h2:           { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1, marginHorizontal: Spacing.gutter, marginTop: 18 },
    terrRow:      { flexDirection: 'row', gap: 8, marginHorizontal: Spacing.gutter, marginTop: 12, marginBottom: 16 },
    terrTile:     { flex: 1, borderRadius: 18, padding: 12, gap: 2 },
    terrVal:      { fontFamily: Fonts.semiBold, fontSize: 20, color: C.t1, fontVariant: ['tabular-nums'] },
    terrLbl:      { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    gridCard:     { marginTop: 16 },
    cardHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabel:    { ...Type.labelSm, color: C.t2 },
    cardTitle:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    rideNote:    { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: C.t2, marginTop: 6 },
    mapRow:      { flexDirection: 'row', alignItems: 'center' },
    panel:       { backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14 },
    editRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    editIcon:    { width: 40, height: 40, borderRadius: 20, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
    editTitle:   { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    editSub:     { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2, marginTop: 2 },
    mapRowTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    mapRowSub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
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

/** Plain words for why the server scored a run at zero. */
function rejectionText(reason: string): string {
  switch (reason) {
    case 'run_too_short':     return 'Runs shorter than a minute aren\'t scored.';
    case 'insufficient_gps':  return 'The phone recorded too few GPS points to check this run.';
    case 'mock_location':     return 'This phone reported a simulated location during the run, so it earns no PACE or ground.';
    case 'trace_too_large':   return 'This run\'s GPS trace was too large to check.';
    case 'activity_type':
    case 'duration':
    case 'trace_before_start':
    case 'trace_after_end':
    case 'trace_in_future':
    case 'run_mismatch':      return 'The GPS trace didn\'t match the saved run (its time or sport), so it couldn\'t be scored.';
    case 'gps_point':
    case 'bad_request':       return 'Some GPS points were invalid, so the run couldn\'t be scored.';
    default:                  return 'The run couldn\'t be verified, so it earned no PACE or ground.';
  }
}
