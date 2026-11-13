import { describe, it, expect, vi } from 'vitest';
vi.mock('expo-notifications', () => ({}));
vi.mock('@mobile/shared/lib/optionalNative', () => ({ getCalendar: () => null }));
import { reminderTime } from './eventCalendar';

describe('event reminder time', () => {
  it('is 7 pm the evening before', () => {
    const start = new Date(2026, 11, 6, 6, 30).toISOString();
    const t = reminderTime(start, new Date(2026, 11, 1).getTime())!;
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([5, 19, 0]);
  });
  it('falls back to 2 hours before, then nothing', () => {
    const start = new Date(2026, 11, 6, 18, 0);
    const t = reminderTime(start.toISOString(), new Date(2026, 11, 6, 9).getTime())!;
    expect(t.getHours()).toBe(16);
    expect(reminderTime(start.toISOString(), new Date(2026, 11, 6, 17).getTime())).toBeNull();
  });
});
