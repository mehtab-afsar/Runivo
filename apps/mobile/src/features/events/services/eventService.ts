import { isPlus } from '@shared/engine/entitlements';
import { supabase } from '@shared/services/supabase';
import { fmtEventDate, fmtEventTime, fmtDistShort } from '@mobile/shared/lib/formatters';
import type { RunEvent, Discipline } from '../types';

export interface EventsData {
  events: RunEvent[];
  joinedIds: Set<string>;
  /** E5: saved on the server, shown under Going. */
  bookmarkedIds: Set<string>;
  canCreate: boolean;
}

// Raw DB row → display-ready RunEvent. Shared by fetchEvents and
// fetchNearbyEvents so the two paths can't drift apart.
function toRunEvent(e: Record<string, unknown>): RunEvent {
  return {
    id: e.id as string,
    title: e.title as string,
    description: (e.description as string) ?? '',
    category: e.event_type as string,
    startsAt: e.starts_at as string,
    date: fmtEventDate(e.starts_at as string),
    time: fmtEventTime(e.starts_at as string),
    location: (e.location_name as string) ?? 'TBD',
    distance: e.distance_m ? `${fmtDistShort(e.distance_m as number)} km` : undefined,
    distanceM: (e.distance_m as number | null) ?? undefined,
    participants: (e.participant_count as number) ?? 0,
    organizer: (e.organizer as string) ?? undefined,
    source: (e.source as RunEvent['source']) ?? 'hosted',
    registrationUrl: (e.registration_url as string) ?? undefined,
    sourceName: (e.source_name as string) ?? undefined,
    discipline: (e.discipline as Discipline) ?? undefined,
    clubId: (e.club_id as string) ?? undefined,
    paceGroups: (e.pace_groups as string[] | null) ?? undefined,
    route: Array.isArray(e.route_points) && (e.route_points as unknown[]).length >= 2 ? e.route_points as { lat: number; lng: number }[] : undefined,
    lat: e.lat == null ? undefined : Number(e.lat),
    lng: e.lng == null ? undefined : Number(e.lng),
    radiusM: (e.radius_m as number | null) ?? undefined,
    endsAt: (e.ends_at as string | null) ?? undefined,
  };
}

export async function fetchEvents(): Promise<EventsData> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('starts_at', { ascending: true });

  if (!eventsData) return { events: [], joinedIds: new Set(), bookmarkedIds: new Set(), canCreate: false };

  const events = eventsData.map(toRunEvent);

  if (!user) return { events, joinedIds: new Set(), bookmarkedIds: new Set(), canCreate: false };

  const [{ data: parts }, { data: profile }, { data: marks }] = await Promise.all([
    supabase.from('event_participants').select('event_id').eq('user_id', user.id).in('event_id', eventsData.map(e => e.id)),
    supabase.from('profiles').select('subscription_tier').eq('id', user.id).single(),
    supabase.from('event_bookmarks').select('event_id').eq('user_id', user.id),
  ]);

  return {
    events,
    joinedIds: new Set(parts?.map(p => p.event_id) ?? []),
    bookmarkedIds: new Set((marks as { event_id: string }[] | null)?.map(b => b.event_id) ?? []),
    // Plus hosts public events; everyone while subscriptions are off.
    canCreate: isPlus(profile?.subscription_tier),
  };
}

// "Near me" — server-side radius filter via the nearby_events RPC (see
// migration 20260811000002), so it scales past however many events exist
// instead of fetching everything and filtering client-side.
export async function fetchNearbyEvents(
  lat: number,
  lng: number,
  radiusKm = 50,
  discipline?: Discipline,
): Promise<RunEvent[]> {
  const { data, error } = await supabase.rpc('nearby_events', {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
    p_discipline: discipline ?? null,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(toRunEvent);
}

export interface CreateEventData {
  title: string;
  eventType: string;
  date: string;
  time: string;
  location: string;
  distanceKm: string;
  description: string;
  discipline?: Discipline;
  /** E3: "5:00, 6:00" → pace groups. */
  paceGroups?: string;
  /** E3/E4: meeting point, for check-in and the result (the host's position). */
  lat?: number;
  lng?: number;
}

export function parsePaceGroups(raw: string | undefined): string[] | null {
  const groups = (raw ?? '').split(/[,\s]+/).map(g => g.trim()).filter(g => /^\d{1,2}:[0-5]\d$/.test(g));
  return groups.length ? [...new Set(groups)].slice(0, 6) : null;
}

// Parsing "YYYY-MM-DD" + "HH:MM" as free text (no date picker in the form
// yet) previously went straight to `.toISOString()` with no validity check —
// a malformed value produced an Invalid Date and threw a RangeError instead
// of a form error. Validate first so a bad date surfaces as the same
// on-screen error as any other invalid field.
function parseEventDateTime(date: string, time: string): Date {
  const parsed = new Date(`${date}T${time}`);
  if (isNaN(parsed.getTime())) {
    throw new Error('That date or time doesn\'t look right — use YYYY-MM-DD and HH:MM.');
  }
  return parsed;
}

export async function createEvent(data: CreateEventData): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in to create an event.');

  const startsAt = parseEventDateTime(data.date, data.time);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  // source defaults to 'hosted' at the DB level — this form only ever
  // creates hosted events; curated listings are admin-only (see the RLS
  // policy in 20260811000002).
  const { error } = await supabase.from('events').insert({
    title: data.title.trim(),
    event_type: data.eventType,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    location_name: data.location.trim(),
    distance_m: data.distanceKm ? Math.round(parseFloat(data.distanceKm) * 1000) : null,
    description: data.description.trim() || null,
    discipline: data.discipline ?? null,
    pace_groups: parsePaceGroups(data.paceGroups),
    ...(data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng, location: `SRID=4326;POINT(${data.lng} ${data.lat})` } : {}),
    is_active: true,
    participant_count: 0,
  });

  if (error) throw new Error(error.message);
}

export async function toggleEventJoin(eventId: string, isJoined: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // participant_count is maintained atomically by trg_sync_event_participant_count
  // (migration 20260301000016) — writing it here too used to race that trigger.
  // Errors are thrown so the screens' optimistic "Going" rolls back: they used
  // to be dropped, so a refused RSVP (signed out, blocked, removed event) still
  // showed as joined until the next refresh.
  const { error } = isJoined
    ? await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', user.id)
    : await supabase.from('event_participants').upsert({ event_id: eventId, user_id: user.id }, { onConflict: 'event_id,user_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

// ── E5 / E3 / E4 / E6 ─────────────────────────────────────────────────────

export async function setBookmark(eventId: string, on: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = on
    ? await supabase.from('event_bookmarks').upsert({ user_id: user.id, event_id: eventId }, { ignoreDuplicates: true })
    : await supabase.from('event_bookmarks').delete().eq('user_id', user.id).eq('event_id', eventId);
  if (error) throw new Error(error.message);
}

export interface Attendee { userId: string; username: string; avatarColor: string | null; paceGroup: string | null; arrived: boolean }
export async function fetchAttendees(eventId: string): Promise<Attendee[]> {
  const { data } = await supabase.rpc('event_attendees', { p_event: eventId });
  return ((data as any[]) ?? []).map(r => ({ userId: r.user_id, username: r.username, avatarColor: r.avatar_color, paceGroup: r.pace_group, arrived: !!r.arrived }));
}
export async function setPaceGroup(eventId: string, group: string | null): Promise<void> {
  await supabase.rpc('set_event_pace_group', { p_event: eventId, p_group: group });
}
export async function checkInEvent(eventId: string, lat: number, lng: number): Promise<boolean> {
  const { data } = await supabase.rpc('check_in_event', { p_event: eventId, p_lat: lat, p_lng: lng });
  return !!data;
}

export interface ResultRow { userId: string; username: string; avatarColor: string | null; distanceKm: number; durationSec: number; isMe: boolean }
export async function fetchEventResult(eventId: string): Promise<ResultRow[]> {
  const { data } = await supabase.rpc('event_result', { p_event: eventId });
  return ((data as any[]) ?? []).map(r => ({ userId: r.user_id, username: r.username, avatarColor: r.avatar_color, distanceKm: Number(r.distance_km), durationSec: r.duration_sec, isMe: !!r.is_me }))
    .sort((a, b) => b.distanceKm - a.distanceKm || a.durationSec - b.durationSec);
}
export async function claimEventFinish(eventId: string): Promise<boolean> {
  const { data } = await supabase.rpc('claim_event_finish', { p_event: eventId });
  return !!data;
}

export async function createTerritoryEvent(clubId: string, e: { title: string; startsAt: Date; minutes: number; lat: number; lng: number; radiusM: number; place: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_territory_event', {
    p_club: clubId, p_title: e.title, p_starts_at: e.startsAt.toISOString(), p_minutes: e.minutes,
    p_lat: e.lat, p_lng: e.lng, p_radius_m: e.radiusM, p_place: e.place || 'Club area',
  });
  if (error) throw error;
  return data as string;
}

/** Whether you posted this event or run the club it belongs to (server: can_manage_event). */
export async function canManageEvent(eventId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc('can_manage_event', { p_event: eventId, p_user: user.id });
  return data === true;
}

/** Cancel an event that hasn't started; people going are told (server: cancel_event). */
export async function cancelEvent(eventId: string): Promise<'cancelled' | 'not_allowed' | 'started' | 'not_found'> {
  const { data, error } = await supabase.rpc('cancel_event', { p_event: eventId });
  if (error) throw new Error(error.message);
  return data as 'cancelled' | 'not_allowed' | 'started' | 'not_found';
}
