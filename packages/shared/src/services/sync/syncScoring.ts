/**
 * Server scoring for an uploaded run: invokes the idempotent `process-run-territory`
 * edge function (PostGIS steal/claim logic, PACE, streaks), folds the server's verdict
 * into the local run and player, then fires the follow-ups (AI debrief, milestone card).
 *
 * The server is idempotent per run, so a retry can never pay twice; a failure here only
 * means the run is scored on the next sync.
 */
import { supabase } from '../supabase';
import { isPlus } from '../../engine/entitlements';
import {
  getPlayer, savePlayer, saveRun, getRunById, getTerritoryPolygons, deleteTerritory, type StoredRun,
} from '../store';
import type { TerritoryTier } from '../../types/game';
import { hasAiConsent } from '../aiConsent';
import { reportSyncError } from './syncQueue';

// AI COACH ENABLEMENT: the app's own FEATURES.AI_COACH flag, mirrored here. This package
// can't import apps/mobile's config (wrong dependency direction: shared is also used by
// apps/web), so the app calls setAiCoachEnabled() once at boot, the same pattern as
// setSoundEnabled/setHapticEnabled in the theme layer. Without it the auto post-run
// debrief called the ai-coach edge function (sending heart rate, HRV, cadence and calorie
// data to Anthropic) on every run for a feature no user could see. Defaults to false.
let _aiCoachEnabled = false;
export function setAiCoachEnabled(enabled: boolean): void { _aiCoachEnabled = enabled; }

const TIER_ORDER = ['patch', 'block', 'district', 'quarter', 'domain'];

function computeLargestTier(polygons: { tier: string }[]): string {
  return polygons.reduce((best, p) =>
    TIER_ORDER.indexOf(p.tier) > TIER_ORDER.indexOf(best) ? p.tier : best, 'patch');
}

type ServerResult = NonNullable<StoredRun['serverResult']>;

/** What process-run-territory returns (or what a permanent rejection is mapped to). */
interface ScoreResult {
  paceAdjustment?: number;
  rejected?: boolean;
  rejectedReason?: string;
  flagged?: string;
  verifiedDistanceKm?: number;
  territoryAreaM2?: number;
  claimedAreaM2?: number;
  newZonesClaimed?: number;
  rivalZonesStolen?: number;
  paceCapped?: boolean;
  territoryCapReached?: boolean;
  streakDays?: number;
  paceBreakdown?: ServerResult['paceBreakdown'];
}

/**
 * A permanent rejection (too short, too little GPS, trace too large, doesn't match the
 * stored run) will never succeed on retry. It is recorded as scored with nothing earned:
 * the correction drops the PACE shown optimistically, and later syncs stop re-sending the
 * whole trace. Anything else (network, 401/403, 404, 409 in progress, 5xx) is retried.
 */
async function resultOrRejection(data: ScoreResult | null, scoreError: unknown): Promise<ScoreResult | null> {
  if (!scoreError) return data;
  const ctx = (scoreError as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
  const status = ctx?.status;
  if (status !== 400 && status !== 413 && status !== 422) return data;
  // Keep the server's reason so the run summary can say why.
  const body = await ctx?.json?.().catch(() => null) as { error?: string; reason?: string } | null;
  return { paceAdjustment: 0, rejected: true, rejectedReason: body?.reason ?? body?.error ?? 'rejected' };
}

/** Applies the server's number once: after this the run carries it, so a retry finds nothing to correct. */
async function applyServerScore(run: StoredRun, result: ScoreResult, serverPace: number): Promise<void> {
  const latestRun = (await getRunById(run.id)) ?? run;
  if (latestRun.serverProcessed !== true) {
    const delta = serverPace - (latestRun.xpEarned ?? 0);
    const player = await getPlayer();
    if (player && delta !== 0) {
      await savePlayer({
        ...player,
        paceBalance:      Math.max(0, (player.paceBalance      ?? 0) + delta),
        paceTotalEarned:  Math.max(0, (player.paceTotalEarned  ?? 0) + delta),
        paceWeeklyEarned: Math.max(0, (player.paceWeeklyEarned ?? 0) + delta),
      });
    }
    await saveRun({
      ...latestRun,
      synced: true,
      serverProcessed: true,
      xpEarned: serverPace,
      ...(typeof result.verifiedDistanceKm === 'number' && { verifiedDistanceKm: result.verifiedDistanceKm }),
      ...(typeof result.territoryAreaM2 === 'number' && { claimedAreaM2: result.claimedAreaM2 ?? 0, territoryAreaM2: result.territoryAreaM2 }),
      // What the server decided, for the run summary and the paywall moments.
      serverResult: {
        newZones:            Number(result.newZonesClaimed) || 0,
        stolenZones:         Number(result.rivalZonesStolen) || 0,
        paceCapped:          result.paceCapped === true,
        territoryCapReached: result.territoryCapReached === true,
        streakDays:          Number(result.streakDays) || 0,
        claimedAreaM2:       Number(result.claimedAreaM2) || 0,
        ...(result.paceBreakdown && typeof result.paceBreakdown === 'object' && { paceBreakdown: result.paceBreakdown }),
        ...(result.rejected === true && { rejectedReason: String(result.rejectedReason ?? 'rejected') }),
        ...(typeof result.flagged === 'string' && { rejectedReason: result.flagged }),
      },
    });
  }
  // The optimistic zone drawn at run end is replaced by the server's real shape;
  // keeping both counted the same ground twice.
  const optimistic = (await getTerritoryPolygons()).filter(t => t.runId === run.id && !t.synced);
  for (const t of optimistic) await deleteTerritory(t.id);
}

/** Auto post-run debrief. Fire-and-forget; only Plus runners get it (the server refuses it otherwise). */
async function postRunDebrief(runId: string, userId: string): Promise<void> {
  try {
    // Sends the run to the third-party AI, so only after the runner agreed (App Store
    // 5.1.2(i)); the server refuses without it as well.
    if (!(await hasAiConsent())) return;
    const { data: debriefData } = await supabase.functions.invoke('ai-coach', {
      body: { feature: 'post_run', runId },
    });
    if (!debriefData?.data) return;
    const p = debriefData.data as { praise?: string; analysis?: string; suggestion?: string; recovery?: string };
    const content = [p.praise, p.analysis, p.suggestion, p.recovery].filter(Boolean).join('\n\n');
    if (!content) return;
    await supabase.from('coach_messages').insert({
      user_id: userId, role: 'assistant', content, auto_triggered: true, created_at: new Date().toISOString(),
    });
  } catch (err) {
    reportSyncError('postRunDebrief', err, { runId });
  }
}

/** Milestone feed card when the runner's largest territory tier improved. Fire-and-forget. */
async function postTierMilestone(userId: string): Promise<void> {
  try {
    const localPolygons = await getTerritoryPolygons();
    if (localPolygons.length === 0) return;
    const newLargestTier  = computeLargestTier(localPolygons) as TerritoryTier;
    const currentPlayer   = await getPlayer();
    const prevLargestTier = currentPlayer?.largestTierAchieved ?? 'patch';
    if (TIER_ORDER.indexOf(newLargestTier) <= TIER_ORDER.indexOf(prevLargestTier)) return;
    await supabase.from('feed_posts').insert({
      user_id:           userId,
      post_type:         'milestone',
      territory_tier:    newLargestTier,
      territory_area_m2: localPolygons.reduce((s, p) => s + p.areaM2, 0),
      runner_rank:       currentPlayer?.runnerRank ?? 'pacer',
      pace_earned:       0,
      distance_km:       0,
    });
    if (currentPlayer) await savePlayer({ ...currentPlayer, largestTierAchieved: newLargestTier });
  } catch (err) {
    reportSyncError('postTierMilestone', err);
  }
}

/**
 * Scores one uploaded run on the server and applies the result. Never throws: a failure
 * is reported and the run is re-evaluated on the next sync (PACE from stolen zones is
 * credited then).
 */
export async function scoreRun(run: StoredRun, user: { id: string }): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    // Treadmill runs are logged by hand: nothing to claim, nothing to score.
    if (!session.session || run.activityType === 'treadmill') return;

    const { data, error: scoreError } = await supabase.functions.invoke('process-run-territory', {
      body: {
        runId:            run.id,
        userId:           user.id,
        gpsPoints:        run.gpsPoints,   // full original GPS trace (not simplified)
        activityType:     run.activityType,
        distanceKm:       run.distanceMeters / 1000,
        durationSec:      run.durationSec,
        clientPaceEarned: run.xpEarned ?? 0,
        ...(run.mockedLocation && { mockedLocation: true }),
      },
    });
    const result = await resultOrRejection(data, scoreError);
    if (result && typeof result.paceAdjustment === 'number') {
      await applyServerScore(run, result, result.paceAdjustment);
    }

    // AI stays in Plus (PRD): only Plus runners get the auto debrief. Gated on the app flag
    // (see setAiCoachEnabled); not awaited, a debrief must never delay the sync.
    const tierForDebrief = (await getPlayer())?.subscriptionTier;
    if (_aiCoachEnabled && isPlus(tierForDebrief)) void postRunDebrief(run.id, user.id);
    void postTierMilestone(user.id);
  } catch (err) {
    reportSyncError('scoreRun', err, { runId: run.id });
  }
}
