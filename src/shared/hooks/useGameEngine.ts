import { useState, useEffect, useRef, useCallback } from 'react';
import { GAME_CONFIG } from '@shared/services/config';
import {
  getPlayer,
  savePlayer,
  initializePlayer,
  getAllTerritories,
  saveTerritories,
  saveRun,
  StoredPlayer,
  StoredTerritory,
  StoredRun,
} from '@shared/services/store';
import { ClaimEngine, ClaimEvent, ClaimState } from '@features/territory/services/claimEngine';
import { updateMissionsAfterRun } from '@features/missions/services/missionStore';
import { latLngToCell } from 'h3-js';

export interface GameEngineState {
  player: StoredPlayer | null;
  loading: boolean;
  playerTerritoryCount: number;
  claimState: ClaimState | null;
  sessionStats: {
    claimed: string[];
    fortified: string[];
    xp: number;
    coins: number;
  };
}

export function useGameEngine() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerTerritoryCount, setPlayerTerritoryCount] = useState(0);
  const [claimState, setClaimState] = useState<ClaimState | null>(null);
  const [sessionStats, setSessionStats] = useState({
    claimed: [] as string[],
    fortified: [] as string[],
    xp: 0,
    coins: 0,
  });

  const claimEngineRef = useRef<ClaimEngine | null>(null);
  const claimListenersRef = useRef<((event: ClaimEvent) => void)[]>([]);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    loadPlayer();
  }, []);

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const hoursSinceRegen = (now - player.lastEnergyRegen) / (1000 * 60 * 60);
      const energyGained = Math.floor(hoursSinceRegen * GAME_CONFIG.ENERGY_REGEN_PER_HOUR);

      if (energyGained >= 1 && player.energy < GAME_CONFIG.MAX_ENERGY) {
        const newEnergy = Math.min(GAME_CONFIG.MAX_ENERGY, player.energy + energyGained);
        const updated = { ...player, energy: newEnergy, lastEnergyRegen: now };
        setPlayer(updated);
        await savePlayer(updated);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [player]);

  const loadPlayer = async () => {
    setLoading(true);
    let p = await getPlayer();
    if (!p) {
      p = await initializePlayer('Runner');
    }
    setPlayer(p);

    const allTerritories = await getAllTerritories();
    const ownCount = allTerritories.filter(t => t.ownerId === p!.id).length;
    setPlayerTerritoryCount(ownCount);

    setLoading(false);
  };

  const startClaimEngine = useCallback(async () => {
    if (!player) return;

    const allTerritories = await getAllTerritories();

    const playerSet = new Set<string>();
    const worldMap = new Map<string, { ownerId: string | null; defense: number }>();

    allTerritories.forEach(t => {
      worldMap.set(t.hexId, { ownerId: t.ownerId, defense: t.defense });
      if (t.ownerId === player.id) {
        playerSet.add(t.hexId);
      }
    });

    const engine = new ClaimEngine(player.id, playerSet, worldMap);
    claimEngineRef.current = engine;
    lastUpdateTimeRef.current = Date.now();

    const unsub = engine.onEvent((event) => {
      claimListenersRef.current.forEach(l => l(event));
      setSessionStats(engine.getSessionStats());
    });

    return unsub;
  }, [player]);

  const updateClaim = useCallback(
    (lat: number, lng: number, speed: number, accuracy: number) => {
      if (!claimEngineRef.current) return null;

      const now = Date.now();
      const deltaTimeSec = (now - lastUpdateTimeRef.current) / 1000;
      lastUpdateTimeRef.current = now;

      const clampedDelta = Math.min(deltaTimeSec, 5);
      const state = claimEngineRef.current.update(lat, lng, speed, accuracy, clampedDelta);

      setClaimState(state);
      return state;
    },
    []
  );

  const onClaimEvent = useCallback((listener: (event: ClaimEvent) => void) => {
    claimListenersRef.current.push(listener);
    return () => {
      claimListenersRef.current = claimListenersRef.current.filter(l => l !== listener);
    };
  }, []);

  const endRunSession = useCallback(
    async (runData: {
      id: string;
      activityType: string;
      startTime: number;
      endTime: number;
      distanceMeters: number;
      durationSec: number;
      avgPace: string;
      gpsPoints: {
        lat: number;
        lng: number;
        timestamp: number;
        speed: number;
        accuracy: number;
      }[];
    }) => {
      if (!player || !claimEngineRef.current) return;

      const stats = claimEngineRef.current.getSessionStats();

      const run: StoredRun = {
        ...runData,
        territoriesClaimed: stats.claimed,
        territoriesFortified: stats.fortified,
        xpEarned: stats.xp + Math.floor((runData.distanceMeters / 1000) * GAME_CONFIG.XP_PER_KM),
        coinsEarned: stats.coins + Math.floor((runData.distanceMeters / 1000) * GAME_CONFIG.COINS_PER_KM),
        synced: false,
      };
      await saveRun(run);

      const distanceXP = Math.floor((runData.distanceMeters / 1000) * GAME_CONFIG.XP_PER_KM);
      const distanceCoins = Math.floor((runData.distanceMeters / 1000) * GAME_CONFIG.COINS_PER_KM);
      const totalXP = stats.xp + distanceXP;
      const totalCoins = stats.coins + distanceCoins;

      const newXP = player.xp + totalXP;
      const newLevel = calculateLevel(newXP);

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      let newStreak = player.streakDays;
      if (player.lastRunDate === yesterday) {
        newStreak += 1;
      } else if (player.lastRunDate !== today) {
        newStreak = 1;
      }

      const updatedPlayer: StoredPlayer = {
        ...player,
        xp: newXP,
        level: newLevel,
        coins: player.coins + totalCoins,
        totalDistanceKm: player.totalDistanceKm + runData.distanceMeters / 1000,
        totalRuns: player.totalRuns + 1,
        totalTerritoriesClaimed: player.totalTerritoriesClaimed + stats.claimed.length,
        streakDays: newStreak,
        lastRunDate: today,
      };
      await savePlayer(updatedPlayer);
      setPlayer(updatedPlayer);

      const territoriesToSave: StoredTerritory[] = [];
      for (const hexId of stats.claimed) {
        territoriesToSave.push({
          hexId,
          ownerId: player.id,
          ownerName: player.username,
          defense: GAME_CONFIG.INITIAL_DEFENSE,
          tier: 'common',
          claimedAt: Date.now(),
          lastFortifiedAt: Date.now(),
        });
      }
      if (territoriesToSave.length > 0) {
        await saveTerritories(territoriesToSave);
      }

      // Update daily missions
      const visitedHexes = new Set<string>();
      runData.gpsPoints.forEach(point => {
        visitedHexes.add(latLngToCell(point.lat, point.lng, 9));
      });

      const missionResult = await updateMissionsAfterRun({
        distanceKm: runData.distanceMeters / 1000,
        territoriesClaimed: stats.claimed,
        territoriesFortified: stats.fortified,
        enemyCaptured: 0,
        hexesVisited: visitedHexes.size,
        enemyZoneDistanceKm: 0,
        fastKmCount: 0,
      });

      claimEngineRef.current.reset();
      claimEngineRef.current = null;
      setClaimState(null);
      setSessionStats({ claimed: [], fortified: [], xp: 0, coins: 0 });

      const allTerritories = await getAllTerritories();
      setPlayerTerritoryCount(allTerritories.filter(t => t.ownerId === player.id).length);

      return {
        run,
        xpEarned: totalXP,
        coinsEarned: totalCoins,
        leveledUp: newLevel > player.level,
        newLevel,
        newStreak,
        completedMissions: missionResult.newlyCompleted,
      };
    },
    [player]
  );

  const addXP = useCallback(
    async (amount: number) => {
      if (!player) return;
      const newXP = player.xp + amount;
      const newLevel = calculateLevel(newXP);
      const updated = { ...player, xp: newXP, level: newLevel };
      await savePlayer(updated);
      setPlayer(updated);
      return { leveledUp: newLevel > player.level, newLevel };
    },
    [player]
  );

  return {
    player,
    loading,
    playerTerritoryCount,
    claimState,
    sessionStats,
    startClaimEngine,
    updateClaim,
    onClaimEvent,
    endRunSession,
    addXP,
    reloadPlayer: loadPlayer,
  };
}

function calculateLevel(xp: number): number {
  const levels = GAME_CONFIG.LEVEL_XP;
  let level = 1;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}
