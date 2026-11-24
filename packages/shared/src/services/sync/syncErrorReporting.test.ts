import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resetErrorReportingForTests, setErrorReporter } from '../errorReporting';
import { forwardSyncError, forwardSyncErrorsToErrorReporting } from './syncErrorReporting';
import { reportSyncError, setSyncErrorListener } from './syncQueue';

const reporter = vi.fn();

beforeEach(() => {
  __resetErrorReportingForTests();
  reporter.mockClear();
  setErrorReporter(reporter);
});
afterEach(() => { setSyncErrorListener(null); __resetErrorReportingForTests(); });

describe('forwardSyncError', () => {
  it('reports to the error tracker under the sync domain with a kebab-case operation', () => {
    const err = new Error('invoke failed');
    forwardSyncError({ scope: 'scoreRun', error: err, context: { runId: 'run-1' } });
    expect(reporter).toHaveBeenCalledOnce();
    expect(reporter).toHaveBeenCalledWith(err, {
      tags: { domain: 'sync', operation: 'score-run', handled: 'true' },
      extra: { runId: 'run-1' },
    });
  });

  it.each([['postRunDebrief', 'post-run-debrief'], ['postTierMilestone', 'post-tier-milestone']])(
    'maps scope %s to operation %s', (scope, operation) => {
      forwardSyncError({ scope, error: new Error(scope) });
      expect(reporter.mock.calls[0][1].tags.operation).toBe(operation);
    },
  );

  it('never forwards coordinates, tokens or payloads, whatever the caller put in context', () => {
    forwardSyncError({
      scope: 'scoreRun', error: new Error('x'),
      context: { runId: 'r', lat: 51.5, token: 'secret', note: 'Bearer abc.def.ghi' },
    });
    const { extra } = reporter.mock.calls[0][1];
    expect(extra.runId).toBe('r');
    expect(extra.lat).toBe('[redacted]');
    expect(extra.token).toBe('[redacted]');
    expect(JSON.stringify(extra)).not.toContain('abc.def.ghi');
    expect(JSON.stringify(extra)).not.toContain('51.5');
  });

  it('throttles an identical failure instead of flooding the tracker', () => {
    for (let i = 0; i < 5; i++) forwardSyncError({ scope: 'scoreRun', error: new Error('same'), context: { runId: 'r' } });
    expect(reporter).toHaveBeenCalledOnce();
  });

  it('does not throw if the tracker does', () => {
    reporter.mockImplementationOnce(() => { throw new Error('sentry down'); });
    expect(() => forwardSyncError({ scope: 'scoreRun', error: new Error('y') })).not.toThrow();
  });
});

describe('forwardSyncErrorsToErrorReporting', () => {
  it('routes reportSyncError to the tracker once registered, and restores the default when undone', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const undo = forwardSyncErrorsToErrorReporting();
    reportSyncError('scoreRun', new Error('boom'), { runId: 'r2' });
    expect(reporter).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();

    undo();
    reportSyncError('scoreRun', new Error('boom 2'));
    expect(reporter).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
