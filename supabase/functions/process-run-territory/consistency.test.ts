import { describe, expect, it } from 'vitest';
import { runMismatch, TRACE_SLACK_MS, type StoredRunFacts } from './consistency';

const T0 = Date.parse('2026-11-14T08:00:00Z');
const stored: StoredRunFacts = {
  activity_type: 'run',
  duration_sec: 1800,
  started_at: new Date(T0).toISOString(),
  finished_at: new Date(T0 + 1800_000).toISOString(),
};
const pts = (...ts: number[]) => ts.map(timestamp => ({ timestamp }));
const ok = { activityType: 'run', durationSec: 1800, gpsPoints: pts(T0 + 1000, T0 + 900_000, T0 + 1_790_000) };
const NOW = T0 + 2_000_000;

describe('runMismatch', () => {
  it('accepts a run that agrees with its stored row', () => {
    expect(runMismatch(stored, ok, NOW)).toBeNull();
  });

  it('rejects a different sport than the stored run', () => {
    expect(runMismatch(stored, { ...ok, activityType: 'cycle' }, NOW)).toBe('activity_type');
  });

  it('allows small duration drift but not a different duration', () => {
    expect(runMismatch(stored, { ...ok, durationSec: 1820 }, NOW)).toBeNull();
    expect(runMismatch(stored, { ...ok, durationSec: 5400 }, NOW)).toBe('duration');
    expect(runMismatch(stored, { ...ok, durationSec: undefined }, NOW)).toBe('duration');
  });

  it('rejects a trace from before the run started or after it ended', () => {
    const early = { ...ok, gpsPoints: pts(T0 - TRACE_SLACK_MS - 60_000, T0 + 1000) };
    expect(runMismatch(stored, early, NOW)).toBe('trace_before_start');
    const late = { ...ok, gpsPoints: pts(T0 + 1000, T0 + 1_800_000 + TRACE_SLACK_MS + 60_000) };
    expect(runMismatch(stored, late, NOW + 5_000_000)).toBe('trace_after_end');
  });

  it('rejects timestamps in the future', () => {
    const future = { ...ok, gpsPoints: pts(T0 + 1000, NOW + TRACE_SLACK_MS + 60_000) };
    expect(runMismatch({ ...stored, finished_at: null }, future, NOW)).toBe('trace_in_future');
  });

  it('tolerates points without timestamps and rows with missing fields', () => {
    expect(runMismatch(stored, { ...ok, gpsPoints: [{}, {}] }, NOW)).toBeNull();
    expect(runMismatch({ activity_type: null, duration_sec: null, started_at: null, finished_at: null }, ok, NOW)).toBeNull();
  });
});
