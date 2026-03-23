/**
 * pushNotificationService — Web Push subscription lifecycle.
 *
 * Handles:
 *  1. Service worker registration
 *  2. Permission request
 *  3. PushManager subscription (VAPID)
 *  4. Saving / removing the subscription in Supabase push_subscriptions
 *
 * All functions are safe to call in browsers that don't support Push API —
 * they return false / null instead of throwing.
 *
 * Required env var (web app):
 *   VITE_VAPID_PUBLIC_KEY — the URL-safe base64 VAPID public key
 */

import { supabase } from './supabase';

// ── Capability check ───────────────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

// ── VAPID key conversion ───────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// ── Service worker ─────────────────────────────────────────────────────────────

let _swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  if (_swRegistration) return _swRegistration;

  try {
    _swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Wait for the SW to be active before using it for push
    await navigator.serviceWorker.ready;
    return _swRegistration;
  } catch (err) {
    console.warn('[push] SW registration failed:', err);
    return null;
  }
}

// ── Subscribe ──────────────────────────────────────────────────────────────────

/**
 * Requests notification permission (if not already granted), creates a Web
 * Push subscription via PushManager, and saves the endpoint + keys in
 * Supabase push_subscriptions so the edge function can fan out to this device.
 *
 * Returns 'granted' | 'denied' | 'unsupported' | 'error'
 */
export async function subscribeToPush(): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
  if (!isPushSupported()) return 'unsupported';

  // 1. Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  // 2. Register SW
  const sw = await registerServiceWorker();
  if (!sw) return 'error';

  // 3. Get or create Push subscription
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY is not set');
    return 'error';
  }

  let pushSub: PushSubscription | null = null;
  try {
    pushSub = await sw.pushManager.getSubscription();
    if (!pushSub) {
      pushSub = await sw.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });
    }
  } catch (err) {
    console.warn('[push] PushManager.subscribe failed:', err);
    return 'error';
  }

  // 4. Save to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'error';

    const sub = pushSub.toJSON();
    const { endpoint, keys } = sub as { endpoint: string; keys: { p256dh: string; auth: string } };

    await supabase.from('push_subscriptions').upsert({
      user_id:  user.id,
      endpoint,
      p256dh:   keys.p256dh,
      auth:     keys.auth,
    }, { onConflict: 'user_id,endpoint' });
  } catch (err) {
    console.warn('[push] Failed to save subscription to Supabase:', err);
    // Don't fail here — user has granted permission and SW is registered
  }

  return 'granted';
}

// ── Unsubscribe ────────────────────────────────────────────────────────────────

/**
 * Unsubscribes from Web Push on this device and removes the endpoint row from
 * Supabase so no further pushes are sent to this device.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const sw = await navigator.serviceWorker.getRegistration('/');
  if (!sw) return;

  const pushSub = await sw.pushManager.getSubscription();
  if (!pushSub) return;

  const endpoint = pushSub.endpoint;

  try { await pushSub.unsubscribe(); } catch { /* already gone */ }

  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch { /* non-critical */ }
}

// ── Sync on app open ───────────────────────────────────────────────────────────

/**
 * Called once on app load. If the browser already granted notification
 * permission, silently re-registers the subscription (handles browser updates
 * that rotate VAPID keys or clear subscriptions).
 */
export async function syncPushSubscriptionOnLoad(): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  // Re-register SW (idempotent)
  const sw = await registerServiceWorker();
  if (!sw) return;

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) return;

  try {
    let pushSub = await sw.pushManager.getSubscription();
    if (!pushSub) {
      // Subscription was lost (e.g. after browser update) — renew it silently
      pushSub = await sw.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });

      const sub = pushSub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('push_subscriptions').upsert({
          user_id:  user.id,
          endpoint: sub.endpoint,
          p256dh:   sub.keys.p256dh,
          auth:     sub.keys.auth,
        }, { onConflict: 'user_id,endpoint' });
      }
    }
  } catch { /* silent — don't disrupt app load */ }
}
