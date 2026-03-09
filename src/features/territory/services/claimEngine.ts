import { GAME_CONFIG } from '@shared/services/config';

export type ClaimEventType = 'claim_progress' | 'claimed' | 'energy_blocked';

export interface ClaimEvent {
  type: ClaimEventType;
  progress?: number;
  xpEarned?: number;
  coinsEarned?: number;
  timestamp: number;
}

export interface ClaimState {
  distanceSinceLastClaim: number;
  claimProgress: number;   // 0-100
  territoriesClaimed: number;
  isActive: boolean;
}

// Every CLAIM_DISTANCE_M meters of running = one territory segment claimed
const CLAIM_DISTANCE_M = 200;

export class ClaimEngine {
  private state: ClaimState = {
    distanceSinceLastClaim: 0,
    claimProgress: 0,
    territoriesClaimed: 0,
    isActive: false,
  };

  private lastLat: number | null = null;
  private lastLng: number | null = null;
  private sessionXP = 0;
  private sessionCoins = 0;
  private listeners: ((event: ClaimEvent) => void)[] = [];

  constructor(_playerId: string) {}

  onEvent(listener: (event: ClaimEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: ClaimEvent) {
    this.listeners.forEach(l => l(event));
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  update(lat: number, lng: number, _speedMps: number, accuracy: number, canClaim = true): ClaimState {
    if (accuracy > 50) return this.state;

    this.state.isActive = true;

    if (this.lastLat !== null && this.lastLng !== null) {
      const dist = this.haversine(this.lastLat, this.lastLng, lat, lng);

      if (dist > 2 && dist < 100) {
        this.state.distanceSinceLastClaim += dist;

        const progress = Math.min(
          100,
          (this.state.distanceSinceLastClaim / CLAIM_DISTANCE_M) * 100
        );

        if (Math.floor(progress / 5) > Math.floor(this.state.claimProgress / 5)) {
          this.emit({ type: 'claim_progress', progress, timestamp: Date.now() });
        }
        this.state.claimProgress = progress;

        if (this.state.distanceSinceLastClaim >= CLAIM_DISTANCE_M) {
          if (!canClaim) {
            // Freeze at 100% until player has energy
            this.state.claimProgress = 100;
            this.state.distanceSinceLastClaim = CLAIM_DISTANCE_M;
            this.emit({ type: 'energy_blocked', timestamp: Date.now() });
          } else {
            this.state.territoriesClaimed++;
            this.state.distanceSinceLastClaim -= CLAIM_DISTANCE_M;
            this.state.claimProgress =
              (this.state.distanceSinceLastClaim / CLAIM_DISTANCE_M) * 100;

            const xp = GAME_CONFIG.XP_CLAIM_NEUTRAL;
            const coins = GAME_CONFIG.COINS_CLAIM_NEUTRAL;
            this.sessionXP += xp;
            this.sessionCoins += coins;

            this.emit({ type: 'claimed', xpEarned: xp, coinsEarned: coins, timestamp: Date.now() });
          }
        }
      }
    }

    this.lastLat = lat;
    this.lastLng = lng;
    return this.state;
  }

  getState(): Readonly<ClaimState> {
    return { ...this.state };
  }

  getSessionStats() {
    return {
      claimed: this.state.territoriesClaimed,
      xp: this.sessionXP,
      coins: this.sessionCoins,
    };
  }

  reset() {
    this.state = {
      distanceSinceLastClaim: 0,
      claimProgress: 0,
      territoriesClaimed: 0,
      isActive: false,
    };
    this.lastLat = null;
    this.lastLng = null;
    this.sessionXP = 0;
    this.sessionCoins = 0;
  }
}
