'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { SUPPORT_EMAIL } from '@/lib/site';

/** A page failed while rendering. The layout (and so the nav and footer) is still intact. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <>
      <Nav />
      <main id="main" className="status-page">
        <div role="alert">
          <h1 className="h-section">Something went wrong.</h1>
          <p className="lead" style={{ margin: '14px auto 0', maxWidth: 440 }}>
            Try again, and if it keeps happening email <a href={`mailto:${SUPPORT_EMAIL}`} className="accent">{SUPPORT_EMAIL}</a>.
          </p>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-dark" onClick={reset}>Try again</button>
            <Link href="/" className="btn btn-surface">Back to home</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
