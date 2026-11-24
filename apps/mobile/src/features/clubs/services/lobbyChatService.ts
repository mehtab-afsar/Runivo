import { supabase } from '@shared/services/supabase';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';

export interface LobbyMessage {
  id: string;
  userId: string;
  userName: string;
  userLevel: number;
  /** Profile photo, when the runner set one. */
  userAvatarUrl?: string | null;
  message: string;
  timestamp: string;
}

// lobby_messages.lobby_id is a UUID FK to lobbies(id) — there is no room_id column
// and no username column (joined from profiles instead). See the migration seeding
// the 5 public discovery rooms this screen references by id.
export async function fetchMessages(lobbyId: string): Promise<LobbyMessage[]> {
  const { data, error } = await supabase
    .from('lobby_messages')
    .select('id, user_id, content, created_at')
    .eq('lobby_id', lobbyId)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) throw error;

  const rows = data ?? [];
  const profiles = await fetchPublicProfiles(rows.map((r: any) => r.user_id as string));

  return rows.reverse().map((row: any) => {
    const p = profiles.get(row.user_id as string);
    return {
      id: row.id,
      userId: row.user_id,
      userName: p?.username ?? 'Runner',
      userLevel: p?.level ?? 1,
      userAvatarUrl: p?.avatar_url ?? null,
      message: row.content,
      timestamp: row.created_at,
    };
  });
}

export async function sendMessage(
  lobbyId: string,
  userId: string,
  content: string,
): Promise<void> {
  const { error } = await supabase.from('lobby_messages').insert({
    lobby_id: lobbyId,
    user_id: userId,
    content,
  });
  if (error) throw error;
}

export function subscribeToMessages(
  lobbyId: string,
  onMessage: (msg: LobbyMessage) => void,
): () => void {
  const channel = supabase
    .channel(`lobby-${lobbyId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'lobby_messages',
        filter: `lobby_id=eq.${lobbyId}`,
      },
      async (payload) => {
        const row = payload.new as {
          id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        const { data: p } = await supabase
          .from('profiles_public')
          .select('username, level, avatar_url')
          .eq('id', row.user_id)
          .single();
        onMessage({
          id: row.id,
          userId: row.user_id,
          userName: p?.username ?? 'Runner',
          userLevel: p?.level ?? 1,
          userAvatarUrl: (p?.avatar_url as string | null | undefined) ?? null,
          message: row.content,
          timestamp: row.created_at,
        });
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
