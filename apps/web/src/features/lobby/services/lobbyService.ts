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
  { id: 'general', name: 'General', description: 'General running chat', color: '#D93518', emoji: '🏃' },
  { id: 'territory', name: 'Territory', description: 'Territory strategy & tips', color: '#1A6B40', emoji: '🗺️' },
  { id: 'training', name: 'Training', description: 'Training plans & advice', color: '#9E6800', emoji: '💪' },
  { id: 'events', name: 'Events', description: 'Upcoming races & events', color: '#0055C8', emoji: '🏅' },
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

export function subscribeToLobbyRoom(_roomId: string, _callback: (msg: LobbyMessage) => void): () => void {
  const channel = supabase
    .channel(`lobby:${_roomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobby_messages' }, (payload) => {
      _callback(payload.new as LobbyMessage);
    })
    .subscribe();

  return () => { channel.unsubscribe(); };
}
