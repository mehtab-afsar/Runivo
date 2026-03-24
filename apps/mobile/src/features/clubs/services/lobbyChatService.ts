import { supabase } from '@shared/services/supabase';

export interface MessageReaction {
  emoji: string;
  count: number;
  hasMe: boolean;
}

export interface LobbyMessage {
  id: string;
  userId: string;
  userName: string;
  userLevel: number;
  message: string;
  timestamp: string;
  reactions?: MessageReaction[];
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

export async function reactToMessage(
  messageId: string,
  emoji: string,
  userId: string,
): Promise<void> {
  // Try upsert — silently fails if table doesn't exist yet
  try {
    const { data: existing } = await supabase
      .from('lobby_message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      await supabase.from('lobby_message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji);
    } else {
      await supabase.from('lobby_message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
    }
  } catch { /* table may not exist — ignore */ }
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
