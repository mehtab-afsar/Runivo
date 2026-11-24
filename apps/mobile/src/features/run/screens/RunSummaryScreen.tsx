import { territoryPalette } from '@theme/territory';
import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useRunSummary } from '../hooks/useRunSummary';
import SplitsList           from '../components/SplitsList';
import { AnalysisCards } from '../components/AnalysisCards';
import ShoeDrawer           from '../components/ShoeDrawer';
import ActivityCharts       from '../components/ActivityCharts';
import PaceXSummaryCard     from '../components/PaceXSummaryCard';
import { sportFor }         from '../constants/activities';
import PostRunActions       from '../components/PostRunActions';
import SaveRouteSheet       from '../components/SaveRouteSheet';
import { PngCapture } from '../components/PngCapture';
import { useMyIdentity } from '@mobile/shared/hooks/useMyIdentity';
import { StatusBarScrim } from '@mobile/shared/components/StatusBarScrim';
import EditActivitySheet from '../components/EditActivitySheet';
import { activityTitle } from '@features/profile/utils/profileStats';
import { isPlus } from '@shared/engine/entitlements';
import { usePaywallMoment } from '@features/subscription/hooks/usePaywallMoment';
import { computeRunnerRank } from '@shared/services/claimEngine';
import { ErrorState } from '@mobile/shared/components/ErrorState';
import { useDistanceUnit } from '@mobile/shared/hooks/useDistanceUnit';
import { useTheme, Spacing, type AppColors, useIsDark } from '@theme';
import AwardUnlockSheet from '../components/AwardUnlockSheet';
import { NotificationPrimeSheet } from '../components/NotificationPrimeSheet';
import { useSettings } from '@features/settings/hooks/useSettings';
import { RunCheers } from '@features/cheers/RunCheers';
import CommentSheet from '@features/social/components/CommentSheet';

import RunSummaryHeader from '../components/runSummary/RunSummaryHeader';
import RunEditRow from '../components/runSummary/RunEditRow';
import RunVerdictNotices from '../components/runSummary/RunVerdictNotices';
import RankUpBanner from '../components/runSummary/RankUpBanner';
import RunShareActions from '../components/runSummary/RunShareActions';
import RunTerritoryTiles from '../components/runSummary/RunTerritoryTiles';
import RunPaceCard from '../components/runSummary/RunPaceCard';
import RunZoneLimitCard from '../components/runSummary/RunZoneLimitCard';
import RunShoeSection from '../components/runSummary/RunShoeSection';
import RunRankCard from '../components/runSummary/RunRankCard';
import RunMapVisibilityRow from '../components/runSummary/RunMapVisibilityRow';
import { useRunServerVerdict } from '../hooks/runSummary/useRunServerVerdict';
import { useRunPlayerContext } from '../hooks/runSummary/useRunPlayerContext';
import { useRunMapVisibility } from '../hooks/runSummary/useRunMapVisibility';
import { useRunEditMeta } from '../hooks/runSummary/useRunEditMeta';
import { useNotificationPrime } from '../hooks/runSummary/useNotificationPrime';
import { usePaceCountUp } from '../hooks/runSummary/usePaceCountUp';
import { useRunShare } from '../hooks/runSummary/useRunShare';
import { useRunCelebration } from '../hooks/runSummary/useRunCelebration';
import type { RunSummaryNav, RunSummaryRoute } from '../utils/runSummaryTypes';
import { capFirst, estimateCalories, extraStatsFor, fasterThanUsual, finishTimeLabel, rankProgress, whenLineFor } from '../utils/runSummaryFormatters';
import { computeOutcome, paceParts as buildPaceParts, paceXSummary, zoneForHero } from '../utils/runSummaryOutcome';

export default function RunSummaryScreen() {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const ss = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RunSummaryNav>();
  const route = useRoute<RunSummaryRoute>();
  const { runId, runData: passedData, activityType } = route.params;
  // Map visibility: the runner's rule (Settings) plus this activity's own switch.
  const { settings } = useSettings();
  const { mapHidden, mapSaving, toggleMapHidden } = useRunMapVisibility(runId);
  const { editOpen, setEditOpen, edited, setEdited } = useRunEditMeta(runId);
  // A ride is tracked only: no zone, no PACE, no rank progress.
  const sport = sportFor(activityType);
  const ride = !sport.claims;

  const { runData, splits, loading, loadError, retryLoad, runShoe, allShoes, shoeTotalKm, showShoeDrawer, setShowShoeDrawer, selectShoe } =
    useRunSummary(runId, passedData, activityType);
  const distanceUnit = useDistanceUnit();

  const [showSaveRoute, setShowSaveRoute] = useState(false);
  const [commentsOpen, setCommentsOpen]   = useState(false);
  const { serverAreaM2, serverResult, serverPace, confirm } = useRunServerVerdict(runId);
  const { weightKg, tier, runsCompleted, recentAvgPace, authorName, stored, post, setPost } = useRunPlayerContext(runId);
  const me = useMyIdentity();
  const plus = isPlus(tier);
  const openPaywallMoment = usePaywallMoment();
  const { showNotifPrime, dismissNotifPrime } = useNotificationPrime((runData.newAwards?.length ?? 0) > 0);

  const paceEarned      = serverPace ?? runData.paceEarned ?? 0;
  const paceTotalEarned = runData.paceTotalEarned ?? 0;
  const prevRank        = computeRunnerRank(Math.max(0, paceTotalEarned - paceEarned));
  const currentRank     = runData.runnerRank ?? 'pacer';
  const rankedUp        = paceEarned > 0 && prevRank !== currentRank;
  const paceDisplay     = usePaceCountUp(paceEarned);

  const { showAward, setShowAward, rankUpScale, rankUpOpacity } = useRunCelebration(rankedUp, runData.newAwards);

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
  const calories = useMemo(
    () => estimateCalories(weightKg, runData.distance, runData.duration),
    [runData.distance, runData.duration, weightKg],
  );
  const { stolen, newZones, noGain, noGainReason, claimedArea, headline } = computeOutcome(runData, serverResult, serverAreaM2, ride, sport);
  const startMs = runData.startTime ?? Date.now();
  const authorLabel = me.name || authorName;
  const { terr, zoneLabel } = zoneForHero(runData, { noGain, claimedArea }, serverResult);
  const parts = buildPaceParts(runData, serverResult, { distance: C.t1, stolen: zone.rival, newZone: zone.own, streak: C.t3 });

  // Runner rank progress
  const displayRank = capFirst(currentRank);
  const { pct, nextName, paceToNext } = rankProgress(paceTotalEarned, currentRank);

  const { storyCaptureRef, openReplay, shareRun, shareStory, shareSticker } = useRunShare({
    runId, runData, ride, sport, headline, startMs, stored, displayName: authorLabel, calories, distanceUnit,
    mapVisibility: { radiusM: settings.mapHideRadiusM, hideAll: settings.mapHideAll, hidden: !!mapHidden, places: settings.privatePlaces },
    zoneCount: newZones + stolen, navigation,
  });

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

  const defaultTitle = activityTitle({ activityType: activityType ?? 'run', startTime: runData.startTime ?? Date.now() });

  return (
    <View style={ss.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <RunSummaryHeader
          topInset={insets.top}
          sport={sport}
          ride={ride}
          runData={runData}
          stored={stored}
          headline={headline}
          finishLabel={finishTimeLabel(startMs, runData.duration)}
          terr={terr}
          zoneLabel={zoneLabel}
          stolen={stolen}
          distanceUnit={distanceUnit}
          authorName={authorLabel || undefined}
          authorPhoto={me.avatarUrl}
          whenLine={whenLineFor(startMs, stored?.importSource)}
          prLine={fasterThanUsual(ride, recentAvgPace, runData.distance, runData.duration)}
          extraStats={extraStatsFor(stored, distanceUnit)}
          onClose={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
          onShare={shareRun}
          onOpenMap={() => navigation.navigate('TerritoryMap', {})}
          onReplay={openReplay}
        />

        <RunEditRow edited={edited} defaultTitle={defaultTitle} onPress={() => setEditOpen(true)} />

        <RunVerdictNotices
          ride={ride}
          fromRunScreen={!!passedData}
          hasGroundAction={!!(runData.territory || runData.actionType)}
          confirm={confirm}
          noGainReason={noGainReason}
          rejected={!!serverResult?.rejectedReason}
        />

        {!ride && <>
        {rankedUp && <RankUpBanner rankName={displayRank} scale={rankUpScale} opacity={rankUpOpacity} />}

        <RunShareActions
          post={post}
          onOpenComments={() => setCommentsOpen(true)}
          onShareStory={shareStory}
          onShareSticker={shareSticker}
          onReplay={openReplay}
        />

        <RunTerritoryTiles
          stolen={stolen}
          newZones={newZones}
          fortified={runData.actionType === 'fortify'}
          paceEarned={paceEarned}
          paceDisplay={paceDisplay}
        />

        <View style={{ marginHorizontal: Spacing.gutter, marginBottom: 12 }}><RunCheers runId={runId} runStart={runData.startTime} /></View>
        {splits.length > 0 && <View style={ss.card}><SplitsList splits={splits} /></View>}

        <RunPaceCard
          paceEarned={paceEarned}
          paceDisplay={paceDisplay}
          cappedAt={runData.cappedAt}
          capped={capped}
          plus={plus}
          parts={parts}
          onSeePlus={() => navigation.navigate('Subscription', { reason: 'pace_cap' })}
        />

        {zoneLimited && !plus && <RunZoneLimitCard onUpgrade={() => navigation.navigate('Subscription', { reason: 'zone_limit' })} />}

        <View style={ss.card}><ActivityCharts runId={runId} isRide={activityType === 'cycle'} /></View>
        <AnalysisCards runId={runId} />

        <RunShoeSection allShoes={allShoes} runShoe={runShoe} shoeTotalKm={shoeTotalKm} onPress={() => setShowShoeDrawer(true)} />

        <PaceXSummaryCard
          runId={runId}
          plus={plus}
          runsCompleted={runsCompleted}
          onOpenPlus={() => navigation.navigate('Subscription', { reason: 'debrief' })}
          summary={paceXSummary(runData, serverResult, recentAvgPace, stolen, paceEarned, capped)}
        />

        <RunRankCard rankName={displayRank} isTopRank={currentRank === 'sovereign'} nextName={nextName} paceToNext={paceToNext} pct={pct} />
        </>}

        <RunMapVisibilityRow
          hideAll={!!settings.mapHideAll}
          hideRadiusM={settings.mapHideRadiusM}
          mapHidden={mapHidden}
          saving={mapSaving}
          onToggleHidden={toggleMapHidden}
          onOpenSettings={() => navigation.navigate('MapVisibility')}
        />

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
        defaultTitle={defaultTitle}
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
    root:        { flex: 1, backgroundColor: C.bg },
    loadingRoot: { alignItems: 'center', justifyContent: 'center' },
    card:        { marginHorizontal: Spacing.gutter, marginBottom: 12 },
  });
}
