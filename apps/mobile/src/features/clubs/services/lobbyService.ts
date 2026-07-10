import { supabase } from '@shared/services/supabase';

export interface LobbyRoomActivity {
  id: string;
  messagesToday: number;
}

export async function fetchLobbyRooms(): Promise<LobbyRoomActivity[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('lobby_messages')
    .select('lobby_id')
    .gte('created_at', today.toISOString());

  if (!data) return [];

  const counts: Record<string, number> = {};
  data.forEach((row: { lobby_id: string }) => {
    counts[row.lobby_id] = (counts[row.lobby_id] ?? 0) + 1;
  });

  return Object.entries(counts).map(([id, messagesToday]) => ({ id, messagesToday: messagesToday }));
}
