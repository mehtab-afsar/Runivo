import { withSentryConfig } from '@sentry/nextjs';

// Headers for every page and API route. Without them the admin pages could be framed
// by another site (clickjacking) and the site had no transport or referrer policy.
//
// The CSP is deliberately narrow: it blocks framing, plugins and <base>/form hijacking.
// A full script-src policy needs per-request nonces in Next; add that as its own change,
// with the Supabase, Sentry and PostHog hosts allowed in connect-src.
const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

// org/project are only needed for source-map upload at build time (requires a
// SENTRY_AUTH_TOKEN env var in CI) — without them set, the Sentry build plugin skips
// upload rather than failing the build, so this is safe to leave unconfigured locally.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
