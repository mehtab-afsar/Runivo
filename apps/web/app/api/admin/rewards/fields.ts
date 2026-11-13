import { str, num, list, isoDate, oneOf } from '@/lib/adminServer';

export const REWARD_STATUSES = ['available', 'coming_soon', 'sold_out', 'hidden'] as const;
export const REWARD_TIERS = ['entry', 'mid', 'premium'] as const;
export const REWARD_CATEGORIES = ['gear', 'nutrition', 'tech', 'events'] as const;
export const RANKS = ['pacer', 'strider', 'chaser', 'hunter', 'sovereign'] as const;
export const CODE_MODES = ['pool', 'static', 'none'] as const;

export function rewardPayload(b: Record<string, unknown>) {
  const codeMode = oneOf(b.code_mode, CODE_MODES, 'none');
  const stock = num(b.stock);
  const minRank = RANKS.includes(b.min_rank as typeof RANKS[number]) ? (b.min_rank as string) : null;
  const color = str(b.brand_color, 7);
  return {
    partner_id:    str(b.partner_id, 40),
    brand:         str(b.brand, 60),
    brand_initial: (str(b.brand_initial, 1) ?? '?').toUpperCase(),
    brand_color:   color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#0C0C0D',
    title:         str(b.title, 100),
    description:   str(b.description, 400),
    value_label:   str(b.value_label, 30),
    how_to_use:    str(b.how_to_use, 400),
    category:      oneOf(b.category, REWARD_CATEGORIES, 'gear'),
    tier:          oneOf(b.tier, REWARD_TIERS, 'entry'),
    status:        oneOf(b.status, REWARD_STATUSES, 'coming_soon'),
    pace_cost:     Math.round(num(b.pace_cost) ?? 0),
    sort_order:    Math.round(num(b.sort_order) ?? 0),
    plus_only:     b.plus_only === true || b.plus_only === 'true',
    min_rank:      minRank,
    countries:     list(b.countries)?.map(c => c.toUpperCase()) ?? null,
    cities:        list(b.cities),
    starts_at:     isoDate(b.starts_at),
    expires_at:    isoDate(b.expires_at),
    code_mode:     codeMode,
    static_code:   codeMode === 'static' ? str(b.static_code, 80) : null,
    // Pool rewards are limited by their codes; static/none use stock (blank = unlimited).
    stock:         codeMode === 'pool' || stock == null ? null : Math.max(0, Math.round(stock)),
  };
}

export function rewardProblem(p: ReturnType<typeof rewardPayload>): string | null {
  if (!p.brand) return 'Brand is required';
  if (!p.title || p.title.length < 3) return 'Title is required';
  if (!p.description) return 'Description is required';
  if (!p.value_label) return 'Value label is required';
  if (p.pace_cost <= 0) return 'PACE cost must be more than 0';
  if (p.code_mode === 'static' && !p.static_code) return 'A static-code reward needs its code';
  if (p.starts_at && p.expires_at && p.expires_at <= p.starts_at) return 'Expiry must be after the start';
  return null;
}
