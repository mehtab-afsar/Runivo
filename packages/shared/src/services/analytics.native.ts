/**
 * Product analytics — native (React Native) resolution. Exposes the identical API
 * as analytics.ts (web) — see that file for the full contract and rules.
 */
import { PostHog } from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';
import { getSettings, saveSettings } from './store';

let client: PostHog | null = null;

export function initAnalytics(apiKey: string, host?: string): void {
  if (!apiKey || client) return;
  try {
    client = new PostHog(apiKey, { host: host ?? 'https://us.i.posthog.com' });
    // Honour an earlier opt-out as soon as the saved setting is read. Until then
    // nothing is queued that the runner has not allowed: events sent in these
    // first milliseconds are the only ones that can slip out, and the app
    // sends none before sign-in.
    getSettings().then(st => { if (st.analyticsEnabled === false) void client?.optOut(); }).catch(() => {});
  } catch {
    // non-critical — analytics must never block the app
  }
}

export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (!client) return;
  try {
    client.capture(eventName, properties as PostHogEventProperties | undefined);
  } catch {
    // non-critical
  }
}

export function identify(userId: string): void {
  if (!client) return;
  try {
    client.identify(userId);
  } catch {
    // non-critical
  }
}

export function resetAnalytics(): void {
  if (!client) return;
  try {
    client.reset();
  } catch {
    // non-critical
  }
}

/** Settings switch: stop (or resume) sending usage analytics. Persisted, and applied at once. */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  try {
    const st = await getSettings();
    await saveSettings({ ...st, analyticsEnabled: enabled });
  } catch { /* the in-memory switch below still applies for this session */ }
  try {
    if (enabled) void client?.optIn(); else void client?.optOut();
  } catch { /* non-critical */ }
}

export async function isAnalyticsEnabled(): Promise<boolean> {
  try { return (await getSettings()).analyticsEnabled !== false; } catch { return true; }
}
