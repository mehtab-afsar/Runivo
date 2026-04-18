import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@shared/services/supabase';
import {
  fetchMessages,
  sendMessage as sendMessageService,
  subscribeToMessages,
} from '@features/clubs/services/lobbyChatService';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';

export function useLobbyChat(roomId: string) {
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMessages(roomId)
      .then((msgs) => setMessages(msgs))
      .catch(() => setError('Could not load messages. Check your connection.'))
      .finally(() => setLoading(false));

    const unsubscribe = subscribeToMessages(roomId, (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return unsubscribe;
  }, [roomId]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    setInputText('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      await sendMessageService(roomId, user.id, p?.username ?? 'Runner', text);
    } catch { /* offline */ }
    setSending(false);
  }, [inputText, sending, roomId]);

  return { messages, loading, error, inputText, setInputText, sending, sendMessage };
}
