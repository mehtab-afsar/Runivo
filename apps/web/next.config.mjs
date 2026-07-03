import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const config = {};

// org/project are only needed for source-map upload at build time (requires a
// SENTRY_AUTH_TOKEN env var in CI) — without them set, the Sentry build plugin skips
// upload rather than failing the build, so this is safe to leave unconfigured locally.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
