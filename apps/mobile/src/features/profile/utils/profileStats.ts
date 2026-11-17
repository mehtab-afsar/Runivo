/**
 * Numbers behind the Strava-style profile: per-sport filters, weekly volume,
 * year / all-time totals and activity titles. Pure functions over stored runs
 * so they can be tested without React.
 */

/** The profile's sport filter. Walk covers hikes; Run covers every running type; Hike is hikes only (mock chip). */
export type SportFilter = 'all' | 'run' | 'walk' | 'hike' | 'ride';

export interface ActivityLike {
  activityType?: string | null;
  startTime: number;
  distanceMeters: number;
  durationSec: number;
  /** "Don't count this": kept in the list, left out of totals. */
  excluded?: boolean;
}

const WALK_TYPES = new Set(['walk', 'hike']);
const RIDE_TYPES = new Set(['cycle']);

export function sportGroup(activityType: string | null | undefined): Exclude<SportFilter, 'all' | 'hike'> {
  const t = activityType ?? 'run';
  if (RIDE_TYPES.has(t)) return 'ride';
  if (WALK_TYPES.has(t)) return 'walk';
  return 'run';
}

export function filterBySport<T extends ActivityLike>(runs: T[], sport: SportFilter): T[] {
  if (sport === 'all') return runs;
  if (sport === 'hike') return runs.filter(r => r.activityType === 'hike');
  return runs.filter(r => sportGroup(r.activityType) === sport);
}

const DAY_MS = 86_400_000;

/** Local midnight of the Monday that starts `ms`'s week. */
export function weekStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return d.getTime() - dow * DAY_MS;
}

export interface WeekTotal { start: number; km: number; sec: number; count: number }

/** Oldest-first weekly totals for the last `weeks` weeks, this week last. */
export function weeklyTotals(runs: ActivityLike[], now = Date.now(), weeks = 12): WeekTotal[] {
  const thisWeek = weekStart(now);
  // Calendar weeks, not 7-day steps from now: a DST change would drift them.
  const starts: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - i * 7);
    starts.push(d.getTime());
  }
  const out = starts.map(start => ({ start, km: 0, sec: 0, count: 0 }));
  const index = new Map(starts.map((s, i) => [s, i]));
  for (const r of runs) {
    if (r.excluded) continue;
    const i = index.get(weekStart(r.startTime));
    if (i === undefined) continue;
    out[i].km += r.distanceMeters / 1000;
    out[i].sec += r.durationSec;
    out[i].count += 1;
  }
  return out;
}

export interface PeriodStats { count: number; km: number; sec: number; longestKm: number }

/** Totals since 1 January this year, or across everything stored. */
export function periodStats(runs: ActivityLike[], period: 'year' | 'all', now = Date.now()): PeriodStats {
  const from = period === 'year' ? new Date(new Date(now).getFullYear(), 0, 1).getTime() : -Infinity;
  const s: PeriodStats = { count: 0, km: 0, sec: 0, longestKm: 0 };
  for (const r of runs) {
    if (r.startTime < from || r.excluded) continue;
    const km = r.distanceMeters / 1000;
    s.count += 1;
    s.km += km;
    s.sec += r.durationSec;
    if (km > s.longestKm) s.longestKm = km;
  }
  return s;
}

const NOUN: Record<Exclude<SportFilter, 'all'>, string> = { run: 'run', walk: 'walk', hike: 'hike', ride: 'ride' };

/** "Morning run", "Evening ride", "Afternoon hike" — as Strava names untitled activities. */
export function activityTitle(r: Pick<ActivityLike, 'activityType' | 'startTime'>): string {
  const h = new Date(r.startTime).getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  const t = r.activityType ?? 'run';
  const noun = t === 'hike' ? 'hike' : t === 'trail_run' || t === 'trail' ? 'trail run' : NOUN[sportGroup(t)];
  return `${part} ${noun}`;
}

/** "4:32" per km, or km/h for rides. */
export function paceOrSpeed(km: number, sec: number, sport: Exclude<SportFilter, 'all'>): { value: string; unit: string } {
  if (km <= 0 || sec <= 0) return { value: '–', unit: sport === 'ride' ? 'km/h' : '/km' };
  if (sport === 'ride') return { value: (km / (sec / 3600)).toFixed(1), unit: 'km/h' };
  const secPerKm = sec / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return { value: s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`, unit: '/km' };
}

/** "1h 04m" / "32m" / "0m". */
export function fmtHours(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Clock time for one activity: "2:10", "1:04:05". */
export { fmtClock } from '@mobile/shared/lib/formatters';

/** 0.4 → "0.4", 12.34 → "12.3", 1234.5 → "1,235". */
export function fmtKm(km: number): string {
  if (km >= 1000) return Math.round(km).toLocaleString('en-US');
  return km >= 100 ? km.toFixed(0) : km.toFixed(1);
}
