'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Required by Next.js App Router for Sentry to capture errors that escape the root
// layout. Must render its own <html>/<body> since it replaces the root layout entirely
// when triggered.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong.</h2>
      </body>
    </html>
  );
}
