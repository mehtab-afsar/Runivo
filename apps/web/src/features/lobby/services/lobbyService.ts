import { supabase } from '@shared/services/supabase';

export interface LobbyRoom {
  id: string;
  name: string;
  description: string;
  color: string;
  emoji: string;
  count?: number;
}

export interface LobbyMessage {
  id: string;
  user_id: string;
  userId?: string;
  username: string;
  userName?: string;
  userLevel?: number;
  content: string;
  message?: string;
  created_at: string;
  timestamp?: string;
}

export const LOBBY_ROOMS: LobbyRoom[] = [
  { id: 'global',   name: 'Global Runners',     description: 'Connect with runners worldwide',     color: '#1E4D8C', emoji: '🌍' },
  { id: 'training', name: 'Training Talk',       description: 'Plans, tips, and workout advice',    color: '#1A6B40', emoji: '🏃' },
  { id: 'races',    name: 'Race Reports',        description: 'Share your race results and stories', color: '#9E6800', emoji: '🏆' },
  { id: 'speed',    name: 'Speed & Intervals',   description: 'Track work, tempo runs, PRs',        color: '#D93518', emoji: '⚡' },
  { id: 'night',    name: 'Night Runners',       description: 'For those who run after dark',       color: '#6B2D8C', emoji: '🌙' },
];

export async function getLobbyRoomCounts(): Promise<Record<string, number>> {
  return {};
}

export async function fetchLobbyMessages(_roomId: string): Promise<LobbyMessage[]> {
  const { data } = await supabase
    .from('lobby_messages')
    .select('*')
    .eq('room_id', _roomId)
    .order('created_at', { ascending: true })
    .limit(50);
  return (data as LobbyMessage[]) || [];
}

export async function sendLobbyMessage(_roomId: string, _content: string): Promise<void> {
  // stub
}

export async function reactToMessage(messageId: string, emoji: string, userId: string): Promise<void> {
  await supabase.from('lobby_reactions').upsert(
    { message_id: messageId, user_id: userId, emoji },
    { onConflict: 'message_id,user_id' }
  );
}

export function subscribeToLobbyRoom(_roomId: string, _callback: (msg: LobbyMessage) => void): () => void {
  const channel = supabase
    .channel(`lobby:${_roomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_messages' }, (payload) => {
      _callback(payload.new as LobbyMessage);
    })
    .subscribe();

  return () => { channel.unsubscribe(); };
}
