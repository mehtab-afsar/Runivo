import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaimEngine, ClaimEvent } from './claimEngine';
import { GAME_CONFIG } from '@shared/services/config';

// Two GPS coords within the same H3 resolution-9 hex (~170 m across)
const LAT = 37.7749;
const LNG = -122.4194;
const NEARBY_LNG = LNG + 0.0001; // ~9 m east — same hex

function makeEngine() {
  return new ClaimEngine('player1');
}

function collectEvents(engine: ClaimEngine) {
  const events: ClaimEvent[] = [];
  engine.onEvent(e => events.push(e));
  return events;
}

describe('ClaimEngine (time-in-hex mechanic)', () => {
  let engine: ClaimEngine;
  let events: ClaimEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    engine = makeEngine();
    events = collectEvents(engine);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires claim_progress=0 when entering a hex', () => {
    engine.update(LAT, LNG, 2.0, 10);
    expect(events.some(e => e.type === 'claim_progress' && e.progress === 0)).toBe(true);
  });

  it('fires claim_progress after 10 seconds in the same hex', () => {
    engine.update(LAT, LNG, 2.0, 10);
    vi.advanceTimersByTime(10_500);
    engine.update(LAT, NEARBY_LNG, 2.0, 10);
    const progressEvents = events.filter(e => e.type === 'claim_progress' && (e.progress ?? 0) > 0);
    expect(progressEvents.length).toBeGreaterThan(0);
  });

  it('fires claimed after 60 seconds in the same hex', () => {
    engine.update(LAT, LNG, 2.0, 10);
    vi.advanceTimersByTime(61_000);
    engine.update(LAT, NEARBY_LNG, 2.0, 10);
    expect(events.some(e => e.type === 'claimed')).toBe(true);
  });

  it('resets progress when moving to a different hex', () => {
    engine.update(LAT, LNG, 2.0, 10);
    vi.advanceTimersByTime(30_000);
    engine.update(LAT, NEARBY_LNG, 2.0, 10);
    // Move far away to a different hex
    engine.update(LAT + 0.01, LNG + 0.01, 2.0, 10);
    expect(engine.getState().claimProgress).toBe(0);
    expect(engine.getState().hexDwellMs).toBe(0);
  });

  it('returns unchanged state when accuracy > 50 m', () => {
    engine.update(LAT, LNG, 2.0, 10);
    const before = { ...engine.getState() };
    engine.update(LAT, NEARBY_LNG, 2.0, 60); // poor accuracy — should be ignored
    expect(engine.getState().claimProgress).toBe(before.claimProgress);
  });

  it('getSessionStats accumulates XP and coins after a claim', () => {
    engine.update(LAT, LNG, 2.0, 10);
    vi.advanceTimersByTime(61_000);
    engine.update(LAT, NEARBY_LNG, 2.0, 10);
    const stats = engine.getSessionStats();
    expect(stats.xp).toBe(GAME_CONFIG.XP_CLAIM_NEUTRAL);
    expect(stats.coins).toBe(GAME_CONFIG.COINS_CLAIM_NEUTRAL);
    expect(stats.claimed).toBe(1);
  });

  it('reset() clears all state and session stats', () => {
    engine.update(LAT, LNG, 2.0, 10);
    vi.advanceTimersByTime(61_000);
    engine.update(LAT, NEARBY_LNG, 2.0, 10);
    engine.reset();
    const state = engine.getState();
    const stats = engine.getSessionStats();
    expect(state.claimProgress).toBe(0);
    expect(state.hexDwellMs).toBe(0);
    expect(state.currentHex).toBeNull();
    expect(stats.xp).toBe(0);
    expect(stats.coins).toBe(0);
    expect(stats.claimed).toBe(0);
  });
});
