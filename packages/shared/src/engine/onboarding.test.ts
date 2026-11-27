import { describe, it, expect } from 'vitest';
import {
  parseFiveKTime, formatDuration, experienceLevelFor, missionDifficultyFor, preferredDistanceFor,
  startingWeeklyTargetKm, paceXToneFor, healthBaseline, ageForRange, validateUsername,
  normalizePhone, dialCodeForLocale, ageGateOutcome, validateEmail, otpSendPolicy, isOtpCode, OTP_WINDOW_MS,
} from './onboarding';

describe('5K time', () => {
  it('reads mm:ss, m:ss and h:mm:ss', () => {
    expect(parseFiveKTime('27:30')).toEqual({ ok: true, seconds: 1650 });
    expect(parseFiveKTime(' 19:05 ')).toEqual({ ok: true, seconds: 1145 });
    expect(parseFiveKTime('1:05:00')).toEqual({ ok: true, seconds: 3900 });
  });
  it('is optional', () => {
    expect(parseFiveKTime('')).toEqual({ ok: true, seconds: null });
  });
  it('rejects nonsense and impossible times', () => {
    expect(parseFiveKTime('27')).toMatchObject({ ok: false });
    expect(parseFiveKTime('27:75')).toMatchObject({ ok: false });
    expect(parseFiveKTime('9:59')).toMatchObject({ ok: false });
    expect(parseFiveKTime('1:31:00')).toMatchObject({ ok: false });
  });
  it('formats back', () => {
    expect(formatDuration(1650)).toBe('27:30');
    expect(formatDuration(3900)).toBe('1:05:00');
  });
});

describe('starting setup', () => {
  it('derives experience from habits, and a sub-20 5K is competitive', () => {
    expect(experienceLevelFor(1, 5, null)).toBe('new');
    expect(experienceLevelFor(3, 2, null)).toBe('new');
    expect(experienceLevelFor(3, 5, null)).toBe('casual');
    expect(experienceLevelFor(4, 5, null)).toBe('regular');
    expect(experienceLevelFor(2, 8, null)).toBe('regular');
    expect(experienceLevelFor(5, 10, null)).toBe('competitive');
    expect(experienceLevelFor(2, 5, 19 * 60)).toBe('competitive');
  });
  it('maps experience to mission difficulty', () => {
    expect(missionDifficultyFor('new')).toBe('easy');
    expect(missionDifficultyFor('casual')).toBe('mixed');
    expect(missionDifficultyFor('regular')).toBe('mixed');
    expect(missionDifficultyFor('competitive')).toBe('hard');
  });
  it('buckets the usual distance', () => {
    expect(preferredDistanceFor(2)).toBe('short');
    expect(preferredDistanceFor(5)).toBe('5k');
    expect(preferredDistanceFor(10)).toBe('10k');
    expect(preferredDistanceFor(21)).toBe('long');
  });
  it('weekly target: runs × distance, +10% for a race, within 3–120 km', () => {
    expect(startingWeeklyTargetKm({ runsPerWeek: 3, usualKm: 5, goal: 'get_fit' })).toBe(15);
    expect(startingWeeklyTargetKm({ runsPerWeek: 3, usualKm: 5, goal: 'race' })).toBe(17);
    expect(startingWeeklyTargetKm({ runsPerWeek: 1, usualKm: 2, goal: 'social' })).toBe(3);
    expect(startingWeeklyTargetKm({ runsPerWeek: 7, usualKm: 21, goal: 'compete' })).toBe(120);
  });
  it('weekly target blends in the health-app average when there is one', () => {
    expect(startingWeeklyTargetKm({ runsPerWeek: 3, usualKm: 5, goal: 'get_fit', healthAvgWeeklyKm: 25 })).toBe(20);
    expect(startingWeeklyTargetKm({ runsPerWeek: 3, usualKm: 5, goal: 'get_fit', healthAvgWeeklyKm: 0 })).toBe(15);
  });
  it('gives PaceX a tone for each goal', () => {
    expect(paceXToneFor('get_fit')).toBe('encouraging');
    expect(paceXToneFor('race')).toBe('structured');
    expect(paceXToneFor('compete')).toBe('competitive');
    expect(paceXToneFor('social')).toBe('friendly');
  });
  it('turns an age range into an age for calorie maths', () => {
    expect(ageForRange('25_34')).toBe(30);
    expect(ageForRange(null)).toBeNull();
  });
});

describe('health baseline', () => {
  const now = Date.UTC(2026, 10, 6);
  const day = 86_400_000;
  const run = (daysAgo: number, km: number, paceSecPerKm: number) => {
    const start = now - daysAgo * day;
    return { startTime: start, endTime: start + km * paceSecPerKm * 1000, distanceMeters: km * 1000 };
  };

  it('summarises the last 90 days of runs', () => {
    const b = healthBaseline([run(2, 5, 330), run(9, 10, 360), run(30, 8, 345)], now)!;
    expect(b.runs).toBe(3);
    expect(b.totalKm).toBe(23);
    expect(b.longestKm).toBe(10);
    expect(b.avgWeeklyKm).toBeCloseTo(23 / (90 / 7), 1);
    // (5·330 + 10·360 + 8·345) / 23 = 8010 / 23 ≈ 348
    expect(b.avgPaceSecPerKm).toBe(348);
  });
  it('ignores walks, rides, short jogs and anything older than 90 days', () => {
    const b = healthBaseline([
      run(1, 5, 330),
      run(3, 4, 900),     // walk
      run(4, 30, 120),    // ride
      run(5, 0.6, 330),   // too short
      run(120, 10, 330),  // too old
    ], now)!;
    expect(b.runs).toBe(1);
  });
  it('returns null with no runs', () => {
    expect(healthBaseline([], now)).toBeNull();
  });
});

describe('username', () => {
  it('accepts and lowercases good names', () => {
    expect(validateUsername('Asha_Runs')).toEqual({ ok: true, value: 'asha_runs' });
  });
  it('rejects bad ones', () => {
    expect(validateUsername('ab')).toMatchObject({ ok: false });
    expect(validateUsername('1runner')).toMatchObject({ ok: false });
    expect(validateUsername('run ner')).toMatchObject({ ok: false });
    expect(validateUsername('a'.repeat(21))).toMatchObject({ ok: false });
    expect(validateUsername('admin')).toMatchObject({ ok: false });
  });
});

describe('phone and email', () => {
  it('normalises Indian numbers by default', () => {
    expect(normalizePhone('98765 43210')).toEqual({ ok: true, e164: '+919876543210' });
    expect(normalizePhone('098765-43210')).toEqual({ ok: true, e164: '+919876543210' });
  });
  it('keeps explicit country codes', () => {
    expect(normalizePhone('+44 7700 900123')).toEqual({ ok: true, e164: '+447700900123' });
    expect(normalizePhone('0044 7700 900123')).toEqual({ ok: true, e164: '+447700900123' });
    expect(normalizePhone('(415) 555-0132', '+1')).toEqual({ ok: true, e164: '+14155550132' });
  });
  it('rejects junk', () => {
    expect(normalizePhone('12')).toMatchObject({ ok: false });
    expect(normalizePhone('+0123456789')).toMatchObject({ ok: false });
    expect(normalizePhone('call me')).toMatchObject({ ok: false });
  });
  it('checks email shape', () => {
    expect(validateEmail('asha@runivo.in')).toBe(true);
    expect(validateEmail('asha@runivo')).toBe(false);
    expect(validateEmail('asha runivo.in')).toBe(false);
  });
  it('checks one-time codes', () => {
    expect(isOtpCode('123456')).toBe(true);
    expect(isOtpCode('12345')).toBe(false);
    expect(isOtpCode('12a456')).toBe(false);
  });
});

describe('one-time code resend limits', () => {
  const t0 = 1_800_000_000_000;
  it('first send is always allowed', () => {
    expect(otpSendPolicy([], t0)).toEqual({ allowed: true, waitSeconds: 0, resendsLeft: 3 });
  });
  it('waits 30 seconds between sends', () => {
    expect(otpSendPolicy([t0], t0 + 10_000)).toEqual({ allowed: false, waitSeconds: 20, resendsLeft: 3 });
    expect(otpSendPolicy([t0], t0 + 30_000)).toMatchObject({ allowed: true });
  });
  it('allows 3 resends in 10 minutes, then waits for the window', () => {
    const sends = [t0, t0 + 31_000, t0 + 62_000, t0 + 93_000];
    const p = otpSendPolicy(sends, t0 + 200_000);
    expect(p.allowed).toBe(false);
    expect(p.resendsLeft).toBe(0);
    expect(p.waitSeconds).toBe(400);
    expect(otpSendPolicy(sends, t0 + OTP_WINDOW_MS + 1)).toMatchObject({ allowed: true });
  });
});

describe('dialCodeForLocale', () => {
  it('reads the region from the device locale', () => {
    expect(dialCodeForLocale('en-US')).toBe('+1');
    expect(dialCodeForLocale('en_GB')).toBe('+44');
    expect(dialCodeForLocale('de-DE')).toBe('+49');
    expect(dialCodeForLocale('en-IN')).toBe('+91');
    expect(dialCodeForLocale('zh-Hans-HK')).toBe('+852');
  });

  it('falls back to +91 when the region is missing or unknown', () => {
    expect(dialCodeForLocale('en')).toBe('+91');
    expect(dialCodeForLocale(undefined)).toBe('+91');
    expect(dialCodeForLocale('en-ZZ')).toBe('+91');
  });

  it('lets a US number reach the right country code instead of +91', () => {
    const r = normalizePhone('(415) 555-0100', dialCodeForLocale('en-US'));
    expect(r).toEqual({ ok: true, e164: '+14155550100' });
  });
});

describe('ageGateOutcome', () => {
  const now = new Date(2026, 10, 15); // 15 Nov 2026

  it('refuses under-13s, treats 13 to 17 as teens, 18 and over as adults', () => {
    expect(ageGateOutcome(6, 2018, now)).toBe('under13');
    expect(ageGateOutcome(1, 2010, now)).toBe('teen');   // 16
    expect(ageGateOutcome(5, 2000, now)).toBe('adult');
  });

  it('never counts someone older than they could be (birthday = last day of the month)', () => {
    // Born in Nov 2013: turns 13 on 30 Nov at the latest, so on 15 Nov 2026 still 12.
    expect(ageGateOutcome(11, 2013, now)).toBe('under13');
    // Born Oct 2013: 13 since 31 Oct.
    expect(ageGateOutcome(10, 2013, now)).toBe('teen');
    // Same rule at 18.
    expect(ageGateOutcome(11, 2008, now)).toBe('teen');
    expect(ageGateOutcome(10, 2008, now)).toBe('adult');
  });

  it('rejects impossible input', () => {
    expect(ageGateOutcome(0, 2000, now)).toBe('invalid');
    expect(ageGateOutcome(13, 2000, now)).toBe('invalid');
    expect(ageGateOutcome(5, 1800, now)).toBe('invalid');
    expect(ageGateOutcome(5, 2027, now)).toBe('invalid');
    expect(ageGateOutcome(12, 2026, now)).toBe('invalid');  // December 2026 has not happened yet
    expect(ageGateOutcome(Number.NaN, 2000, now)).toBe('invalid');
  });
});
