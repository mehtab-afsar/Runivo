/**
 * rc-webhook — RevenueCat webhook handler.
 *
 * Updates `profiles.subscription_tier` in Supabase when RevenueCat
 * fires a subscription lifecycle event (purchase, renewal, cancellation, etc.)
 *
 * Configure in RevenueCat dashboard:
 *   Webhook URL: https://<project>.supabase.co/functions/v1/rc-webhook
 *   Authorization header: Bearer <SUPABASE_ANON_KEY>
 *
 * Required env vars (auto-set by Supabase Edge Runtime):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env var:
 *   RC_WEBHOOK_SECRET — if set, validates the Authorization header value
 *
 * Entitlement → tier mapping:
 *   any active paid entitlement (runivo_plus / territory_lord / empire_builder)
 *   → 'premium'  (subscription_tier is constrained to 'free'|'premium', migration 042)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Entitlement identifiers that grant premium (any one is sufficient).
const PAID_ENTITLEMENTS = ['runivo_plus', 'territory_lord', 'empire_builder'];

type RCEvent = {
  type: string;
  app_user_id: string;
  product_id: string;
  entitlement_ids?: string[];
};

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
  if (auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: { event: RCEvent };
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = payload.event;
  if (!event?.app_user_id) {
    return new Response('Missing app_user_id', { status: 400 });
  }

  const userId = event.app_user_id;
  const eventType = event.type ?? '';

  // Determine the new tier based on the event
  let newTier: string | null = null;

  const activeEntitlements = event.entitlement_ids ?? [];

  // Any active paid entitlement maps to 'premium' (the column only allows
  // 'free'|'premium' since migration 042; the old three-tier strings violated the
  // CHECK constraint, so those UPDATEs failed and no one ever became premium).
  if (activeEntitlements.some(e => PAID_ENTITLEMENTS.includes(e))) {
    newTier = 'premium';
  } else if (
    eventType === 'CANCELLATION' ||
    eventType === 'EXPIRATION' ||
    eventType === 'BILLING_ISSUE'
  ) {
    newTier = 'free';
  }

  if (newTier === null) {
    // Unhandled event type — acknowledge without action
    return new Response(JSON.stringify({ ok: true, action: 'ignored' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: newTier, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('[rc-webhook] DB update error:', error.message);
    return new Response('DB error', { status: 500 });
  }

  console.log(`[rc-webhook] ${userId} → ${newTier} (event: ${eventType})`);

  return new Response(JSON.stringify({ ok: true, tier: newTier }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
