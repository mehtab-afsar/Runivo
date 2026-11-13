import { str, num, list, oneOf } from '@/lib/adminServer';

export const PARTNER_CATEGORIES = ['shoes', 'apparel', 'gear', 'nutrition', 'cafe', 'physio', 'races', 'gym', 'insurance', 'tech', 'other'] as const;
export const PARTNER_STATUSES = ['applied', 'active', 'paused', 'ended', 'rejected'] as const;
export const BILLING_MODELS = ['free_listing', 'cost_per_redemption'] as const;

export function partnerPayload(b: Record<string, unknown>) {
  const billing = oneOf(b.billing_model, BILLING_MODELS, 'free_listing');
  return {
    name:               str(b.name, 120),
    category:           oneOf(b.category, PARTNER_CATEGORIES, 'other'),
    contact_name:       str(b.contact_name, 120),
    contact_email:      str(b.contact_email, 200),
    cities:             list(b.cities),
    countries:          list(b.countries)?.map(c => c.toUpperCase()) ?? null,
    billing_model:      billing,
    fee_per_redemption: billing === 'cost_per_redemption' ? Math.max(0, num(b.fee_per_redemption) ?? 0) : 0,
    fee_currency:       (str(b.fee_currency, 3) ?? 'USD').toUpperCase(),
    billing_starts_on:  typeof b.billing_starts_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.billing_starts_on) ? b.billing_starts_on : null,
    status:             oneOf(b.status, PARTNER_STATUSES, 'applied'),
    notes:              str(b.notes, 2000),
  };
}
