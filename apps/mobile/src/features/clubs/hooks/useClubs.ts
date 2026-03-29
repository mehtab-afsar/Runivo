import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@shared/services/supabase';
import { fetchClubs, joinClub, leaveClub, createClub } from '@features/clubs/services/clubService';
import type { Club } from '@features/clubs/types';

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const data = await fetchClubs(user?.id ?? null);
      setClubs(data);
    } catch { /* offline */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleJoinClub = useCallback(async (club: Club) => {
    if (!userId) return;
    if (club.join_policy !== 'open') {
      Alert.alert('Request sent', 'The club owner will review your request.');
      return;
    }
    await joinClub(club.id, userId);
    setClubs((prev) =>
      prev.map((c) =>
        c.id === club.id ? { ...c, joined: true, member_count: c.member_count + 1 } : c,
      ),
    );
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
          setClubs((prev) =>
            prev.map((c) =>
              c.id === club.id
                ? { ...c, joined: false, member_count: Math.max(0, c.member_count - 1) }
                : c,
            ),
          );
        },
      },
    ]);
  }, [userId]);

  const handleCreateClub = useCallback(async (
    name: string,
    description: string,
    badgeEmoji: string,
    joinPolicy: 'open' | 'request' | 'invite',
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
