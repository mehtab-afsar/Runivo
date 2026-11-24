import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
    from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
  },
}));
vi.mock('../store', () => ({
  getPlayer: vi.fn(), savePlayer: vi.fn(), saveRun: vi.fn(), getRunById: vi.fn(),
  getTerritoryPolygons: vi.fn(), deleteTerritory: vi.fn(),
}));
vi.mock('../aiConsent', () => ({ hasAiConsent: vi.fn().mockResolvedValue(false) }));

import { supabase } from '../supabase';
import * as store from '../store';
import { scoreRun } from './syncScoring';
import { setSyncErrorListener } from './syncQueue';

type Run = Parameters<typeof scoreRun>[0];
const run = (patch: Partial<Run> = {}): Run => ({
  id: 'run-1', activityType: 'run', startTime: 0, endTime: 1000, distanceMeters: 5000, durationSec: 1500,
  avgPace: '5:00', gpsPoints: [], territoriesClaimed: [], territoriesFortified: [], enemyCaptured: 0,
  preRunLevel: 1, xpEarned: 5, synced: true, serverProcessed: false, ...patch,
}) as Run;
const player = { id: 'u', paceBalance: 100, paceTotalEarned: 100, paceWeeklyEarned: 50 } as Awaited<ReturnType<typeof store.getPlayer>>;
const invoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
  vi.clearAllMocks();
  setSyncErrorListener(null);
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u' } } } } as never);
  vi.mocked(store.getPlayer).mockResolvedValue(player);
  vi.mocked(store.getRunById).mockResolvedValue(undefined);
  vi.mocked(store.getTerritoryPolygons).mockResolvedValue([]);
});

describe('scoreRun', () => {
  it("applies the server's PACE once: player credited by the difference, run marked scored", async () => {
    invoke.mockResolvedValue({ data: { paceAdjustment: 12, newZonesClaimed: 2, rivalZonesStolen: 1 }, error: null } as never);
    await scoreRun(run(), { id: 'u' });
    expect(store.savePlayer).toHaveBeenCalledWith(expect.objectContaining({ paceBalance: 107, paceTotalEarned: 107, paceWeeklyEarned: 57 }));
    expect(store.saveRun).toHaveBeenCalledWith(expect.objectContaining({
      serverProcessed: true, xpEarned: 12,
      serverResult: expect.objectContaining({ newZones: 2, stolenZones: 1 }),
    }));
  });

  it('is idempotent: a run already scored is not corrected again', async () => {
    invoke.mockResolvedValue({ data: { paceAdjustment: 12 }, error: null } as never);
    vi.mocked(store.getRunById).mockResolvedValue(run({ serverProcessed: true, xpEarned: 12 }));
    await scoreRun(run(), { id: 'u' });
    expect(store.savePlayer).not.toHaveBeenCalled();
    expect(store.saveRun).not.toHaveBeenCalled();
  });

  it('records a permanent rejection (422) as scored with nothing earned, keeping the reason', async () => {
    invoke.mockResolvedValue({
      data: null, error: { context: { status: 422, json: async () => ({ reason: 'too_short' }) } },
    } as never);
    await scoreRun(run(), { id: 'u' });
    expect(store.saveRun).toHaveBeenCalledWith(expect.objectContaining({
      serverProcessed: true, xpEarned: 0, serverResult: expect.objectContaining({ rejectedReason: 'too_short' }),
    }));
    // The optimistic 5 PACE shown after the run is taken back.
    expect(store.savePlayer).toHaveBeenCalledWith(expect.objectContaining({ paceBalance: 95 }));
  });

  it.each([401, 404, 409, 500])('leaves a transient %s alone so the next sync retries it', async status => {
    invoke.mockResolvedValue({ data: null, error: { context: { status } } } as never);
    await scoreRun(run(), { id: 'u' });
    expect(store.saveRun).not.toHaveBeenCalled();
    expect(store.savePlayer).not.toHaveBeenCalled();
  });

  it('does not score treadmill runs', async () => {
    await scoreRun(run({ activityType: 'treadmill' }), { id: 'u' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does nothing without a session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never);
    await scoreRun(run(), { id: 'u' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('replaces the optimistic on-device zone with the server one', async () => {
    invoke.mockResolvedValue({ data: { paceAdjustment: 5 }, error: null } as never);
    vi.mocked(store.getTerritoryPolygons).mockResolvedValue([
      { id: 'mine', runId: 'run-1', synced: false, tier: 'patch', areaM2: 1 },
      { id: 'other-run', runId: 'run-2', synced: false, tier: 'patch', areaM2: 1 },
      { id: 'server', runId: 'run-1', synced: true, tier: 'patch', areaM2: 1 },
    ] as never);
    await scoreRun(run(), { id: 'u' });
    expect(store.deleteTerritory).toHaveBeenCalledTimes(1);
    expect(store.deleteTerritory).toHaveBeenCalledWith('mine');
  });

  it('reports instead of throwing when scoring blows up', async () => {
    const listener = vi.fn();
    setSyncErrorListener(listener);
    invoke.mockRejectedValue(new Error('network down'));
    await expect(scoreRun(run(), { id: 'u' })).resolves.toBeUndefined();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ scope: 'scoreRun', context: { runId: 'run-1' } }));
  });
});
