import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import type { RunEvent, Discipline } from '../types';
import { fetchEvents, fetchNearbyEvents, toggleEventJoin } from '../services/eventService';
import { getPlayer } from '@shared/services/store';

export interface EventsState {
  events: RunEvent[];
  joinedIds: Set<string>;
  canCreate: boolean;
  loading: boolean;
  refreshing: boolean;
  nearMeAvailable: boolean;
  nearMeActive: boolean;
  toggleNearMe: (discipline?: Discipline) => void;
  handleJoin: (eventId: string) => void;
  refresh: () => void;
}

export function useEvents(): EventsState {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastKnownLocation, setLastKnownLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMeActive, setNearMeActive] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [data, player] = await Promise.all([fetchEvents(), getPlayer()]);
      setEvents(data.events);
      setJoinedIds(data.joinedIds);
      setCanCreate(data.canCreate);
      setLastKnownLocation(player?.lastKnownLocation ?? null);
    } catch { /* offline */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // "Near me" reuses the last-known location already captured after a run
  // finishes (useActiveRun.doFinish) — no extra location-permission prompt
  // needed just to browse nearby events.
  const toggleNearMe = useCallback(async (discipline?: Discipline) => {
    if (!lastKnownLocation) return;
    if (nearMeActive) {
      setNearMeActive(false);
      load();
      return;
    }
    setLoading(true);
    const nearby = await fetchNearbyEvents(lastKnownLocation.lat, lastKnownLocation.lng, 50, discipline);
    setEvents(nearby);
    setNearMeActive(true);
    setLoading(false);
  }, [lastKnownLocation, nearMeActive, load]);

  const handleJoin = useCallback(async (eventId: string) => {
    const isJoined = joinedIds.has(eventId);
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    if (event.category === 'king-of-hill' || event.category === 'territory-war') {
      Alert.alert('Coming Soon', 'Territory War events are launching soon. Stay tuned!');
      return;
    }

    // Optimistic update
    setJoinedIds(prev => {
      const next = new Set(prev);
      if (isJoined) next.delete(eventId); else next.add(eventId);
      return next;
    });
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, participants: e.participants + (isJoined ? -1 : 1) } : e
    ));

    try {
      await toggleEventJoin(eventId, isJoined);
    } catch {
      // Revert optimistic update on failure
      setJoinedIds(prev => {
        const next = new Set(prev);
        if (isJoined) next.add(eventId); else next.delete(eventId);
        return next;
      });
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, participants: e.participants + (isJoined ? 1 : -1) } : e
      ));
    }
  }, [events, joinedIds]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    events, joinedIds, canCreate, loading, refreshing,
    nearMeAvailable: !!lastKnownLocation, nearMeActive, toggleNearMe,
    handleJoin, refresh,
  };
}
