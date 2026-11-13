import { locationGranted } from '@mobile/shared/location/devicePosition';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@shared/services/supabase';
import { fetchClubs, fetchClubsNear, lastKnownPositionIfAllowed, joinClub, leaveClub, createClub, requestToJoinClub } from '@features/clubs/services/clubService';
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
    } catch { /* offline */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleJoinClub = useCallback(async (club: Club) => {
    if (!userId) return;
    if (club.join_policy !== 'open') {
      const { ok } = await requestToJoinClub(club.id, userId);
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
          await leaveClub(club.id, userId);
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
  ) => {
    if (!userId) return false;
    const newClub = await createClub(userId, name, description, badgeEmoji, joinPolicy);
    if (newClub) {
      setClubs(prev => [newClub, ...prev]);
      return true;
    }
    return false;
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
    refreshing,
    searchQuery,
    setSearchQuery,
    joinClub: handleJoinClub,
    leaveClub: handleLeaveClub,
    createClub: handleCreateClub,
    refresh,
  };
}
