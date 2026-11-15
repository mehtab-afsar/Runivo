/**
 * Tests the RevenueCat webhook's tier decisions. The function lives with the
 * edge function (supabase/functions/_shared/rcTier.ts, pure TS, no Deno APIs).
 */
import { describe, it, expect } from 'vitest';
import { decideTierUpdates, usersInEvent, isStaleEvent, expiryFor } from '../../../../supabase/functions/_shared/rcTier';

const U = 'u1';
const ev = (type: string, extra: Record<string, unknown> = {}) =>
  ({ type, app_user_id: U, entitlement_ids: ['runivo_plus'], ...extra });

describe('RevenueCat event → tier', () => {
  it.each(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED'])(
    '%s with a paid entitlement grants Plus', type => {
      expect(decideTierUpdates(ev(type), { [U]: 'free' })).toEqual([{ userId: U, tier: 'premium' }]);
    });

  it('a purchase without a paid entitlement changes nothing', () => {
    expect(decideTierUpdates(ev('INITIAL_PURCHASE', { entitlement_ids: ['something_else'] }), { [U]: 'free' })).toEqual([]);
  });

  it('cancellation keeps Plus until the period ends', () => {
    expect(decideTierUpdates(ev('CANCELLATION'), { [U]: 'premium' })).toEqual([]);
  });

  it('a billing issue keeps Plus through the grace period', () => {
    expect(decideTierUpdates(ev('BILLING_ISSUE'), { [U]: 'premium' })).toEqual([]);
  });

  it('expiration downgrades even though it names the expired entitlement', () => {
    expect(decideTierUpdates(ev('EXPIRATION'), { [U]: 'premium' })).toEqual([{ userId: U, tier: 'free' }]);
  });

  it('admins are never changed', () => {
    expect(decideTierUpdates(ev('EXPIRATION'), { [U]: 'admin' })).toEqual([]);
    expect(decideTierUpdates(ev('INITIAL_PURCHASE'), { [U]: 'admin' })).toEqual([]);
  });

  it('no-op when already on that tier, and unknown users are skipped', () => {
    expect(decideTierUpdates(ev('RENEWAL'), { [U]: 'premium' })).toEqual([]);
    expect(decideTierUpdates(ev('RENEWAL'), {})).toEqual([]);
  });

  it('transfer moves Plus from the old account to the new one', () => {
    const t = { type: 'TRANSFER', transferred_from: ['old'], transferred_to: ['new'] };
    expect(usersInEvent(t).sort()).toEqual(['new', 'old']);
    expect(decideTierUpdates(t, { old: 'premium', new: 'free' })).toEqual([
      { userId: 'new', tier: 'premium' },
      { userId: 'old', tier: 'free' },
    ]);
  });

  it('test and unknown events are ignored', () => {
    expect(decideTierUpdates(ev('TEST'), { [U]: 'free' })).toEqual([]);
    expect(decideTierUpdates({ type: 'INITIAL_PURCHASE' }, { [U]: 'free' })).toEqual([]);
  });
});

describe('RevenueCat event order and expiry', () => {
  it('skips an event older than the last one applied (a late EXPIRATION after a RENEWAL)', () => {
    const renewedAt = '2026-11-10T10:00:00.000Z';
    expect(isStaleEvent(ev('EXPIRATION', { event_timestamp_ms: Date.parse('2026-11-09T10:00:00Z') }), renewedAt)).toBe(true);
    expect(isStaleEvent(ev('EXPIRATION', { event_timestamp_ms: Date.parse('2026-12-10T10:00:00Z') }), renewedAt)).toBe(false);
  });
  it('applies events with no timestamp, or for runners with none recorded', () => {
    expect(isStaleEvent(ev('RENEWAL'), '2026-11-10T10:00:00Z')).toBe(false);
    expect(isStaleEvent(ev('RENEWAL', { event_timestamp_ms: 1 }), null)).toBe(false);
  });
  it('stores the period end with Plus, and nothing with Free', () => {
    const end = Date.parse('2026-12-15T00:00:00Z');
    expect(expiryFor(ev('RENEWAL', { expiration_at_ms: end }), 'premium')).toBe('2026-12-15T00:00:00.000Z');
    expect(expiryFor(ev('NON_RENEWING_PURCHASE', { expiration_at_ms: null }), 'premium')).toBeNull();
    expect(expiryFor(ev('EXPIRATION', { expiration_at_ms: end }), 'free')).toBeNull();
  });
});
