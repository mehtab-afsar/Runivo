import { describe, it, expect, vi, afterEach } from 'vitest';
import { onSyncStatusChange, reportSyncError, setSyncErrorListener, setSyncStatus, withRetry } from './syncQueue';

afterEach(() => { vi.useRealTimers(); setSyncErrorListener(null); vi.restoreAllMocks(); });

describe('withRetry', () => {
  it('returns the first success without waiting', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries with 1 s then 2 s backoff and returns the eventual success', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b')).mockResolvedValue('ok');
    const p = withRetry(fn);
    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after the final attempt', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(new Error('1')).mockRejectedValueOnce(new Error('2')).mockRejectedValue(new Error('3'));
    const p = withRetry(fn);
    const assertion = expect(p).rejects.toThrow('3');
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('a single attempt never waits', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(withRetry(fn, 1)).rejects.toThrow('nope');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('reportSyncError', () => {
  it('hands the failure to the registered listener', () => {
    const listener = vi.fn();
    setSyncErrorListener(listener);
    const err = new Error('boom');
    reportSyncError('scoreRun', err, { runId: 'r1' });
    expect(listener).toHaveBeenCalledWith({ scope: 'scoreRun', error: err, context: { runId: 'r1' } });
  });

  it('warns on the console when no listener is registered', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportSyncError('milestone', new Error('x'));
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('milestone');
  });

  it('never throws, even if the listener does', () => {
    setSyncErrorListener(() => { throw new Error('listener broke'); });
    expect(() => reportSyncError('x', new Error('y'))).not.toThrow();
  });
});

describe('onSyncStatusChange', () => {
  afterEach(() => setSyncStatus('idle'));

  it('notifies subscribers and stops after unsubscribe', () => {
    const fn = vi.fn();
    const off = onSyncStatusChange(fn);
    setSyncStatus('syncing');
    off();
    setSyncStatus('idle');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('syncing');
  });

  it('unsubscribing twice never removes another component\'s listener', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onSyncStatusChange(a);
    onSyncStatusChange(b);
    offA();
    offA();   // used to splice(-1, 1): the LAST listener, which is b's
    offA();
    setSyncStatus('error');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith('error');
  });

  it('a stale unsubscribe cannot remove a listener registered after it', () => {
    const offOld = onSyncStatusChange(vi.fn());
    offOld();
    const late = vi.fn();
    onSyncStatusChange(late);
    offOld();
    setSyncStatus('offline');
    expect(late).toHaveBeenCalledWith('offline');
  });

  it('the same function registered twice is two independent subscriptions', () => {
    const shared = vi.fn();
    const off1 = onSyncStatusChange(shared);
    const off2 = onSyncStatusChange(shared);
    off1();
    setSyncStatus('syncing');
    expect(shared).toHaveBeenCalledTimes(1);
    off2();
    setSyncStatus('idle');
    expect(shared).toHaveBeenCalledTimes(1);
  });

  it('a listener may unsubscribe while being notified without skipping the next one', () => {
    const calls: string[] = [];
    const offFirst = onSyncStatusChange(() => { calls.push('first'); offFirst(); });
    onSyncStatusChange(() => calls.push('second'));
    setSyncStatus('syncing');
    expect(calls).toEqual(['first', 'second']);
  });
});
