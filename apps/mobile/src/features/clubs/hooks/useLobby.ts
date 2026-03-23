import { useState, useEffect, useCallback } from 'react';
import { fetchLobbyRooms } from '@features/clubs/services/lobbyService';
import type { LobbyRoomActivity } from '@features/clubs/services/lobbyService';

export function useLobby() {
  const [rooms, setRooms] = useState<LobbyRoomActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchLobbyRooms();
      setRooms(data);
    } catch { /* offline */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return { rooms, loading, refreshing, refresh };
}
