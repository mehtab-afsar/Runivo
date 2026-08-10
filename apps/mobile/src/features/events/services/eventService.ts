import { supabase } from '@shared/services/supabase';
import { fmtEventDate, fmtEventTime, fmtDistShort } from '@mobile/shared/lib/formatters';
import type { RunEvent } from '../types';

export interface EventsData {
  events: RunEvent[];
  joinedIds: Set<string>;
  canCreate: boolean;
}

export async function fetchEvents(): Promise<EventsData> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('starts_at', { ascending: true });

  if (!eventsData) return { events: [], joinedIds: new Set(), canCreate: false };

  const events: RunEvent[] = eventsData.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description ?? '',
    category: e.event_type,
    date: fmtEventDate(e.starts_at),
    time: fmtEventTime(e.starts_at),
    location: e.location_name ?? 'TBD',
    distance: e.distance_m ? `${fmtDistShort(e.distance_m)} km` : undefined,
    participants: e.participant_count ?? 0,
  }));

  if (!user) return { events, joinedIds: new Set(), canCreate: false };

  const [{ data: parts }, { data: profile }] = await Promise.all([
    supabase.from('event_participants').select('event_id').eq('user_id', user.id).in('event_id', eventsData.map(e => e.id)),
    supabase.from('profiles').select('subscription_tier').eq('id', user.id).single(),
  ]);

  return {
    events,
    joinedIds: new Set(parts?.map(p => p.event_id) ?? []),
    // 'empire-builder' was a pre-migration-042 tier value that no longer exists —
    // subscription_tier is now just 'free' | 'premium' | 'admin'. The old check
    // could never match, so no one — including paying subscribers — could create
    // an event.
    canCreate: profile?.subscription_tier === 'premium' || profile?.subscription_tier === 'admin',
  };
}

export interface CreateEventData {
  title: string;
  eventType: string;
  date: string;
  time: string;
  location: string;
  distanceKm: string;
  description: string;
}

export async function createEvent(data: CreateEventData): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in to create an event.');

  const startsAt = new Date(`${data.date}T${data.time}`);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  const { error } = await supabase.from('events').insert({
    title: data.title.trim(),
    event_type: data.eventType,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    location_name: data.location.trim(),
    distance_m: data.distanceKm ? Math.round(parseFloat(data.distanceKm) * 1000) : null,
    description: data.description.trim() || null,
    is_active: true,
    participant_count: 0,
  });

  if (error) throw new Error(error.message);
}

export async function toggleEventJoin(
  eventId: string,
  currentParticipants: number,
  isJoined: boolean,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (isJoined) {
    await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', user.id);
    await supabase.from('events').update({ participant_count: currentParticipants - 1 }).eq('id', eventId);
  } else {
    await supabase.from('event_participants').upsert({ event_id: eventId, user_id: user.id }, { onConflict: 'event_id,user_id' });
    await supabase.from('events').update({ participant_count: currentParticipants + 1 }).eq('id', eventId);
  }
}
