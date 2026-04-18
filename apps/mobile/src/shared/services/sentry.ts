/**
 * Sentry error-tracking initialisation for the mobile app.
 *
 * To activate:
 *   1. npx expo install @sentry/react-native
 *   2. npx @sentry/wizard@latest -i reactNative   (patches native files)
 *   3. Set EXPO_PUBLIC_SENTRY_DSN in apps/mobile/.env.local
 *   4. Uncomment the Sentry import and init block below.
 */

// import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) return;
  // Sentry.init({
  //   dsn,
  //   environment: __DEV__ ? 'development' : 'production',
  //   tracesSampleRate: 0.2,
  // });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return;
  // Sentry.captureException(error, { extra: context });
  if (__DEV__) console.error('[Sentry stub]', error, context);
}
