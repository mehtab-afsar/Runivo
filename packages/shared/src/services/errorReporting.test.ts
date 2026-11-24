import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  captureHandledError,
  sanitizeExtra,
  setErrorReporter,
  __resetErrorReportingForTests,
  REPORT_THROTTLE_MS,
  type HandledErrorReport,
} from './errorReporting';

const g = globalThis as { __DEV__?: boolean };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-24T10:00:00Z'));
  __resetErrorReportingForTests();
  delete g.__DEV__;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete g.__DEV__;
});

describe('captureHandledError — production', () => {
  it('forwards the error to the reporter with domain/operation tags', () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const err = new Error('SQLITE_FULL');

    captureHandledError(err, { domain: 'storage', operation: 'save-run', extra: { runId: 'r1', pointCount: 842 } });

    expect(reporter).toHaveBeenCalledTimes(1);
    const [sentError, report] = reporter.mock.calls[0] as [unknown, HandledErrorReport];
    expect(sentError).toBe(err);
    expect(report.tags).toEqual({ domain: 'storage', operation: 'save-run', handled: 'true' });
    expect(report.extra).toEqual({ runId: 'r1', pointCount: 842 });
  });

  it('is a silent no-op when no reporter is registered (no DSN)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => captureHandledError(new Error('x'), { domain: 'sync', operation: 'push' })).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('never throws, even when the reporter does', () => {
    setErrorReporter(() => { throw new Error('sentry exploded'); });
    expect(() => captureHandledError(new Error('x'), { domain: 'gps', operation: 'append-fix' })).not.toThrow();
  });

  it('copes with non-Error throwables', () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    captureHandledError('a string', { domain: 'native', operation: 'x' });
    captureHandledError(undefined, { domain: 'native', operation: 'y' });
    captureHandledError({ code: 7 }, { domain: 'native', operation: 'z' });
    expect(reporter).toHaveBeenCalledTimes(3);
  });
});

describe('captureHandledError — __DEV__', () => {
  it('only console.warns; nothing is sent to the reporter', () => {
    g.__DEV__ = true;
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = new Error('boom');

    captureHandledError(err, { domain: 'checkpoint', operation: 'write', extra: { parts: 3 } });

    expect(reporter).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[checkpoint] write failed:', err, { parts: 3 });
  });
});

describe('captureHandledError — does not leak sensitive payloads', () => {
  const gpsPoints = [{ lat: 51.5007, lng: -0.1246 }, { lat: 51.5008, lng: -0.1247 }];

  it('never forwards GPS coordinate arrays or objects', () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);

    captureHandledError(new Error('x'), {
      domain: 'run', operation: 'finish',
      extra: { gpsPoints, route: gpsPoints, nested: { lat: 51.5, lng: -0.12 }, pointCount: gpsPoints.length },
    });

    const report = (reporter.mock.calls[0] as [unknown, HandledErrorReport])[1];
    const wire = JSON.stringify(report);
    expect(wire).not.toContain('51.5007');
    expect(wire).not.toContain('0.1246');
    expect(wire).not.toContain('51.5');
    expect(report.extra.gpsPoints).toBe('[redacted]');
    expect(report.extra.route).toBe('[redacted]');
    expect(report.extra.nested).toBe('[object]');
    expect(report.extra.pointCount).toBe(2);
  });

  it('redacts coordinate and credential keys regardless of value type', () => {
    expect(sanitizeExtra({
      lat: 51.5, lng: -0.12, latitude: 1, longitude: 2, coords: { a: 1 }, lastKnownLocation: 'SRID=4326;POINT(1 2)',
      token: 'abc', accessToken: 'abc', authorization: 'Bearer abc', password: 'hunter2', email: 'a@b.co', session: 's',
    })).toEqual({
      lat: '[redacted]', lng: '[redacted]', latitude: '[redacted]', longitude: '[redacted]', coords: '[redacted]',
      lastKnownLocation: '[redacted]', token: '[redacted]', accessToken: '[redacted]', authorization: '[redacted]',
      password: '[redacted]', email: '[redacted]', session: '[redacted]',
    });
  });

  it('scrubs tokens and WKT points that appear inside ordinary string values', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const out = sanitizeExtra({
      detail: `request failed: Authorization: Bearer ${jwt} at SRID=4326;POINT(-0.1246 51.5007)`,
      raw: `token ${jwt}`,
    });
    expect(JSON.stringify(out)).not.toContain('eyJhbGci');
    expect(JSON.stringify(out)).not.toContain('POINT(');
    expect(JSON.stringify(out)).not.toContain('51.5007');
    expect(out.detail).toContain('[redacted]');
  });

  it('flattens arrays and objects to size/type markers, truncates long strings, drops undefined', () => {
    const out = sanitizeExtra({
      ids: ['a', 'b', 'c'], blob: { deep: { deeper: 1 } }, long: 'x'.repeat(5000), gone: undefined, fn: () => 1,
      ok: true, n: 3, nil: null, inf: Infinity,
    });
    expect(out.ids).toBe('[array(3)]');
    expect(out.blob).toBe('[object]');
    expect((out.long as string).length).toBeLessThanOrEqual(201);
    expect('gone' in out).toBe(false);
    expect(out.fn).toBe('[function]');
    expect(out).toMatchObject({ ok: true, n: 3, nil: null, inf: 'Infinity' });
  });

  it('caps how many keys are kept', () => {
    const many = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeExtra(many)).length).toBeLessThanOrEqual(20);
  });
});

describe('captureHandledError — throttling', () => {
  it('reports an identical failure once per window and counts the suppressed repeats', () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const fail = () => captureHandledError(new Error('disk I/O error'), { domain: 'gps', operation: 'append-fix' });

    for (let i = 0; i < 50; i++) fail();
    expect(reporter).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(REPORT_THROTTLE_MS + 1);
    fail();
    expect(reporter).toHaveBeenCalledTimes(2);
    const second = (reporter.mock.calls[1] as [unknown, HandledErrorReport])[1];
    expect(second.extra.suppressedSinceLastReport).toBe(49);
  });

  it('does not merge different operations or different messages', () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    captureHandledError(new Error('a'), { domain: 'gps', operation: 'append-fix' });
    captureHandledError(new Error('a'), { domain: 'gps', operation: 'drain-buffer' });
    captureHandledError(new Error('b'), { domain: 'gps', operation: 'append-fix' });
    expect(reporter).toHaveBeenCalledTimes(3);
  });
});
