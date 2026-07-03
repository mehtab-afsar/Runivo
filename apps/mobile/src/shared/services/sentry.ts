/**
 * Sentry error-tracking initialisation for the mobile app.
 *
 * Set EXPO_PUBLIC_SENTRY_DSN in apps/mobile/.env.local to activate — initSentry() and
 * captureException() are safe no-ops without it (matches every other env-gated service
 * in this codebase, e.g. supabase.ts's anon key check).
 */

import * as Sentry from '@sentry/react-native';
import { scrubPII } from './sentryScrub';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.2,
    // See sentryScrub.ts — strips GPS coordinates and auth tokens before they leave
    // the device. Applies to every event, not just captureException() calls below,
    // since Sentry.init also auto-captures native crashes and unhandled rejections.
    beforeSend: event => scrubPII(event),
    beforeBreadcrumb: breadcrumb => scrubPII(breadcrumb),
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) {
    if (__DEV__) console.error('[Sentry disabled — no DSN]', error, context);
    return;
  }
  Sentry.captureException(error, { extra: context ? (scrubPII(context) as Record<string, unknown>) : undefined });
}
