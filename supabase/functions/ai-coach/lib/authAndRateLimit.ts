// Who may call ai-coach and how much they may spend: bearer-token validation,
// the Plus-tier and AI-consent gates, and the per-user daily spend caps.
// Every refusal is thrown as a ready-made Response; the router passes it through.
import { effectiveTier } from '../../_shared/subscriptions.ts';
import { jsonResponse } from './http.ts';
import type { Db, Feature } from './types.ts';

/** Runivo Plus: 'premium' or the internal 'admin' tier (entitlements.isPlus). */
export function isPlusTier(tier: string | null | undefined): boolean {
  // Plus for everyone while subscriptions are off (_shared/subscriptions.ts).
  tier = effectiveTier(tier);
  return tier === 'premium' || tier === 'admin';
}

/** The caller behind the request's bearer token. Throws a 401 Response when there is none. */
export async function authenticate(supabase: Db, req: Request): Promise<{ id: string }> {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) throw jsonResponse(401, { error: 'unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) throw jsonResponse(401, { error: 'unauthorized' });
  return user;
}

/**
 * AI stays in Plus (PRD "Running costs"): every feature that calls Claude refuses
 * free runners here, before any cost. 'admin' counts as Plus (402 plus_required).
 *
 * Then the AI-consent check: everything past it sends the runner's data to
 * Anthropic. Apple (5.1.2(i)) and the privacy policy require explicit permission
 * first, so this is enforced here, not only in the app: a modified client must
 * not be able to skip it (403 ai_consent_required).
 */
export async function requirePlusAndConsent(supabase: Db, userId: string): Promise<void> {
  const { data: tierRow } = await supabase
    .from('profiles').select('subscription_tier, ai_consent_at').eq('id', userId).single();
  const gate = tierRow as { subscription_tier: string | null; ai_consent_at: string | null } | null;
  if (!isPlusTier(gate?.subscription_tier)) throw jsonResponse(402, { error: 'plus_required' });
  if (!gate?.ai_consent_at) throw jsonResponse(403, { error: 'ai_consent_required' });
}

// ─── Cost protection ──────────────────────────────────────────────────────────
// Per-user daily spend caps (USD). Cached features (weekly_brief, post_run,
// training_plan, nutrition_insights) cost fractions of a cent per day in
// normal use. coach_chat is the only unbounded endpoint.
// A chat turn is ~4-7k input tokens (system prompt + 12 turns of history) plus
// ~300 output: about $0.02 at Sonnet prices, so the old $0.08 chat cap allowed
// only 3-5 messages a day. Tunable per project with secrets.
const DAILY_CAP_USD      = Number(Deno.env.get('AI_DAILY_CAP_USD') ?? '0.60');  // ~25-30 calls incl. brief/debrief
const CHAT_DAILY_CAP_USD = Number(Deno.env.get('AI_CHAT_CAP_USD')  ?? '0.45');  // ~20 chat turns

// Worst case for one request (a long context plus max output at Sonnet prices),
// held while the request runs so parallel requests can't overrun the cap.
const RESERVE_USD = 0.02;

/**
 * Reserve this request's worst-case cost against the runner's daily caps, in
 * one locked step (ai_reserve_spend, 20261115000023): parallel requests see
 * each other's reservations. Throws a 429 Response when a cap is reached.
 * Returns the reservation id; release it when the request ends.
 */
export async function enforceDailyCap(supabase: Db, userId: string, feature: Feature): Promise<string | null> {
  const { data, error } = await supabase.rpc('ai_reserve_spend', {
    p_user: userId, p_feature: feature, p_estimate_usd: RESERVE_USD,
    p_daily_cap_usd: DAILY_CAP_USD, p_chat_cap_usd: CHAT_DAILY_CAP_USD,
  });
  // Fail closed: if the cap can't be checked, don't spend.
  if (error) throw jsonResponse(503, { error: 'limit_check_failed' });

  const row = (Array.isArray(data) ? data[0] : data ?? null) as { reservation_id: string | null; refused: string | null } | null;
  if (row?.refused) {
    const detail = row.refused === 'chat_limit_reached'
      ? 'Daily coach chat limit reached. Try again tomorrow.'
      : 'Daily AI usage limit reached. Try again tomorrow.';
    throw jsonResponse(429, { error: row.refused, detail });
  }
  return row?.reservation_id ?? null;
}

export async function releaseReservation(supabase: Db, id: string | null): Promise<void> {
  if (!id) return;
  await supabase.from('ai_usage_log').delete().eq('id', id).eq('reservation', true).then(() => {}, () => {});
}

/**
 * Reserve spend for this request and hand back the function that releases it.
 * The router calls the release in a `finally`, so the hold never outlives the request.
 */
export async function reserveSpend(supabase: Db, userId: string, feature: Feature): Promise<() => Promise<void>> {
  const reservationId = await enforceDailyCap(supabase, userId, feature);
  return () => releaseReservation(supabase, reservationId);
}
