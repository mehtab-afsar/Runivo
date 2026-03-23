import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculatePersonalRecords,
  formatRecordValue,
  getRecordLabel,
  type PersonalRecord,
} from '@shared/services/personalRecords';

// Mock getRuns so tests don't depend on IndexedDB state
vi.mock('@shared/services/store', () => ({
  getRuns: vi.fn(),
}));

import { getRuns } from '@shared/services/store';
const mockGetRuns = vi.mocked(getRuns);

function makeRun(id: string, distanceKm: number, durationSec: number, territoriesClaimed: string[] = []) {
  return {
    id,
    activityType: 'run' as const,
    startTime: Date.now(),
    endTime: Date.now() + durationSec * 1000,
    distanceMeters: distanceKm * 1000,
    durationSec,
    avgPace: String(durationSec / distanceKm),
    gpsPoints: [],
    territoriesClaimed,
    territoriesFortified: [],
    xpEarned: 0,
    coinsEarned: 0,
    diamondsEarned: 0,
    enemyCaptured: 0,
    preRunLevel: 1,
    synced: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('calculatePersonalRecords', () => {
  // 1
  it('returns empty array for no runs', async () => {
    mockGetRuns.mockResolvedValue([]);
    const result = await calculatePersonalRecords();
    expect(result).toEqual([]);
  });

  // 2
  it('generates longest_run and fastest_pace for a run < 1km (but > 0.5km)', async () => {
    mockGetRuns.mockResolvedValue([makeRun('r1', 0.8, 240)]);
    const result = await calculatePersonalRecords();
    const types = result.map(r => r.type);
    expect(types).toContain('longest_run');
    expect(types).toContain('fastest_pace');
    expect(types).not.toContain('fastest_1k');
    expect(types).not.toContain('fastest_5k');
  });

  // 3
  it('generates fastest_1k, fastest_5k, longest_run, fastest_pace for a 5km run', async () => {
    mockGetRuns.mockResolvedValue([makeRun('r1', 5, 1500)]);
    const result = await calculatePersonalRecords();
    const types = result.map(r => r.type);
    expect(types).toContain('fastest_1k');
    expect(types).toContain('fastest_5k');
    expect(types).toContain('longest_run');
    expect(types).toContain('fastest_pace');
    expect(types).not.toContain('fastest_10k');
  });

  // 4
  it('generates all 6 record types for a 10km run', async () => {
    mockGetRuns.mockResolvedValue([makeRun('r1', 10, 3600)]);
    const result = await calculatePersonalRecords();
    const types = result.map(r => r.type);
    expect(types).toContain('fastest_1k');
    expect(types).toContain('fastest_5k');
    expect(types).toContain('fastest_10k');
    expect(types).toContain('longest_run');
    expect(types).toContain('fastest_pace');
    // No territories claimed, so most_territories should not appear
    expect(types).not.toContain('most_territories');
  });

  // 5
  it('updates fastest_5k when second run is faster', async () => {
    const slow = makeRun('r1', 5, 1800); // 6:00/km
    const fast = makeRun('r2', 5, 1200); // 4:00/km
    mockGetRuns.mockResolvedValue([slow, fast]);
    const result = await calculatePersonalRecords();
    const pr5k = result.find(r => r.type === 'fastest_5k')!;
    expect(pr5k.runId).toBe('r2');
    expect(pr5k.value).toBe(1200);
  });

  // 6
  it('keeps fastest_5k as first run when it is already faster', async () => {
    const fast = makeRun('r1', 5, 1200);
    const slow = makeRun('r2', 5, 1800);
    mockGetRuns.mockResolvedValue([fast, slow]);
    const result = await calculatePersonalRecords();
    const pr5k = result.find(r => r.type === 'fastest_5k')!;
    expect(pr5k.runId).toBe('r1');
  });

  // 12 (most_territories)
  it('tracks most_territories across runs', async () => {
    const few = makeRun('r1', 3, 900, ['hex1']);
    const many = makeRun('r2', 3, 900, ['hex1', 'hex2', 'hex3', 'hex4']);
    mockGetRuns.mockResolvedValue([few, many]);
    const result = await calculatePersonalRecords();
    const pr = result.find(r => r.type === 'most_territories')!;
    expect(pr.runId).toBe('r2');
    expect(pr.value).toBe(4);
  });
});

describe('formatRecordValue', () => {
  const pr = (type: PersonalRecord['type'], value: number): PersonalRecord => ({
    type, value, runId: 'r1', date: Date.now(),
  });

  // 7
  it('formats fastest_1k 240s as "04:00"', () => {
    expect(formatRecordValue(pr('fastest_1k', 240))).toBe('04:00');
  });

  // 8
  it('formats longest_run 12.3km as "12.3 km"', () => {
    expect(formatRecordValue(pr('longest_run', 12.3))).toBe('12.3 km');
  });

  // 9
  it('formats fastest_pace 300s/km as "5:00 /km"', () => {
    expect(formatRecordValue(pr('fastest_pace', 300))).toBe('5:00 /km');
  });

  // 10
  it('formats most_territories 7 as "7 zones"', () => {
    expect(formatRecordValue(pr('most_territories', 7))).toBe('7 zones');
  });
});

describe('getRecordLabel', () => {
  // 11
  it('returns "Fastest 5K" for fastest_5k', () => {
    expect(getRecordLabel('fastest_5k')).toBe('Fastest 5K');
  });

  // 12
  it('returns "Most Zones" for most_territories', () => {
    expect(getRecordLabel('most_territories')).toBe('Most Zones');
  });
});
