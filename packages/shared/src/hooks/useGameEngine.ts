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
  buildCorridorPolygon,
  polygonAreaM2,
} from '../services/claimEngine';
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

  if (newAwards.length > 0) {
    try {
      const { supabase } = await import('../services/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Promise.all(newAwards.map(id =>
          Promise.resolve(supabase.from('user_awards').insert({ user_id: user.id, award_id: id })).catch(() => {})
        ));
      }
    } catch { /* offline — awards persist locally */ }
  }
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
  return buildCorridorPolygon(
    points.map(p => ({ ...p, timestamp: 0, speed: 0 })),
    radiusM,
  );
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

      // 1. Build territory polygon client-side
      const buildResult = buildTerritoryPolygon(runData.gpsPoints, runData.activityType);

      // 2. Save run to local store
      const today = localDateString();
      const yesterday = localDateString(new Date(Date.now() - GAME_CONFIG.MS_PER_DAY));
      const oldStreak = player.streakDays;
      let newStreak = oldStreak;
      if (player.lastRunDate === yesterday) {
        newStreak += 1;
      } else if (player.lastRunDate !== today) {
        newStreak = 1;
      }

      const missionResult = await updateMissionsAfterRun({
        distanceKm:          runData.distanceMeters / 1000,
        territoriesClaimed:  buildResult ? [buildResult.tier] : [],
        enemyCaptured:       0,
        fastKmCount:         0,
        defendedZonesCount:  0,
        rivalZonesStolen:    0,
      });

      const defaultShoe = await getDefaultShoe().catch(() => undefined);

      const run: StoredRun = {
        ...runData,
        territoriesClaimed:   buildResult ? ['pending'] : [],
        territoriesFortified: [],
        enemyCaptured: 0,
        preRunLevel: 0,
        synced: false,
        shoeId: defaultShoe?.id,
        elevationGainM: runData.elevationGainM,
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
          ownerId:        player.id,
          ownerName:      player.username,
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

      // 4. Calculate PACE (0 stolen zones — server refines after sync)
      const distanceKm = runData.distanceMeters / 1000;
      const paceResult = calculateRunPACE({
        distanceKm,
        newZonesClaimed: buildResult ? 1 : 0,
        stolenZones:     0,
        streakDays:      newStreak,
        paceWeeklyEarned: player.paceWeeklyEarned ?? 0,
        isPremium:       false,
      });

      // 5. Update player PACE fields
      const newPaceTotalEarned = (player.paceTotalEarned ?? 0) + paceResult.paceEarned;
      const newRunnerRank: RunnerRank = computeRunnerRank(newPaceTotalEarned);

      const updatedPlayer: StoredPlayer = {
        ...player,
        totalDistanceKm:         player.totalDistanceKm + distanceKm,
        totalRuns:               player.totalRuns + 1,
        totalTerritoriesClaimed: player.totalTerritoriesClaimed + (buildResult ? 1 : 0),
        streakDays:              newStreak,
        lastRunDate:             today,
        paceBalance:             (player.paceBalance ?? 0) + paceResult.paceEarned,
        paceTotalEarned:         newPaceTotalEarned,
        paceWeeklyEarned:        (player.paceWeeklyEarned ?? 0) + paceResult.paceEarned,
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

      const polygons = await getTerritoryPolygons(player.id);
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
