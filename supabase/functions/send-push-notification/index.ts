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

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@runivo.app',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
);

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
  if (subs.length === 0) return { sent: 0, expiredEndpoints: [] };

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

  let body: { user_id: string; title: string; body: string; action_url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { user_id, title, body: notifBody, action_url = '/' } = body;
  if (!user_id || !title) {
    return new Response('Missing user_id or title', { status: 400 });
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
