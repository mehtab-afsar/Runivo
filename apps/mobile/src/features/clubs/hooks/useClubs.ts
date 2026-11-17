import { locationGranted } from '@mobile/shared/location/devicePosition';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@shared/services/supabase';
import { fetchClubs, fetchClubsNear, lastKnownPositionIfAllowed, joinClub, leaveClub, createClub, requestToJoinClub, uploadClubImage } from '@features/clubs/services/clubService';
import type { Club } from '@features/clubs/types';

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  // "Near you": closest clubs, or the popular fallback (nearby = false).
  const [nearClubs, setNearClubs] = useState<Club[]>([]);
  const [nearby, setNearby] = useState(false);
  const [locationOn, setLocationOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [data, near, granted] = await Promise.all([
        fetchClubs(user?.id ?? null),
        lastKnownPositionIfAllowed().then(pos => fetchClubsNear(pos, 5)),
        locationGranted(),
      ]);
      setLocationOn(granted);
      setClubs(data);
      setNearClubs(near.clubs);
      setNearby(near.nearby);
      setLoadError(false);
    } catch {
      // Say so instead of showing "No pack to run with yet" when the load simply failed.
      setLoadError(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleJoinClub = useCallback(async (club: Club) => {
    if (!userId) return;
    if (club.join_policy !== 'open') {
      if (club.requested) return;
      const { ok } = await requestToJoinClub(club.id, userId);
      if (ok) {
        const markRequested = (prev: Club[]) => prev.map((c) => (c.id === club.id ? { ...c, requested: true } : c));
        setClubs(markRequested);
        setNearClubs(markRequested);
      }
      Alert.alert(
        ok ? 'Request sent' : 'Something went wrong',
        ok ? 'The club owner will review your request.' : 'Please try again.',
      );
      return;
    }
    const { error } = await joinClub(club.id, userId);
    if (error) { Alert.alert('Something went wrong', 'Please try again.'); return; }
    const markJoined = (prev: Club[]) =>
      prev.map((c) => (c.id === club.id ? { ...c, joined: true, member_count: c.member_count + 1 } : c));
    setClubs(markJoined);
    setNearClubs(markJoined);
  }, [userId]);

  const handleLeaveClub = useCallback(async (club: Club) => {
    if (!userId) return;
    Alert.alert('Leave club?', `Leave ${club.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const { error, result } = await leaveClub(club.id, userId);
          // Don't show them as out of a club the server still has them in.
          if (result === 'owner') { Alert.alert("You own this club", 'Owners can’t leave. Open the club’s Admin tab to delete it.'); return; }
          if (error) { Alert.alert("Couldn't leave the club", 'Check your connection and try again.'); return; }
          const markLeft = (prev: Club[]) =>
            prev.map((c) =>
              c.id === club.id
                ? { ...c, joined: false, member_count: Math.max(0, c.member_count - 1) }
                : c,
            );
          setNearClubs(markLeft);
          setClubs(markLeft);
        },
      },
    ]);
  }, [userId]);

  const handleCreateClub = useCallback(async (
    name: string,
    description: string,
    badgeEmoji: string,
    joinPolicy: 'open' | 'invite_only',
    images?: { avatar: string | null; banner: string | null },
  ) => {
    if (!userId) return 'Sign in again to create a club.';
    try {
      const newClub = await createClub(userId, name, description, badgeEmoji, joinPolicy);
      // Pictures need the club's id, so they go up after it exists. A failed
      // upload doesn't undo the club: it can be added from the club's Admin tab.
      for (const kind of ['avatar', 'banner'] as const) {
        const uri = images?.[kind];
        if (!uri) continue;
        try { newClub[`${kind}_url`] = await uploadClubImage(newClub.id, kind, uri); }
        catch { Alert.alert('Club created', `The ${kind === 'avatar' ? 'picture' : 'cover'} didn't upload. Add it from the club's Admin tab.`); }
      }
      setClubs(prev => [newClub, ...prev]);
      return true;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not create the club. Please try again.';
    }
  }, [userId]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const filteredClubs = useMemo(
    () =>
      searchQuery
        ? clubs.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : clubs,
    [clubs, searchQuery],
  );

  return {
    clubs,
    nearClubs,
    nearby,
    locationOn,
    filteredClubs,
    loading,
    loadError,
    refreshing,
    searchQuery,
    setSearchQuery,
    joinClub: handleJoinClub,
    leaveClub: handleLeaveClub,
    createClub: handleCreateClub,
    refresh,
  };
}
