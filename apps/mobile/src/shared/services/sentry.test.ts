import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { init, captureException } = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn() }));
vi.mock('@sentry/react-native', () => ({ init, captureException }));

async function loadSentryModule(dsn: string | undefined) {
  vi.resetModules();
  if (dsn === undefined) vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', '');
  else vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', dsn);
  return import('./sentry');
}

// Each test loads fresh copies of sentry.ts and errorReporting.ts (vi.resetModules in
// loadSentryModule), so a reporter registered in one test can't leak into the next.
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('__DEV__', false); // React Native defines this; Vitest doesn't
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Sentry as the captureHandledError sink', () => {
  it('forwards handled errors to Sentry.captureException with tags and level', async () => {
    const { initSentry } = await loadSentryModule('https://key@example.ingest.sentry.io/1');
    initSentry();
    // same (fresh) module graph as the sentry.ts that was just loaded
    const helper = await import('@shared/services/errorReporting');
    const err = new Error('database is locked');

    helper.captureHandledError(err, { domain: 'storage', operation: 'save-run', extra: { runId: 'r1' } });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [sent, options] = captureException.mock.calls[0]!;
    expect(sent).toBe(err);
    expect(options).toMatchObject({
      level: 'warning',
      tags: { domain: 'storage', operation: 'save-run', handled: 'true' },
      extra: { runId: 'r1' },
    });
  });

  it('keeps GPS coordinates and auth tokens out of what Sentry receives', async () => {
    const { initSentry } = await loadSentryModule('https://key@example.ingest.sentry.io/1');
    initSentry();
    const helper = await import('@shared/services/errorReporting');
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

    helper.captureHandledError(new Error('x'), {
      domain: 'sync',
      operation: 'push-run',
      extra: {
        gpsPoints: [{ lat: 51.5007, lng: -0.1246 }],
        lastKnownLocation: 'SRID=4326;POINT(-0.1246 51.5007)',
        headers: { Authorization: `Bearer ${jwt}` },
        note: `Bearer ${jwt}`,
        attempts: 3,
      },
    });

    const wire = JSON.stringify(captureException.mock.calls[0]);
    expect(wire).not.toContain('51.5007');
    expect(wire).not.toContain('0.1246');
    expect(wire).not.toContain('eyJhbGci');
    expect(wire).not.toContain('POINT(');
    expect(captureException.mock.calls[0]![1].extra.attempts).toBe(3);
  });

  it('registers nothing without a DSN, so handled errors stay local', async () => {
    const { initSentry } = await loadSentryModule(undefined);
    initSentry();
    const helper = await import('@shared/services/errorReporting');

    helper.captureHandledError(new Error('x'), { domain: 'gps', operation: 'append-fix' });

    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });
});
