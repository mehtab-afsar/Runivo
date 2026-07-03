import * as Sentry from '@sentry/nextjs';
import { scrubPII } from './lib/sentryScrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    tracesSampleRate: 0.2,
    beforeSend: event => scrubPII(event),
    beforeBreadcrumb: breadcrumb => scrubPII(breadcrumb),
  });
}
