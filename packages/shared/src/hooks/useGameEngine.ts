import { useState, useEffect, useRef, useCallback } from 'react';
import { GAME_CONFIG } from '../services/config';
import { localDateString } from '../services/store';
import { supabase } from '../services/supabase';
import {
  getPlayer,
  savePlayer,
  initializePlayer,
  getAllTerritories,
  saveTerritories,
  saveRun,
  getDefaultShoe,
  StoredPlayer,
  StoredTerritory,
  StoredRun,
} from '../services/store';
import { ClaimEngine, ClaimEvent, ClaimState } from '../services/claimEngine';
import { updateMissionsAfterRun } from '../services/missionStore';

// ── Award key → human-readable label (mirrors Profile.tsx awardSections) ─────
const AWARD_LABELS: Record<string, string> = {
  first_run:    'First Steps',
  '5k_club':    '5K Club',
  '10k_warrior':'10K Warrior',
  '50k':        '50K Explorer',
  streak_3:     'On Fire',
  streak_7:     'Week Warrior',
  streak_30:    'Monthly Grind',
  first_zone:   'Zone Claimer',
  zones_10:     'Map Maker',
  zones_50:     'Conqueror',
  level_5:      'Rising Star',
  level_10:     'Veteran',
};

/** Returns the set of award keys earned given the player stats + longest run known. */
function computeEarnedAwardKeys(p: StoredPlayer, longestRunKm: number): Set<string> {
  const s = new Set<string>();
  if (p.totalRuns >= 1)                     s.add('first_run');
  if (longestRunKm >= 5)                    s.add('5k_club');
  if (longestRunKm >= 10)                   s.add('10k_warrior');
  if (p.totalDistanceKm >= 50)              s.add('50k');
  if (p.streakDays >= 3)                    s.add('streak_3');
  if (p.streakDays >= 7)                    s.add('streak_7');
  if (p.streakDays >= 30)                   s.add('streak_30');
  if (p.totalTerritoriesClaimed >= 1)       s.add('first_zone');
  if (p.totalTerritoriesClaimed >= 10)      s.add('zones_10');
  if (p.totalTerritoriesClaimed >= 50)      s.add('zones_50');
  if (p.level >= 5)                         s.add('level_5');
  if (p.level >= 10)                        s.add('level_10');
  return s;
}

export interface GameEngineState {
  player: StoredPlayer | null;
  loading: boolean;
  playerTerritoryCount: number;
  claimState: ClaimState | null;
  sessionStats: {
    claimed: number;
    xp: number;
  };
}

/**
 * Build a corridor polygon (GeoJSON [lng,lat][] closed ring) around a GPS path.
 * radiusM = half-width of the corridor in metres.
 */
export function bufferPath(
  points: { lat: number; lng: number }[],
  radiusM: number
): [number, number][] {
  if (points.length < 2) return [];

  const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const latScale = GAME_CONFIG.METERS_PER_DEGREE_LAT;
  const lngScale = GAME_CONFIG.METERS_PER_DEGREE_LAT * Math.cos((avgLat * Math.PI) / 180);

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
export function polygonAreaM2(coords: [number, number][]): number {
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
  const mPerDeg = GAME_CONFIG.METERS_PER_DEGREE_LAT;
  return area * mPerDeg * mPerDeg * Math.cos((avgLat * Math.PI) / 180);
}

export function useGameEngine() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerTerritoryCount, setPlayerTerritoryCount] = useState(0);
  const [claimState, setClaimState] = useState<ClaimState | null>(null);
  const [sessionStats, setSessionStats] = useState({ claimed: 0, xp: 0 });
  const [sessionEnergy, setSessionEnergy] = useState(0);

  const claimEngineRef = useRef<ClaimEngine | null>(null);
  const claimListenersRef = useRef<((event: ClaimEvent) => void)[]>([]);
  // Tracks energy during active run (real-time regen from distance)
  const sessionEnergyRef = useRef<number>(0);

  useEffect(() => {
    loadPlayer();
  }, []);

  // Sync energy from server on visibility change (app foregrounded).
  // Replaces the client-side 30-second polling interval that used the device clock
  // (exploitable by advancing the device clock to gain free energy).
  useEffect(() => {
    if (!player) return;

    const syncEnergyFromServer = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: newEnergy } = await supabase.rpc('sync_energy', { p_user_id: session.user.id });
      if (typeof newEnergy === 'number') {
        const updated = { ...player, energy: newEnergy, lastEnergyRegen: Date.now() };
        setPlayer(updated);
        await savePlayer(updated);
      }
    };

    // Sync once on mount
    // (visibilitychange / AppState handling is done at the app layer on mobile)
    syncEnergyFromServer();
    if (typeof document !== 'undefined' && document.addEventListener) {
      const onVisibility = () => {
        if (document.visibilityState === 'visible') syncEnergyFromServer();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const loadPlayer = async () => {
    setLoading(true);
    let p = await getPlayer();
    if (!p) {
      p = await initializePlayer('Runner');
    }

    const allTerritories = await getAllTerritories();
    const ownedCount = allTerritories.filter(t => t.ownerId === p.id).length;
    setPlayerTerritoryCount(ownedCount);

    setPlayer(p);
    setLoading(false);
  };

  const startClaimEngine = useCallback(async () => {
    if (!player) return;

    // Sync energy from server before run starts so we have the canonical value
    let startEnergy = player.energy;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: serverEnergy } = await supabase.rpc('sync_energy', { p_user_id: session.user.id });
      if (typeof serverEnergy === 'number') {
        startEnergy = serverEnergy;
        const updated = { ...player, energy: serverEnergy, lastEnergyRegen: Date.now() };
        setPlayer(updated);
        await savePlayer(updated);
      }
    }

    const engine = new ClaimEngine(player.id);
    claimEngineRef.current = engine;
    // Seed session energy from server-synced value
    sessionEnergyRef.current = startEnergy;
    setSessionEnergy(startEnergy);

    const unsub = engine.onEvent((event) => {
      claimListenersRef.current.forEach(l => l(event));
      setSessionStats(engine.getSessionStats());
      // Energy is now deducted server-side by the claim_territory RPC.
      // Local energy display is refreshed at end of run via postRunSync → pullProfile.
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

      // Build a territory polygon from the run path (min MIN_CLAIM_DISTANCE_M to qualify)
      const territoriesToSave: StoredTerritory[] = [];

      if (runData.distanceMeters >= GAME_CONFIG.MIN_CLAIM_DISTANCE_M && runData.gpsPoints.length >= 2) {
        // Downsample GPS points to at most MAX_GPS_SAMPLE_POINTS for efficiency
        const pts = runData.gpsPoints;
        const step = Math.max(1, Math.floor(pts.length / GAME_CONFIG.MAX_GPS_SAMPLE_POINTS));
        const sampled = pts.filter((_, i) => i % step === 0);
        if (sampled.length < 2) sampled.push(pts[pts.length - 1]);

        const polygon = bufferPath(sampled, GAME_CONFIG.CORRIDOR_BUFFER_M);
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
      const totalXP = stats.xp + distanceXP;

      const preRunLevel = player.level;
      const newXP = player.xp + totalXP;
      const newLevel = calculateLevel(newXP);

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
        distanceKm: runData.distanceMeters / 1000,
        territoriesClaimed: territoryIds,
        territoriesFortified: [],
        enemyCaptured: 0,
        hexesVisited: 0,
        enemyZoneDistanceKm: 0,
        fastKmCount: 0,
      });

      const defaultShoe = await getDefaultShoe().catch(() => undefined);
      const run: StoredRun = {
        ...runData,
        territoriesClaimed: territoryIds,
        territoriesFortified: [],
        xpEarned: totalXP,
        coinsEarned: 0,
        enemyCaptured: 0,
        preRunLevel,
        synced: false,
        shoeId: defaultShoe?.id,
      };
      await saveRun(run);

      if (territoriesToSave.length > 0) {
        await saveTerritories(territoriesToSave);
      }

      const currentRunKm = runData.distanceMeters / 1000;

      // Capture which awards were already acknowledged before this run
      const preAcknowledged = new Set(player.unlockedAchievements ?? []);

      const updatedPlayer: StoredPlayer = {
        ...player,
        xp: newXP,
        level: newLevel,
        coins: player.coins,
        totalDistanceKm: player.totalDistanceKm + currentRunKm,
        totalRuns: player.totalRuns + 1,
        totalTerritoriesClaimed: player.totalTerritoriesClaimed + territoriesToSave.length,
        streakDays: newStreak,
        lastRunDate: today,
      };

      // Detect awards newly earned by this run
      const postEarned = computeEarnedAwardKeys(updatedPlayer, currentRunKm);
      const newlyUnlockedAwards: string[] = [];
      for (const key of postEarned) {
        if (!preAcknowledged.has(key)) {
          newlyUnlockedAwards.push(key);
        }
      }
      // Persist the expanded acknowledged set so we don't re-surface them
      updatedPlayer.unlockedAchievements = [
        ...preAcknowledged,
        ...newlyUnlockedAwards,
      ];

      await savePlayer(updatedPlayer);
      setPlayer(updatedPlayer);

      claimEngineRef.current.reset();
      claimEngineRef.current = null;
      setClaimState(null);
      setSessionStats({ claimed: 0, xp: 0 });

      const allTerritories = await getAllTerritories();
      setPlayerTerritoryCount(allTerritories.filter(t => t.ownerId === player.id).length);

      return {
        run,
        xpEarned: totalXP,
        leveledUp: newLevel > preRunLevel,
        preRunLevel,
        newLevel,
        newStreak,
        completedMissions: missionResult.newlyCompleted,
        claimedPolygons: territoriesToSave.map(t => t.polygon),
        newlyUnlockedAwards: newlyUnlockedAwards.map(key => ({
          key,
          label: AWARD_LABELS[key] ?? key,
        })),
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

export function calculateLevel(xp: number): number {
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
