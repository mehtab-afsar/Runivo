import { getHexAtPosition } from './territory';
import { GAME_CONFIG } from './config';

export type ClaimEventType =
  | 'entered_own'
  | 'entered_enemy'
  | 'entered_neutral'
  | 'claim_progress'
  | 'claimed'
  | 'fortify_progress'
  | 'fortified';

export interface ClaimEvent {
  type: ClaimEventType;
  hexId: string;
  progress?: number;
  xpEarned?: number;
  coinsEarned?: number;
  defenseAdded?: number;
  previousOwner?: string | null;
  timestamp: number;
}

export interface ClaimState {
  currentHexId: string | null;
  hexStatus: 'owned' | 'enemy' | 'neutral' | null;
  timeInHex: number;
  distanceInHex: number;
  claimProgress: number;
  requiredTime: number;
  isActive: boolean;
}

interface TerritoryInfo {
  ownerId: string | null;
  defense: number;
}

export class ClaimEngine {
  private state: ClaimState = {
    currentHexId: null,
    hexStatus: null,
    timeInHex: 0,
    distanceInHex: 0,
    claimProgress: 0,
    requiredTime: 0,
    isActive: false,
  };

  private playerId: string;
  private playerTerritories: Set<string>;
  private worldTerritories: Map<string, TerritoryInfo>;
  private listeners: ((event: ClaimEvent) => void)[] = [];

  private sessionClaimed: string[] = [];
  private sessionFortified: string[] = [];
  private sessionXP: number = 0;
  private sessionCoins: number = 0;

  constructor(
    playerId: string,
    playerTerritories: Set<string>,
    worldTerritories: Map<string, TerritoryInfo>
  ) {
    this.playerId = playerId;
    this.playerTerritories = playerTerritories;
    this.worldTerritories = worldTerritories;
  }

  onEvent(listener: (event: ClaimEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: ClaimEvent) {
    this.listeners.forEach(l => l(event));
  }

  update(
    lat: number,
    lng: number,
    speedMps: number,
    accuracy: number,
    deltaTimeSec: number
  ): ClaimState {
    const hexId = getHexAtPosition(lat, lng);

    if (accuracy > 50) return this.state;

    const validSpeed =
      speedMps >= GAME_CONFIG.MIN_SPEED_MPS &&
      speedMps <= GAME_CONFIG.MAX_SPEED_MPS;

    if (hexId !== this.state.currentHexId) {
      this.state.currentHexId = hexId;
      this.state.timeInHex = 0;
      this.state.distanceInHex = 0;
      this.state.claimProgress = 0;
      this.state.isActive = false;

      if (this.playerTerritories.has(hexId)) {
        this.state.hexStatus = 'owned';
        this.state.requiredTime = 0;
        this.emit({ type: 'entered_own', hexId, timestamp: Date.now() });
      } else if (this.worldTerritories.has(hexId)) {
        const info = this.worldTerritories.get(hexId)!;
        if (info.ownerId && info.ownerId !== this.playerId) {
          this.state.hexStatus = 'enemy';
          this.state.requiredTime =
            GAME_CONFIG.CLAIM_ENEMY_BASE_SEC +
            info.defense * GAME_CONFIG.CLAIM_ENEMY_PER_DEFENSE_SEC;
          this.state.isActive = true;
          this.emit({ type: 'entered_enemy', hexId, timestamp: Date.now() });
        } else {
          this.state.hexStatus = 'neutral';
          this.state.requiredTime = GAME_CONFIG.CLAIM_NEUTRAL_SEC;
          this.state.isActive = true;
          this.emit({ type: 'entered_neutral', hexId, timestamp: Date.now() });
        }
      } else {
        this.state.hexStatus = 'neutral';
        this.state.requiredTime = GAME_CONFIG.CLAIM_NEUTRAL_SEC;
        this.state.isActive = true;
        this.emit({ type: 'entered_neutral', hexId, timestamp: Date.now() });
      }
    }

    if (!validSpeed) return this.state;

    this.state.timeInHex += deltaTimeSec;
    this.state.distanceInHex += speedMps * deltaTimeSec;

    const speedMultiplier =
      speedMps >= GAME_CONFIG.SPEED_BONUS_THRESHOLD_MPS
        ? GAME_CONFIG.SPEED_BONUS_MULTIPLIER
        : 1.0;

    if (this.state.isActive && this.state.hexStatus !== 'owned') {
      const effectiveTime = this.state.timeInHex * speedMultiplier;
      const newProgress = Math.min(
        100,
        (effectiveTime / this.state.requiredTime) * 100
      );

      if (Math.floor(newProgress / 5) > Math.floor(this.state.claimProgress / 5)) {
        this.emit({ type: 'claim_progress', hexId, progress: newProgress, timestamp: Date.now() });
      }

      this.state.claimProgress = newProgress;

      if (this.state.claimProgress >= 100) {
        const wasEnemy = this.state.hexStatus === 'enemy';
        const previousOwner = this.worldTerritories.get(hexId)?.ownerId ?? null;
        const xp = wasEnemy ? GAME_CONFIG.XP_CLAIM_ENEMY : GAME_CONFIG.XP_CLAIM_NEUTRAL;
        const coins = wasEnemy ? GAME_CONFIG.COINS_CLAIM_ENEMY : GAME_CONFIG.COINS_CLAIM_NEUTRAL;

        this.playerTerritories.add(hexId);
        this.worldTerritories.set(hexId, {
          ownerId: this.playerId,
          defense: GAME_CONFIG.INITIAL_DEFENSE,
        });
        this.state.hexStatus = 'owned';
        this.state.isActive = false;

        this.sessionClaimed.push(hexId);
        this.sessionXP += xp;
        this.sessionCoins += coins;

        this.emit({ type: 'claimed', hexId, xpEarned: xp, coinsEarned: coins, previousOwner, timestamp: Date.now() });
      }
    }

    if (this.state.hexStatus === 'owned' && this.state.distanceInHex > 0) {
      const distKm = this.state.distanceInHex / 1000;
      const fortifyPoints = distKm * GAME_CONFIG.FORTIFY_PER_KM;

      if (fortifyPoints >= 1) {
        const current = this.worldTerritories.get(hexId);
        if (current && current.defense < GAME_CONFIG.MAX_DEFENSE) {
          const added = Math.min(fortifyPoints, GAME_CONFIG.MAX_DEFENSE - current.defense);
          current.defense = Math.round((current.defense + added) * 10) / 10;

          if (!this.sessionFortified.includes(hexId)) {
            this.sessionFortified.push(hexId);
          }
          this.sessionXP += GAME_CONFIG.XP_FORTIFY;

          this.emit({ type: 'fortified', hexId, defenseAdded: added, xpEarned: GAME_CONFIG.XP_FORTIFY, timestamp: Date.now() });
        }
      }
    }

    return this.state;
  }

  getState(): Readonly<ClaimState> {
    return { ...this.state };
  }

  getSessionStats() {
    return {
      claimed: [...this.sessionClaimed],
      fortified: [...this.sessionFortified],
      xp: this.sessionXP,
      coins: this.sessionCoins,
    };
  }

  reset() {
    this.state = {
      currentHexId: null,
      hexStatus: null,
      timeInHex: 0,
      distanceInHex: 0,
      claimProgress: 0,
      requiredTime: 0,
      isActive: false,
    };
    this.sessionClaimed = [];
    this.sessionFortified = [];
    this.sessionXP = 0;
    this.sessionCoins = 0;
  }
}
