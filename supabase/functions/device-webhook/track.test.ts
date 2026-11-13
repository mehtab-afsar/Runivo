import { describe, it, expect } from 'vitest';
import { runivoSport, extractTrack, plausible } from './track';

describe('watch activities', () => {
  it('maps provider sports', () => {
    expect(runivoSport('RUNNING')).toBe('run');
    expect(runivoSport('trail_running')).toBe('trail_run');
    expect(runivoSport('TREADMILL_RUNNING')).toBe('run');
    expect(runivoSport('HIKING')).toBe('hike');
    expect(runivoSport('walking')).toBe('walk');
    expect(runivoSport('ROAD_BIKING')).toBe('cycle');
    expect(runivoSport('YOGA')).toBeNull();
  });

  it('reads Garmin detail samples, skipping samples without a fix', () => {
    const t = extractTrack({ samples: [
      { startTimeInSeconds: 1700000010, latitudeInDegree: 12.97, longitudeInDegree: 77.59, heartRate: 151 },
      { startTimeInSeconds: 1700000000, latitudeInDegree: 12.969, longitudeInDegree: 77.589 },
      { startTimeInSeconds: 1700000020, heartRate: 150 },
      { timerDurationInSeconds: 30, latitudeInDegree: 12.971, longitudeInDegree: 77.591 },
    ] }, 1700000000);
    expect(t.map(p => p.timestamp)).toEqual([1700000000000, 1700000010000, 1700000030000]);
    expect(t[1].hr).toBe(151);
    expect(t[0].hr).toBeUndefined();
  });

  it('reads generic tracks with seconds, ms or ISO times', () => {
    const t = extractTrack({ points: [
      { lat: 1, lng: 2, time: '2026-11-01T06:00:00Z' }, { latitude: 1.001, longitude: 2.001, timestamp: 1793512805 }, { lat: 0, lng: 0, time: 1 },
    ] });
    expect(t).toHaveLength(2);
    expect(t[0].timestamp).toBe(Date.parse('2026-11-01T06:00:00Z'));
  });

  it('applies the same distance ceilings as phone runs', () => {
    expect(plausible(10000, 3000, 'run')).toBe(true);
    expect(plausible(30000, 3000, 'run')).toBe(false);
    expect(plausible(30000, 3000, 'cycle')).toBe(true);
    expect(plausible(5000, 0, 'run')).toBe(false);
  });
});
