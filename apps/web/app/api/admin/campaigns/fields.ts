import { str, num, list, isoDate, oneOf } from '@/lib/adminServer';

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'done', 'cancelled'] as const;
export const TIERS = ['free', 'premium', 'admin'] as const;

export function campaignPayload(b: Record<string, unknown>) {
  const hour = num(b.local_hour);
  const active = num(b.active_within_days);
  const tiers = list(b.tiers)?.filter(t => (TIERS as readonly string[]).includes(t)) ?? null;
  return {
    name:               str(b.name, 120),
    title:              str(b.title, 80),
    body:               str(b.body, 240),
    action_url:         str(b.action_url, 200) ?? '/',
    send_at:            isoDate(b.send_at),
    local_hour:         hour == null ? null : Math.round(hour),
    expires_at:         isoDate(b.expires_at),
    countries:          list(b.countries)?.map(c => c.toUpperCase()) ?? null,
    tiers:              tiers && tiers.length ? tiers : null,
    active_within_days: active == null ? null : Math.max(1, Math.round(active)),
    status:             oneOf(b.status, CAMPAIGN_STATUSES, 'scheduled'),
  };
}

export function campaignProblem(p: ReturnType<typeof campaignPayload>): string | null {
  if (!p.name) return 'Internal name is required';
  if (!p.title) return 'Push title is required';
  if (!p.body) return 'Push message is required';
  if (!p.send_at) return 'Send time is required';
  if (p.local_hour != null && (p.local_hour < 7 || p.local_hour > 21)) return 'Local hour must be between 7 and 21 (quiet hours)';
  if (!p.action_url.startsWith('/')) return 'Link must be an in-app path like /run or /store';
  if (p.expires_at && p.expires_at <= p.send_at) return 'Expiry must be after the send time';
  return null;
}
