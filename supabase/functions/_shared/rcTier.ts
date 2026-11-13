/**
 * rcTier — which profiles change tier for a RevenueCat webhook event.
 * Pure (no Deno, no network) so it is unit-tested from packages/shared.
 *
 * RevenueCat semantics:
 *  - CANCELLATION means auto-renew was turned off; the runner keeps Plus
 *    until the period ends, when EXPIRATION arrives. So it never downgrades.
 *  - BILLING_ISSUE starts the store's grace period; keep Plus until EXPIRATION.
 *  - EXPIRATION lists the entitlement that just expired, so it always
 *    downgrades regardless of entitlement_ids.
 *  - TRANSFER moves a purchase between app user ids (restore on a new
 *    account): the receivers gain Plus, the givers lose it.
 *  - 'admin' profiles are managed by hand and are never changed here.
 */

export const PAID_ENTITLEMENTS = ['runivo_plus', 'territory_lord', 'empire_builder'];

export type RCEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  transferred_from?: string[];
  transferred_to?: string[];
};

export type TierUpdate = { userId: string; tier: 'free' | 'premium' };

const GRANTING = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

function hasPaidEntitlement(e: RCEvent): boolean {
  const ids = [...(e.entitlement_ids ?? []), ...(e.entitlement_id ? [e.entitlement_id] : [])];
  return ids.some(id => PAID_ENTITLEMENTS.includes(id));
}

/** Every user id this event touches; the handler loads their current tiers. */
export function usersInEvent(e: RCEvent): string[] {
  if (e.type === 'TRANSFER') return [...new Set([...(e.transferred_to ?? []), ...(e.transferred_from ?? [])])];
  return e.app_user_id ? [e.app_user_id] : [];
}

/**
 * The tier changes to apply. `currentTiers` maps user id → current
 * profiles.subscription_tier (missing = unknown user; skipped).
 */
export function decideTierUpdates(e: RCEvent, currentTiers: Record<string, string | null | undefined>): TierUpdate[] {
  const type = e.type ?? '';
  const wanted: TierUpdate[] = [];

  if (type === 'TRANSFER') {
    // A transfer with no paid entitlement moves nothing we sell.
    const paid = hasPaidEntitlement(e) || (e.entitlement_ids == null && e.entitlement_id == null);
    if (paid) {
      for (const id of e.transferred_to ?? []) wanted.push({ userId: id, tier: 'premium' });
      for (const id of e.transferred_from ?? []) {
        if (!(e.transferred_to ?? []).includes(id)) wanted.push({ userId: id, tier: 'free' });
      }
    }
  } else if (e.app_user_id) {
    if (type === 'EXPIRATION') {
      wanted.push({ userId: e.app_user_id, tier: 'free' });
    } else if (GRANTING.has(type) && hasPaidEntitlement(e)) {
      wanted.push({ userId: e.app_user_id, tier: 'premium' });
    }
    // CANCELLATION, BILLING_ISSUE, SUBSCRIPTION_PAUSED, TEST, anything else: no change.
  }

  return wanted.filter(u => {
    if (!(u.userId in currentTiers)) return false;
    const current = currentTiers[u.userId];
    if (current === 'admin') return false;
    return current !== u.tier;
  });
}
