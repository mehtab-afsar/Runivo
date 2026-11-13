/**
 * rc-webhook — RevenueCat webhook handler.
 *
 * Updates `profiles.subscription_tier` in Supabase when RevenueCat
 * fires a subscription lifecycle event (purchase, renewal, cancellation, etc.)
 *
 * Configure in RevenueCat dashboard:
 *   Webhook URL: https://<project>.supabase.co/functions/v1/rc-webhook
 *   Authorization header: Bearer <RC_WEBHOOK_SECRET>
 *
 * Required env vars (auto-set by Supabase Edge Runtime):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Required env var:
 *   RC_WEBHOOK_SECRET — the Authorization header must be "Bearer <secret>"
 *
 * Event → tier rules live in ../_shared/rcTier.ts (unit-tested): purchases,
 * renewals and transfers grant 'premium'; only EXPIRATION downgrades
 * (CANCELLATION and BILLING_ISSUE keep Plus until the period ends); 'admin'
 * profiles are never changed.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decideTierUpdates, usersInEvent, type RCEvent } from '../_shared/rcTier.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Webhook secret is required — reject unauthenticated requests even if the env var
  // hasn't been set yet, so misconfigured deployments fail loudly instead of silently
  // accepting unauthenticated tier-manipulation requests.
  const secret = Deno.env.get('RC_WEBHOOK_SECRET');
  if (!secret) {
    return new Response('Webhook secret not configured', { status: 500 });
  }
  const auth = req.headers.get('Authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const authorized = auth.length === expected.length &&
    Array.from(auth).reduce((diff, c, i) => diff | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0;
  if (!authorized) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: { event: RCEvent };
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = payload.event;
  const userIds = usersInEvent(event ?? {});
  if (!event || userIds.length === 0) {
    return new Response('Missing app_user_id', { status: 400 });
  }

  // Current tiers first: admins are never touched, and unchanged rows are skipped.
  const { data: rows, error: readError } = await supabase
    .from('profiles')
    .select('id, subscription_tier')
    .in('id', userIds);
  if (readError) {
    console.error('[rc-webhook] DB read error:', readError.message);
    return new Response('DB error', { status: 500 });
  }
  const currentTiers: Record<string, string | null> = {};
  for (const r of (rows ?? []) as { id: string; subscription_tier: string | null }[]) {
    currentTiers[r.id] = r.subscription_tier;
  }

  const updates = decideTierUpdates(event, currentTiers);
  if (updates.length === 0) {
    return new Response(JSON.stringify({ ok: true, action: 'ignored', type: event.type ?? '' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  for (const u of updates) {
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_tier: u.tier, updated_at: new Date().toISOString() })
      .eq('id', u.userId);
    if (error) {
      console.error('[rc-webhook] DB update error:', error.message);
      return new Response('DB error', { status: 500 });
    }
    // Structured log — see stripe-webhook's identical fix for rationale.
    console.log({ source: 'rc-webhook', userId: u.userId, newTier: u.tier, eventType: event.type });
  }

  return new Response(JSON.stringify({ ok: true, updates }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
