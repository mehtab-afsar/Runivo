'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Required by Next.js App Router for Sentry to capture errors that escape the root
// layout. Must render its own <html>/<body> since it replaces the root layout entirely
// when triggered, so it cannot use globals.css and carries its few styles inline
// (same tokens as the rest of the site: paper, ink, Outfit falls back to the system font).
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{
        margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24,
        background: '#F4F5F1', color: '#17181A',
        fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 12px' }}>Something went wrong.</h1>
          <p style={{ color: '#5F635D', margin: '0 0 24px' }}>Try again, and if it keeps happening, email support@runivo.com.</p>
          <button type="button" onClick={() => window.location.assign('/')} style={{
            display: 'inline-flex', alignItems: 'center', height: 52, padding: '0 26px', borderRadius: 999, border: 0, cursor: 'pointer',
            background: '#17181A', color: '#fff', fontWeight: 600, fontSize: 16, fontFamily: 'inherit',
          }}>Back to Runivo</button>
        </div>
      </body>
    </html>
  );
}
