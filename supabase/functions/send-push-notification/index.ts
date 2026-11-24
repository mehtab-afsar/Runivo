/**
 * send-push-notification
 *
 * Accepts a JSON body: { user_id, title, body, action_url? }
 * Fans out to:
 *   1. Web Push (VAPID) — push_subscriptions table
 *   2. Expo Push — expo_push_tokens table
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY   — base64url-encoded VAPID public key
 *   VAPID_PRIVATE_KEY  — base64url-encoded VAPID private key
 *   VAPID_SUBJECT      — mailto: or https: contact URL
 *   SUPABASE_URL       — set automatically by Supabase Edge Runtime
 *   SUPABASE_SERVICE_ROLE_KEY — set automatically by Supabase Edge Runtime
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';
import { isServiceRoleRequest, isUuid } from '../_shared/auth.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Web push (browsers) is optional; the iOS app uses Expo push. web-push throws on
// empty keys, and at module load that crashed the whole function on every call, so
// no phone got a push either. Only set it up when the keys exist.
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
let webPushReady = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@runivo.com', VAPID_PUBLIC, VAPID_PRIVATE);
    webPushReady = true;
  } catch (err) {
    console.error('[push] VAPID keys rejected; web push off:', err);
  }
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── Expo push fan-out ──────────────────────────────────────────────────────────

async function sendExpoNotifications(
  tokens: { id: number; token: string }[],
  title: string,
  body: string,
  actionUrl: string,
): Promise<{ sent: number; expired: number[] }> {
  if (tokens.length === 0) return { sent: 0, expired: [] };

  const messages = tokens.map(({ token }) => ({
    to:       token,
    sound:    'default',
    title,
    body,
    data:     { actionUrl },
    priority: 'high',
  }));

  let sent = 0;
  const expired: number[] = [];

  try {
    const resp = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(messages),
    });

    if (!resp.ok) {
      console.error('[push] Expo push API error:', resp.status, await resp.text());
      return { sent: 0, expired: [] };
    }

    const result = await resp.json() as { data: { status: string; details?: { error?: string } }[] };

    result.data.forEach((ticket, i) => {
      if (ticket.status === 'ok') {
        sent++;
      } else if (ticket.details?.error === 'DeviceNotRegistered') {
        expired.push(tokens[i].id);
      } else {
        console.warn('[push] Expo ticket error:', ticket);
      }
    });
  } catch (err) {
    console.error('[push] Expo push fetch failed:', err);
  }

  return { sent, expired };
}

// ── VAPID fan-out ──────────────────────────────────────────────────────────────

async function sendVapidNotifications(
  subs: { endpoint: string; p256dh: string; auth: string }[],
  payload: string,
): Promise<{ sent: number; expiredEndpoints: string[] }> {
  if (subs.length === 0 || !webPushReady) return { sent: 0, expiredEndpoints: [] };

  let sent = 0;
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn('[push] VAPID send failed:', err);
        }
      }
    })
  );

  return { sent, expiredEndpoints };
}

// ── Handler ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Server-to-server only. This function pushes to an ARBITRARY user_id from the
  // request body, so it must never be callable by a normal client — otherwise anyone
  // with the public anon key could push notifications to any user. It is only invoked
  // by other edge functions (currently process-run-territory) through their
  // service-role client, which sends the service-role key as the bearer. The platform
  // gateway would otherwise let a valid anon/authenticated JWT through, so we narrow
  // to the service-role key explicitly here.
  // Constant-time comparison (_shared/auth.ts): a plain string compare leaks the
  // key a byte at a time through response timing.
  if (!isServiceRoleRequest(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { user_id: string; title: string; body: string; action_url?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { user_id, body: rawBody, action_url: rawAction, type: rawType } = body ?? {};
  if (!isUuid(user_id) || typeof body.title !== 'string' || !body.title) {
    return new Response('Missing or invalid user_id/title', { status: 400 });
  }
  // Bound what is fanned out to push providers (APNs/Expo cap payloads at ~4 KB).
  const title      = body.title.slice(0, 120);
  const notifBody  = typeof rawBody === 'string' ? rawBody.slice(0, 500) : '';
  const action_url = typeof rawAction === 'string' && rawAction ? rawAction.slice(0, 300) : '/';
  const type       = typeof rawType === 'string' ? rawType.slice(0, 60) : '';

  // Per-category toggles (Settings screen) sit under the master switch — the
  // notify_push_on_notification() trigger already passes `type` here
  // (20260520000071_fix_notify_push_type.sql), but nothing ever read it until
  // now, so Run reminders / Territory alerts / Announce achievements / Weekly
  // summary all looked real but never actually suppressed anything.
  const { data: profile } = await supabase
    .from('profiles')
    .select('notifications_enabled, run_reminders_enabled, territory_alerts_enabled, announce_achievements_enabled, weekly_summary_enabled, offers_enabled')
    .eq('id', user_id)
    .single();

  if (profile && profile.notifications_enabled === false) {
    return new Response(JSON.stringify({ sent: 0, reason: 'disabled' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const CATEGORY_BY_TYPE: Record<string, keyof NonNullable<typeof profile>> = {
    run_reminder:       'run_reminders_enabled',
    streak_risk:        'run_reminders_enabled',
    territory_claimed:  'territory_alerts_enabled',
    zone_fading:        'territory_alerts_enabled',
    territory_lost:     'territory_alerts_enabled',
    territory_captured: 'territory_alerts_enabled',
    zone_attacked:      'territory_alerts_enabled',
    achievement:        'announce_achievements_enabled',
    rank_up:            'announce_achievements_enabled',
    pace_cap:           'announce_achievements_enabled',
    pace_cap_near:      'announce_achievements_enabled',
    campaign:           'offers_enabled',
    new_event:          'offers_enabled',
    weekly_summary:     'weekly_summary_enabled',
  };
  const categoryColumn = CATEGORY_BY_TYPE[type];
  if (profile && categoryColumn && profile[categoryColumn] === false) {
    return new Response(JSON.stringify({ sent: 0, reason: 'category_disabled' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch both subscription types in parallel
  const [vapidResult, expoResult] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id),
    supabase
      .from('expo_push_tokens')
      .select('id, token')
      .eq('user_id', user_id),
  ]);

  if (vapidResult.error) {
    console.error('[push] DB error (VAPID):', vapidResult.error.message);
  }
  if (expoResult.error) {
    console.error('[push] DB error (Expo):', expoResult.error.message);
  }

  const vapidSubs   = vapidResult.data ?? [];
  const expoTokens  = expoResult.data  ?? [];

  if (vapidSubs.length === 0 && expoTokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const vapidPayload = JSON.stringify({ title, body: notifBody, actionUrl: action_url });

  const [vapidSendResult, expoSendResult] = await Promise.all([
    sendVapidNotifications(vapidSubs, vapidPayload),
    sendExpoNotifications(expoTokens, title, notifBody, action_url),
  ]);

  // Clean up expired VAPID subscriptions
  if (vapidSendResult.expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', vapidSendResult.expiredEndpoints);
  }

  // Clean up expired Expo tokens (DeviceNotRegistered)
  if (expoSendResult.expired.length > 0) {
    await supabase
      .from('expo_push_tokens')
      .delete()
      .in('id', expoSendResult.expired);
  }

  const totalSent = vapidSendResult.sent + expoSendResult.sent;
  return new Response(JSON.stringify({ sent: totalSent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
