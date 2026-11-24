import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), getUser: vi.fn() }, from: vi.fn() },
}));
vi.mock('../store', () => ({ getRunsNeedingSync: vi.fn(), saveRun: vi.fn() }));
vi.mock('./syncScoring', () => ({ scoreRun: vi.fn().mockResolvedValue(undefined) }));

import { supabase } from '../supabase';
import * as store from '../store';
import { scoreRun } from './syncScoring';
import { pushUnsyncedRuns } from './syncPush';

const run = (id: string, patch: Record<string, unknown> = {}) => ({
  id, activityType: 'run', startTime: 0, endTime: 1000, distanceMeters: 1, durationSec: 1, avgPace: '0:00',
  gpsPoints: [{ lat: 1, lng: 1, timestamp: 1.4, speed: 0, accuracy: 1, altitude: 0 }],
  territoriesClaimed: [], territoriesFortified: [], enemyCaptured: 0, preRunLevel: 1, synced: false, ...patch,
});
const upsert = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: {} } } as never);
  vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'u' } } } as never);
  vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
  upsert.mockResolvedValue({ error: null });
});

describe('pushUnsyncedRuns', () => {
  it('uploads a run insert-or-ignore, marks it synced, then scores it', async () => {
    vi.mocked(store.getRunsNeedingSync).mockResolvedValue([run('a')] as never);
    await pushUnsyncedRuns();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', user_id: 'u' }), { onConflict: 'id', ignoreDuplicates: true });
    // Whole-millisecond timestamps: the server orders the route by ::bigint.
    expect(upsert.mock.calls[0][0].gps_points[0].timestamp).toBe(1);
    expect(store.saveRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', synced: true, serverProcessed: false }));
    expect(scoreRun).toHaveBeenCalledOnce();
  });

  it('a run already uploaded is only retried for scoring (no upsert)', async () => {
    vi.mocked(store.getRunsNeedingSync).mockResolvedValue([run('a', { synced: true })] as never);
    await pushUnsyncedRuns();
    expect(upsert).not.toHaveBeenCalled();
    expect(scoreRun).toHaveBeenCalledOnce();
  });

  it('marks treadmill runs scored straight away', async () => {
    vi.mocked(store.getRunsNeedingSync).mockResolvedValue([run('t', { activityType: 'treadmill' })] as never);
    await pushUnsyncedRuns();
    expect(store.saveRun).toHaveBeenCalledWith(expect.objectContaining({ id: 't', serverProcessed: true }));
  });

  it('one rejected run does not block the ones behind it, and the first error is thrown after', async () => {
    vi.mocked(store.getRunsNeedingSync).mockResolvedValue([run('bad'), run('good')] as never);
    upsert.mockResolvedValueOnce({ error: new Error('rejected') }).mockResolvedValueOnce({ error: null });
    await expect(pushUnsyncedRuns()).rejects.toThrow('rejected');
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(store.saveRun).toHaveBeenCalledTimes(1);
    expect(store.saveRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'good' }));
    expect(scoreRun).toHaveBeenCalledTimes(1);
  });

  it('concurrent callers share one in-flight push (a run is never pushed twice)', async () => {
    vi.mocked(store.getRunsNeedingSync).mockResolvedValue([run('a')] as never);
    await Promise.all([pushUnsyncedRuns(), pushUnsyncedRuns(), pushUnsyncedRuns()]);
    expect(store.getRunsNeedingSync).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('does nothing when signed out', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never);
    await pushUnsyncedRuns();
    expect(store.getRunsNeedingSync).not.toHaveBeenCalled();
  });

  it('lets a later push start once the first finished', async () => {
    vi.mocked(store.getRunsNeedingSync).mockResolvedValue([]);
    await pushUnsyncedRuns();
    await pushUnsyncedRuns();
    expect(store.getRunsNeedingSync).toHaveBeenCalledTimes(2);
  });
});
