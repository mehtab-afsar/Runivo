import { describe, it, expect, beforeEach } from 'vitest';
import { ClaimEngine, ClaimEvent } from './claimEngine';
import { GAME_CONFIG } from '@shared/services/config';

// Two GPS coords ~250 m apart (longitude delta ~0.0023° at this latitude)
const LAT = 37.7749;
const LNG = -122.4194;

function makeEngine() {
  return new ClaimEngine('player1');
}

function collectEvents(engine: ClaimEngine) {
  const events: ClaimEvent[] = [];
  engine.onEvent(e => events.push(e));
  return events;
}

describe('ClaimEngine', () => {
  let engine: ClaimEngine;
  let events: ClaimEvent[];

  beforeEach(() => {
    engine = makeEngine();
    events = collectEvents(engine);
  });

  it('fires claim_progress when moving', () => {
    // Use small step (~50 m) that stays within the 2–100 m acceptance window
    engine.update(LAT, LNG, 2.0, 10);
    engine.update(LAT, LNG + 0.00057, 2.0, 10); // ~50 m east
    expect(events.some(e => e.type === 'claim_progress')).toBe(true);
  });

  it('fires claimed after 200 m of movement', () => {
    // 10 iterations = 9 movement steps × ~24 m each ≈ 216 m (> CLAIM_DISTANCE_M=200)
    let lng = LNG;
    for (let i = 0; i < 10; i++) {
      engine.update(LAT, lng, 3.0, 10);
      lng += 0.00027; // ~24 m step (within 2–100 m window accepted by engine)
    }
    expect(events.some(e => e.type === 'claimed')).toBe(true);
  });

  it('returns unchanged state when accuracy > 50 m', () => {
    engine.update(LAT, LNG, 2.0, 10);
    const before = { ...engine.getState() };
    engine.update(LAT, LNG + 0.00027, 2.0, 60); // poor accuracy — should be ignored
    expect(engine.getState().claimProgress).toBe(before.claimProgress);
  });

  it('getSessionStats accumulates XP and coins after a claim', () => {
    let lng = LNG;
    for (let i = 0; i < 10; i++) {
      engine.update(LAT, lng, 3.0, 10);
      lng += 0.00027;
    }
    const stats = engine.getSessionStats();
    expect(stats.xp).toBe(GAME_CONFIG.XP_CLAIM_NEUTRAL);
    expect(stats.coins).toBe(GAME_CONFIG.COINS_CLAIM_NEUTRAL);
    expect(stats.claimed).toBe(1);
  });

  it('reset() clears all state and session stats', () => {
    let lng = LNG;
    for (let i = 0; i < 10; i++) {
      engine.update(LAT, lng, 3.0, 10);
      lng += 0.00027;
    }
    engine.reset();
    const state = engine.getState();
    const stats = engine.getSessionStats();
    expect(state.claimProgress).toBe(0);
    expect(state.distanceSinceLastClaim).toBe(0);
    expect(stats.xp).toBe(0);
    expect(stats.coins).toBe(0);
    expect(stats.claimed).toBe(0);
  });
});
