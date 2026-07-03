/**
 * Product analytics — native (React Native) resolution. Exposes the identical API
 * as analytics.ts (web) — see that file for the full contract and rules.
 */
import { PostHog } from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';

let client: PostHog | null = null;

export function initAnalytics(apiKey: string, host?: string): void {
  if (!apiKey || client) return;
  try {
    client = new PostHog(apiKey, { host: host ?? 'https://us.i.posthog.com' });
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
