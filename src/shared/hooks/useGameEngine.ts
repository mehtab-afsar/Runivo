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
import { calculateRunDiamonds } from '@shared/services/diamonds';

export interface GameEngineState {
  player: StoredPlayer | null;
  loading: boolean;
  playerTerritoryCount: number;
  claimState: ClaimState | null;
  sessionStats: {
    claimed: number;
    xp: number;
    coins: number;
  };
}

/**
 * Build a corridor polygon (GeoJSON [lng,lat][] closed ring) around a GPS path.
 * radiusM = half-width of the corridor in metres.
 */
function bufferPath(
  points: { lat: number; lng: number }[],
  radiusM: number
): [number, number][] {
  if (points.length < 2) return [];

  const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((avgLat * Math.PI) / 180);

  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let i = 0; i < points.length; i++) {
    const { lat, lng } = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];

    // Direction vector in metres
    const dx = (next.lng - prev.lng) * lngScale;
    const dy = (next.lat - prev.lat) * latScale;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 0.001) {
      if (left.length > 0) {
        left.push(left[left.length - 1]);
        right.push(right[right.length - 1]);
      } else {
        left.push([lng, lat]);
        right.push([lng, lat]);
      }
      continue;
    }

    // Perpendicular unit vector
    const px = -dy / len;
    const py = dx / len;

    const offLng = (px * radiusM) / lngScale;
    const offLat = (py * radiusM) / latScale;

    left.push([lng + offLng, lat + offLat]);
    right.push([lng - offLng, lat - offLat]);
  }

  const coords: [number, number][] = [...left, ...right.reverse()];
  coords.push(coords[0]); // close the ring
  return coords;
}

/** Approximate polygon area in m² using the shoelace formula. */
function polygonAreaM2(coords: [number, number][]): number {
  const n = coords.length - 1;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }
  area = Math.abs(area) / 2;
  // Convert deg² → m²
  const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return area * 111320 * 111320 * Math.cos((avgLat * Math.PI) / 180);
}

export function useGameEngine() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerTerritoryCount, setPlayerTerritoryCount] = useState(0);
  const [claimState, setClaimState] = useState<ClaimState | null>(null);
  const [sessionStats, setSessionStats] = useState({ claimed: 0, xp: 0, coins: 0 });
  const [sessionEnergy, setSessionEnergy] = useState(0);

  const claimEngineRef = useRef<ClaimEngine | null>(null);
  const claimListenersRef = useRef<((event: ClaimEvent) => void)[]>([]);
  // Tracks energy during active run (real-time regen from distance)
  const sessionEnergyRef = useRef<number>(0);

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

    const allTerritories = await getAllTerritories();
    const ownedCount = allTerritories.filter(t => t.ownerId === p!.id).length;
    setPlayerTerritoryCount(ownedCount);

    setPlayer(p);
    setLoading(false);
  };

  const startClaimEngine = useCallback(async () => {
    if (!player) return;

    const engine = new ClaimEngine(player.id);
    claimEngineRef.current = engine;
    // Seed session energy from current player energy
    sessionEnergyRef.current = player.energy;
    setSessionEnergy(player.energy);

    const unsub = engine.onEvent((event) => {
      claimListenersRef.current.forEach(l => l(event));
      setSessionStats(engine.getSessionStats());
      // Deduct energy when a claim completes
      if (event.type === 'claimed') {
        sessionEnergyRef.current = Math.max(
          0,
          sessionEnergyRef.current - GAME_CONFIG.ENERGY_COST_CLAIM
        );
        setSessionEnergy(sessionEnergyRef.current);
      }
    });

    return unsub;
  }, [player]);

  const updateClaim = useCallback(
    (lat: number, lng: number, speed: number, accuracy: number, distanceDeltaKm = 0) => {
      if (!claimEngineRef.current) return null;
      // Real-time energy regen from running distance
      if (distanceDeltaKm > 0) {
        const regen = distanceDeltaKm * GAME_CONFIG.ENERGY_REGEN_PER_KM_RUN;
        sessionEnergyRef.current = Math.min(
          GAME_CONFIG.MAX_ENERGY,
          sessionEnergyRef.current + regen
        );
        setSessionEnergy(Math.round(sessionEnergyRef.current));
      }
      const canClaim = sessionEnergyRef.current >= GAME_CONFIG.ENERGY_COST_CLAIM;
      const state = claimEngineRef.current.update(lat, lng, speed, accuracy, canClaim);
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

      // Build a territory polygon from the run path (min 200 m to qualify)
      const territoriesToSave: StoredTerritory[] = [];
      const MIN_CLAIM_DISTANCE_M = 200;

      if (runData.distanceMeters >= MIN_CLAIM_DISTANCE_M && runData.gpsPoints.length >= 2) {
        // Downsample GPS points to at most 200 for efficiency
        const pts = runData.gpsPoints;
        const step = Math.max(1, Math.floor(pts.length / 200));
        const sampled = pts.filter((_, i) => i % step === 0);
        if (sampled.length < 2) sampled.push(pts[pts.length - 1]);

        const polygon = bufferPath(sampled, 20); // 20 m each side
        const areaM2 = polygonAreaM2(polygon);

        territoriesToSave.push({
          id: crypto.randomUUID(),
          polygon,
          areaM2,
          runId: runData.id,
          ownerId: player.id,
          ownerName: player.username,
          defense: GAME_CONFIG.CAPTURED_INITIAL_DEFENSE,
          tier: 'common',
          claimedAt: Date.now(),
          lastFortifiedAt: Date.now(),
        });
      }

      const territoryIds = territoriesToSave.map(t => t.id);

      const distanceXP = Math.floor((runData.distanceMeters / 1000) * GAME_CONFIG.XP_PER_KM);
      const distanceCoins = Math.floor((runData.distanceMeters / 1000) * GAME_CONFIG.COINS_PER_KM);
      const totalXP = stats.xp + distanceXP;
      const totalCoins = stats.coins + distanceCoins;

      const preRunLevel = player.level;
      const newXP = player.xp + totalXP;
      const newLevel = calculateLevel(newXP);

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const oldStreak = player.streakDays;
      let newStreak = oldStreak;
      if (player.lastRunDate === yesterday) {
        newStreak += 1;
      } else if (player.lastRunDate !== today) {
        newStreak = 1;
      }

      const missionResult = await updateMissionsAfterRun({
        distanceKm: runData.distanceMeters / 1000,
        territoriesClaimed: territoryIds,
        territoriesFortified: [],
        enemyCaptured: 0,
        hexesVisited: 0,
        enemyZoneDistanceKm: 0,
        fastKmCount: 0,
      });

      // Diamond economy (PRD Part 4): level-up milestones + streak milestones + mission diamonds
      const missionDiamonds = missionResult.newlyCompleted.reduce(
        (sum: number, m: { rewards?: { diamonds?: number } }) => sum + (m.rewards?.diamonds ?? 0),
        0
      );
      const diamondsEarned = calculateRunDiamonds({
        oldLevel: preRunLevel,
        newLevel,
        oldStreak,
        newStreak,
        missionDiamonds,
      });

      const run: StoredRun = {
        ...runData,
        territoriesClaimed: territoryIds,
        territoriesFortified: [],
        xpEarned: totalXP,
        coinsEarned: totalCoins,
        diamondsEarned,
        enemyCaptured: 0,
        preRunLevel,
        synced: false,
      };
      await saveRun(run);

      if (territoriesToSave.length > 0) {
        await saveTerritories(territoriesToSave);
      }

      const updatedPlayer: StoredPlayer = {
        ...player,
        xp: newXP,
        level: newLevel,
        coins: player.coins + totalCoins,
        diamonds: (player.diamonds ?? 0) + diamondsEarned,
        totalDistanceKm: player.totalDistanceKm + runData.distanceMeters / 1000,
        totalRuns: player.totalRuns + 1,
        totalTerritoriesClaimed: player.totalTerritoriesClaimed + territoriesToSave.length,
        streakDays: newStreak,
        lastRunDate: today,
      };
      await savePlayer(updatedPlayer);
      setPlayer(updatedPlayer);

      claimEngineRef.current.reset();
      claimEngineRef.current = null;
      setClaimState(null);
      setSessionStats({ claimed: 0, xp: 0, coins: 0 });

      const allTerritories = await getAllTerritories();
      setPlayerTerritoryCount(allTerritories.filter(t => t.ownerId === player.id).length);

      return {
        run,
        xpEarned: totalXP,
        coinsEarned: totalCoins,
        diamondsEarned,
        leveledUp: newLevel > preRunLevel,
        preRunLevel,
        newLevel,
        newStreak,
        completedMissions: missionResult.newlyCompleted,
        claimedPolygons: territoriesToSave.map(t => t.polygon),
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
    sessionEnergy,
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
