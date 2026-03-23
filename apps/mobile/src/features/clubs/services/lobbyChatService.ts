import { supabase } from '@shared/services/supabase';

export interface LobbyMessage {
  id: string;
  userId: string;
  userName: string;
  userLevel: number;
  message: string;
  timestamp: string;
}

export async function fetchMessages(roomId: string): Promise<LobbyMessage[]> {
  const { data, error } = await supabase
    .from('lobby_messages')
    .select('id, user_id, content, created_at, profiles(username, level)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(60);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.profiles?.username ?? 'Runner',
    userLevel: row.profiles?.level ?? 1,
    message: row.content,
    timestamp: row.created_at,
  }));
}

export async function sendMessage(
  roomId: string,
  userId: string,
  username: string,
  content: string,
): Promise<void> {
  await supabase.from('lobby_messages').insert({
    room_id: roomId,
    user_id: userId,
    content,
    username,
  });
}

export function subscribeToMessages(
  roomId: string,
  onMessage: (msg: LobbyMessage) => void,
): () => void {
  const channel = supabase
    .channel(`lobby-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'lobby_messages',
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        const row = payload.new as {
          id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        const { data: p } = await supabase
          .from('profiles')
          .select('username, level')
          .eq('id', row.user_id)
          .single();
        onMessage({
          id: row.id,
          userId: row.user_id,
          userName: p?.username ?? 'Runner',
          userLevel: p?.level ?? 1,
          message: row.content,
          timestamp: row.created_at,
        });
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
