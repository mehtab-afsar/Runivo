/**
 * Tests the RevenueCat webhook's tier decisions. The function lives with the
 * edge function (supabase/functions/_shared/rcTier.ts, pure TS, no Deno APIs).
 */
import { describe, it, expect } from 'vitest';
import { decideTierUpdates, usersInEvent } from '../../../../supabase/functions/_shared/rcTier';

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
