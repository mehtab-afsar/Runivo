import { supabase } from '@shared/services/supabase';

/**
 * The race catalogue (migration 20261117000011_races): curated races mirrored
 * from curated events, plus races runners add themselves (pending until
 * approved, visible only to them until then).
 */
export interface RaceDistanceOption { id: string; distanceM: number; label: string; startTime: string | null }
export interface RaceResult {
  id: string;
  name: string;
  city: string | null;
  startsOn: string; // YYYY-MM-DD
  websiteUrl: string | null;
  source: 'curated' | 'runner';
  status: 'approved' | 'pending';
  distances: RaceDistanceOption[];
  kmAway: number | null;
  /** 0 none, -1 "a few" (1–4), otherwise the count. */
  entrants: number;
  mine: boolean;
}

export interface RaceSearch {
  q?: string;
  /** YYYY-MM-DD range. */
  from?: string | null;
  to?: string | null;
  distanceM?: number | null;
  near?: { lat: number; lng: number } | null;
}

interface Row {
  race_id: string; name: string; city: string | null; starts_on: string; website_url: string | null;
  source: 'curated' | 'runner'; status: 'approved' | 'pending';
  distances: { id: string; distance_m: number; label: string; start_time: string | null }[];
  km_away: number | null; entrants: number; mine: boolean;
}

const toResult = (r: Row): RaceResult => ({
  id: r.race_id, name: r.name, city: r.city, startsOn: r.starts_on, websiteUrl: r.website_url,
  source: r.source, status: r.status, kmAway: r.km_away, entrants: r.entrants, mine: r.mine,
  distances: (r.distances ?? []).map(d => ({ id: d.id, distanceM: d.distance_m, label: d.label, startTime: d.start_time })),
});

export async function searchRaces(q: RaceSearch): Promise<RaceResult[]> {
  const { data, error } = await supabase.rpc('search_races', {
    p_q: q.q?.trim() || null,
    p_from: q.from ?? null,
    p_to: q.to ?? null,
    p_distance_m: q.distanceM ?? null,
    p_lat: q.near?.lat ?? null,
    p_lng: q.near?.lng ?? null,
    p_limit: 30,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toResult);
}

/** The catalogue race mirrored from a curated event ("Train for this" in Events). */
export async function raceForEvent(eventId: string): Promise<RaceResult | null> {
  const { data } = await supabase.from('races').select('id, name').eq('event_id', eventId).maybeSingle();
  if (!data) return null;
  const hits = await searchRaces({ q: data.name as string });
  return hits.find(h => h.id === data.id) ?? null;
}

export type AddRaceError = 'bad_name' | 'bad_date' | 'bad_distance' | 'bad_url' | 'too_many' | 'not_signed_in' | 'failed';
export const ADD_RACE_MESSAGE: Record<AddRaceError, string> = {
  bad_name: 'Give the race a name (3 to 80 characters).',
  bad_date: 'Pick a race day in the next two years.',
  bad_distance: 'Pick a distance.',
  bad_url: 'The website must start with https://',
  too_many: "You've added 5 races today. Try again tomorrow.",
  not_signed_in: 'Sign in to add a race.',
  failed: "Couldn't add the race. Check your connection and try again.",
};

export async function addRunnerRace(input: { name: string; startsOn: string; distanceM: number; city?: string; url?: string }):
  Promise<{ raceId: string; distanceId: string } | { error: AddRaceError }> {
  const { data, error } = await supabase.rpc('add_runner_race', {
    p_name: input.name, p_starts_on: input.startsOn, p_distance_m: input.distanceM,
    p_city: input.city?.trim() || null, p_url: input.url?.trim() || null,
  });
  if (error) return { error: 'failed' };
  const r = data as { race_id?: string; distance_id?: string; error?: AddRaceError };
  if (r.error) return { error: r.error };
  return { raceId: r.race_id!, distanceId: r.distance_id! };
}

/** "I'm running this", optionally tied to a plan. */
export async function enterRace(distanceId: string, planId?: string | null, goalSec?: number | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('enter_race', {
    p_race_distance_id: distanceId, p_plan_id: planId ?? null, p_goal_sec: goalSec ?? null, p_visibility: 'followers',
  });
  return !error && data === 'entered';
}

export async function leaveRace(distanceId: string): Promise<void> {
  await supabase.rpc('leave_race', { p_race_distance_id: distanceId });
}

/** "42 training", "A few training", or null for none. */
export function entrantsLabel(n: number): string | null {
  if (n === 0) return null;
  if (n < 0) return 'A few training';
  return `${n} training`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Sun 25 Jan" (adds the year when it isn't this year). */
export function fmtRaceDate(iso: string, now = new Date()): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${d} ${MONTHS[m - 1]}${y !== now.getFullYear() ? ` ${y}` : ''}`;
}
