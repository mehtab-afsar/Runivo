import { describe, it, expect } from 'vitest';
import { toGarminWorkout } from './garminWorkout';

describe('Garmin workout export (T7)', () => {
  const w = toGarminWorkout({
    id: 's1', title: 'Intervals 6 × 800 m', summary: 'Warm up, six fast 800s', date: '2026-11-20',
    steps: [
      { kind: 'warmup', label: 'Easy 10 min', durationSec: 600 },
      { kind: 'run', label: '800 m fast', distanceM: 800, pace: { fast: 240, slow: 250 } },
      { kind: 'recover', label: 'Jog 2 min', durationSec: 120 },
    ],
  });
  it('maps steps, durations and intensity', () => {
    expect(w.sport).toBe('RUNNING');
    expect(w.steps.map(s => s.intensity)).toEqual(['WARMUP', 'INTERVAL', 'RECOVERY']);
    expect(w.steps[0]).toMatchObject({ durationType: 'TIME', durationValue: 600, targetType: 'OPEN' });
    expect(w.steps[1]).toMatchObject({ durationType: 'DISTANCE', durationValue: 800, durationValueType: 'METER', targetType: 'SPEED' });
  });
  it('turns a pace band into a speed band', () => {
    expect(w.steps[1].targetValueLow).toBeCloseTo(4.0, 2);   // 4:10/km
    expect(w.steps[1].targetValueHigh).toBeCloseTo(4.167, 2); // 4:00/km
  });
});
