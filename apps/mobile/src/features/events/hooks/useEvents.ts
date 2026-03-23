import { useState, useEffect, useCallback } from 'react';
import type { RunEvent } from '../types';
import { fetchEvents, toggleEventJoin } from '../services/eventService';

export interface EventsState {
  events: RunEvent[];
  joinedIds: Set<string>;
  canCreate: boolean;
  loading: boolean;
  refreshing: boolean;
  handleJoin: (eventId: string) => void;
  refresh: () => void;
}

export function useEvents(): EventsState {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchEvents();
      setEvents(data.events);
      setJoinedIds(data.joinedIds);
      setCanCreate(data.canCreate);
    } catch { /* offline */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleJoin = useCallback(async (eventId: string) => {
    const isJoined = joinedIds.has(eventId);
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    // Optimistic update
    setJoinedIds(prev => {
      const next = new Set(prev);
      isJoined ? next.delete(eventId) : next.add(eventId);
      return next;
    });
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, participants: e.participants + (isJoined ? -1 : 1) } : e
    ));

    try {
      await toggleEventJoin(eventId, event.participants, isJoined);
    } catch {
      // Revert optimistic update on failure
      setJoinedIds(prev => {
        const next = new Set(prev);
        isJoined ? next.add(eventId) : next.delete(eventId);
        return next;
      });
    }
  }, [events, joinedIds]);

  const refresh = useCallback(() => load(true), [load]);

  return { events, joinedIds, canCreate, loading, refreshing, handleJoin, refresh };
}
