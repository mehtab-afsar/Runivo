import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  isPlus, isPlusTier, setSubscriptionsEnabledForTests, SUBSCRIPTIONS_ENABLED, zoneLimitFor, canUse, canClaimZone, weeklyCapFor, paywallMoment,
  paywallWeekKey, PLAN_ROWS, PLUS_FEATURES, type Feature,
} from './entitlements';

// The Free/Plus rules below are checked as they'll run once subscriptions are on.
beforeAll(() => setSubscriptionsEnabledForTests(true));
afterAll(() => setSubscriptionsEnabledForTests(SUBSCRIPTIONS_ENABLED));

describe('while subscriptions are off (still building)', () => {
  it('everyone gets Plus, no limits and no paywall', () => {
    setSubscriptionsEnabledForTests(false);
    try {
      for (const t of ['free', null, undefined, 'premium']) expect(isPlus(t)).toBe(true);
      expect(zoneLimitFor('free')).toBe(Infinity);
      expect(canUse('training_plan', 'free')).toBe(true);
      expect(paywallMoment({ trigger: 'zone_limit', tier: 'free', runsCompleted: 5, isFirstLaunch: false, alreadyShownThisWeek: false })).toBe(false);
      // The stored tier is still read the same way, ready for launch.
      expect(isPlusTier('free')).toBe(false);
    } finally {
      setSubscriptionsEnabledForTests(true);
    }
  });
});

describe('tiers', () => {
  it('premium and admin are Plus; free, null and unknown are not', () => {
    expect(isPlus('premium')).toBe(true);
    expect(isPlus('admin')).toBe(true);
    for (const t of ['free', null, undefined, '', 'territory_lord']) expect(isPlus(t)).toBe(false);
  });

  it('free holds 10 zones, Plus is unlimited', () => {
    expect(zoneLimitFor('free')).toBe(10);
    expect(zoneLimitFor('premium')).toBe(Infinity);
    expect(canClaimZone(9, 'free')).toBe(true);
    expect(canClaimZone(10, 'free')).toBe(false);
    expect(canClaimZone(500, 'admin')).toBe(true);
  });

  it('weekly cap is 100 free and 150 Plus', () => {
    expect(weeklyCapFor('free')).toBe(100);
    expect(weeklyCapFor('premium')).toBe(150);
    expect(weeklyCapFor('admin')).toBe(150);
  });
});

describe('features (PRD: never charge for the game, safety or privacy)', () => {
  const free: Feature[] = ['run_tracking', 'territory', 'territory_alerts', 'leaderboards', 'feed', 'clubs',
    'create_clubs', 'club_chat', 'live_friend_map', 'pacex_summary'];
  const plus: Feature[] = ['territory_unlimited', 'pacex_debrief', 'pacex_weekly_brief', 'pacex_chat',
    'training_plan', 'host_events', 'plus_store_drops', 'extra_map_styles'];

  it.each(free)('%s is free for everyone', f => {
    expect(canUse(f, 'free')).toBe(true);
    expect(canUse(f, 'premium')).toBe(true);
  });

  it.each(plus)('%s needs Plus', f => {
    expect(canUse(f, 'free')).toBe(false);
    expect(canUse(f, 'premium')).toBe(true);
    expect(canUse(f, 'admin')).toBe(true);
  });

  it('territory alerts are never paywalled', () => {
    expect(PLUS_FEATURES.has('territory_alerts')).toBe(false);
  });

  it('the comparison table shows the real limits', () => {
    const zones = PLAN_ROWS.find(r => r.label.startsWith('Zones'))!;
    const cap = PLAN_ROWS.find(r => r.label.startsWith('Weekly PACE'))!;
    expect([zones.free, zones.plus]).toEqual(['10', 'Unlimited']);
    expect([cap.free, cap.plus]).toEqual(['100', '150']);
  });
});

describe('paywall moments', () => {
  const base = { tier: 'free', runsCompleted: 5, isFirstLaunch: false, alreadyShownThisWeek: false };

  it('shows on an 11th-zone claim and on hitting the PACE cap', () => {
    expect(paywallMoment({ ...base, trigger: 'zone_limit' })).toBe(true);
    expect(paywallMoment({ ...base, trigger: 'pace_cap' })).toBe(true);
  });

  it('shows the debrief paywall only from the third run', () => {
    expect(paywallMoment({ ...base, trigger: 'debrief', runsCompleted: 2 })).toBe(false);
    expect(paywallMoment({ ...base, trigger: 'debrief', runsCompleted: 3 })).toBe(true);
  });

  it('never on first launch, never twice a week, never for Plus, never before a run', () => {
    expect(paywallMoment({ ...base, trigger: 'zone_limit', isFirstLaunch: true })).toBe(false);
    expect(paywallMoment({ ...base, trigger: 'pace_cap', alreadyShownThisWeek: true })).toBe(false);
    expect(paywallMoment({ ...base, trigger: 'zone_limit', tier: 'premium' })).toBe(false);
    expect(paywallMoment({ ...base, trigger: 'zone_limit', tier: 'admin' })).toBe(false);
    expect(paywallMoment({ ...base, trigger: 'pace_cap', runsCompleted: 0 })).toBe(false);
  });

  it('weeks start on Monday (UTC)', () => {
    const sun = Date.parse('2026-11-08T23:00:00Z');
    const mon = Date.parse('2026-11-09T00:30:00Z');
    const sat = Date.parse('2026-11-14T12:00:00Z');
    expect(paywallWeekKey(sun)).not.toBe(paywallWeekKey(mon));
    expect(paywallWeekKey(mon)).toBe(paywallWeekKey(sat));
    expect(paywallWeekKey(mon)).toBe('2026-W46');
    expect(paywallWeekKey(Date.parse('2027-01-01T12:00:00Z'))).toBe('2026-W53');
  });
});

describe('paywallRows', () => {
  it('lists only live perks with the enforced numbers', async () => {
    const { paywallRows, displayPrice, FREE_ZONE_LIMIT, weeklyCapFor } = await import('./entitlements');
    const off = paywallRows({ aiCoach: false });
    expect(off.map(r => r.label)).not.toContain('PaceX after a run');
    expect(off.map(r => r.label)).toContain('Host public events');
    expect(off.find(r => r.label === 'Zones you can hold')!.free).toBe(String(FREE_ZONE_LIMIT));
    expect(off.find(r => r.label === 'Weekly PACE cap')!.plus).toBe(String(weeklyCapFor('premium')));
    expect(paywallRows({ aiCoach: true }).map(r => r.label)).toContain('Chat with PaceX');
    expect(displayPrice(' ₹499 ')).toBe('₹499');
    expect(displayPrice(undefined)).toBeNull();
  });
});
