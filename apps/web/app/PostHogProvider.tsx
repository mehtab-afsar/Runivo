'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

// Self-contained (does not import packages/shared) — apps/web has no dependency on
// the shared package today, and this marketing site has no need for the mobile-only
// funnel events (signup/run/territory/etc.) that live in analytics.ts's wrapper.
// Automatic pageview capture covers this app's analytics needs.
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey || posthog.__loaded) return;
    // Auth links (password reset, sign-in) carry access and refresh tokens after
    // the '#'. Never start analytics on those pages, and strip every '#…' from
    // anything sent, so a token can't end up stored in PostHog.
    if (isAuthTokenPage()) return;
    posthog.init(apiKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      capture_pageview: true,
      before_send: (event) => {
        if (!event) return event;
        for (const key of ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer']) {
          const v = event.properties?.[key];
          if (typeof v === 'string') event.properties[key] = stripFragment(v);
        }
        return event;
      },
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

const AUTH_PATHS = ['/reset-password', '/auth'];

function isAuthTokenPage(): boolean {
  if (typeof window === 'undefined') return true;
  const { pathname, hash, search } = window.location;
  return AUTH_PATHS.some(p => pathname.startsWith(p))
    || /access_token|refresh_token|type=recovery/.test(hash + search);
}

function stripFragment(url: string): string {
  const i = url.indexOf('#');
  return i === -1 ? url : url.slice(0, i);
}
