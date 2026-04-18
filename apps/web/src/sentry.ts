/**
 * Sentry error-tracking initialisation for the web app.
 *
 * To activate:
 *   1. npm install @sentry/react --workspace=@runivo/web
 *   2. Set VITE_SENTRY_DSN in .env.local
 *   3. Uncomment the Sentry import and init block below.
 *
 * The module is structured so that removing the comments is the only
 * change needed — no other files need to be touched.
 */

// import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!dsn) return;
  // Sentry.init({
  //   dsn,
  //   environment: import.meta.env.MODE,
  //   tracesSampleRate: 0.2,
  //   replaysOnErrorSampleRate: 1.0,
  // });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return;
  // Sentry.captureException(error, { extra: context });
  console.error('[Sentry stub]', error, context);
}
