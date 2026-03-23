import { latLngToCell } from 'h3-js';
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
  currentHex: string | null;
  hexDwellMs: number;         // milliseconds spent in current hex
  claimProgress: number;      // 0-100
  territoriesClaimed: number;
  isActive: boolean;
}

const CLAIM_MS = (GAME_CONFIG.CLAIM_TIME_IN_HEX_SEC ?? 60) * 1000;
const PROGRESS_EMIT_INTERVAL_MS = 10_000; // emit every ~10 seconds

export class ClaimEngine {
  private state: ClaimState = {
    currentHex: null,
    hexDwellMs: 0,
    claimProgress: 0,
    territoriesClaimed: 0,
    isActive: false,
  };

  private trackedHex: string | null = null;
  private hexEnteredAt: number | null = null;
  private lastProgressEmitMs = 0;
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

  update(lat: number, lng: number, _speedMps: number, accuracy: number, canClaim = true): ClaimState {
    if (accuracy > 50) return this.state;

    this.state.isActive = true;

    const now = Date.now();
    const hex = latLngToCell(lat, lng, 9);
    this.state.currentHex = hex;

    // If we've moved to a new hex, reset the dwell timer
    if (hex !== this.trackedHex) {
      this.trackedHex = hex;
      this.hexEnteredAt = now;
      this.lastProgressEmitMs = now;
      this.state.hexDwellMs = 0;
      this.state.claimProgress = 0;
      this.emit({ type: 'claim_progress', progress: 0, timestamp: now });
      return this.state;
    }

    if (this.hexEnteredAt === null) {
      this.hexEnteredAt = now;
      this.lastProgressEmitMs = now;
    }

    const dwellMs = now - this.hexEnteredAt;
    this.state.hexDwellMs = dwellMs;
    const progress = Math.min(100, (dwellMs / CLAIM_MS) * 100);

    // Emit progress at ~10-second increments
    if (now - this.lastProgressEmitMs >= PROGRESS_EMIT_INTERVAL_MS) {
      this.lastProgressEmitMs = now;
      this.emit({ type: 'claim_progress', progress, timestamp: now });
    }
    this.state.claimProgress = progress;

    if (dwellMs >= CLAIM_MS) {
      if (!canClaim) {
        // Freeze at 100% until player has energy
        this.state.claimProgress = 100;
        this.emit({ type: 'energy_blocked', timestamp: now });
      } else {
        this.state.territoriesClaimed++;
        // Reset dwell so the same hex can't be immediately re-claimed
        this.hexEnteredAt = now;
        this.lastProgressEmitMs = now;
        this.state.hexDwellMs = 0;
        this.state.claimProgress = 0;

        const xp = GAME_CONFIG.XP_CLAIM_NEUTRAL;
        const coins = GAME_CONFIG.COINS_CLAIM_NEUTRAL;
        this.sessionXP += xp;
        this.sessionCoins += coins;

        this.emit({ type: 'claimed', xpEarned: xp, coinsEarned: coins, timestamp: now });
      }
    }

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
      currentHex: null,
      hexDwellMs: 0,
      claimProgress: 0,
      territoriesClaimed: 0,
      isActive: false,
    };
    this.trackedHex = null;
    this.hexEnteredAt = null;
    this.lastProgressEmitMs = 0;
    this.sessionXP = 0;
    this.sessionCoins = 0;
  }
}
