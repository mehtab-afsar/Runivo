import { supabase } from '@shared/services/supabase';
import { fmtEventDate, fmtEventTime, fmtDistShort } from '@mobile/shared/lib/formatters';
import type { RunEvent, Discipline } from '../types';

export interface EventsData {
  events: RunEvent[];
  joinedIds: Set<string>;
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
    participants: (e.participant_count as number) ?? 0,
    organizer: (e.organizer as string) ?? undefined,
    source: (e.source as RunEvent['source']) ?? 'hosted',
    registrationUrl: (e.registration_url as string) ?? undefined,
    sourceName: (e.source_name as string) ?? undefined,
    discipline: (e.discipline as Discipline) ?? undefined,
    clubId: (e.club_id as string) ?? undefined,
  };
}

export async function fetchEvents(): Promise<EventsData> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('starts_at', { ascending: true });

  if (!eventsData) return { events: [], joinedIds: new Set(), canCreate: false };

  const events = eventsData.map(toRunEvent);

  if (!user) return { events, joinedIds: new Set(), canCreate: false };

  const [{ data: parts }, { data: profile }] = await Promise.all([
    supabase.from('event_participants').select('event_id').eq('user_id', user.id).in('event_id', eventsData.map(e => e.id)),
    supabase.from('profiles').select('subscription_tier').eq('id', user.id).single(),
  ]);

  return {
    events,
    joinedIds: new Set(parts?.map(p => p.event_id) ?? []),
    canCreate: profile?.subscription_tier === 'premium' || profile?.subscription_tier === 'admin',
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
  if (isJoined) {
    await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', user.id);
  } else {
    await supabase.from('event_participants').upsert({ event_id: eventId, user_id: user.id }, { onConflict: 'event_id,user_id' });
  }
}
