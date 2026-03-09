import { supabase } from '@shared/services/supabase';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface ClubMessageRow {
  id: string;
  club_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { username: string } | null;
}

export interface ClubChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string; // ISO string
  type: 'message';
}

// ----------------------------------------------------------------
// Messages
// ----------------------------------------------------------------

/** Fetch the most recent messages for a club, oldest-first for rendering */
export async function fetchClubMessages(
  clubId: string,
  limit = 50
): Promise<ClubChatMessage[]> {
  const { data, error } = await supabase
    .from('club_messages')
    .select('id, club_id, user_id, content, created_at, profiles(username)')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Reverse so oldest message is first in the array
  return (data as unknown as ClubMessageRow[]).reverse().map(row => ({
    id: row.id,
    userId: row.user_id,
    userName: row.profiles?.username ?? 'Runner',
    message: row.content,
    timestamp: row.created_at,
    type: 'message' as const,
  }));
}

/** Send a message to the club chat */
export async function sendClubMessage(
  clubId: string,
  content: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('club_messages')
    .insert({ club_id: clubId, user_id: user.id, content });

  if (error) throw error;
}

/**
 * Subscribe to new messages in a club chat via Supabase Realtime.
 * Returns an unsubscribe function — call it when leaving the chat.
 */
export function subscribeToClubChat(
  clubId: string,
  onMessage: (msg: ClubChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`club-chat:${clubId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'club_messages',
        filter: `club_id=eq.${clubId}`,
      },
      async (payload) => {
        const row = payload.new as {
          id: string;
          club_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };

        // Fetch the sender's username (not included in realtime payload)
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', row.user_id)
          .single();

        onMessage({
          id: row.id,
          userId: row.user_id,
          userName: profile?.username ?? 'Runner',
          message: row.content,
          timestamp: row.created_at,
          type: 'message',
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ----------------------------------------------------------------
// Join Requests
// ----------------------------------------------------------------

/** Submit a join request for invite/request-only clubs */
export async function submitJoinRequest(
  clubId: string,
  _message?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('club_join_requests')
    .insert({
      club_id: clubId,
      user_id: user.id,
      // Store message in status field isn't ideal — a real impl would add a
      // message column via migration, but we keep it minimal here
    });

  // Ignore "already requested" duplicate key errors gracefully
  if (error && !error.message.includes('duplicate')) throw error;
}

/** Join an open club directly (no approval needed) */
export async function joinClub(clubId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error: memberError } = await supabase
    .from('club_members')
    .insert({ club_id: clubId, user_id: user.id, role: 'member' });

  if (memberError && !memberError.message.includes('duplicate')) throw memberError;

  // Increment member count — fallback to direct update if RPC doesn't exist
  try {
    await supabase.rpc('increment_club_member_count', { p_club_id: clubId });
  } catch {
    const { data: club } = await supabase
      .from('clubs')
      .select('member_count')
      .eq('id', clubId)
      .single();
    if (club) {
      await supabase
        .from('clubs')
        .update({ member_count: (club.member_count ?? 0) + 1 })
        .eq('id', clubId);
    }
  }
}

// ----------------------------------------------------------------
// Leave Club
// ----------------------------------------------------------------

/** Leave a club — removes membership and decrements member count */
export async function leaveClub(clubId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.id);

  if (error) throw error;

  // Decrement member count (floor at 0)
  const { data: club } = await supabase
    .from('clubs')
    .select('member_count')
    .eq('id', clubId)
    .single();

  if (club && club.member_count > 0) {
    await supabase
      .from('clubs')
      .update({ member_count: club.member_count - 1 })
      .eq('id', clubId);
  }
}
