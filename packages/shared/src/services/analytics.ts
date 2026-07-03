/**
 * Product analytics — web (browser/Next.js) resolution. Metro resolves
 * analytics.native.ts on mobile instead; both expose an identical API so callers
 * never need to know which platform they're on.
 *
 * All 8 activation-funnel events must go through track() here — no ad hoc PostHog
 * calls in screens. Never pass GPS coordinates or precise location as a property.
 */
import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics(apiKey: string, host?: string): void {
  if (!apiKey || initialized) return;
  try {
    posthog.init(apiKey, { api_host: host ?? 'https://us.i.posthog.com', capture_pageview: false });
    initialized = true;
  } catch {
    // non-critical — analytics must never block the app
  }
}

export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.capture(eventName, properties);
  } catch {
    // non-critical
  }
}

export function identify(userId: string): void {
  if (!initialized) return;
  try {
    posthog.identify(userId);
  } catch {
    // non-critical
  }
}

export function resetAnalytics(): void {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    // non-critical
  }
}
