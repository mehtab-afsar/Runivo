// Next.js instrumentation hook — runs once per server/edge runtime on boot.
// Loads the matching Sentry config so server and edge requests are both captured.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
