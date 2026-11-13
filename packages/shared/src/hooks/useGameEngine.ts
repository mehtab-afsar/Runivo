import { useState, useEffect, useCallback } from 'react';
import { GAME_CONFIG } from '../services/config';
import { localDateString } from '../services/store';
import {
  getPlayer,
  savePlayer,
  initializePlayer,
  saveRun,
  saveTerritory,
  getTerritoryPolygons,
  getDefaultShoe,
  getRuns,
  StoredPlayer,
  StoredRun,
} from '../services/store';
import {
  buildTerritoryPolygon,
  calculateRunPACE,
  computeRunnerRank,
  polygonAreaM2,
} from '../services/claimEngine';
import { canClaimZone } from '../engine/entitlements';
import { corridorRing, updateStreak, paceWeekStartMs, isOnFoot, type LngLat } from '../engine/runEngine';
import type { TerritoryPolygon, RunnerRank } from '../types/game';
import { updateMissionsAfterRun } from '../services/missionStore';

// ── Award key → human-readable label ─────────────────────────────────────────
const AWARD_LABELS: Record<string, string> = {
  first_claim:        'First Claim',
  first_blood:        'First Blood',
  park_capture:       'Park Capture',
  district_owner:     'District Owner',
  quarter_owner:      'Quarter Owner',
  domain_lord:        'Domain Lord',
  city_builder:       'City Builder',
  defender:           'Defender',
  sovereign_rank:     'Sovereign',
  first_5k:           'First 5K',
  first_10k:          '10K Club',
  first_halfmarathon: 'Half Done',
  km_100:             '100km',
  km_500:             '500km Club',
  km_1000:            '1000km',
  streak_7:           'On Fire',
  streak_30:          'Unstoppable',
  early_bird:         'Early Bird',
  sub_5:              'Sub-5',
  sub_4_30:           'Sub-4:30',
  monthly_100:        'Century Month',
};

async function checkAndAwardAchievements(params: {
  run: StoredRun;
  territory: TerritoryPolygon | null;
  rivalZonesStolen: number;
  defendedZonesCount: number;
  player: StoredPlayer;
  totalKm: number;
}): Promise<string[]> {
  const { run, territory, rivalZonesStolen, defendedZonesCount, player, totalKm } = params;
  const earned = new Set<string>([
    ...(player.earnedAwardIds ?? []),
    ...(player.unlockedAchievements ?? []),
  ]);
  const newAwards: string[] = [];
  const grant = (id: string) => { if (!earned.has(id)) { earned.add(id); newAwards.push(id); } };

  const distKm = run.distanceMeters / 1000;
  const runHour = new Date(run.startTime).getHours();

  if (territory) grant('first_claim');
  if (territory?.tier === 'district' || territory?.tier === 'quarter' || territory?.tier === 'domain') grant('district_owner');
  if (territory?.tier === 'quarter' || territory?.tier === 'domain') grant('quarter_owner');
  if (territory?.tier === 'domain') grant('domain_lord');
  if (territory?.isLoopFill) grant('park_capture');
  if (rivalZonesStolen > 0) grant('first_blood');
  if (defendedZonesCount > 0) grant('defender');
  if (totalKm * 200 >= 500_000) grant('city_builder');
  if ((player.paceTotalEarned ?? 0) >= 4000) grant('sovereign_rank');

  if (distKm >= 5)  grant('first_5k');
  if (distKm >= 10) grant('first_10k');
  if (distKm >= 21) grant('first_halfmarathon');
  if (totalKm >= 100)  grant('km_100');
  if (totalKm >= 500)  grant('km_500');
  if (totalKm >= 1000) grant('km_1000');

  if ((player.streakDays ?? 0) >= 7)  grant('streak_7');
  if ((player.streakDays ?? 0) >= 30) grant('streak_30');

  // early_bird: check if 5 runs before 6am (including this one)
  if (runHour < 6) {
    const allRuns = await getRuns(500);
    const earlyCount = allRuns.filter(r => new Date(r.startTime).getHours() < 6).length;
    if (earlyCount >= 5) grant('early_bird');
  }

  // Awards are no longer written to Supabase from here. This used to insert
  // directly into user_awards, but RLS only ever checked user_id = auth.uid()
  // — never the award itself — so any signed-in user could grant themselves
  // any award via a direct REST call. The authoritative grant now happens
  // server-side in process-run-territory (grant_award / sync_user_awards),
  // triggered from postRunSync shortly after this run finishes. What's
  // returned here is purely a same-device, optimistic guess — used to show
  // the unlock celebration immediately and to update the local player record
  // for instant display — and gets reconciled against the server's real
  // user_awards rows the same way every other PACE field already is.
  return newAwards;
}

// Resets paceWeeklyEarned when a new Monday (UTC 00:00) has passed since last reset.
function checkAndResetWeeklyPace(p: StoredPlayer): StoredPlayer {
  const resetAt = p.paceWeeklyResetAt ? new Date(p.paceWeeklyResetAt) : new Date(0);
  const now = new Date();
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const lastMonday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday,
  ));
  if (resetAt < lastMonday) {
    return { ...p, paceWeeklyEarned: 0, paceWeeklyResetAt: lastMonday.toISOString() };
  }
  return p;
}

export interface GameEngineState {
  player: StoredPlayer | null;
  loading: boolean;
  playerTerritoryCount: number;
}

// Backward-compat re-export — delegates to claimEngine geometry functions.
export function bufferPath(
  points: { lat: number; lng: number }[],
  radiusM: number,
): [number, number][] {
  if (points.length < 2) return [];
  return corridorRing(points.map(p => [p.lng, p.lat] as LngLat), radiusM);
}

export { polygonAreaM2 };

export function useGameEngine() {
  const [player, setPlayer]               = useState<StoredPlayer | null>(null);
  const [loading, setLoading]             = useState(true);
  const [playerTerritoryCount, setPlayerTerritoryCount] = useState(0);

  useEffect(() => { loadPlayer(); }, []);

  const loadPlayer = async () => {
    setLoading(true);
    let p = await getPlayer();
    if (!p) {
      p = await initializePlayer('Runner');
    }
    p = checkAndResetWeeklyPace(p);
    if (p.paceWeeklyEarned === 0 && p.paceWeeklyResetAt) {
      await savePlayer(p);
    }

    const polygons = await getTerritoryPolygons(p.id);
    setPlayerTerritoryCount(polygons.length);
    setPlayer(p);
    setLoading(false);
  };

  const endRunSession = useCallback(
    async (runData: {
      id: string;
      activityType: string;
      startTime: number;
      endTime: number;
      distanceMeters: number;
      durationSec: number;
      avgPace: string;
      elevationGainM?: number;
      gpsPoints: {
        lat: number;
        lng: number;
        timestamp: number;
        speed: number;
        accuracy: number;
        altitude: number;
      }[];
    }) => {
      if (!player) return;

      // CRITICAL PATH: `player` is React state loaded once when this hook's component
      // (ActiveRunScreen, via useActiveRun) mounted, at the START of this run. For a
      // long run, or if a background sync from an earlier run's postRunSync() completes
      // while this run is still in progress, that snapshot can be stale by the time we
      // credit PACE below. Re-read fresh right before deriving anything from it — streak,
      // totals, and especially the PACE fields — so a concurrent correction is never
      // overwritten by this run's crediting. Falls back to the closure's `player` only if
      // the record vanished between the guard above and here (should not happen).
      const freshPlayer = (await getPlayer()) ?? player;

      // 1. Build territory polygon client-side
      // A free runner already holding 10 zones claims nothing (the server
      // refuses it too, territoryCapReached), so don't draw or pay for one.
      const ownedBefore = (await getTerritoryPolygons(freshPlayer.id)).length;
      const buildResult = canClaimZone(ownedBefore, freshPlayer.subscriptionTier)
        ? buildTerritoryPolygon(runData.gpsPoints, runData.activityType)
        : null;

      // 2. Streak — the server's rule: only the day's first meaningful run
      // moves it. The app uses the runner's local day for instant feedback;
      // pullProfile() brings back the server's (UTC) value after sync.
      const today = localDateString();
      // Rides don't move the running streak (server rule, see isOnFoot).
      const meetsMinimumEffort = isOnFoot(runData.activityType)
        && runData.distanceMeters >= GAME_CONFIG.MIN_MEANINGFUL_RUN_DISTANCE_M;
      const streak = updateStreak({
        streakDays: freshPlayer.streakDays,
        lastRunDay: freshPlayer.lastRunDate,
        today,
        meaningful: meetsMinimumEffort,
      });
      const newStreak = streak.streakDays;
      const newLastRunDate = streak.lastRunDay;

      const missionResult = await updateMissionsAfterRun({
        distanceKm:          runData.distanceMeters / 1000,
        territoriesClaimed:  buildResult ? [buildResult.tier] : [],
        enemyCaptured:       0,
        fastKmCount:         0,
        defendedZonesCount:  0,
        rivalZonesStolen:    0,
      });

      const defaultShoe = await getDefaultShoe().catch(() => undefined);

      // Calculated before the run is saved so the optimistic PACE credit can be
      // stamped onto the run row itself (StoredRun.xpEarned) — sync.ts's post-sync
      // delta reconciliation reads this value back to avoid double-crediting the
      // server-authoritative amount on top of what was already credited here.
      const distanceKm = runData.distanceMeters / 1000;
      // A new PACE week starts Monday 00:00 UTC; count from zero if the stored
      // total belongs to last week.
      const weekStart = paceWeekStartMs(Date.now());
      const weeklyEarned = freshPlayer.paceWeeklyResetAt && Date.parse(freshPlayer.paceWeeklyResetAt) >= weekStart
        ? (freshPlayer.paceWeeklyEarned ?? 0)
        : 0;
      const paceResult = calculateRunPACE({
        distanceKm,
        newZonesClaimed:  buildResult ? 1 : 0,
        stolenZones:      0,
        streakDays:       newStreak,
        streakAdvanced:   streak.advanced,
        paceWeeklyEarned: weeklyEarned,
        tier:             freshPlayer.subscriptionTier ?? 'free',
        activityType:     runData.activityType,
      });

      const run: StoredRun = {
        ...runData,
        territoriesClaimed:   buildResult ? ['pending'] : [],
        territoriesFortified: [],
        enemyCaptured: 0,
        preRunLevel: 0,
        synced: false,
        shoeId: defaultShoe?.id,
        elevationGainM: runData.elevationGainM,
        xpEarned: paceResult.paceEarned,
      };
      const safeGpsPoints = run.gpsPoints.filter(p =>
        isFinite(p.lat) && isFinite(p.lng) &&
        isFinite(p.accuracy) && isFinite(p.speed) &&
        isFinite(p.timestamp)
      );
      await saveRun({ ...run, gpsPoints: safeGpsPoints });

      // 3. Save territory polygon if generated
      let territory: TerritoryPolygon | null = null;
      if (buildResult) {
        territory = {
          id:             crypto.randomUUID(),
          runId:          runData.id,
          ownerId:        freshPlayer.id,
          ownerName:      freshPlayer.username,
          polygon:        buildResult.polygon,
          areaM2:         buildResult.areaM2,
          freshness:      100,
          lastDefendedAt: new Date().toISOString(),
          claimedAt:      new Date().toISOString(),
          isLoopFill:     buildResult.isLoopFill,
          tier:           buildResult.tier,
          synced:         false,
        };
        await saveTerritory(territory);
      }

      // 4. Player PACE fields already computed above (paceResult) — base is freshPlayer, not the stale closure
      const newPaceTotalEarned = (freshPlayer.paceTotalEarned ?? 0) + paceResult.paceEarned;
      const newRunnerRank: RunnerRank = computeRunnerRank(newPaceTotalEarned);

      const updatedPlayer: StoredPlayer = {
        ...freshPlayer,
        totalDistanceKm:         freshPlayer.totalDistanceKm + distanceKm,
        totalRuns:               freshPlayer.totalRuns + 1,
        totalTerritoriesClaimed: freshPlayer.totalTerritoriesClaimed + (buildResult ? 1 : 0),
        streakDays:              newStreak,
        lastRunDate:             newLastRunDate,
        paceBalance:             (freshPlayer.paceBalance ?? 0) + paceResult.paceEarned,
        paceTotalEarned:         newPaceTotalEarned,
        paceWeeklyEarned:        weeklyEarned + paceResult.paceEarned,
        paceWeeklyResetAt:       weeklyEarned === 0 ? new Date(weekStart).toISOString() : freshPlayer.paceWeeklyResetAt,
        runnerRank:              newRunnerRank,
      };

      const newlyUnlockedAwards = await checkAndAwardAchievements({
        run,
        territory,
        rivalZonesStolen: 0,
        defendedZonesCount: 0,
        player: updatedPlayer,
        totalKm: updatedPlayer.totalDistanceKm,
      });
      updatedPlayer.earnedAwardIds = [
        ...(updatedPlayer.earnedAwardIds ?? updatedPlayer.unlockedAchievements ?? []),
        ...newlyUnlockedAwards,
      ];

      await savePlayer(updatedPlayer);
      setPlayer(updatedPlayer);

      const polygons = await getTerritoryPolygons(updatedPlayer.id);
      setPlayerTerritoryCount(polygons.length);

      const rankOrder: RunnerRank[] = ['pacer', 'strider', 'chaser', 'hunter', 'sovereign'];
      const nextRankName = rankOrder[rankOrder.indexOf(newRunnerRank) + 1];
      const runnerRankPaceToNext = nextRankName
        ? GAME_CONFIG.RUNNER_RANK_THRESHOLDS[nextRankName] - newPaceTotalEarned
        : 0;

      return {
        run,
        paceEarned:           paceResult.paceEarned,
        paceBreakdown:        paceResult.breakdown,
        cappedAt:             paceResult.cappedAt,
        territory,
        runnerRank:           newRunnerRank,
        paceTotalEarned:      newPaceTotalEarned,
        runnerRankPaceToNext: Math.max(0, runnerRankPaceToNext),
        newStreak,
        completedMissions: missionResult.newlyCompleted,
        newlyUnlockedAwards: newlyUnlockedAwards.map(key => ({
          key,
          label: AWARD_LABELS[key] ?? key,
        })),
      };
    },
    [player],
  );

  return {
    player,
    loading,
    playerTerritoryCount,
    endRunSession,
    reloadPlayer: loadPlayer,
  };
}
